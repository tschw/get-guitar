
import { bitCount, initializedArray } from './Utility.js'

let initialized = false;

export class StaticInfo {

	constructor() {

		if ( initialized )
			throw Error( "Instances of this class have static lifetime." );
	}
}

export class PackingStats extends StaticInfo {

	islands = 0;
	minAdjacency = 12;
	maxAdjacency = 12;
	minGapSize = 0;
	maxGapSize = 0;
}

export class HarmonicStructure extends PackingStats  {

	constructor( bits, popc, tpToInv ) {

		super();

		this.bits = bits;
		this.cardinality = popc;
		this.transposeToInverse = tpToInv;
		this.reverseBinaryString = rb12( bits );
		this.distinctModes = popc;
		this.fifths = new PackingStats();
	}
}

export class Pattern extends StaticInfo {

	constructor( index, bits, popc, inv, tpToInv ) {

		super();

		this.index = index;
		this.view = [
				new HarmonicStructure( bits, popc, tpToInv ),
				new HarmonicStructure( inv, 12 - popc, - tpToInv ) ];
	}

	positionSuffixString = '';
	distinctChromaticPositions = 12;
}

const id = new Int32Array( 4096 ),
		chromaticPosition = id => id >> 1 & 15,
		patternIndex = id => id >>> 5,
		viewIndex = id => id & 1,
		portability = '-ABCDEF';

export class TonalityInfo extends StaticInfo {

	constructor( bits ) {

		super();

		const i = id[ bits ];

		const p = pattern[ patternIndex( i ) ];
		const v = p.view[ viewIndex( i ) ],
				pos = chromaticPosition( i ),
				pi = v.fifths.islands;

		this.pattern = p;
		this.view = v;
		this.position = pos;

		this.asString = `${ v.cardinality };`
				+ `${ p.index - cOffset[ p.view[ 0 ].cardinality ] }@`
				+ `${ pos }${ p.positionSuffixString },`
				+ `rb${ v.reverseBinaryString },`
				+ `${ v.modesOfCardinalityString },${ portability[ pi ] }`;

		Object.freeze( this );
	}

	toString() { return this.asString; }
};

const Bit12 = 1 << 11,
		tmpArrayN = initializedArray( 12, i => new Array( i + 1 ) );

function rb12( bits ) {

	let l = 11;
	for ( let b = Bit12; b != 1 && ( bits & b ) == 0; b >>>= 1, -- l )

		;

	const d = tmpArrayN[ l ];
	for ( let i = 0, b = 1; i <= l; ++ i, b += b )
		d[ i ] = bits & b ? '1' : '0';
	return d.join( '' );
}

const rol12 = bits => ( bits << 1 | bits >> 11 & 1 ) & 0xfff,
		asSignedTranspose = pos => pos >= 6 ? pos - 12 : pos,

		cOffset = [ 0, 1, 2, 8, 27, 70, 136, 0 ],
		pattern = new Array( 180 ),

		bitLut = initializedArray( 13, i => 1 << i ),
		fifths = [ 0x001, 0x080, 0x004, 0x200, 0x010, 0x800,
				0x040, 0x002, 0x100, 0x008, 0x400, 0x020 ];

for ( let i = 0; i < 1366; ++ i ) {

	if ( id[ i ] != 0 ) continue;
	const b = bitCount( i );

	// Subtle: in only two cases, the heptatonic has a lower integer value
	// than the corresponding pentatonic, which we prefer for symmetry and
	// simplicity (heptatonic tonalities can be explained by their inverse).

	if ( b > 6 ) continue;

	let tpToInv = 0, inv = i ^ 0xfff;
	for ( let k = 1, p = inv; k < 12; ++ k ) {

		p = rol12( p );
		if ( p < inv ) inv = p, tpToInv = k;
	}
	tpToInv = asSignedTranspose( tpToInv );

	const j = cOffset[ b ] ++;
	const pat = pattern[ j ] = new Pattern( j, i, b, inv, tpToInv );
	const view = pat.view, encPatternIndex = j << 5;

	for ( let k = 0, p = i, q = inv; k < 12;
			++ k, p = rol12( p ), q = rol12( q ) ) {

		if ( k > 0 && p == i ) {

			pat.distinctChromaticPositions = k;

			const m = ( 1 << k ) - 1;
			view[ 0 ].distinctModes = bitCount( p & m );
			view[ 1 ].distinctModes = bitCount( q & m );
			break;
		}

		// Subtle: for only eight hexatonic patterns, the inverse can be
		// explained solely by shifting and the explanations compete, so
		// the order in which these assignments are executed matters and
		// happens to encode the shortest absolute distance between both
		// mutually inverse views:

		const encShiftedPatternIndex = encPatternIndex | k + k;

		if ( id[ p ] == 0 )
			id[ p ] = encShiftedPatternIndex;

		if ( id[ q ] == 0 )
			id[ q ] = encShiftedPatternIndex | 1;
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

cOffset.copyWithin( 1, 0, cOffset.length );
cOffset[ 0 ] = 0;

export const TonalityRegistry = Object.freeze(
		initializedArray( 4096, bits => new TonalityInfo( bits ) ) );

export const TonalityByString = new Object(),
		TonalityByPrefix = new Object();


for ( let i = 0, b = 0; i < 4096; ++ i ) {

	const obj = TonalityRegistry[ i ];
	const s = obj.asString;
	TonalityByString[ s ] = i;

	const p = s.slice( 0, s.indexOf( ':' ) );
	TonalityByPrefix[ p ] = i;
}

Object.freeze( TonalityByString );
Object.freeze( TonalityByPrefix );

initialized = true;
