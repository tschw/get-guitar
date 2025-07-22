import { Settings } from './Settings.js'
import { WebMidi } from './WebMidi.js'
import { Fretboard } from './Fretboard.js'
import { Highlighting } from './Highlighting.js'
import { PianoKeyboard } from './PianoKeyboard.js'
import { CircleOfFifths } from './CircleOfFifths.js'
import { ScaleLegend } from './ScaleLegend.js'
import { Button } from './Button.js'
import { formatBinary } from './Utility.js'
import { transpose, noteNameToNumber } from './Music.js'
import * as symbol from './UnicodeSymbols.js'
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

		const webMidi = new WebMidi();
		const settingsObject = new Settings( webMidi );
		const settings = settingsObject.state;
		this.settings = settings;
		const highlighting = new Highlighting();
		this.highlighting = highlighting;
		webMidi.attachFriends( settings, highlighting );

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

		this.buttons = [

			createButton(
					xLastButton, yFretsButtons,
					symbol.Settings, () => settingsObject.openModalDialog() ),

			this.buttonSharp = createButton(
					xLastButton - ButtonsRowDistance, yFretsButtons,
					symbol.Sharp, () => this.transpose( 1 ) ),

			this.buttonFlat = createButton(
					xLastButton - ButtonsRowDistance * 2, yFretsButtons,
					symbol.Flat, () => this.transpose( -1 ) ),

			this.buttonMic = createButton(
					xLastButton,
					yFretsButtons + ButtonsHeight + ButtonsRowSpacing,
					symbol.Microphone, () => this.toggleListen() ),

			this.buttonKeysLeft = createButton(
					xFirstButton, yKeysButtons,
					symbol.ScrollLeft, () => this.keys.scrollViewport( -1 ) ),

			this.buttonKeysRight = createButton(
					xKeysButtonsRight, yKeysButtons,
					symbol.ScrollRight, () => this.keys.scrollViewport( 1 ) ),

			this.buttonLegendUp = createButton(
					xLegendScrollButtons, yKeysButtons,
					symbol.ScrollUp, () => this.legend.scrollViewport( -1 ) ),

			this.buttonLegendDown = createButton(
					xLegendScrollButtons, yButtonsBottom,
					symbol.ScrollDown, () => this.legend.scrollViewport( 1 ) ),

			this.buttonFifthUp = createButton(
					xLastButton, yKeysButtons,
					symbol.RotateRight, () => this.transpose( 7 ) ),

			this.buttonFifthDown = createButton(
					xCoFButtonsLeft, yKeysButtons,
					symbol.RotateLeft, () => this.transpose( -7 ) ),

			this.buttonApplyCoF = createButton(
					xLastButton, yButtonsBottom,
					symbol.Apply, () => this.applyOrCancelCoF( true ) ),

			this.buttonCancelCoF = createButton(
					xCoFButtonsLeft, yButtonsBottom,
					symbol.Cancel, () => this.applyOrCancelCoF( false ) ),
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
					'//tschw.github.io/perfect-harmony',
					'//perfect-harmony.netlify.app');
			if ( redirect != location ) window.location = redirect;
		}

		for ( const button of [ this.buttonApplyCoF, this.buttonCancelCoF ] ) {

			button.enabled = false;
			button.pulsing = true;
		}

		this.dragStart = { x: -1, y: -1 };

		this.element.addEventListener( 'mousemove', (e) => this.mouseMove(e) );
		this.element.addEventListener( 'mousedown', (e) => this.mouseDown(e) );
		this.element.addEventListener( 'mouseout', (e) => this.unhighlight() );
		this.element.addEventListener( 'mouseup', (e) => this.mouseUp(e) );

		animation.render = () => this.paint();
		animation.unhighlight = () => this.unhighlight();

		animation.requestRefresh();
	}

	paint() {

		this.#setButtonsState();

		const c2d = this.c2d, element = this.element;

		if ( audioAnalyzer.getSystemState() == 'running' )
			this.#applyAudioAnalysis();

		c2d.clearRect( 0, 0, element.width, element.height );
		this.frets.paint( c2d );
		this.keys.paint( c2d );
		this.cof.paint( c2d );
		this.legend.paint( c2d );
		for ( const button of this.buttons ) button.paint( c2d );
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

		const isListening = audioAnalyzer.getSystemState() == 'running';

		for ( const button of this.buttons )
			if ( button.highlightIfContained( p.x, p.y ) ) {

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
				animation.ifStateChange(
						highlighting.highlitTonality, tonality );
	}

	mouseDown( event ) {

		const p = this.#getPointerCoordinates( event ), drag = this.dragStart;
		drag.x = p.x; drag.y = p.y;

		for ( const button of this.buttons )
			if ( button.actionIfContained( p.x, p.y ) )
				return;

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

		setButtonState( this.buttonApplyCoF, true, selecting );
		setButtonState( this.buttonCancelCoF, true, selecting );

		cof.selectedTonality = animation.ifStateChange(
				cof.selectedTonality, selecting ? tonality : 0 );

		if ( selecting && tonality == cof.highlitTonality )

			cof.highlitTonality = 0;

		const selection = selecting ? tonality : cof.matchTonality;
		highlighting.selection =
				animation.ifStateChange( highlighting.selection, selection );
	}

	unhighlight() {

		for ( const button of this.buttons ) button.unhighlight();

		const highlighting = this.highlighting, cof = this.cof;

		highlighting.highlitNote =
				animation.ifStateChange( highlighting.highlitNote, null );

		highlighting.highlitTonality =
				animation.ifStateChange( highlighting.highlitTonality, 0 );

		cof.highlitTonality = animation.ifStateChange( cof.highlitTonality, 0 );
		cof.highlitScale = animation.ifStateChange( cof.highlitScale, null );

		this.legend.unhighlight();
	}

	mouseUp( event ) {

		const cof = this.cof;
		if ( cof.selectedTonality != 0 ) return null;

		const p = this.#getPointerCoordinates( event ),
				d = this.dragStart, frets = this.frets;

		if ( this.settings.local.swipewipes &&
				p.x - d.x > frets.width / 4 &&
				p.x < frets.width && p.y < frets.height &&
				d.x < frets.width && d.y < frets.height ) {

			const highlighting = this.highlighting;

			highlighting.selection = 0;
			cof.matchTonality = highlighting.selection;
			this.#updateUrl( highlighting.selection );
			animation.requestRefresh();
		}
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

		setButtonState( this.buttonApplyCoF, true, false );
		setButtonState( this.buttonCancelCoF, true, false );

		animation.requestRefresh();
	}

	#applyAudioAnalysis() {

		const highlighting = this.highlighting, cof = this.cof;

		this.buttonMic.highlit = true;
		animation.requestRefresh();

		const a = this.analyzerData;

		if ( audioAnalyzer.getFrame( a ) ) {

			const candidates = this.diffCandidates.update( a[ 0 ] );
			const stimuli = this.diffStimuli.update( a[ 0 ] | a[ 1 ] );

			cof.matchTonality = stimuli.apply( cof.matchTonality );

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

	#setButtonsState() {

		const localSettings = this.settings.local,
				allowTranspose = this.cof.selectedTonality ||
						audioAnalyzer.getSystemState() != 'running';

		this.buttonMic.visible = localSettings.featureAudioAnalysis;

		const sharpFlatButtons = localSettings.featureChromaticTranspose;

		setButtonState( this.buttonSharp, sharpFlatButtons, allowTranspose );
		setButtonState( this.buttonFlat, sharpFlatButtons, allowTranspose );

		const cofRotateButtons = localSettings.featureTransposeByFifth;

		setButtonState( this.buttonFifthUp, cofRotateButtons, allowTranspose );
		setButtonState( this.buttonFifthDown, cofRotateButtons, allowTranspose );

		const keys = this.keys,
				scrollKeysButtons = localSettings.keysScrollButtons;
		setButtonState( this.buttonKeysLeft,
				scrollKeysButtons, keys.canScrollViewport( -1 ) );
		setButtonState( this.buttonKeysRight,
				scrollKeysButtons, keys.canScrollViewport( 1 ) );

		const legend = this.legend,
				legendScrollButtons = localSettings.legendScrollButtons;
		setButtonState( this.buttonLegendUp,
				legendScrollButtons, legend.canScrollViewport( -1 ) );
		setButtonState( this.buttonLegendDown,
				legendScrollButtons, legend.canScrollViewport( 1 ) );
	}
}

function createButton( x, y, label, action ) {

	const b = new Button( x, y, ButtonsWidth, ButtonsHeight, label );
	b.action = action;
	return b;
}

function setButtonState( button, visible, enabled ) {

	button.visible = visible;
	if ( visible ) {
		if ( button.enabled != enabled ) {

			button.enabled = enabled;
			if ( ! enabled ) button.highlit = false;
			animation.requestRefresh();
		}
	}
}

const fmtBin12 = ( bits ) => formatBinary( bits, 12 );

const app = new App();
