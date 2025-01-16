import { noteNameToNumber, numberToNoteName, NoteNameInOctave } from './Music.js'
import { animation } from './Animation.js'

const StorageKey = 'settings';

export class Settings {

	#uiInitialized;
	#cachedExportUrl;
	#imexButtonLastFailed;

	constructor() {

		const dialog = document.getElementsByTagName( 'dialog' )[ 0 ];
		const form = dialog.getElementsByTagName( 'form' )[ 0 ];
		const elem = form.elements;

		this.form = form;
		this.formElements = elem;
		const partToggles = [

			elem.imexTunings,
			elem.imexLocal
		];
		this.partToggles = partToggles;

		this.#uiInitialized = false;
		this.#cachedExportUrl = '';
		this.#imexButtonLastFailed = null;

		let state = JSON.parse( storage?.getItem( StorageKey ) || 'null' );
		if ( ! state ) {

			state = { tunings: [], local: {} };
			this.state = state;

			if ( ! this.#getTunings() )
				this.#resetTunings();
			this.#getLowestWhiteKey();
			this.#getToggles();

		} else this.state = state;
	}

	openModalDialog() {

		if ( ! this.#uiInitialized ) {
			this.#attachEventListeners();
			this.#uiInitialized = true;
		}

		this.#updateUi();
		this.formElements[ 0 ].form.parentElement.showModal();
	}

	#updateUi() {

		this.#setTunings();
		this.#setLowestWhiteKey();
		this.#setToggles();
	}

	#stateHasChanged() {

		storage?.setItem( StorageKey, JSON.stringify( this.state ) );
		animation.requestRefresh();
	}

	#attachEventListeners() {

		const elem = this.formElements;

		( h => {
			elem.tunings.addEventListener( 'input', h );
			elem.tunings.addEventListener( 'change', h );
		})( () => { this.#getTunings() && this.#stateHasChanged(); } );

		( h => {
			elem.keysLowestKey.addEventListener( 'change', h );
			elem.keysLowestKeyOctave.addEventListener( 'change', h );
		})( () => { this.#getLowestWhiteKey(); this.#stateHasChanged(); } );

		( h => {
			elem.mirrored.addEventListener( 'change', h );
			elem.keysScrollButtons.addEventListener( 'change', h );
			elem.legendScrollButtons.addEventListener( 'change', h );
			elem.featureChromaticTranspose.addEventListener( 'change', h );
			elem.featureTransposeByFifth.addEventListener( 'change', h );
			elem.featureAudioAnalysis.addEventListener( 'change', h );
		})( () => { this.#getToggles(); this.#stateHasChanged(); } );

		this.partToggles.forEach(
				checkbox => checkbox.addEventListener(
					'change', () => this.#imexClearError() ) );

		form.querySelector(
				'label[for=import]' ).addEventListener(
					'click',e => this.#imexOkSelectionApproves( e ) );

		form.querySelector( 'input#import[type=file]' ).
				addEventListener( 'change', e => this.#importFile( e ) );

		form.querySelector( 'a.button[name=export]' ).
				addEventListener( 'click', e => this.#exportClick( e ) );

		form.querySelector( 'a.button[name=reset]' ).
				addEventListener( 'click', e => this.#resetClick( e ) );
	}

	#getTunings() {

		const result = [], element = this.formElements.tunings;

		const splitParts =
				/\s*([^:]*):\s*((?:[A-G][#b\u266f\u266d\u{1d130}\u{1d12c}]?\d\s*)+)/gu;
		const eachString = /(([A-G][#b\u266f\u266d\u{1d130}\u{1d12c}]?)\d)\s*/gu;

		const fail = element.value.replaceAll(
				splitParts, ( _, label, strings ) => {

			const parsed = [];
			strings.replaceAll(
					eachString, ( _, noteWithOctave, note ) => {

				parsed.push( { label: note, tuning:
					noteNameToNumber( noteWithOctave ) } );
			});

			parsed.push( { label, tuning: null } );
			result.push( parsed.reverse() );
			return "";
		});

		const ok = ! fail && result.length > 0;

		if ( ok ) {

			this.state.tunings = result;

			removeErrorIndication( element );
		} else addErrorIndication( element );

		return ok;
	}

	#setTunings() {

		const result = [];

		for ( const instrument of this.state.tunings ) {
			for ( const string of instrument ) {

				if ( string.tuning == null ) result.push( string.label, ':' );
				else result.push( ' ', numberToNoteName( string.tuning ) );
			}
			result.push( '\n' );
		}
		this.formElements.tunings.value = result.join( '' );
	}

	#getLowestWhiteKey() {

		const elem = this.formElements, data = this.state.local;

		data.lowestWhiteKey = noteNameToNumber(
				elem.keysLowestKey.value + elem.keysLowestKeyOctave.value );
	}

	#setLowestWhiteKey() {

		const elem = this.formElements;
		const note = this.state.local.lowestWhiteKey;

		elem.keysLowestKey.value = NoteNameInOctave[ note % 12 ];
		elem.keysLowestKeyOctave.value = note / 12 | 0;
	}

	#getToggles() {

		const elem = this.formElements, data = this.state.local;

		data.mirrored = elem.mirrored.checked;

		data.keysScrollButtons = elem.keysScrollButtons.checked;
		data.legendScrollButtons = elem.legendScrollButtons.checked;

		data.featureChromaticTranspose = elem.featureChromaticTranspose.checked;
		data.featureTransposeByFifth = elem.featureTransposeByFifth.checked;
		data.featureAudioAnalysis = elem.featureAudioAnalysis.checked;
	}

	#setToggles() {

		const elem = this.formElements, data = this.state.local;

		elem.mirrored.checked = data.mirrored;

		elem.keysScrollButtons.checked = data.keysScrollButtons;
		elem.legendScrollButtons.checked = data.legendScrollButtons;

		elem.featureChromaticTranspose.checked = data.featureChromaticTranspose;
		elem.featureTransposeByFifth.checked = data.featureTransposeByFifth;
		elem.featureAudioAnalysis.checked = data.featureAudioAnalysis;
	}

	#resetTunings() {

		const elem = this.formElements;
		elem.tunings.value = elem.tunings.defaultValue;
		this.#getTunings();
	}

	#resetLocal() {

		const elem = this.formElements;

		elem.mirrored.checked = elem.mirrored.defaultChecked;

		elem.keysLowestKey.value = elem.keysLowestKey.getAttribute( 'value' );
		elem.keysLowestKeyOctave.value = elem.keysLowestKeyOctave.defaultValue;
		this.#getLowestWhiteKey();
		elem.keysScrollButtons.checked = elem.keysScrollButtons.defaultChecked;

		elem.legendScrollButtons.checked = elem.legendScrollButtons.defaultChecked;

		elem.featureChromaticTranspose.checked = elem.featureChromaticTranspose.defaultChecked;
		elem.featureTransposeByFifth.checked = elem.featureTransposeByFifth.defaultChecked;
		elem.featureAudioAnalysis.checked = elem.featureAudioAnalysis.defaultChecked;
		this.#getToggles();
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
				const elem = this.formElements;
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
					this.#stateHasChanged();
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

		const elem = this.formElements, root = { version: 1 }, s = this.state;
		if ( elem.imexTunings.checked ) root.tunings = s.tunings;
		if ( elem.imexLocal.checked) root.local = s.local;

		if ( this.#cachedExportUrl )
			window.revokeObjectUrl( this.#cachedExportUrl );

		const url = jsonDownload( root );
		this.#cachedExportUrl = url;

		const target = event.target;
		target.href = url;
		target.target = '_blank';
		target.download = 'get-guitar-export.json';
	}

	#resetClick( event ) {

		if ( this.#imexCheckSelection( event.target ) ) {

			const elem = this.formElements;
			if ( elem.imexTunings.checked ) this.#resetTunings();
			if ( elem.imexLocal.checked ) this.#resetLocal();

			this.#stateHasChanged();
		}

		event.preventDefault();
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

		const toggles = this.partToggles;
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

let storageType = 'none';

const storage = (
	( get ) => get( 'localStorage' ) || get( 'sessionStorage' ) || null )(
		( type ) => {

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
			storageType = type;
			return storage;
		} );

