import { noOp, incModN, decModN, bitCount,
		initializedArray, formatHexDump } from './Utility.js'
import { transpose } from './Music.js'
import { BitMaskDelta } from './BitMaskDelta.js'
import { animation } from './Animation.js'

const ChPolyphony = 64;

const NoteOff = 0x80;
const NoteOn = 0x90;
const PolyAT = 0xa0;
const Ctrl = 0xb0;
const Bend = 0xe0;
const Sys = 0xf0;

const CtrlRpnLsb = 0x64;
const CtrlRpnMsb = 0x65;
const CtrlDataMsb = 0x06;
const CtrlDataLsb = 0x26;
const CtrlDataInc = 0x60;
const CtrlDataDec = 0x61;

const BendZeroMsb = 0x40;

const RpnBendMsb = 0x00;
const RpnBendLsb = 0x00;

const CtrlPortamento = 0x54;


function decodeSelection( on ) { return on >>> 20; }
function decodeConfig( channelContext, on ) {
	return channelContext.configs[ on >>> 14 & 0x3f ]; }
function decodeVelo( on ) { return on >>> 8 & 0x7f; }

export class WebMidi {

	#settings
	#highlighting;

	apiAvailable = typeof window.navigator.requestMIDIAccess !== 'undefined';
	diagnostics = null;
	access = null;

	#listeners = [];
	#input = null;
	#output = null;

	#channelConfKeys = null;

	#channels = initializedArray( 16, i => ( {
			index: i,
			onEvents: new Uint32Array( ChPolyphony ),
			iFirstEvent: 0,
			iEvent: 0,
			configs: new Array( 64 ),
			iConfig: 0,
			forwarding: false,
			transforming: false,
			notes: 0,
			noteCount: new Int8Array( 12 ),
			selectedRpn: -1,
			rpBendSteps: -1,
			rpBendCents: -1,
			bendValueLsb: 0,
			bendValueMsb: BendZeroMsb,
			bendValidInDirection: 0,
			sentCount: new Int8Array( 128 ),
	} ) );

	#liveNotes = new Int32Array( 12 );
	#liveDelta = new BitMaskDelta();

	#byteArray3 = new Uint8Array( 3 );
	#byteArray6 = new Uint8Array( 6 );

	#bendMessageTemplate18 = new Uint8Array( [
		0, CtrlRpnLsb, RpnBendLsb, 0, CtrlRpnMsb, RpnBendMsb,
		0, CtrlDataLsb, 0, 0, CtrlDataMsb, 0, 0, 0, 0, 0, 0, 0 ] );

	#bendMessageTemplate15 = new Uint8Array(
		this.#bendMessageTemplate18.buffer, 0, 15 );

	constructor() {

		if ( this.apiAvailable ) return;

		this.#warn( "WebMIDI API unavailable. This feature may require " +
				"different browser settings or another browser altogether.." );
	}

	// Delayed initialization for late-binding the tightly coupled `Settings`
	attachFriends( settings, highlighting ) {

		this.#settings = settings;
		this.#highlighting = highlighting;

		if ( this.apiAvailable ) {

			const sysex = this.#settings.midi.fwdSysExclusive;
			window.navigator.requestMIDIAccess( { sysex } ).then(
					midiXs => this.#init( midiXs, settings ),
					msg => {
						this.#warn( `WebMIDI access denied - ${msg}` );
						this.#dispatchSystemStateChange( null );
					} );
		}
	}

	addSystemStateListener( f ) {

		const l = this.#listeners;
		if ( l.indexOf( f ) == -1 ) l.push( f );
		if ( this.access || this.diagnostics ) f( null );
	}

	removeSystemStateListener( f ) {

		const l = this.#listeners;
		const out = l.indexOf( f );
		if ( out != -1 ) l.splice( out );
	}

	static forEachPort( ports, f, idDefault ) {

		ports.forEach( ( port, key ) => {
			if ( port.state == 'connected' ) {

				const id = port.id,
						name = port.name || `${port.id} @ ${port.manufacturer}`;

				f( id, name, id == idDefault );
			}
		} );
	}

	setInput( portId ) {

		const port = this.access.inputs.get( portId );
		if ( port != this.#input ) {

			if ( this.#input ) this.#input.onmidimessage = null;
			this.#input = port || null;
		}
		if ( port && ! port.onmidimessage )
			port.onmidimessage = event => this.#receiveMidiMessage( event );
	}

	setOutput( portId ) {

		this.#output = portId ?
				this.access.outputs.get( portId ) || null : null;
	}

	#init( midiXs ) {

		this.access = midiXs;
		this.diagnostics = null;

		for ( const cc of this.#channels ) this.#getChannelConfig( cc );

		midiXs.onstatechange =
				( event ) => this.#dispatchSystemStateChange( event );

		this.#dispatchSystemStateChange( null );
	}

	#warn( message ) {

		this.diagnostics = message;
		console.warn( message );
	}

	#dispatchSystemStateChange( event ) {

		for ( const l of this.#listeners ) l( event );
	}

	#receiveMidiMessage( event ) {

		if ( ! ( event instanceof MIDIMessageEvent ) ) return;

		const bytes = event.data, output = this.#output;
		const statusByte = bytes[ 0 ];
		const cc = this.#channels[ statusByte & 0x0f ];

		if ( this.#settings.local.logMidiInput )
			console.log( "< MIDI", formatHexDump( bytes ) );

		let type = statusByte & 0xf0, conf = null;

		switch ( type ) {

			case NoteOn: if ( bytes[ 2 ] > 0 )  {

				const note = bytes[ 1 ], velo = bytes[ 2 ],
						selection = this.#highlighting.selection;

				conf = this.#getChannelConfig( cc );
				let i = ( cc.iEvent = incModN( cc.iEvent, ChPolyphony ) );
				if ( i == cc.iFirstEvent )
					cc.iFirstEvent = incModN( i, ChPolyphony );

				cc.onEvents[ i ] =
						note | velo << 7 | cc.iConfig << 14 | selection << 20;

				return this.#processNoteOnOffMessage(
						cc, type, note, velo, selection, conf );

			}	type = NoteOff; // v-v-v-v-v (velo == 0)

			case NoteOff: {

				const note = bytes[ 1 ], velo = bytes[ 2 ];
				const key = velo << 7 | note;
				const index = this.#findOnEventIndex( cc, key, 0x3fff );
				if ( index == -1 ) break; // to avoid annoyance

				const on = cc.onEvents[ index ];
				this.#forgetOnEvent( cc, index );

				this.#processNoteOnOffMessage( cc, type, note, velo,
						decodeSelection( on ), decodeConfig( cc, on ) );
			}	return;

			case PolyAT: {

				if ( ! cc.forwarding ) return;
				this.#processSoundingNoteMessage( PolyAT, cc, bytes, 1 );

			} 	break;

			case Bend: {

				cc.bendValueLsb = bytes[ 1 ];
				cc.bendValueMsb = bytes[ 2 ];

				if ( ! cc.forwarding || ! output ) return;
				if ( this.#sentAfterPendingBendWidth( cc, bytes, null ) )
					return;
			}	break;

			case Ctrl: {

				if ( ! cc.forwarding ) return;

				const number = bytes[ 1 ];
				let handled = true;
				switch ( number ) {

					case CtrlPortamento:
						this.#processSoundingNoteMessage( Ctrl, cc, bytes, 2 );
						return;
					case CtrlRpnMsb:
						cc.selectedRpn &= 0xff;
						cc.sekectedRpn |= bytes[ 2 ] << 8;
						break;
					case CtrlRpnLsb:
						cc.selectedRpn &= 0xff00;
						cc.selectedRpn |= bytes[ 2 ];
						break;
					default:
						handled = false;
				}

				if ( ! handled && cc.selectedRpn == 0 ) {

					conf = this.#getChannelConfig( cc );
					const whatDo = conf.bendWidthEvent;
					if ( whatDo == 'ignore' ) return;
					let stepsSet = true;
					switch ( number ) {

						case CtrlDataInc:
							cc.rpBendSteps =
									Math.min( cc.rpBendSteps + 1, $7f );
							break;
						case CtrlDataDec:
							cc.rpBendSteps = Math.max( cc.rpBendSteps - 1, 0 );
							break;
						case CtrlDataMsb:
							cc.rpBendSteps = bytes[ 2 ];
							break;
						case CtrlDataLsb:
							cc.rpBendCents = bytes[ 2 ];
							break;
						default:
							stepsSet = false;
					}
					if ( stepsSet ) {

						cc.bendValidInDirection = 0;
						if ( whatDo == 'set-steps' ) return;
					}
				}
			}	break;

			case Sys:
				if ( output )
					return this.#forwardSystemMessage( statusByte, bytes );

			default:
		}

		if ( output && cc.forwarding ) {

			if ( ! conf ) conf = this.#getChannelConfig( cc );
			bytes[ 0 ] = type | ( conf.outChannel - 1 );
			this.#sendMidi( bytes );
		}
	}

	#processNoteOnOffMessage(
			channelContext, type, noteIn, velo, selection, conf ) {

		let note = noteIn + conf.inTranspose;
		if ( ( note & 0x80 ) != 0 ) return;

		switch ( conf.inOp ) {

			case 'select-toggle-absorb':
			case 'select-toggle-forward':
				this.#selectToggle( type, note % 12 );
				break;
			case 'select-live-absorb':
			case 'select-live-forward':
				this.#selectLive(
						channelContext, type, note % 12, conf.inNAcc );
			default:
		}
		if ( channelContext.transforming ) {

			note = this.#transformNoteValue( noteIn, selection, conf );
			if ( ( note & 0x80 ) != 0 ) return;
			this.#trackActiveNotes( channelContext, type, note % 12 );
		}

		if ( channelContext.forwarding && this.#output ) {

			note += conf.outTranspose;
			if ( ( note & 0x80 ) != 0 ) return;

			const channelIndex = conf.outChannel - 1;
			const ccOut = this.#channels[ channelIndex ];
			const sent = ccOut.sentCount;

			let message = this.#byteArray3;
			if ( type == NoteOn ) {

				if ( sent[ note ] ++ > 0 ) {

					const message = this.#byteArray6;
					const statusByte = NoteOn | channelIndex;
					message[ 0 ] = statusByte;
					message[ 1 ] = note;
					message[ 2 ] = 0;
					message[ 3 ] = statusByte;
					message[ 4 ] = note;
					message[ 5 ] = velo;

					if ( ! this.#sentAfterPendingBendWidth(
							channelContext, message, conf ) )

						this.#sendMidi( message );

					return;
				}
			} else if ( -- sent[ note ] == 0 ) velo = 0; // effectively NoteOff
			else return;

			message[ 0 ] = NoteOn | channelIndex;
			message[ 1 ] = note;
			message[ 2 ] = velo;

			if ( velo == 0 ||
					! this.#sentAfterPendingBendWidth(
						channelContext, message, conf ) )

				this.#sendMidi( message );
		}
	}

	#selectToggle( type, noteInOctave ) {

		if ( type == NoteOn ) {

			this.#highlighting.selection ^= 1 << noteInOctave;
			animation.requestRefresh();
		}
	}

	#selectLive( channelContext, type, noteInOctave, nAcc ) {

		const counters = this.#liveNotes, highlit = this.#highlighting;
		if ( type == NoteOn ) counters[ noteInOctave ] = 1 + nAcc * 2;

		this.#trackActiveNotes( channelContext, type, noteInOctave );
		const activeNotes = channelContext.notes;
		let bits = 0;
		for ( let i = 0, b = 1; i < 12; ++ i, b <<= 1 ) {

			let t = counters[ i ];

			if ( ( activeNotes & b ) == 0 && t > 0 ) counters[ i ] = -- t;

			if ( t > 0 ) bits |= b;
		}
		highlit.selection =
				this.#liveDelta.update( bits ).apply( highlit.selection );
		animation.requestRefresh();
	}

	#getChannelConfig( cc ) {

		const latestKnown = cc.configs[ cc.iConfig ],
				channels = this.#settings.midi.inputResponse;

		const current = channels[ cc.index ];

		if ( latestKnown ) {

			const keys = ( this.#channelConfKeys ||=
					Array.from( Object.keys( current ) ) );

			let haveLatest = true;
			for ( const key of keys )
				if ( current[ key ] != latestKnown[ key ] )
					haveLatest = false;

			if ( haveLatest ) return latestKnown;
		}
		const inOp = current.inOp;
		let resetContextState = false;
		if ( ! latestKnown || latestKnown.inOp != inOp ) {

			let forward = true, transform = false;
			switch ( inOp ) {
				case 'absorb':
				case 'select-live-absorb':
				case 'select-toggle-absorb':
					forward = false;
					break;
				case 'select-live-forward':
				case 'select-toggle-forward':
					break;
				default:
					transform = true;
			}
			cc.forwarding = forward;
			if ( cc.transforming != transform ) {

				resetContextState = true;
				cc.transforming = transform;
			}
		}
		if ( ! latestKnown || latestKnown.outChannel != current.outChannel )

			resetContextState = true;

		const bendWidth = current.bendWidth,
				bendWidthSteps = current.bendWidthSteps,
				bendWidthEvent = current.bendWidthEvent;

		if ( resetContextState ||
				latestKnown.bendWidth != bendWidth ||
				latestKnown.bendWidthEvent != bendWidthEvent ) {

			cc.rpBendSteps = ! bendWidth ? -1 :
					bendWidthEvent != 'override' ? bendWidthSteps : -1;
			cc.rpBendCents = 0;
			cc.bendValidInDirection = 0;
		}
		if ( bendWidth && latestKnown &&
				bendWidthEvent != 'override' &&
				latestKnown.bendWidthSteps != bendWidthSteps &&
				cc.rpBendSteps == latestKnown.bendWidthSteps ) {

			cc.rpBendSteps = bendWidthSteps;
			cc.bendValidInDirection = 0;
		}
		if ( resetContextState ) {

			cc.noteCount.fill( 0 );
			cc.notes = 0;
		}
		const index = ( cc.iConfig = incModN( cc.iConfig, 64 ) );
		return Object.assign( cc.configs[ index ] ||= { index }, current );
	}

	#findOnEventIndex( channelContext, key, mask ) {

		const onEvents = channelContext.onEvents,
				e = channelContext.iFirstEvent;

		for ( let m = mask; m != 0; m >>= 8 ) {

			const k = key & m;

			for ( let i = channelContext.iEvent;
					i != e; i = decModN( i, ChPolyphony ) )

				if ( ( onEvents[ i ] & m ) == k ) return i;
		}
		return -1;
	}

	#forgetOnEvent( channelContext, index ) {

		const iFirst = channelContext.iFirstEvent,
				onEvents = channelContext.onEvents;

		if ( iFirst <= index ) {

			onEvents.copyWithin( iFirst + 1, iFirst, index );
			channelContext.iFirstEvent = incModN( iFirst + 1, ChPolyphony );

		} else {

			const iLast = ChPolyphony - 1;
			onEvents.copyWithin( 1, 0, index ).
					copyWithin( 0, iLast, ChPolyphony ).
					copyWithin( iFirst + 1, iFirst, iLast );
		}
	}

	#processSoundingNoteMessage( type, channelContext, bytes, noteIndex ) {

		const output = this.#output;
		if ( ! output ) return;

		let note = bytes[ noteIndex ], conf = null;
		const i = this.#findOnEventIndex( channelContext, note, 0x7f );
		if ( i == -1 ) return this.#sendMidi( bytes );

		const on = channelContext.onEvents[ i ];
		conf = decodeConfig( channelContext, on );
		note = this.#transformNoteValue( note, decodeSelection( on ), conf );
		if ( ( note & 0x80 ) == 0 &&
				( ( note += conf.outTranspose ) & 0x80 ) == 0 ) {
			const message = this.#byteArray3;
			message[ 0 ] = type | conf.outChannel - 1;
			message[ 1 ] = noteIndex == 1 ? note : bytes[ 1 ];
			message[ 2 ] = noteIndex == 2 ? note : bytes[ 2 ];
			this.#sendMidi( message );
		}
	}

	#transformNoteValue( noteIn, selection, conf ) {

		let note = noteIn + conf.inTranspose;
		if ( ( note & 0x80 ) != 0 ) return -1;

		let modeTranspose = conf.modeTranspose;

		switch ( conf.inOp ) {

			//-	case 'absorb':
			//-	case 'select-live-absorb':
			//-	case 'select-toggle-absorb':
			//-		return -1;

			case 'lock-filtering':
				if ( ( selection & 1 << note % 12 ) == 0 ) note = -1;
				break;
			case 'lock-flattening':
				if ( selection == 0 ) note = -1;
				while ( note > -1 && ( selection & 1 << note % 12 ) == 0 )
					-- note;
				break;
			case 'lock-sharpening':
				if ( selection == 0 ) note = 128;
				while ( note < 128 && ( selection & 1 << note % 12 ) == 0 )
					++ note;
				break;
			default:
				modeTranspose = 0;
		}
		if ( modeTranspose != 0 ) {

			const step = Math.sign( modeTranspose ),
					n = Math.abs( modeTranspose ) % bitCount( selection );

			for ( let i = 0; i != n && note > -1 && note < 128; ++ i ) {

				do { note += step; }
				while ( note != -1 &&
						note != 128 && ( selection & 1 << note % 12 ) == 0 );
			}
		}
		return note;
	}

	#sentAfterPendingBendWidth( channelContext, bytes, optConf ) {

		let notes = channelContext.notes;
		if ( notes == 0 ) return false;

		const bendLsb = channelContext.bendValueLsb,
				bendMsb = channelContext.bendValueMsb;

		const direction = bendMsb > BendZeroMsb ? 1 :
				bendMsb < BendZeroMsb ? -1 : bendLsb > 0 ? 1 : 0;

		if ( direction == 0 ||
				direction == channelContext.bendValidInDirection )
			return false;

		const conf = optConf || this.#getChannelConfig( channelContext );
		if ( ! conf.bendWidth ) return false;

		let steps = channelContext.rpBendSteps;
		if ( conf.bendWidthEvent == 'override' )
			if ( channelContext.rpBendSteps == 0 &&
					channelContext.rpBendCents == 0 )
				steps = conf.bendWidthSteps;
			else return false;

		let lsbOut = 0, msbOut = 0;
		const selection = this.#highlighting.selection;
		if ( selection != 0 ) {

			const fraction = Math.max( channelContext.rpBendCents, 0 ) / 100.0;
			const targetSteps = steps + Math.ceil( fraction );
			let n = 0, nFull = 0, stepCounter = 0;
			while ( stepCounter != targetSteps ) {

				do {
					notes = transpose( notes, direction );
					++ n;
				} while ( ( notes & selection ) == 0 );

				++ stepCounter;
				if ( nFull == 0 && stepCounter == steps ) nFull = n;
			}
			const asFloat = Math.min( Math.max(
					nFull + ( n - nFull ) * fraction, 0 ), 127.99 );

			msbOut = Math.floor( asFloat );
			lsbOut = Math.floor( 100 * ( asFloat - msbOut ) );
		}

		const len = bytes.length;
		const channel = conf.outChannel - 1, message = len == 3 ?
				this.#bendMessageTemplate15 : this.#bendMessageTemplate18;

		// Other than the example found in the MIDI spec, we have to repeat the
		// status byte, for WebMidi does not allow us to speak 'running status'
		for ( let i = 0, v = Ctrl | channel; i <= 9; i += 3 ) message[ i ] = v;
		message[ 8 ] = lsbOut;
		message[ 11 ] = msbOut;
		for ( let i = 0; i < len; ++ i ) message[ 12 + i ] = bytes[ i ];
		this.#sendMidi( message );

		channelContext.bendValidInDirection = direction;
	}

	#trackActiveNotes( channelContext, type, noteInOctave ) {

		if ( type == NoteOn ) {

			if ( ! channelContext.noteCount[ noteInOctave ] ++ ) {

				channelContext.notes |= 1 << noteInOctave;
				channelContext.bendValidInDirection = 0;
			}

		} else {

			if ( ! -- channelContext.noteCount[ noteInOctave ] ) {

				channelContext.notes &= ~ ( 1 << noteInOctave );
				channelContext.bendValidInDirection = 0;
			}
		}
	}

	#forwardSystemMessage( statusByte, bytes ) {

		const settings = this.#settings.midi,
				lowByte = statusByte & 0x0f;

		let approveFwd = settings.fwdSysCommon;
		if ( lowByte >= 8 )
			approveFwd = settings.fwdSysRealTime;
		else if ( lowByte == 0 )
			approveFwd = settings.fwdSysExclusive;

		if ( approveFwd ) this.#sendMidi( bytes );
	}

	#sendMidi( bytes ) {

		if ( this.#settings.local.logMidiOutput )
			console.log( "> MIDI", formatHexDump( bytes ) );

		this.#output.send( bytes );
	}
}
