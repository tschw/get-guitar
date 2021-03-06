

const name = [ 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B' ];
const basePitch = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

function numberToNoteName(i) {

	return "${ name[ i % 12 ] }${ i / 12 }"
}

function noteNameToNumber(s) {

	let note = basePitch[ s[0].toUpperCase() ];
	let octave = s[ s.length - 1 ];
	switch ( s[1] ) {
		case '#': note += 1; break;
		case 'b': note -= 1; break;
	}
	return note + octave * 12
}

export { numberToNoteName, noteNameToNumber };
