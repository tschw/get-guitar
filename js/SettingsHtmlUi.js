import { noteNameToNumber, numberToNoteName, NoteNameInOctave } from './Music.js'

export class SettingsHtmlUi {

	constructor( domContext, dataContext, modelName ) {

		this.modelName = modelName;
		this.domContext = domContext;
		this.dataContext = dataContext;
	}

	saveToModel() { throw 'virtual'; }
	loadFromModel() { throw 'virtual'; }
}

export class CheckBox extends SettingsHtmlUi {

	constructor( domContext, dataContext, onChange, modelName ) {

		super( domContext, dataContext, modelName );

		const onInput = event => { this.saveToModel(); onChange( event ); };
		domContext[ modelName ].addEventListener('change', onInput );
	}

	saveToModel() {

		const name = this.modelName;
		this.dataContext[ name ] = this.domContext[ name ].checked;
	}

	loadFromModel() {

		const name = this.modelName;
		this.domContext[ name ].checked = this.dataContext[ name ];
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

		const result = [], element = this.domContext[ this.modelName ];

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

			this.dataContext[ this.modelName ] = result;

			element.classList.remove( 'error' );
		} else element.classList.add( 'error' );

		return ok;
	}

	loadFromModel() {

		const result = [];

		for ( const instrument of this.dataContext[ this.modelName ] ) {
			for ( const string of instrument ) {

				if ( string.tuning == null ) result.push( string.label, ':' );
				else result.push( ' ', numberToNoteName( string.tuning ) );
			}
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


