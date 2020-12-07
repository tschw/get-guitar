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

const pianoUpperBorder = 16;

class App {

	constructor() {


		this.element = document.getElementById( 'canvas' );
		this.c2d = this.element.getContext( '2d' );

		const width = this.element.width;
		const height = this.element.height;

		const highlighting = new Highlighting();
		this.highlighting = highlighting;
		this.fretboard = new Fretboard( width, height * 0.75, tuning, numberOfFrets, highlighting );
		this.piano = new PianoKeyboard( width, height * 0.25 - pianoUpperBorder, pianoFirstOctave, numberOfPianoOctaves, highlighting );
		this.pianoTransform = null;
		this.animationFrame = null;

		this.element.addEventListener( 'mousemove', (e) => this.mouseMove(e) );
		this.element.addEventListener( 'mousedown', (e) => this.mouseDown(e) );
		this.element.addEventListener( 'mouseout', (e) => this.mouseOut(e) );

		this._requestRefresh();
	}

	paint() {

		this.animationFrame = null;

		const c2d = this.c2d;
		this.fretboard.paint( c2d );

		c2d.save();
		c2d.translate( 0, this.element.height * 0.75 + pianoUpperBorder );
		this.pianoTransform = c2d.getTransform().invertSelf();
		this.piano.paint( c2d );
		c2d.restore();

		if ( ! this.highlighting.attenuate() ) this._requestRefresh();
	}

	_requestRefresh() {

		if ( this.animationFrame == null )
			this.animationFrame =
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

		this.highlighting.highlightedNote = this._findNote( event );
		this._requestRefresh();
	}

	mouseOut( event ) {

		this.highlighting.highlightedNote = null;
		this._requestRefresh();
	}

	mouseDown( event ) {

		let note = this._findNote( event );
		if ( note != null ) {
			this.highlighting.toggleSelection( note );
			this._requestRefresh();
		}
	}
}

function transformedPoint( t, evemt ) {
	return t.transformPoint( new DOMPoint( event.offsetX, event.offsetY ) );
}


const app = new App();
export { app }
