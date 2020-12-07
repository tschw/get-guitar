import { Fretboard } from './Fretboard.js'
import { Highlighting } from './Highlighting.js'
import { PianoKeyboard } from './PianoKeyboard.js'
import { noteNameToNumber } from './Music.js'

const tuning = [

	{ caption: 'Guitar - standard tuning' },
	{ caption: 'E', tuning: noteNameToNumber('E4') },
	{ caption: 'B', tuning: noteNameToNumber('B3') },
	{ caption: 'G', tuning: noteNameToNumber('G3') },
	{ caption: 'D', tuning: noteNameToNumber('D3') },
	{ caption: 'A', tuning: noteNameToNumber('A2') },
	{ caption: 'E', tuning: noteNameToNumber('E2') },

	{ caption: 'Ukulele - GCEA' },
	{ caption: 'A', tuning: noteNameToNumber('A4') },
	{ caption: 'E', tuning: noteNameToNumber('E4') },
	{ caption: 'C', tuning: noteNameToNumber('C4') },
	{ caption: 'G', tuning: noteNameToNumber('G4') },
];

const numberOfFrets = 16;
const numberOfPianoOctaves = 4;
const pianoFirstOctave = 2;

class App {

	constructor() {


		this.element = document.getElementById( 'canvas' );
		this.c2d = this.element.getContext( '2d' );

		const width = this.element.width;
		const height = this.element.height;

		const highlighting = new Highlighting();
		this.highlighting = highlighting;
		this.fretboard = new Fretboard( width, width / 3, tuning, numberOfFrets, highlighting );
		this.piano = new PianoKeyboard( width, width / 9, pianoFirstOctave, numberOfPianoOctaves, highlighting );
		this.pianoTransform = null;

		this.highlightedNote = null;

		window.requestAnimationFrame( () => this.paint() );
		this.element.addEventListener( 'mousemove', (e) => this.mouseMove(e) );
		this.element.addEventListener( 'mousedown', (e) => this.mouseDown(e) );
		this.element.addEventListener( 'mouseout', (e) => this.mouseOut(e) );
	}

	paint() {

		const note = this.highlightedNote;
		if ( note != null )
			this.highlighting.showSelectionHint( note );

		const c2d = this.c2d;
		this.fretboard.paint( c2d );

		c2d.save();
		c2d.translate( 0, this.element.width / 3 + 20 );
		this.pianoTransform = c2d.getTransform().invertSelf();
		this.piano.paint( c2d );
		c2d.restore();

		this.highlighting.attenuate();
		window.requestAnimationFrame( () => this.paint() );
	}

	_findNote( event ) {

		let note = this.fretboard.noteAtCoordinates( event.offsetX, event.offsetY );
		if ( note == null && this.pianoTransform != null ) {

			const p = transformedPoint( this.pianoTransform, event );
			note = this.piano.noteAtCoordinates( p.x, p.y );
		}
		return note;
	}

	mouseMove( event ) {

		this.highlightedNote = this._findNote( event );
	}

	mouseDown( event ) {

		let note = this._findNote( event );
		if ( note != null )
			this.highlighting.toggleSelection( note );
	}

	mouseOut( event ) {

		this.highlightedNote = null;
	}
}

function transformedPoint( t, evemt ) {
	return t.transformPoint( new DOMPoint( event.offsetX, event.offsetY ) );
}


const app = new App();
export { app }
