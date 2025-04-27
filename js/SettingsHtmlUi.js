import { noteNameToNumber, numberToNoteName, NoteNameInOctave } from './Music.js'
import { WebMidi } from './WebMidi.js'

export class SettingsHtmlUi {

	constructor( domContext, dataContext, modelName ) {

		this.modelName = modelName;
		this.domContext = domContext;
		this.dataContext = dataContext;
	}

	saveToModel() { throw 'virtual'; }
	loadFromModel() { throw 'virtual'; }
	afterFormReset() { }
}

class SettingsHtmlUiComposite extends SettingsHtmlUi {

	#parts;

	constructor( domContext, dataContext, modelName, parts ) {

		super( domContext, dataContext, modelName );
		this.#parts = parts;
	}

	saveToModel() { for ( const p of this.#parts ) p.saveToModel(); }
	loadFromModel() { for ( const p of this.#parts ) p.loadFromModel(); }
	afterFormReset() { for ( const p of this.#parts ) p.loadFromModel(); }
}

export class FormElem extends SettingsHtmlUi {

	constructor( domContext, dataContext, onChange, modelName ) {

		super( domContext, dataContext, modelName );

		if ( onChange ) {

			const onInput = event => { this.saveToModel(); onChange( event ); };
			domContext[ modelName ].addEventListener('change', onInput );
		}
	}

	saveToModel() {

		const name = this.modelName;
		const lm = this.domContext[ name ];
		let value;
		switch ( lm.type ) {
			case 'checkbox':	value = lm.checked;			break;
			case 'number':		value = lm.valueAsNumber;	break;
			default:			value = lm.value;
		}
		this.dataContext[ name ] = value;
	}

	loadFromModel() {

		const name = this.modelName;
		const value = this.dataContext[ name ], lm = this.domContext[ name ];
		switch ( lm.type ) {
			case 'number':		lm.valueAsNumber = value;	break;
			case 'checkbox':	lm.checked = value;			break;
			default:			lm.value = value;
		}
	}
}

export class Tunings extends SettingsHtmlUi {

	constructor( domContext, dataContext, onChange, modelName ) {

		super( domContext, dataContext, modelName );

		const elem = domContext[ modelName ], onInput =
				event => { if ( this.saveToModel() ) onChange( event ); };

		elem.addEventListener( 'input', onInput );
		elem.addEventListener( 'change', onInput );
	}

	saveToModel() {

		const result = [ ], element = this.domContext[ this.modelName ];

		const splitParts =
				/\s*([^:]*):\s*((?:[A-G][#b\u266f\u266d\u{1d130}\u{1d12c}]?\d\s*)+)/gu;
		const eachString = /(([A-G][#b\u266f\u266d\u{1d130}\u{1d12c}]?)\d)\s*/gu;

		const fail = element.value.replaceAll(
				splitParts, ( _, label, strings ) => {

			const parsed = [ ];
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

			this.dataContext[ this.modelName ] = result;

			element.classList.remove( 'error' );
		} else element.classList.add( 'error' );

		return ok;
	}

	loadFromModel() {

		const result = [ ];

		for ( const instrument of this.dataContext[ this.modelName ] ) {

			const strings = [ ];

			for ( const string of instrument ) {

				if ( string.tuning == null ) result.push( string.label, ':' );
				else strings.push( numberToNoteName( string.tuning ), ' ' );
			}
			result.push( ...strings.reverse() );
			result.push( '\n' );
		}
		this.domContext[ this.modelName ].value = result.join( '' );
	}
}

export class NoteOctaveCombo extends SettingsHtmlUi {

	constructor( domContext, dataContext, onChange, modelName ) {

		super( domContext, dataContext, modelName );

		this.domNameNote = modelName + 'Note';
		this.domNameOctave = modelName + 'Octave';

		const onInput = event => { this.saveToModel(); onChange( event ); }
		domContext[ this.domNameNote ].addEventListener( 'change', onInput );
		domContext[ this.domNameOctave ].addEventListener( 'change', onInput );
	}

	saveToModel() {

		const d = this.domContext;
		this.dataContext[ this.modelName ] = noteNameToNumber(
				d[ this.domNameNote ].value + d[ this.domNameOctave ].value );
	}

	loadFromModel() {

		const d = this.domContext,
				note = this.dataContext[ this.modelName ];

		d[ this.domNameNote ].value = NoteNameInOctave[ note % 12 ];
		d[ this.domNameOctave ].value = note / 12 | 0;
	}
}

export class MidiPort extends SettingsHtmlUi {

	constructor( domContext,
			dataContext, onChange, modelName, webMidi, portType ) {

		super( domContext, dataContext, modelName );

		this.webMidi = webMidi;
		this.portType = portType;

		webMidi.addSystemStateListener(
				event => this.#updateOptions( event ) );

		this.#updateOptions( null );

		const onInput = event => { this.saveToModel(); onChange( event ); };
		domContext[ this.modelName ].addEventListener( 'change', onInput );
	}

	saveToModel() {

		const name = this.modelName;
		this.dataContext[ name ] = this.domContext[ name ].value;
	}

	loadFromModel() {

		const name = this.modelName;
		this.domContext[ name ].value = this.dataContext[ name ];
	}

	#updateOptions( event ) {

		const xs = this.webMidi.access,
				portType = this.portType,
				port = event?.port,
				name = this.modelName,
				select = this.domContext[ name ];

		const options = select.options;
//console.log( "updateOptions", event, portType, port );

		function addOption( id, label, idOfDefault ) {

			const option = document.createElement( 'option' );
			option.value = id;
			option.label = label;
			option.selected = id == idOfDefault;
			options.add( option );
		}

		if ( ! port || port.type == portType ) {

			const xs = this.webMidi.access,
					dataContext = this.dataContext;
			const portId = dataContext[ name ],
					portsMap = xs && xs[ portType + 's' ] || null;

			options.length = 0;

			addOption( '', "[ None ]", ! port || ! portsMap || ! portId ||
					( port.id == portId && port.state == 'disconnected' ) );

			if ( portsMap ) WebMidi.forEachPort( portsMap, addOption, portId );

			select.value = this.dataContext[ name ];
//console.log( "updateOptions", this.dataContext[ name ], port );
		}
	}
}

class MidiInChannelResponse extends SettingsHtmlUiComposite {

	constructor( elems, chArray, onChange, chIndex, names ) {

		const onInput = event => { this.#uiDeps(); onChange( event ); },
				chContext = chArray[ chIndex ] || ( chArray[ chIndex ] = { } );

		super( elems, chArray, chIndex, names.map(
				name => new FormElem( elems, chContext, onInput, name ) ) );

		this.#uiDeps();
	}

	#uiDeps() {

		const lm = this.domContext;
		const op = lm[ 'inOp' ].value;

		const absorb = op == 'absorb', select = op.startsWith( 'select-' );

		lm[ 'inNAcc' ].disabled = ! op.startsWith( 'select-live-' );

		lm[ 'inTranspose' ].disabled = absorb;

		lm[ 'outChannel' ].disabled =
			lm[ 'outTranspose' ].disabled = absorb || op.endsWith( '-absorb' );

		lm[ 'modeTranspose' ].disabled = ! op.startsWith( 'lock-' );
		const noTransform = absorb || select, lmEnABW = lm[ 'bendWidth' ];

		lmEnABW.disabled = noTransform;

		lm[ 'bendWidthSteps' ].disabled =
			lm[ 'bendWidthEvent' ].disabled = noTransform || ! lmEnABW.checked;
	}

	loadFromModel() {

		super.loadFromModel();
		this.#uiDeps();
	}
}



export class MidiInputResponse extends SettingsHtmlUiComposite {

	constructor( domContext, dataContext, onChange, modelName ) {

		const parts = new Array( 16 ),
				modelExists = dataContext.hasOwnProperty( modelName ),
				channelRows = document.querySelector( 'table#midiInput tbody' );

		const templateRow = channelRows.firstElementChild,
				data = modelExists ?
					dataContext[ modelName ] :
					dataContext[ modelName ] = new Array( 16 );

		const ch1Elems = { };
		for ( const lm of templateRow.querySelectorAll( 'input, select' ) )

			ch1Elems[ lm.name.replace( 'midiCh1', '' ) ] = lm;

		const names = Array.from( Object.keys( ch1Elems ) );
		parts[ 0 ] = new
				MidiInChannelResponse( ch1Elems, data, onChange, 0, names );

		for ( let i = 1; i < 16; ++ i ) {

			const strChNo = ( i + 1 ).toString(),
					thisRow = templateRow.cloneNode( true );

			thisRow.firstElementChild.innerText = strChNo;
			const formElemNamePrefix = `midiCh${ strChNo }`, elems = { };

			thisRow.querySelectorAll( 'input, select' ).forEach( ( lm, j ) => {

				const name = names[ j ];
				lm.setAttribute( 'name', formElemNamePrefix + name );
				elems[ name ] = lm;
			} );

			const lmOutChannel = elems[ 'outChannel' ];
			lmOutChannel.defaultValue = strChNo;
			lmOutChannel.value = strChNo;

			channelRows.appendChild( thisRow );
			parts[ i ] = new
					MidiInChannelResponse( elems, data, onChange, i, names );
		}

		super( domContext, dataContext, modelName, parts );
	}
}

