import { Fretboard } from './Fretboard.js'
import { Highlighting } from './Highlighting.js'
import { PianoKeyboard } from './PianoKeyboard.js'
import { Button } from './Button.js'
import { transpose } from './Music.js'

const defaultTuning = 'Guitar - standard tuning: E2 A2 D3 G3 B3 E4 Ukulele - GCEA: G4 C4 E4 A4';

const numberOfFrets = 16;
const numberOfPianoOctaves = 4;
const pianoFirstOctave = 2;

const pianoUpperSpace = 12;

const buttonWidth = 32;
const buttonHeight = 24;
const buttonSpacing = buttonWidth + 16;
const buttonsRightSpace = 12;
const buttonsUpperSpace = 6;

class App {

	constructor() {


		this.element = document.getElementById( 'canvas' );
		this.c2d = this.element.getContext( '2d' );

		const width = this.element.width;
		const height = this.element.height;

		const highlighting = new Highlighting();
		this.highlighting = highlighting;
		this.tuning = defaultTuning
		this.fretboard = new Fretboard( width, height * 0.7, this.tuning, numberOfFrets, highlighting );
		this.piano = new PianoKeyboard( width, height * 0.3 - pianoUpperSpace, pianoFirstOctave * 12, numberOfPianoOctaves * 7, highlighting );
		this.pianoTransform = null;
		this.animationFrame = null;

		const yButtons = buttonsUpperSpace;
		const xLastButton = width - buttonsRightSpace - buttonWidth;

		this.buttonConf = new Button(
				xLastButton, yButtons, buttonWidth, buttonHeight, "\u2261" );

		this.buttonDown = new Button( xLastButton - buttonSpacing,
				yButtons, buttonWidth, buttonHeight, "\u2228" );

		this.buttonUp = new Button( xLastButton - buttonSpacing * 2,
				yButtons, buttonWidth, buttonHeight, "\u2227" );

		this.element.addEventListener( 'mousemove', (e) => this.mouseMove(e) );
		this.element.addEventListener( 'mousedown', (e) => this.mouseDown(e) );
		this.element.addEventListener( 'mouseout', (e) => this.mouseOut(e) );

		this.#requestRefresh();
	}

	configure() {

		let tuning = prompt("Edit tuning:", this.tuning);
		if ( tuning == null ) return false; // cancel
		if ( tuning == "" ) tuning = defaultTuning;

		const stringSlots = Fretboard.parseStringSlots( tuning );
		if ( ! stringSlots ) {
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

		this.buttonUp.paint( c2d );
		this.buttonDown.paint( c2d );
		this.buttonConf.paint( c2d );

		c2d.save();
		c2d.translate( 0, this.element.height * 0.7 + pianoUpperSpace );
		this.pianoTransform = c2d.getTransform().invertSelf();
		this.piano.paint( c2d );
		c2d.restore();

		if ( ! ( this.highlighting.attenuate()
				& this.buttonUp.attenuate()
				& this.buttonDown.attenuate()
				& this.buttonConf.attenuate() ) )

			this.#requestRefresh();
	}

	#requestRefresh() {

		if ( this.animationFrame == null )
			this.animationFrame =
				window.requestAnimationFrame( () => this.paint() );
	}

	#findNote( x, y ) {

		let note = this.fretboard.noteAtCoordinates( x, y );
		if ( note == null && this.pianoTransform != null ) {

			const p = transformedPoint( this.pianoTransform, x, y );
			note = this.piano.noteAtCoordinates( p.x, p.y );
		}
		return note;
	}

	mouseMove( event ) {

		const x = event.offsetX;
		const y = event.offsetY;
		this.buttonUp.highlightIfContained( x, y );
		this.buttonDown.highlightIfContained( x, y );
		this.buttonConf.highlightIfContained( x, y );

		this.highlighting.highlitNote = this.#findNote( x, y );
		this.#requestRefresh();
	}

	mouseOut( event ) {

		this.buttonUp.highlit = false;
		this.buttonDown.highlit = false;
		this.buttonConf.highlit = false;

		this.highlighting.highlitNote = null;
		this.#requestRefresh();
	}

	mouseDown( event ) {

		const x = event.offsetX;
		const y = event.offsetY;

		const highlighting = this.highlighting;

		if ( this.buttonConf.isContained( x, y ) )
			this.configure();

		else if ( this.buttonUp.isContained( x, y ) )
			highlighting.selection = transpose( highlighting.selection, 1 );

		else if ( this.buttonDown.isContained( x, y ) )
			highlighting.selection = transpose( highlighting.selection, -1 );

		const note = this.#findNote( x, y );

		if ( note != null )
			highlighting.selection ^= 1 << note % 12;

		this.#requestRefresh();
	}
}

function transformedPoint( t, x, y ) {
	return t.transformPoint( new DOMPoint( x, y ) );
}


const app = new App();
export { app }
