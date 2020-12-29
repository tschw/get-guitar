import { Fretboard } from './Fretboard.js'
import { Highlighting } from './Highlighting.js'
import { PianoKeyboard } from './PianoKeyboard.js'

const defaultTuning = 'Guitar - standard tuning: E2 A2 D3 G3 B3 E4 Ukulele - GCEA: G4 C4 E4 A4';

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
		this.tuning = defaultTuning
		this.fretboard = new Fretboard( width, height * 0.75, this.tuning, numberOfFrets, highlighting );
		this.piano = new PianoKeyboard( width, height * 0.25 - pianoUpperBorder, pianoFirstOctave, numberOfPianoOctaves, highlighting );
		this.pianoTransform = null;
		this.animationFrame = null;

		this.element.addEventListener( 'mousemove', (e) => this.mouseMove(e) );
		this.element.addEventListener( 'mousedown', (e) => this.mouseDown(e) );
		this.element.addEventListener( 'mouseout', (e) => this.mouseOut(e) );

		this._requestRefresh();
	}

	configure() {

		let tuning = prompt("Edit tuning:", this.tuning);
		if (tuning == null) return false; // cancel
		if (tuning == "") tuning = defaultTuning;

		const stringSlots = Fretboard.parseStringSlots( tuning );
		if (! stringSlots) {
			alert("Something in your tuning did not quite add up. ");
			return false;
		}

		this.tuning = tuning;
		this.fretboard.stringSlots = stringSlots
		return true;
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
		} else {
			this.configure();
		}
	}
}

function transformedPoint( t, evemt ) {
	return t.transformPoint( new DOMPoint( event.offsetX, event.offsetY ) );
}


const app = new App();
export { app }
