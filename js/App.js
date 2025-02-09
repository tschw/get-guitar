import { Settings } from './Settings.js'
import { Fretboard } from './Fretboard.js'
import { Highlighting } from './Highlighting.js'
import { PianoKeyboard } from './PianoKeyboard.js'
import { CircleOfFifths } from './CircleOfFifths.js'
import { ScaleLegend } from './ScaleLegend.js'
import { Button } from './Button.js'
import { Sharp, Flat, transpose, noteNameToNumber } from './Music.js'
import { animation } from './Animation.js'
import * as audioAnalyzer from './audio-analyzer/api.js'
import { BitMaskDelta } from './BitMaskDelta.js'

const NumberOfFrets = 16;
const NumberOfPianoWhiteKeys = 8;

const FretsFractionalHeight = 0.62;
const FretsKeysSpacing = 8;
const FretsCoFSpacing = 4;
const KeysScalesSpacing = 10;

const HorizEdgeButtonsSpacing = 10;
const UpperEdgeButtonsSpacing = 21;
const LowerEdgeButtonsSpacing = 7;

const UpperEdgeOfKeysButtonsSpacing = 6;

const ButtonsWidth = 38;
const ButtonsHeight = 32;
const ButtonsRowSpacing = 12;

const ButtonsRowDistance = ButtonsWidth + ButtonsRowSpacing;


class App {

	constructor() {

		this.element = document.getElementsByTagName( 'canvas' )[ 0 ];
		this.c2d = this.element.getContext( '2d' );
		this.pointerPosition = { x: 0, y: 0 };
		this.selectedKey = -1;
		this.analyzerData = audioAnalyzer.createDataVector();
		this.diffCandidates = new BitMaskDelta();
		this.diffStimuli = new BitMaskDelta();

		const settingsObject = new Settings();
		const settings = settingsObject.state;
		this.settings = settings;
		const highlighting = new Highlighting();
		this.highlighting = highlighting;

		const width = this.element.width;
		const height = this.element.height;

		const fretsHeight = height * FretsFractionalHeight;
		this.frets = new Fretboard(
				width, fretsHeight, NumberOfFrets, settings, highlighting );

		const keysTop = fretsHeight + FretsKeysSpacing;
		const keysWidth = width * 0.42;
		this.keys = new PianoKeyboard(
				keysTop, keysWidth, height - keysTop,
				NumberOfPianoWhiteKeys, settingsObject, highlighting );

		const cofTop = fretsHeight + FretsCoFSpacing;
		const cofSize = height - cofTop;
		const cofLeft = width - cofSize - ButtonsWidth;
		const cof = new CircleOfFifths( cofLeft, cofTop, cofSize );
		this.cof = cof;

		const yFretsButtons = UpperEdgeButtonsSpacing;
		const yKeysButtons = keysTop + UpperEdgeOfKeysButtonsSpacing;
		const yButtonsBottom = height - ButtonsHeight - LowerEdgeButtonsSpacing;

		const legendWidth = cofLeft - keysWidth - KeysScalesSpacing;
		this.legend = new ScaleLegend(
				keysWidth + KeysScalesSpacing, yKeysButtons,
				legendWidth, cofSize, this.cof.scales );

		const xFirstButton = HorizEdgeButtonsSpacing;
		const xLastButton = width - ButtonsWidth - HorizEdgeButtonsSpacing;
		const xCoFButtonsLeft =
				cofLeft - ButtonsWidth + HorizEdgeButtonsSpacing;
		const xKeysButtonsRight =
				keysWidth - ButtonsWidth - HorizEdgeButtonsSpacing;
		const xLegendScrollButtons = xCoFButtonsLeft - ButtonsRowDistance;

		const localSettings = settings.local;

		this.buttons = [

			{
				widget:
					new Button( xLastButton, yFretsButtons,
							ButtonsWidth, ButtonsHeight, "\u2261" ),

				action: () => settingsObject.openModalDialog(),
				existsIf: () => true

			}, {
				widget:
					this.buttonSharp = new Button(
							xLastButton - ButtonsRowDistance, yFretsButtons,
							ButtonsWidth, ButtonsHeight, Sharp ),

				action: () => this.transpose( 1 ),
				existsIf: () => localSettings.featureChromaticTranspose

			}, {
				widget:
					this.buttonFlat = new Button(
							xLastButton - ButtonsRowDistance * 2, yFretsButtons,
							ButtonsWidth, ButtonsHeight, Flat ),

				action: () => this.transpose( -1 ),
				existsIf: () => localSettings.featureChromaticTranspose

			}, {
				widget:
					this.buttonMic = new Button( xLastButton,
							yFretsButtons + ButtonsHeight + ButtonsRowSpacing,
							ButtonsWidth, ButtonsHeight, "\u{1f399}" ),

				action: () => this.toggleListen(),
				existsIf: () => localSettings.featureAudioAnalysis

			}, {
				widget:
					this.buttonKeysLeft = new Button(
							xFirstButton, yKeysButtons,
							ButtonsWidth, ButtonsHeight, "\u25c5" ),

				action: () => this.keys.scrollViewport( -1 ),
				existsIf: () => localSettings.keysScrollButtons

			}, {
				widget:
					this.buttonKeysRight = new Button(
							xKeysButtonsRight, yKeysButtons,
							ButtonsWidth, ButtonsHeight, "\u25bb" ),

				action: () => this.keys.scrollViewport( 1 ),
				existsIf: () => localSettings.keysScrollButtons

			}, {
				widget:
					this.buttonLegendUp = new Button(
							xLegendScrollButtons, yKeysButtons,
							ButtonsWidth, ButtonsHeight, "\u25b5" ),

				action: () => this.legend.scrollViewport( -1 ),
				existsIf: () => localSettings.legendScrollButtons

			}, {
				widget:
					this.buttonLegendDown = new Button(
							xLegendScrollButtons, yButtonsBottom,
							ButtonsWidth, ButtonsHeight, "\u25bf" ),

				action: () => this.legend.scrollViewport( 1 ),
				existsIf: () => localSettings.legendScrollButtons

			}, {
				widget:
					this.buttonFifthUp = new Button( xLastButton, yKeysButtons,
							ButtonsWidth, ButtonsHeight, "\u21bb" ),

				action: () => this.transpose( 7 ),
				existsIf: () => localSettings.featureTransposeByFifth

			}, {
				widget:
					this.buttonFifthDown = new Button( xCoFButtonsLeft, yKeysButtons,
							ButtonsWidth, ButtonsHeight, "\u21ba" ),

				action: () => this.transpose( -7 ),
				existsIf: () => localSettings.featureTransposeByFifth

			}, {
				widget:
					this.buttonApplyCoF = new Button(
							xLastButton, yButtonsBottom,
							ButtonsWidth, ButtonsHeight, "\u2713" ),

				action: () => this.applyOrCancelCoF( true ),
				existsIf: () => true

			}, {
				widget:
					this.buttonCancelCoF = new Button(
							xCoFButtonsLeft, yButtonsBottom,
							ButtonsWidth, ButtonsHeight, "\u2717" ),

				action: () => this.applyOrCancelCoF( false ),
				existsIf: () => true

			}
		];

		const location = window.location.toString();
		const sParam = /[?&]s=0b([01]+)(?:&|\/?$)/.exec( location );
		let initialSelection = 0;
		if ( sParam != null && sParam.length == 2 ) {
			initialSelection = parseInt( sParam[ 1 ], 2 );
		}
		this.selectionInUrl = initialSelection;

		cof.matchTonality = initialSelection;
		highlighting.selection = initialSelection;

		if ( audioAnalyzer.getSystemState() == 'unavailable' ) {

			this.buttonMic.enabled = false;
			const redirect = location.replace(
					'//tschw.github.io/get-guitar', '//get-guitar.netlify.app');
			if ( redirect != location ) window.location = redirect;
		}

		for ( const button of [ this.buttonApplyCoF, this.buttonCancelCoF ] ) {

			button.enabled = false;
			button.pulsing = true;
		}

		this.element.addEventListener( 'mousemove', (e) => this.mouseMove(e) );
		this.element.addEventListener( 'mousedown', (e) => this.mouseDown(e) );
		this.element.addEventListener( 'mouseout', (e) => this.unhighlight() );

		animation.render = () => this.paint();
		animation.unhighlight = () => this.unhighlight();

		animation.requestRefresh();
	}

	paint() {

		const c2d = this.c2d, element = this.element;
		const highlighting = this.highlighting, cof = this.cof;

		const isListening = audioAnalyzer.getSystemState() == 'running';

		if ( isListening ) {

			this.buttonMic.highlit = true;
			animation.requestRefresh();
			const a = this.analyzerData;

			if ( audioAnalyzer.getFrame( a ) ) {

				const candidates = this.diffCandidates.update( a[ 0 ] );
				const stimuli = this.diffStimuli.update( a[ 0 ] | a[ 1 ] );

				cof.matchTonality = stimuli.apply( this.cof.matchTonality );

				if ( cof.selectedTonality == 0 ) {

					highlighting.selection =
							candidates.apply( highlighting.selection );

					highlighting.highlitTonality =
							stimuli.apply( highlighting.highlitTonality );

					const melody = Math.round( a[ 2 ] );
					highlighting.highlitNote =
							! Number.isNaN( melody ) ? melody : null;
				}
/*
				console.log( "ui0:", fmtBin12( highlighting.selection ) );
				console.log( "ui1:", fmtBin12( cof.selectedTonality ) );
				console.log( "ui2:", fmtBin12( cof.matchTonality ) );

				console.log( "acc:", fmtBin12( a[ 0 ] ) );
				console.log( "now:", fmtBin12( a[ 1 ] ),
					"vol:", 1 + 0.5 * Math.log10( a[ 2 ] + Number.MIN_VALUE ) );
*/
			}

		}

		const enableTranspose = !isListening || cof.selectedTonality;
		this.buttonSharp.setEnabled( enableTranspose );
		this.buttonFlat.setEnabled( enableTranspose );
		this.buttonFifthUp.setEnabled( enableTranspose );
		this.buttonFifthDown.setEnabled( enableTranspose );

		c2d.clearRect( 0, 0, element.width, element.height );
		this.frets.paint( c2d );

		const keys = this.keys;
		this.buttonKeysLeft.setEnabled( keys.canScrollViewport( -1 ) );
		this.buttonKeysRight.setEnabled( keys.canScrollViewport( 1 ) );
		keys.paint( c2d );

		cof.paint( c2d );

		const legend = this.legend;
		this.buttonLegendUp.setEnabled( legend.canScrollViewport( -1 ) );
		this.buttonLegendDown.setEnabled( legend.canScrollViewport( 1 ) );
		legend.paint( c2d );

		for ( const button of this.buttons )
			if ( button.existsIf() ) button.widget.paint( c2d );

		highlighting.attenuate();
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

		const isListening = audioAnalyzer.getSystemState() == 'running';

		for ( const button of this.buttons )
			if ( button.existsIf() &&
					button.widget.highlightIfContained( p.x, p.y ) ) {

				if ( ! isListening )
					highlighting.highlitNote =
							animation.ifStateChange(
								highlighting.highlitNote, null );
				return;
			}

		const note = this.#findNote( p.x, p.y );

		if ( ! isListening )

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

		for ( const button of this.buttons )
			if ( button.existsIf() &&
					button.widget.isContained( p.x, p.y ) ) {

				if ( button.widget.enabled ) {

					button.action();
					animation.requestRefresh();
				}
				return;
			}

		const highlighting = this.highlighting,
				frets = this.frets, cof = this.cof;

		const note = this.#findNote( p.x, p.y );
		if ( note != null ) {

			highlighting.selection ^= 1 << note % 12;
			cof.matchTonality = highlighting.selection;
			this.#updateUrl( highlighting.selection );
			animation.requestRefresh();
			return;

		} else if ( p.y < frets.height && p.x < frets.width ) {

			frets.transitionToNextTuning();
			return;
		}

		if ( cof.isAnimating() ) return;

		const legend = this.legend;

		let zoomedIn = cof.selectedScale != null;

		let tonality = 0;
		let selecting = false;

		if ( ! legend.isAnimating() && legend.select( p.x, p.y ) ) {

			const iSelectedScale = legend.selectedScaleIndex;

			if ( this.selectedKey != -1 && iSelectedScale != -1 ) {

				const scale = cof.scales[ iSelectedScale ];
				cof.highlitScale = scale;
				tonality = transpose( scale.tonality, this.selectedKey );
				selecting = true;
			}

			if ( this.selectedKey == -1 || zoomedIn ) {

				if ( tonality == 0 ) {

					tonality = cof.selectedTonality;
					selecting = tonality != 0;
				}

				let scale = null;

				if ( iSelectedScale != -1 ) {

					scale = cof.scales[ iSelectedScale ];
					cof.highlitScale = scale;

				} else {

					if ( selecting )

						legend.selectedScaleIndex =
								cof.scales.indexOf( cof.selectedScale );

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

			let scaleIndex = -1;
			if ( selecting || zoomedIn ) {

				scaleIndex = pick.scaleIndex;
				legend.scrollToView( scaleIndex );
			}

			legend.selectedScaleIndex =
					animation.ifStateChange(
						legend.selectedScaleIndex, scaleIndex );

			this.selectedKey = selecting ? pick.key : -1;

			if ( selecting ) legend.highlightByIndex( pick.scaleIndex );
		}

		legend.toggleMode = ! selecting || zoomedIn;
		legend.unhighlight();

		this.buttonApplyCoF.setEnabled( selecting );
		this.buttonCancelCoF.setEnabled( selecting );

		cof.selectedTonality = animation.ifStateChange(
				cof.selectedTonality, selecting ? tonality : 0 );

		if ( selecting && tonality == cof.highlitTonality )

			cof.highlitTonality = 0;

		const selection = selecting ? tonality : cof.matchTonality;
		highlighting.selection =
				animation.ifStateChange( highlighting.selection, selection );
	}

	unhighlight() {

		for ( const button of this.buttons ) button.widget.unhighlight();

		const highlighting = this.highlighting, cof = this.cof;

		highlighting.highlitNote =
				animation.ifStateChange( highlighting.highlitNote, null );

		highlighting.highlitTonality =
				animation.ifStateChange( highlighting.highlitTonality, 0 );

		cof.highlitTonality = animation.ifStateChange( cof.highlitTonality, 0 );
		cof.highlitScale = animation.ifStateChange( cof.highlitScale, null );

		this.legend.unhighlight();
	}

	#updateUrl( selection ) {

		if ( this.selectionInUrl != selection ) {

			this.selectionInUrl = selection;

			let queryString = '';
			if ( selection != 0 )
				queryString = '?s=0b' + fmtBin12( selection );

			const location = window.location;
			window.history.replaceState( null, '',
					location.origin + location.pathname + queryString );
		}
	}

	#findNote( x, y ) {

		if ( this.cof.selectedTonality != 0 ) return null;
		let note = this.frets.noteAtCoordinates( x, y );
		if ( note != null ) return note;
		note = this.keys.noteAtCoordinates( x, y );
		return note;
	}

	transpose( semitones ) {

		const highlighting = this.highlighting, cof = this.cof;

		highlighting.selection = transpose( highlighting.selection, semitones );

		if ( cof.selectedTonality ) {

			cof.selectedTonality = highlighting.selection;
			this.selectedKey = ( this.selectedKey + semitones ) % 12;

		} else {

			const selection = highlighting.selection;
			cof.matchTonality = selection;
			this.#updateUrl( selection );
		}
		animation.requestRefresh();
	}

	toggleListen() {

		audioAnalyzer.switchOnOff();
		switch (audioAnalyzer.getSystemState()) {

			case 'starting':
				this.buttonMic.highlit = true;
				animation.requestRefresh();
				break;

			case 'stopping':
				const cof = this.cof;
				if (cof.selectedTonality == 0)
					cof.matchTonality = this.highlighting.selection;
				this.diffCandidates.prev = 0;
				this.diffStimuli.prev = 0;
				break;
		}
	}

	applyOrCancelCoF( doApply ) {

		const highlighting = this.highlighting, cof = this.cof;

		if ( doApply ) {
			const selection = highlighting.selection;
			cof.matchTonality = selection;
			this.#updateUrl( selection );
		}
		else highlighting.selection = cof.matchTonality;

		this.selectedKey = -1;
		cof.selectedTonality = 0;
		if ( cof.selectedScale == null ) {

			const legend = this.legend;
			legend.selectedScaleIndex = -1;
			legend.unhighlight();
			legend.toggleMode = true;
		}

		this.buttonApplyCoF.setEnabled( false );
		this.buttonCancelCoF.setEnabled( false );

		animation.requestRefresh();
	}
}

function fmtBin12( bits ) {

	const binaryString = bits.toString( 2 );
	const paddingZeroes = 12 - binaryString.length;
	return "0".repeat( paddingZeroes ) + binaryString;
}

const app = new App();
