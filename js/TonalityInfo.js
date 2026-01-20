
import { bitCount, initializedArray } from './Utility.js'

let initialized = false;

const tonalities = new Array( 4096 ),
		structures = new Array( 352 ),
		StructOffs = Object.freeze( [
				0, 1, 2, 8, 27, 70, 136, 216, 282, 325, 344, 350, 351 ] ),
		HexatonicComplementBlacklist = [ 0, 8, 17, 32, 33, 39, 42, 43 ];

export class StaticInfo {

	constructor() {

		if ( initialized )
			throw Error( "Instances of this class have static lifetime." );
	}
}

export class PackingStats extends StaticInfo {

	bits;
	gaps;
	minAdjacency = 12;
	maxAdjacency = 0;
	minGapSize = 12;
	maxGapSize = 0;

	constructor( bits ) {

		super();

		this.bits = bits;

		let edges = 0, prev = 0x800;
		let prevPresent = ( bits & prev ) != 0;
		for ( let note = 1; note <= 0x800; note <<= 1 ) {

			const notePresent = ( bits & note ) != 0;
			if ( prevPresent != notePresent ) ++ edges;

			prev = note;
			prevPresent = notePresent;
		}
		this.gaps = edges / 2;

		let prevEdgePos = -1, firstEdgePos = -1, firstEdgeUp = false;
		for ( let k = 0, pos = 0; k < edges && pos < 12; ++ pos ) {

			const note = 1 << pos;
			const notePresent = ( bits & note ) != 0;
			if ( prevPresent != notePresent ) {

				if ( prevEdgePos != -1 ) {

					if ( ! notePresent )
						this.#accMinMaxAdjacency( pos - prevEdgePos );

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
			this.#accMinMaxAdjacency( ( firstEdgePos + 12 - prevEdgePos ) % 12 );
	}

	#accMinMaxAdjacency( val ) {

		if ( val < this.minAdjacency ) this.minAdjacency = val;
		if ( val > this.maxAdjacency ) this.maxAdjacency = val;
	}
}

function completePackingStats( s, complement ) {

	s.minGapSize = s.maxAdjacency > 1 ? 0 : complement.minAdjacency;
	s.maxGapSize = complement.maxAdjacency;
	Object.freeze( s );
}

const FifthsLut = [ 0x001, 0x080, 0x004, 0x200, 0x010,
		0x800, 0x040, 0x002, 0x100, 0x008, 0x400, 0x020 ];

export class HarmonicStructure extends PackingStats  {

	constructor( index, bits, popc, localIndex, positions, tpToInv ) {

		super( bits );

		this.index = index;
		structures[ index ] = this;

		this.cardinality = popc;
		this.indexInCardinality = localIndex;
		this.asString = `${ popc };${ localIndex }`;
		this.transposeToInverse = tpToInv;
		this.reverseBinaryString = rb12( bits );
		this.distinctChromaticPositions = positions;

		const m = ( 1 << positions ) - 1;
		this.distinctModes = bitCount( bits & m );

		let fifthsBits = 0, bit = 1;
		for ( const note of FifthsLut ) {

			const notePresent = ( bits & note ) != 0;
			if ( notePresent)
				fifthsBits |= bit;
			bit += bit;
		}
		this.fifths = new PackingStats( fifthsBits );
	}

	toString() { return this.asString; }
}


const Portability = '-ABCDEF';

export class TonalityInfo extends StaticInfo {

	constructor( index, structure, position ) {

		super();

		this.index = index;
		this.structure = structure;
		this.position = position;

		const s = structure;
		const portability = Portability[ s.fifths.gaps ];
		this.asString = `${ s.asString }@`
				+ `${ position }:${ s.distinctChromaticPositions },`
				+ `rb${ s.reverseBinaryString },`
				+ `${ s.distinctModes }:${ s.cardinality },${ portability }`;

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
		writeOffs = StructOffs.slice();

for ( let bits = 0; bits < 1366; ++ bits ) {

	if ( tonalities[ bits ] ) continue;
	const bc = bitCount( bits );

	// Subtle: in only two cases, the heptatonic has a lower integer value
	// than its complmenting pentatonic, which we prefer for symmetry and
	// simplicity (heptatonics are explained by their complement).

	if ( bc > 6 ) continue;

	let positions = 12;
	for ( let k = 1, p = rol12( bits ); k < 12; ++ k, p = rol12( p ) )

		if ( p == bits ) {
			positions = k;
			break;
		}

	const bcInv = 12 - bc;
	let tpToInv = 0, inv = bits ^ 0xfff;
	for ( let k = 1, p = inv; k < 12; ++ k ) {

		p = rol12( p );
		if ( p < inv ) inv = p, tpToInv = k;
	}
	tpToInv = asSignedTranspose( tpToInv );

	const structIndex = writeOffs[ bc ] ++;
	const localIndex = structIndex - StructOffs[ bc ];

	const s0 = new HarmonicStructure(
			structIndex, bits, bc, localIndex, positions, tpToInv );

	let s1 = null;
	if ( bc != 6 )
		s1 = new HarmonicStructure( writeOffs[ bcInv ] ++,
				inv, bcInv, localIndex, positions, - tpToInv );
	else {
		const i = localIndex;
		const bi = HexatonicComplementBlacklist.findLastIndex( x => ( i >= x ) );
		if ( bi == -1 || i > HexatonicComplementBlacklist[ bi ] ) {

			const skipped = 1 + bi;
			const offset = 44 - skipped;
			s1 = new HarmonicStructure( structIndex + offset,
					inv, bcInv, i + offset, positions, - tpToInv );
		}
	}

	for ( let k = 0, p = bits, q = inv; k < positions;
			++ k, p = rol12( p ), q = rol12( q ) ) {

		if ( ! tonalities[ p ] )
			tonalities[ p ] = new TonalityInfo( p, s0, k );

		if ( ! tonalities[ q ] )
			tonalities[ q ] = new TonalityInfo( q, s1, k );
	}

	if ( s1 != null ) {
		completePackingStats( s0, s1 );
		completePackingStats( s1, s0 );
		completePackingStats( s0.fifths, s1.fifths );
		completePackingStats( s1.fifths, s0.fifths );
	} else {
		completePackingStats( s0, s0 );
		completePackingStats( s0.fifths, s0.fifths );
	}
}

export const TonalityInfoByIndex = Object.freeze( tonalities );
export const HarmonicStructureByIndex = Object.freeze( structures );
export const HarmonicStructureIndexOffsetByCardinality = StructOffs;

const tnltyByString = { },
		tnltyByPrefix = { },
		structByString = { },
		tnltiesOfStruct = new Array( 352 * 12 );

for ( let i = 0; i < 4096; ++ i ) {

	const inf = tonalities[ i ];
	const s = inf.asString;
	tnltyByString[ s ] = inf;

	const p = s.slice( 0, s.indexOf( ':' ) );
	tnltyByPrefix[ p ] = inf;
}
for ( let i = 0; i < 352; ++ i ) {

	const s = structures[ i ];
	structByString[ s.asString ] = s;

	for ( let j = 0, bits = s.bits; j < 12; ++ j, bits = rol12( bits ) )

		tnltiesOfStruct[ i * 12 + j ] = tonalities[ bits ];
}

export const TonalityInfoByString = Object.freeze( tnltyByString );
export const TonalityInfoByPrefix = Object.freeze( tnltyByPrefix );
export const HarmonicStructureByString = Object.freeze( structByString );
export const TonalityInfosOfStructures = Object.freeze( tnltiesOfStruct );

initialized = true;
