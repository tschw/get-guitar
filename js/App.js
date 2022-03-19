import { Fretboard } from './Fretboard.js'
import { Highlighting } from './Highlighting.js'
import { PianoKeyboard } from './PianoKeyboard.js'
import { Button } from './Button.js'
import { transpose, noteNameToNumber } from './Music.js'
import { animation } from './Animation.js'

const defaultTuning = 'Guitar - standard tuning: E2 A2 D3 G3 B3 E4 Ukulele - GCEA: G4 C4 E4 A4';

const numberOfFrets = 16;
const numberOfPianoWhiteKeys = 3 * 7;
const lowestPianoKey = noteNameToNumber( 'C2' );

const pianoUpperSpace = 12;

const buttonWidth = 32;
const buttonHeight = 24;
const buttonSpacing = buttonWidth + 16;
const buttonsHorizontalSpace = 12;
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
		this.fretboard = new Fretboard(
				width, height * 0.7, this.tuning, numberOfFrets, highlighting );

		this.piano = new PianoKeyboard(
				height * 0.7 + pianoUpperSpace,
				width, height * 0.3 - pianoUpperSpace,
				lowestPianoKey, numberOfPianoWhiteKeys, highlighting );

		const yButtons = buttonsUpperSpace;
		const xLastButton = width - buttonsHorizontalSpace - buttonWidth;

		this.buttonConf = new Button(
				xLastButton, yButtons, buttonWidth, buttonHeight, "\u2261" );

		this.buttonDown = new Button( xLastButton - buttonSpacing * 2,
				yButtons, buttonWidth, buttonHeight, "\u2228" );

		this.buttonUp = new Button( xLastButton - buttonSpacing,
				yButtons, buttonWidth, buttonHeight, "\u2227" );

		const yTopKeysButtons =
				this.element.height * 0.7 + pianoUpperSpace + buttonsUpperSpace;

		this.buttonKeysRight = new Button( xLastButton,
				yTopKeysButtons, buttonWidth, buttonHeight, "\u25bb" );

		this.buttonKeysLeft = new Button( buttonsHorizontalSpace,
				yTopKeysButtons, buttonWidth, buttonHeight, "\u25c5" );

		this.element.addEventListener( 'mousemove', (e) => this.mouseMove(e) );
		this.element.addEventListener( 'mousedown', (e) => this.mouseDown(e) );
		this.element.addEventListener( 'mouseout', (e) => this.unhighlight() );

		animation.render = () => this.paint();
		animation.unhighlight = () => this.unhighlight();

		animation.requestRefresh();
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

		const c2d = this.c2d;

		this.fretboard.paint( c2d );
		this.piano.paint( c2d );

		this.buttonUp.paint( c2d );
		this.buttonDown.paint( c2d );
		this.buttonConf.paint( c2d );

		this.buttonKeysLeft.paint( c2d );
		this.buttonKeysRight.paint( c2d );

		this.highlighting.attenuate();
	}

	#findNote( x, y ) {

		let note = this.fretboard.noteAtCoordinates( x, y );
		if ( note != null ) return note;
		note = this.piano.noteAtCoordinates( x, y );
		return note;
	}

	mouseMove( event ) {

		const x = event.offsetX;
		const y = event.offsetY;
		this.buttonUp.highlightIfContained( x, y );
		this.buttonDown.highlightIfContained( x, y );
		this.buttonConf.highlightIfContained( x, y );
		if ( this.buttonKeysLeft.highlightIfContained( x, y ) ||
				this.buttonKeysRight.highlightIfContained( x, y ) )

			this.highlighting.highlitNote = null;
		else
			this.highlighting.highlitNote = animation.ifStateChange(
					this.highlighting.highlitNote, this.#findNote( x, y ) );
	}

	mouseDown( event ) {

		const x = event.offsetX;
		const y = event.offsetY;

		const highlighting = this.highlighting;

		if ( this.buttonConf.isContained( x, y ) ) this.configure();

		else if ( this.buttonUp.isContained( x, y ) )

			highlighting.selection = transpose( highlighting.selection, 1 );

		else if ( this.buttonDown.isContained( x, y ) )

			highlighting.selection = transpose( highlighting.selection, -1 );

		else if ( this.buttonKeysLeft.isContained( x, y ) ) {

			if ( ! this.buttonKeysLeft.enabled ) return;
			this.#scrollKeysViewport( -1 );
		}

		else if ( this.buttonKeysRight.isContained( x, y ) ) {

			if ( ! this.buttonKeysRight.enabled ) return;
			this.#scrollKeysViewport( 1 );

		} else {

			const note = this.#findNote( x, y );
			if ( note == null ) return;

			highlighting.selection ^= 1 << note % 12;
		}

		animation.requestRefresh();
	}

	unhighlight() {

		this.buttonUp.highlit = false;
		this.buttonDown.highlit = false;
		this.buttonConf.highlit = false;
		this.buttonKeysLeft.highlit = false;
		this.buttonKeysRight.highlit = false;
		this.highlighting.highlitNote = null;

		animation.requestRefresh();
	}

	#scrollKeysViewport( direction ) {

		this.piano.scrollViewport( direction );
		this.buttonKeysLeft.enabled = this.piano.canScrollViewport( -1 );
		this.buttonKeysRight.enabled = this.piano.canScrollViewport( 1 );
	}
}

const app = new App();
export { app }
