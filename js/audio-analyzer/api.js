
import './ringbuf.min.js'

let systemState =
		typeof window.SharedArrayBuffer !=='undefined' ? 'ready' : 'unavailable';
let audioReader = null;

export function getSystemState() { return systemState; }

// FSM: 'ready' -> 'starting' -> 'running' -> 'stopping' -> 'ready'
//              ->           <-> 'malfunction'
//
//      'unavailable' (lone detached state)

export function switchOnOff() {

	switch (systemState) {

		case 'ready':
		case 'failed':	startStreaming();
			break;
		case 'running':	stopStreaming();
	}
}

export function createDataVector() { return new Float32Array( 4 ); }

export function getFrame(dataVector) {

	return ( systemState == 'running'
			&& audioReader.available_read() >= 1
			&& audioReader.dequeue(dataVector) !== 0 );
}

export const FrameIndices = Object.freeze( {
		NoteSuspects: 0, NoteOnSet: 1, MelodyPitch: 2, GainRMS: 3 } );

let audioCtx = null;
let gumStream = null;

let mic = null;
let gain = null;
let pitchNode = null;

function startStreaming() {

	if (navigator.mediaDevices.getUserMedia) {

		systemState = 'starting';
		//console.log("Audio init");

		navigator.mediaDevices.getUserMedia(
				{ audio: true, video: false }).then( 

					startAudioProcessing 

				).catch( (what) => {
						throw "Could not access microphone - " + what; });
	} else {

		systemState = 'unavailable';
		throw "Could not access microphone - getUserMedia not available";
	}
}

function stopStreaming() {

	systemState = 'stopping';
	//console.log("Audio exit");

	gumStream.getAudioTracks().forEach(function(track) {
		track.stop();
		gumStream.removeTrack(track);
	});
	
	audioCtx.close().then(function() {

		mic.disconnect();
		pitchNode.disconnect();
		gain.disconnect();
		mic = null; 
		pitchNode = null; 
		gain = null;
		gumStream = null;

		if (systemState != 'failed' && systemState != 'unavailable')

			systemState = 'ready';

		//console.log("Audio offline");
	});
}


function startAudioProcessing(stream) {

	gumStream = stream;

	if (gumStream.active) {

		if (! audioCtx || audioCtx.state == 'closed') {


			const AudioContext = window.AudioContext || window.webkitAudioContext;
			audioCtx = new AudioContext();


		} else if (audioCtx.state == 'suspended') audioCtx.resume();

		mic = audioCtx.createMediaStreamSource(gumStream);
		gain = audioCtx.createGain();
		gain.gain.setValueAtTime(0, audioCtx.currentTime);

		let codeForProcessorModule = [

			'ringbuf',
			'essentia.js/essentia-wasm.umd.min.js', 
			'essentia.js/essentia.js-core.umd', 
			'essentia.js/essentia.js-extractor.umd',
			'audio-processor.js'
		];

		URLFromFiles(codeForProcessorModule, 'js/audio-analyzer/', '.min.js')
		.then( (concatenatedCode) => {

			audioCtx.audioWorklet.addModule(concatenatedCode)
			.then(setupAudioGraph).then(() => { 

				if (systemState != 'unavailable') {

					systemState = 'running';
					//console.log("Audio rolling");
				}
			})
			.catch( function moduleLoadRejected(msg) {
				if (systemState != 'unavailable') systemState + 'failed';
				console.log(`There was a problem loading the AudioWorklet module code: \n ${msg}`);
			});
		})
		.catch((msg) => {
			if (systemState != 'unavailable') systemState + 'failed';
			console.log(`There was a problem retrieving the AudioWorklet module code: \n ${msg}`);
		})

	} else {
		if (systemState != 'unavailable') systemState + 'failed';
		throw "Mic stream not active";
	}
}

function setupAudioGraph() {

	const bufferSize = 8192;

	let sab = exports.RingBuffer.getStorageForCapacity(3, Float32Array);
	let rb = new exports.RingBuffer(sab, Float32Array);
	audioReader = new exports.AudioReader(rb);

	pitchNode = new AudioWorkletNode(audioCtx, 'audio-processor', {
		processorOptions: {
			bufferSize: bufferSize,
			sampleRate: audioCtx.sampleRate,
		}
	});

	try {

		pitchNode.port.postMessage({
			sab: sab,
		});

	} catch(_){

		systemState = 'unavailable';
		return;
	}

	// It seems necessary to connect the stream to a sink for the pipeline to work, contrary to documentataions.
	// As a workaround, here we create a gain node with zero gain, and connect temp to the system audio output.
	mic.connect(pitchNode);
	pitchNode.connect(gain);
	gain.connect(audioCtx.destination);
}


function URLFromFiles(files, opt_prefix, opt_suffix) {

	const prefix = opt_prefix || '';
	const suffix = opt_suffix || '';

	const promises = files
		.map((file) => fetch(
				prefix + (file.endsWith('.js') ? file : file + suffix) )
		.then((response) => response.text()));

	return Promise
		.all(promises)
		.then((texts) => {
			// hack to make injected umd modules work
			texts.unshift("globalThis.exports = globalThis.exports || {};");
			const text = texts.join('');
			const blob = new Blob([text], {type: "application/javascript"});
			return URL.createObjectURL(blob);
	});
}

