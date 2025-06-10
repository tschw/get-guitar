import { animation } from './Animation.js'
import { FormElem, Tunings, NoteOctaveCombo,
		MidiPort, MidiInputResponse } from './SettingsHtmlUi.js'

const StorageKey = 'settings';
const PersistTimeout = 500;

export class Settings {

	#uiHandlers = [ ];
	#imexToggles = [ ];
	#persistTimer = 0;
	#cachedExportUrl = '';
	#imexButtonLastFailed = null;

	#dialog = document.querySelector( 'dialog' );

	constructor( webMidi ) {

		this.webMidi = webMidi;
		this.midiElems = [ ];

		let state = JSON.parse( storage?.getItem( StorageKey ) || 'null' );
		if ( ! state ) {

			state = { tunings: [ ], local: { }, midi: { } };
			this.state = state;
			this.#initializeUi();
			this.#getState();

		} else this.state = state;

		webMidi.addSystemStateListener( event => this.#onMidiStateChange() );
	}

	openModalDialog() {

		this.#initializeUi();
		this.#updateUi();
		this.#dialog.showModal();
	}

	#getState() {

		for ( const ui of this.#uiHandlers ) ui.saveToModel();
	}

	#updateUi() {

		for ( const ui of this.#uiHandlers ) ui.loadFromModel();
	}

	persist() {

		if ( this.#persistTimer == 0 ) {
			this.#persistTimer = window.setTimeout(
					() => this.#doPersist(), PersistTimeout );
		}
		animation.requestRefresh();
	}

	#doPersist() {

		this.#persistTimer = 0;
		storage?.setItem( StorageKey, JSON.stringify( this.state ) );
		animation.requestRefresh();
	}

	#onMidiStateChange( event ) {

		const subsystem = this.webMidi;

		if ( event == null && subsystem.access ) {

			const localSettings = this.state.local;
			subsystem.setInput( localSettings.midiIn );
			subsystem.setOutput( localSettings.midiOut );
		}

		this.#updateMidiDiax();
	}

	#updateMidiDiax() {

		const diax = this.webMidi.diagnostics,
				diaxElem = document.forms.local.elements[ 'midiDiax' ];

		diaxElem.style.display = diax ? 'block' : 'none';
		diaxElem.value = diax || '';
	}

	#initializeUi() {

		if ( this.#uiHandlers.length > 0 ) return;

		const store = ( event => this.persist() ), midi = this.webMidi;

		{
			const data = this.state, dom = document.forms.tunings.elements;
			this.#uiHandlers.push( new Tunings( dom, data, store, 'tunings' ) );
		}
		{
			const data = this.state.local, dom = document.forms.local.elements,
					setMidiIn = event => {
						midi.setInput( event.target.value ); this.persist(); },
					setMidiOut = event => {
						midi.setOutput( event.target.value ); this.persist(); };

			this.#uiHandlers.push(
					new FormElem( dom, data, store, 'mirrored' ),
					new FormElem( dom, data, store, 'swipewipes' ),
					new MidiPort(
						dom, data, setMidiIn, 'midiIn', midi, 'input' ),
					new MidiPort(
						dom, data, setMidiOut, 'midiOut', midi, 'output' ),
					new FormElem( dom, data, store, 'logMidiInput' ),
					new FormElem( dom, data, store, 'logMidiOutput' ) );

			this.#updateMidiDiax();
		}
		{
			const data = this.state.midi, dom = document.forms.midi.elements;

			this.#uiHandlers.push(
					new MidiInputResponse( dom, data, store, 'inputResponse' ),
					new FormElem( dom, data, store, 'fwdSysCommon' ),
					new FormElem( dom, data, store, 'fwdSysRealTime' ),
					new FormElem( dom, data, store, 'fwdSysExclusive' ) );
		}

		{
			const data = this.state.local, dom = document.forms.local.elements;
			this.#uiHandlers.push(
					new NoteOctaveCombo( dom, data, store, 'keysLowestWhite' ),
					new FormElem( dom, data, store, 'keysScrollButtons' ),
					new FormElem( dom, data, store, 'keysNoteNamesWhite' ),
					new FormElem( dom, data, store, 'keysNoteNamesBlackSharp' ),
					new FormElem( dom, data, store, 'keysNoteNamesBlackFlat' ),

					new FormElem( dom, data, store, 'legendScrollButtons' ),

					new FormElem( dom, data, store, 'featureChromaticTranspose' ),
					new FormElem( dom, data, store, 'featureTransposeByFifth' ),
					new FormElem( dom, data, store, 'featureAudioAnalysis' ) );
		}

		const imex = document.forms.imex.elements;
		const imexToggles = this.#imexToggles;

		imexToggles.push(
				imex.imexTunings,
				imex.imexLocal,
				imex.imexMidi );

		imexToggles.forEach(
				checkbox => checkbox.addEventListener(
					'change', () => this.#imexClearError() ) );

		const dialog = this.#dialog;

		dialog.querySelector(
				'label[for=import]' ).addEventListener(
					'click',e => this.#imexOkSelectionApproves( e ) );

		dialog.querySelector( 'input#import[type=file]' ).
				addEventListener( 'change', e => this.#importFile( e ) );

		dialog.querySelector( 'a.button[name=export]' ).
				addEventListener( 'click', e => this.#exportClick( e ) );

		dialog.querySelector( 'a.button[name=reset]' ).
				addEventListener( 'click', e => this.#resetClick( e ) );
	}


	#importFile( event ) {

		const button = event.target.labels[ 0 ];
		if ( ! this.#imexCheckSelection( button ) ) return false;
		this.#imexClearError();

		const setError = failed => {

			if ( failed ) {

				addErrorIndication( button );
				this.#imexButtonLastFailed = button;

			} else {

				removeErrorIndication( button );
				this.#imexButtonLastFailed = null;
			}
		};

		const doImport = event2 => {

			try {

				let ok = false;

				const jsonString = event2.target.result;
				const root = JSON.parse( jsonString );
				const elem = document.forms.imex;
				const data = this.state;

				if ( elem.imexTunings.checked &&
						typeof root.tunings !== 'undefined' ) {

					const destArray = data.tunings;
					destArray.length = 0;
					destArray.prototype.push.apply( destArray, root.tunings );
					ok = true;
				}
				if ( elem.imexLocal.checked &&
						typeof root.local !== 'undefined' ) {

					Object.assign( data.local, root.local );
					ok = true;
				}

				if ( ok ) {

					this.#updateUi();
					this.persist();
				}
				setError( ! ok );

			} catch ( e ) {

				setError( true );
				throw e;
			}
		};

		const reader = new FileReader();
		reader.addEventListener( 'load', doImport );
		reader.addEventListener( 'error', () => setError( true ) );
		reader.readAsText( event.target.files[ 0 ] );
	}

	#exportClick( event ) {

		if ( ! this.#imexOkSelectionApproves( event ) ) return false;

		const elem = document.forms.imex, root = { version: 1 }, s = this.state;
		if ( elem.imexTunings.checked ) root.tunings = s.tunings;
		if ( elem.imexLocal.checked ) root.local = s.local;
		if ( elem.imexMidi.checked ) root.midi = s.midi;

		if ( this.#cachedExportUrl )
			window.revokeObjectUrl( this.#cachedExportUrl );

		const url = jsonDownload( root );
		this.#cachedExportUrl = url;

		const target = event.target;
		target.href = url;
		target.target = '_blank';
		target.download = 'perfect-harmony-export.json';
	}

	#resetClick( event ) {

		if ( this.#imexCheckSelection( event.target ) ) {

			const elem = document.forms.imex.elements;

			if ( elem.imexTunings.checked )
				this.#resetForm( document.forms.tunings );

			if ( elem.imexLocal.checked )
				this.#resetForm( document.forms.local );

			if ( elem.imexMidi.checked )
				this.#resetForm( document.forms.midi );

			this.#getState();
			this.persist();

			this.#updateUi();
		}

		event.preventDefault();
	}

	#resetForm( form ) {

		form.reset();

		for ( const ui of this.#uiHandlers )
			if ( ui.domContext == form.domContext )
				ui.afterFormReset();
	}

	#imexOkSelectionApproves( event ) {

		const target = event.target;
		const ok = this.#imexCheckSelection( event.target );
		if ( ! ok ) {

			target.href = '#';
			target.target = '';
			event.preventDefault();
		}
		return ok;
	}

	#imexCheckSelection( button ) {

		const toggles = this.#imexToggles;
		const ok = toggles.reduce( ( a, x ) => a || x.checked, false );

		if ( ok ) {

			if ( button ) removeErrorIndication( button );
			toggles.forEach( removeErrorIndication );
			toggles.forEach(
					( e ) => e.labels.forEach( removeErrorIndication ) );
		} else {

			if ( this.#imexButtonLastFailed ) {
				removeErrorIndication( this.#imexButtonLastFailed );
				this.#imexButtonLastFailed = null;
			}
			if ( button ) {
				addErrorIndication( button );
				this.#imexButtonLastFailed = button;
			}
			toggles.forEach( addErrorIndication );
			toggles.forEach( ( e ) => e.labels.forEach( addErrorIndication ) );
		}
		return ok;
	}

	#imexClearError() {

		const failedButton = this.#imexButtonLastFailed;
		if ( failedButton ) {
			this.#imexButtonLastFailed = null;
			this.#imexCheckSelection( failedButton );
		}
	}
}

function addErrorIndication( elem ) { elem.classList.add( 'error' ); }
function removeErrorIndication( elem ) { elem.classList.remove( 'error' ); }

// Routines based on code from MDN docs:

function jsonDownload( object ) {

	return URL.createObjectURL( new Blob( [ JSON.stringify(
			object, null, 2 ) ], { type: "application/json" } ) );
}

function testedStorage( type ) {

	let storage;
	try {
		storage = window[ type ];
		const x = '__storage_test__';
		storage.setItem( x, x );
		storage.removeItem( x );

	} catch ( e ) {

		if ( ! ( e instanceof DOMException &&
			e.name == "QuotaExceededError" &&
			storage && storage.length > 0 ) ) return null;
	}
	return storage;
}

const [ storage, storageType ] = (
		get => get( 'localStorage' )
			|| get( 'sessionStorage' )
			|| [ null, 'none' ] )( type => {

				const storage = testedStorage( type );
				return storage && [ storage, type ];
			} );
