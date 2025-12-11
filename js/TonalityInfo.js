
import { bitCount, initializedArray } from './Utility.js'

const id = new Int32Array( 4096 ),
		chromaticPosition = id => id >> 1 & 15,
		patternIndex = id => id >>> 5,
		viewIndex = id => id & 1,
		portability = '-ABCDEF';

export class TonalityInfo {

	pattern;
	view;

	position;

	constructor( bits ) {

		const i = id[ bits ];
		const p = pattern[ patternIndex( i ) ];
		this.pattern = p;
		const v = p.view[ viewIndex( i ) ];
		this.view = v;

		const pos = chromaticPosition( i );
		this.position = pos;

		const pi = v.fifths.islands;

		this.asString = `${ v.reverseBinaryString }@`
				+ `${ pos }${ p.positionSuffixString },`
				+ `${ v.modesOfCardinalityString },${ portability[ pi ] }`;

		Object.freeze( this );
	}

	toString() { return this.asString; }
};

const bit12 = 1 << 11,
		tmpArrayN = initializedArray( 12, i => new Array( i + 1 ) );

function rb12( bits ) {

	let l = 11;
	for ( let b = bit12; b != 1 && ( bits & b ) == 0; b >>>= 1, -- l )

		;

	const d = tmpArrayN[ l ];
	for ( let i = 0, b = 1; i <= l; ++ i, b += b )
		d[ i ] = bits & b ? '1' : '0';
	return d.join( '' );
}

const rol12 = bits => ( bits << 1 | bits >> 11 & 1 ) & 0xfff,
		asSignedTranspose = pos => pos >= 6 ? pos - 12 : pos,

		cOffset = [ 0, 1, 2, 8, 27, 70, 136 ],
		pattern = new Array( 180 ),

		bitLut = initializedArray( 13, i => 1 << i ),
		fifths = [ 0x001, 0x080, 0x004, 0x200, 0x010, 0x800,
				0x040, 0x002, 0x100, 0x008, 0x400, 0x020 ],

		statsAccDefault = {
			islands: 0,
			minAdjacency: 12, maxAdjacency: 0,
			minGapSize: 0, maxGapSize: 0
		};


for ( let i = 0; i < 1366; ++ i ) {

	if ( id[ i ] != 0 ) continue;
	const b = bitCount( i );

	// Subtle: in only two cases, the heptatonic has a lower integer value
	// than the corresponding pentatonic, which we prefer for symmetry and
	// simplicity (heptatonic tonalities can be explained by their inverse).

	if ( b > 6 ) continue;

	let transposeToInverse = 0, inv = i ^ 0xfff;
	for ( let k = 1, p = inv; k < 12; ++ k ) {

		p = rol12( p );
		if ( p < inv ) inv = p, transposeToInverse = k;
	}
	transposeToInverse = asSignedTranspose( transposeToInverse );

	const view = [ {
				bits: i,
				cardinality: b,
				transposeToInverse,
				reverseBinaryString: rb12( i ),
				distinctModes: b, // <--v-v- tentative, set in code below
				fifths: { }
			}, {
				bits: inv,
				cardinality: 12 - b,
				transposeToInverse: - transposeToInverse,
				reverseBinaryString: rb12( inv ),
				distinctModes: 12 - b, // <--v-v- tentative, set in code below
				fifths: { }
			} ].map( stats => (
					Object.assign( stats.fifths, statsAccDefault ),
					Object.assign( stats, statsAccDefault ) ) );

	const j = cOffset[ b ] ++;

	const pat = pattern[ j ] = {

				patternIndex: j, view,
				positionSuffixString: 'TBD', // <--v-v- detailed below
				distinctChromaticPositions: 12
			},

			encPatternIndex = j << 5;

	for ( let k = 0, p = i, q = inv; k < 12;
			++ k, p = rol12( p ), q = rol12( q ) ) {

		if ( k > 0 && p == i ) {

			pat.distinctChromaticPositions = k;

			const m = ( 1 << k ) - 1;
			pat.view[ 0 ].distinctModes = bitCount( p & m );
			pat.view[ 1 ].distinctModes = bitCount( q & m );
			break;
		}

		const encShiftedPattern = encPatternIndex | k + k;

		// Subtle: for only eight hexatonic patterns, the inverse can be
		// explained solely by shifting and the explanations compete here.
		// Let's prefer the explanation closer to the canonical form:

		if ( id[ p ] == 0 || Math.abs( asSignedTranspose( k ) ) <
				Math.abs( asSignedTranspose( chromaticPosition( id[ p ] ) ) ) )

			id[ p ] = encShiftedPattern;


		if ( id[ q ] == 0 || Math.abs( asSignedTranspose( k ) ) <
				Math.abs( asSignedTranspose( chromaticPosition( id[ q ] ) ) ) )

			id[ q ] = encShiftedPattern | 1;
	}

	for ( const vu of view )
			vu.modesOfCardinalityString =
					`${ vu.distinctModes }:${ vu.cardinality }`;

	pat.positionSuffixString = `:${ pat.distinctChromaticPositions }`;

	function accMinMaxAdjacency( vu, val ) {

		if ( val < vu.minAdjacency ) vu.minAdjacency = val;
		if ( val > vu.maxAdjacency ) vu.maxAdjacency = val;
	}

	function addPatternStats( vu, lut, pat ) {

		let edges = 0, prev = lut[ lut.length - 1 ];
		let prevPresent = ( pat & prev ) != 0;

		for ( const note of lut ) {

			const notePresent = ( pat & note ) != 0;
			if ( prevPresent != notePresent ) ++ edges;

			prev = note;
			prevPresent = notePresent;
		}

		vu.islands = edges / 2;

		let prevEdgePos = -1, firstEdgePos = -1, firstEdgeUp = false;

		for ( let k = 0, pos = 0; k < edges && pos < 12; ++ pos ) {

			const note = lut[ pos ];
			const notePresent = ( pat & note ) != 0;
			if ( prevPresent != notePresent ) {

				if ( prevEdgePos != -1 ) {

					if ( ! notePresent )
						accMinMaxAdjacency( vu, pos - prevEdgePos );

				} else {

					firstEdgePos = pos;
					firstEdgeUp = notePresent;
				}
				prevEdgePos = pos;
				++ k;
			}
			prev = note;
			prevPresent = notePresent;
		}
		if ( ! firstEdgeUp )

			accMinMaxAdjacency(
					vu, ( firstEdgePos + 12 - prevEdgePos ) % 12 );
	}

	function completePatternStats( getVU ) {

		for ( let l = 0; l < 2; ++ l ) {
			const vu = getVU( l ), other = getVU( l ^ 1 );
			vu.minGapSize = vu.maxAdjacency > 1 ? 0 : other.minAdjacency;
			vu.maxGapSize = other.maxAdjacency;
			Object.freeze( vu );
		}
	}

	addPatternStats( view[ 0 ], bitLut, i );
	addPatternStats( view[ 1 ], bitLut, inv );
	completePatternStats( i => view[ i ] );
	addPatternStats( view[ 0 ].fifths, fifths, i );
	addPatternStats( view[ 1 ].fifths, fifths, inv );
	completePatternStats( i => view[ i ].fifths );
	Object.freeze( pat );
}


export const tonalityRegistry = Object.freeze(
		initializedArray( 4096, bits => new TonalityInfo( bits ) ) );

export const tonalityByString = new Object(),
		tonalityByPrefix = new Object();

for ( let i = 0; i < 4096; ++ i ) {

	const obj = tonalityRegistry[ i ];
	const s = obj.asString;
	tonalityByString[ s ] = i;

	const p = s.slice( 0, s.indexOf( ':' ) );
	tonalityByPrefix[ p ] = i;
}
Object.freeze( tonalityByString );
Object.freeze( tonalityByPrefix );

