
const basePitch = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

const sharp = '\u{1d130}';
export const noteNameInOctave = [ 'C', 'C' + sharp, 'D', 'D' + sharp,
		'E', 'F', 'F' + sharp, 'G', 'G' + sharp, 'A', 'A' + sharp, 'B' ];

export function numberToNoteName( i ) {

	return `${ noteNameInOctave[ i % 12 ] }${ i / 12 | 0 }`
}

export function noteNameToNumber( s ) {

	let note = basePitch[ s[ 0 ].toUpperCase() ];
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

export const naturalScale = 0b101010110101;

export function transpose( tonality, semitones ) {

	const nSemiDown = ( 12 - semitones % 12 ) % 12;
	const lowMask = ( 1 << nSemiDown ) - 1;

	return (tonality & lowMask) << (12 - nSemiDown) | tonality >>> nSemiDown;
}

