import { Fretboard } from './Fretboard.js'
import { Highlighting } from './Highlighting.js'
import { PianoKeyboard } from './PianoKeyboard.js'
import { CircleOfFifths } from './CircleOfFifths.js'
import { ScaleLegend } from './ScaleLegend.js'
import { Button } from './Button.js'
import { transpose, noteNameToNumber } from './Music.js'
import { animation } from './Animation.js'

const defaultTuning = 'Guitar - standard tuning: E2 A2 D3 G3 B3 E4';

const numberOfFrets = 16;
const numberOfPianoWhiteKeys = 9;
const lowestPianoKey = noteNameToNumber( 'C2' );

const pianoUpperSpace = 8;

const buttonWidth = 38;
const buttonHeight = 32;
const buttonSpacing = buttonWidth + 12;
const buttonsHorizontalSpace = 10;
const buttonsUpperSpace = 21;

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
				width, height * 0.62, this.tuning, numberOfFrets, highlighting );

		this.keys = new PianoKeyboard(
				height * 0.62 + pianoUpperSpace,
				width / 2, height * 0.38 - pianoUpperSpace,
				lowestPianoKey, numberOfPianoWhiteKeys, highlighting );

		const cofSize = height * 0.38 - pianoUpperSpace + 4;
		this.cof = new CircleOfFifths( width - cofSize - buttonWidth, height * 0.62 + pianoUpperSpace - 4, cofSize );

		this.selectedKey = -1;

		const yFretsButtons = buttonsUpperSpace;
		const yKeysButtons = this.keys.yTop + 6;
		const yButtonsBottom = height - buttonHeight - 7;

		this.legend = new ScaleLegend(
				width / 2 + 10, yKeysButtons,
				width * 0.25 - 20, cofSize, this.cof.scales );

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
					this.buttonKeysRight = new Button(
							width / 2 - buttonWidth - buttonsHorizontalSpace,
							yKeysButtons, buttonWidth, buttonHeight, "\u25bb" ),

				action: () => this.scrollKeysViewport(1)
			}, {
				widget:
					new Button( xLastButton, yKeysButtons,
							buttonWidth, buttonHeight, '\u21bb' ),

				action: () => this.transpose( 7 )
			}, {
				widget:
					new Button(
							this.cof.xLeft - buttonWidth +
								buttonsHorizontalSpace, yKeysButtons,
							buttonWidth, buttonHeight, '\u21ba' ),

				action: () => this.transpose( -7 )
			}, {
				widget:
					this.buttonApplyCoF = new Button(
							xLastButton, yButtonsBottom,
							buttonWidth, buttonHeight, '\u2713' ),

				action: () => this.applyOrCancelCoF( true )
			}, {
				widget:
					this.buttonCancelCoF = new Button(
							this.cof.xLeft - buttonWidth +
								buttonsHorizontalSpace, yButtonsBottom,
							buttonWidth, buttonHeight, '\u2717' ),

				action: () => this.applyOrCancelCoF( false )
			}
		];

		this.buttonApplyCoF.enabled = false;
		this.buttonCancelCoF.enabled = false;

		this.element.addEventListener( 'mousemove', (e) => this.mouseMove(e) );
		this.element.addEventListener( 'mousedown', (e) => this.mouseDown(e) );
		this.element.addEventListener( 'mouseout', (e) => this.unhighlight() );

		animation.render = () => this.paint();
		animation.unhighlight = () => this.unhighlight();

		animation.requestRefresh();
	}

	paint() {

		const c2d = this.c2d, element = this.element;

		c2d.clearRect( 0, 0, element.width, element.height );
		this.frets.paint( c2d );
		this.keys.paint( c2d );
		this.cof.paint( c2d );
		this.legend.paint( c2d );

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


		const note = this.#findNote( p.x, p.y );

		highlighting.highlitNote =
				animation.ifStateChange( highlighting.highlitNote, note );

		const cof = this.cof, legend = this.legend;
		const iHighlitScale = legend.highlight( p.x, p.y );

		let tonality = 0;
		let highlitScale = null;

		if ( iHighlitScale != -1 ) {

			highlitScale = cof.scales[ iHighlitScale ];

			if ( this.selectedKey != -1 )

				tonality = transpose(
						highlitScale.tonality, this.selectedKey );

		} else if ( note == null ) {


			const pick = cof.pickAtCoordinates( p.x, p.y );
			if ( pick != null ) {

				legend.highlightByIndex( pick.scaleIndex );
				tonality = pick.tonality;
			}
		}

		cof.highlitScale =
				animation.ifStateChange( cof.highlitScale, highlitScale );

		cof.highlitTonality =
				animation.ifStateChange( cof.highlitTonality, tonality );

		highlighting.highlitTonality =
				animation.ifStateChange( highlighting.highlitTonality, tonality );
	}

	mouseDown( event ) {

		const p = this.#getPointerCoordinates( event );

		for ( let button of this.buttons )
			if ( button.widget.isContained( p.x, p.y ) ) {

				if ( button.widget.enabled ) {

					button.action();
					animation.requestRefresh();
				}
				return;
			}

		const highlighting = this.highlighting, cof = this.cof;

		const note = this.#findNote( p.x, p.y );
		if ( note != null ) {

			highlighting.selection ^= 1 << note % 12;
			cof.matchTonality = highlighting.selection;
			animation.requestRefresh();
			return;
		}

		const legend = this.legend;

		let zoomedIn = cof.selectedScale != null;

		let tonality = 0;
		let selecting = false;

		if ( legend.select( p.x, p.y ) ) {

			const iSelectedScale = legend.selectedScaleIndex;

			if ( this.selectedKey != -1 ) {

				if ( iSelectedScale != -1 ) {

					tonality = cof.scales[ iSelectedScale ].tonality;
					tonality = transpose( tonality, this.selectedKey );
					selecting = true;
				}

			}

			if ( this.selectedKey == -1 || zoomedIn ) {

				if ( tonality == 0 ) {

					tonality = cof.selectedTonality;
					selecting = tonality != 0;
				}

				let scale = null;

				if ( iSelectedScale != -1 )
					scale = cof.scales[ iSelectedScale ];

				else {

					if ( selecting )
						legend.selectedScaleIndex = cof.scales.indexOf( cof.selectedScale );
					zoomedIn = false;
				}

				cof.selectedScale =
						animation.ifStateChange( cof.selectedScale, scale );

			}

			if ( ! selecting ) this.selectedKey = -1;

		} else {

			const pick = cof.pickAtCoordinates( p.x, p.y );

			if ( pick == null ) return;

			tonality = pick.tonality;
			selecting = tonality != cof.selectedTonality;

			legend.selectedScaleIndex = animation.ifStateChange(
					legend.selectedScaleIndex, selecting || zoomedIn ? pick.scaleIndex : -1 );

			this.selectedKey = selecting ? pick.key : -1;

			if ( selecting ) legend.highlightByIndex( pick.scaleIndex );
		}

		legend.toggleMode = ! selecting || zoomedIn;
		legend.unhighlight();

		this.buttonApplyCoF.enabled = selecting;
		this.buttonCancelCoF.enabled = selecting;

		cof.selectedTonality = animation.ifStateChange(
				cof.selectedTonality, selecting ? tonality : 0 );

		highlighting.selection =
				animation.ifStateChange(
					highlighting.selection,
					selecting ? tonality : cof.matchTonality );
	}

	unhighlight() {

		for ( let button of this.buttons ) button.widget.unhighlight();

		const highlighting = this.highlighting, cof = this.cof;

		highlighting.highlitNote =
				animation.ifStateChange( highlighting.highlitNote, null );

		highlighting.highlitTonality =
				animation.ifStateChange( highlighting.highlitTonality, 0 );

		cof.highlitTonality = animation.ifStateChange( cof.highlitTonality, 0 );
		this.legend.unhighlight();
	}

	#findNote( x, y ) {

		if ( this.cof.selectedTonality != 0 ) return null;
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

		const highlighting = this.highlighting, cof = this.cof;

		highlighting.selection = transpose( highlighting.selection, semitones );

		if ( cof.selectedTonality ) {

			cof.selectedTonality = highlighting.selection;
			this.selectedKey = ( this.selectedKey + semitones ) % 12;
		}

		else cof.matchTonality = highlighting.selection;

		animation.requestRefresh();
	}

	scrollKeysViewport( direction ) {

		const keys = this.keys;
		keys.scrollViewport( direction );
		this.buttonKeysLeft.enabled = keys.canScrollViewport( -1 );
		this.buttonKeysRight.enabled = keys.canScrollViewport( 1 );

		animation.requestRefresh();
	}

	applyOrCancelCoF( doApply ) {

		const highlighting = this.highlighting, cof = this.cof;

		if ( doApply ) cof.matchTonality = highlighting.selection;
		else highlighting.selection = cof.matchTonality;

		this.selectedKey = -1;
		cof.selectedTonality = 0;
		if ( cof.selectedScale == null ) {

			const legend = this.legend;
			legend.selectedScaleIndex = -1;
			legend.unhighlight();
			legend.toggleMode = true;
		}

		this.buttonApplyCoF.enabled = false;
		this.buttonCancelCoF.enabled = false;

		animation.requestRefresh();
	}
}

const app = new App();
