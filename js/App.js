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
		this.pointerPosition = { x: 0, y: 0 };

		const width = this.element.width;
		const height = this.element.height;

		const highlighting = new Highlighting();
		this.highlighting = highlighting;

		this.tuning = defaultTuning
		this.frets = new Fretboard(
				width, height * 0.7, this.tuning, numberOfFrets, highlighting );

		this.keys = new PianoKeyboard(
				height * 0.7 + pianoUpperSpace,
				width, height * 0.3 - pianoUpperSpace,
				lowestPianoKey, numberOfPianoWhiteKeys, highlighting );

		const yFretsButtons = buttonsUpperSpace;
		const yKeysButtons =
				this.element.height * 0.7 +
					pianoUpperSpace + buttonsUpperSpace;

		const xFirstButton = buttonsHorizontalSpace;
		const xLastButton = width - buttonsHorizontalSpace - buttonWidth;

		this.buttons = [

			{
				widget: 
					new Button( xLastButton,
							yFretsButtons, buttonWidth, buttonHeight, "\u2261" ),

				action: () => this.configure()

			}, {
				widget:
					new Button( xLastButton - buttonSpacing, yFretsButtons,
							buttonWidth, buttonHeight, "\ud834\udd30" ),

				action: () => this.transpose(1)

			}, {
				widget:
					new Button( xLastButton - buttonSpacing * 2, yFretsButtons,
							buttonWidth, buttonHeight, "\ud834\udd2c" ),

				action: () => this.transpose(-1)

			}, {
				widget:
					this.buttonKeysLeft = new Button( xFirstButton,
							yKeysButtons, buttonWidth, buttonHeight, "\u25c5" ),

				action: () => this.scrollKeysViewport(-1)

			}, {
				widget:
					this.buttonKeysRight = new Button( xLastButton,
							yKeysButtons, buttonWidth, buttonHeight, "\u25bb" ),

				action: () => this.scrollKeysViewport(1)
			}
		];


		this.element.addEventListener( 'mousemove', (e) => this.mouseMove(e) );
		this.element.addEventListener( 'mousedown', (e) => this.mouseDown(e) );
		this.element.addEventListener( 'mouseout', (e) => this.unhighlight() );

		animation.render = () => this.paint();
		animation.unhighlight = () => this.unhighlight();

		animation.requestRefresh();
	}

	paint() {

		const c2d = this.c2d;

		this.frets.paint( c2d );
		this.keys.paint( c2d );

		for ( let button of this.buttons ) button.widget.paint( c2d );

		this.highlighting.attenuate();
	}

	#getPointerCoordinates( event ) {

		const p = this.pointerPosition, e = this.element,
				b = this.element.getBoundingClientRect();

		p.x = event.offsetX * e.width / b.width;
		p.y = event.offsetY * e.height / b.height;

		return p;
	}

	mouseMove( event ) {

		const highlighting = this.highlighting,
				p = this.#getPointerCoordinates( event );

		for ( let button of this.buttons )
			if ( button.widget.highlightIfContained( p.x, p.y ) ) {

				highlighting.highlitNote =
						animation.ifStateChange(
							highlighting.highlitNote, null );
				return;
			}

		highlighting.highlitNote = animation.ifStateChange(
					highlighting.highlitNote, this.#findNote( p.x, p.y ) );
	}

	mouseDown( event ) {

		const highlighting = this.highlighting,
				p = this.#getPointerCoordinates( event );

		for ( let button of this.buttons )
			if ( button.widget.isContained( p.x, p.y ) ) {

				if ( button.widget.enabled ) {

					button.action();
					animation.requestRefresh();
				}
				return;
			}

		const note = this.#findNote( p.x, p.y );

		if ( note != null ) {

			highlighting.selection ^= 1 << note % 12;
			animation.requestRefresh();
		}
	}

	unhighlight() {

		for ( let button of this.buttons ) {

			const widget = button.widget;
			widget.highlit = animation.ifStateChange( widget.highlit, false );
		}

		this.highlighting.highlitNote =
				animation.ifStateChange( this.highlighting.highlitNote, null );
	}

	#findNote( x, y ) {

		let note = this.frets.noteAtCoordinates( x, y );
		if ( note != null ) return note;
		note = this.keys.noteAtCoordinates( x, y );
		return note;
	}

	configure() {

		let tuning = prompt("Edit tuning:", this.tuning);
		if ( tuning == null ) return; // cancel
		if ( tuning == "" ) tuning = defaultTuning;

		const stringSlots = Fretboard.parseStringSlots( tuning );
		if ( ! stringSlots ) {
			alert("Something in your tuning did not quite add up. ");
			return;
		}

		this.tuning = tuning;
		this.frets.stringSlots = stringSlots;
	}

	transpose( semitones ) {

		this.highlighting.selection =
				transpose( this.highlighting.selection, semitones );
	}

	scrollKeysViewport( direction ) {

		this.keys.scrollViewport( direction );
		this.buttonKeysLeft.enabled = this.keys.canScrollViewport( -1 );
		this.buttonKeysRight.enabled = this.keys.canScrollViewport( 1 );
	}
}

const app = new App();
