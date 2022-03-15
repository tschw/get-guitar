
const basePitch = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

const noteNameInOctave = [
		'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B' ];

export function numberToNoteName( i ) {

	return `${ noteNameInOctave[ i % 12 ] }${ i / 12 | 0 }`
}

export function noteNameToNumber( s ) {

	let note = basePitch[ s[ 0 ].toUpperCase() ];
	let octave = s[ s.length - 1 ];
	switch ( s[ 1 ] ) {
		case '#': note += 1; break;
		case 'b': note -= 1; break;
	}
	return note + octave * 12
}

export const naturalScale = 0b101010110101;

export function transpose( tonality, semitones ) {

	const nSemiDown = ( 12 - semitones % 12 ) % 12;
	const lowMask = ( 1 << nSemiDown ) - 1;

	return (tonality & lowMask) << (12 - nSemiDown) | tonality >>> nSemiDown;
}

