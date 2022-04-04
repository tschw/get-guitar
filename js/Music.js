
const BasePitch = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

const Sharp = '\u{1d130}';

const NoteNameInOctave = [ 'C', 'C' + Sharp, 'D', 'D' + Sharp,
		'E', 'F', 'F' + Sharp, 'G', 'G' + Sharp, 'A', 'A' + Sharp, 'B' ];

export const noteNameInOctave = ( i ) => NoteNameInOctave[ i ];

export function numberToNoteName( i ) {

	return `${ NoteNameInOctave[ i % 12 ] }${ i / 12 | 0 }`
}

export function noteNameToNumber( s ) {

	let note = BasePitch[ s[ 0 ].toUpperCase() ];
	let octavePos = 1;
	switch ( s[ 1 ] ) {
		case '#': ++ note; ++ octavePos; break;
		case 'b': -- note; ++ octavePos; break;

		case '\ud834':
			switch ( s[ 2 ] ) {
				case '\udd30': ++ note; octavePos += 2; break;
				case '\udd2c': -- note; octavePos += 2; break;
			}
	}
	const octave = octavePos < s.length ?
			Number.parseInt( s.substring( octavePos ) ) : 0;
	return note + octave * 12;
}

export const Tonality = Object.freeze( {

	Natural: 0b101010110101,
	MinorHarmonic: 0b101100110101,
	MinorMelodic: 0b101101010101,
	Blues6: 0b001010011101,
} );

export function transpose( tonality, semitones ) {

	const nSemiDown = ( 12 - semitones % 12 ) % 12;
	const lowMask = ( 1 << nSemiDown ) - 1;

	return ( tonality & lowMask )
			<< ( 12 - nSemiDown ) | tonality >>> nSemiDown;
}

