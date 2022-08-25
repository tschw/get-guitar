// avoid ES Module imports: not available on workers in Firefox nor Safari
//
// https://bugzilla.mozilla.org/show_bug.cgi?id=1247687
// https://bugs.webkit.org/show_bug.cgi?id=164860

const essentia = new Essentia(Module);
const extractors = new EssentiaExtractor(Module);

class HarmonyProfiler extends AudioWorkletProcessor {

    constructor(options) {

        super();

        const bufferSize = options.processorOptions.bufferSize;
		const sampleRate = options.processorOptions.sampleRate;
		const frameSize = bufferSize / 2;
		const hopSize = bufferSize / 8;

        this._sampleRate = sampleRate;
        this._channelCount = 1;

		this._bufferSize = bufferSize;
        this._frameSize = frameSize;
        this._hopSize = hopSize;

        this._lowestFreq = 55 * Math.pow(2, 3/12); // lowest note = C2
        this._highestFreq = 55 * Math.pow(2, (3+6*12-1)/12); // 6 octaves above C2

        this._inputRingBuffer = new ChromeLabsRingBuffer(bufferSize, this._channelCount);

        this._accumData = [new Float32Array(bufferSize)];
		this._frameAnalysis = new Float32Array(4);

        this.port.onmessage = e => {
          this._audio_writer = new AudioWriter(new RingBuffer(e.data.sab, Float32Array));
        };

		this._duration = new Uint32Array(12);

		this._maxGain = new Float32Array(12);
		this._maxDuration = new Uint32Array(12);
		this._maxTriggerMelody = new Uint32Array(12);
		this._maxTriggerHarmony = new Uint32Array(12);
		this._age = new Uint32Array(12);

		this._paretoMask = 0;
		this._usualSuspects = 0;

    }

    process(inputList, outputList, params) {

        const input = inputList[0];
        const output = outputList[0];

        this._inputRingBuffer.push(input);

        if (this._inputRingBuffer.framesAvailable >= this._bufferSize) {

            this._inputRingBuffer.pull(this._accumData);

			const audioBuffer = this._accumData[0];
            const accumDataVector = essentia.arrayToVector(audioBuffer);
            const rms = essentia.RMS(accumDataVector).rms;
			const hpcp = extractors.hpcpExtractor(audioBuffer, this._sampleRate);

            let algoOutput = null;
			try {

				algoOutput = essentia.PitchMelodia(
					accumDataVector,
					10, 3, this._frameSize, false, 0.8, this._hopSize, 1, 40, this._highestFreq, 100, this._lowestFreq, 20, 0.9, 0.9, 27.5625, this._lowestFreq, this._sampleRate, 100
				);

				// algoOutput = essentia.PitchYinProbabilistic(
				//     accumDataVector,
				//     this._frameSize, this._hopSize, 0.04, "zero", false, this._sampleRate
				// );

			} catch (e) { console.error(e); }

			if (! algoOutput) return true;

            const pitchFrames = essentia.vectorToArray(algoOutput.pitch);
            const confidenceFrames = essentia.vectorToArray(algoOutput.pitchConfidence);

            // average frame-wise pitches in pitch before writing to SAB
            const numVoicedFrames = pitchFrames.filter(p => p > 0).length;
            // const numFrames = pitchFrames.length;
            const meanPitch = pitchFrames.reduce((acc, val) => acc + val, 0) / numVoicedFrames;
            const meanConfidence = confidenceFrames.reduce((acc, val) => acc + val, 0) / numVoicedFrames;

			let stimuli = 0;
			let activeMask = 0;
			let semitones = Number.NaN;

			const minDuration = 2;

			for (let i = 0, b = 1; i < 12; ++ i, b += b) {

				let j = (i + 3) % 12; // C -> A

				if (hpcp[j] < 1) {

					this._duration[i] = 0;
					continue;
				}

				const d = ++ this._duration[i];

				if (minDuration <= d) {

					activeMask |= b;

					if (minDuration == d)
						++ this._maxTriggerHarmony[i];

					this._maxGain[i] = Math.max(this._maxGain[i], rms);
					this._maxDuration[i] = Math.max(this._maxDuration[i], d);

					this.#paretoConsider(i);
				}
			}

			stimuli |= this._paretoMask;

			if (numVoicedFrames > 0 && meanConfidence / rms > 1) {

				semitones = 12 * Math.log2(
						4 * meanPitch / this._lowestFreq);

				const i = ( Math.round(semitones) % 12 + 12 ) % 12;

				activeMask |= 1 << i;

				++ this._maxTriggerMelody[i];

				this._maxGain[i] = Math.max(this._maxGain[i], rms);
				this._maxDuration[i] =
					Math.max(this._maxDuration[i], minDuration);

				this.#paretoConsider(i);
			}

			stimuli |= this._paretoMask;
			this._usualSuspects |= stimuli;

			const Expiry = 10;

			for (let i = 0, b = 1; i < 12; ++ i, b += b) {

				if ((this._usualSuspects & b) == 0) continue;

				let c = this._age[i];
				if ((stimuli & b) != 0) c = 0;
				//else if ((activeMask & b) != 0) c = Expiry - Expiry / 4;
				else c = Math.max( 0, c + ((activeMask & b) == 0 ? 1 : -2 ));
				this._age[i] = c;
				if (c >= Expiry) this._usualSuspects &= ~b;
			}

            if (this._audio_writer.available_write() >= 1) {

				const tuple = this._frameAnalysis;
				tuple[0] = this._usualSuspects;
				tuple[1] = activeMask;
				tuple[2] = semitones;
				tuple[3] = rms;
            	this._audio_writer.enqueue(tuple);
            }
 
			this._accumData[0].fill(0);
        }

        return true;
    }

	#paretoConsider(i) {

		let bits = this._paretoMask & ~(1 << i);
		let candidateIsInFront = true;

		for (let j = 0, b = 1; j < 12; ++ j, b += b) {

			if (!(bits & b)) continue;

			const cmp = this.#paretoCompare(i, j);
			const candidateDominatesElement = (cmp > 0);

			if (candidateDominatesElement) bits &= ~(1 << j);
			else if (cmp != 0) candidateIsInFront = false;
		}

		if (candidateIsInFront) bits |= (1 << i);

		this._paretoMask = bits;
	}

	#paretoCompare(i, j) {

		function compare(a, i, j) { return Math.sign(a[i] - a[j]); }

		const c0 = compare(this._maxGain, i, j);
		const c1 = compare(this._maxDuration, i, j);
		const c2 = compare(this._maxTriggerMelody, i ,j);
		const c3 = compare(this._maxTriggerHarmony, i, j);

		const min = Math.min( c0, c1, c2, c3 );
		const max = Math.max( c0, c1, c2, c3 );

		if (min < 0 && max > 1) return 0;
		return Math.sign(max + min);
	}
}

registerProcessor("audio-processor", HarmonyProfiler);


// helper classes from https://github.com/GoogleChromeLabs/web-audio-samples/blob/gh-pages/audio-worklet/design-pattern/lib/wasm-audio-helper.js#L170:

/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

// Basic byte unit of WASM heap. (16 bit = 2 bytes)
const BYTES_PER_UNIT = Uint16Array.BYTES_PER_ELEMENT;

// Byte per audio sample. (32 bit float)
const BYTES_PER_SAMPLE = Float32Array.BYTES_PER_ELEMENT;

// The max audio channel on Chrome is 32.
const MAX_CHANNEL_COUNT = 32;

// WebAudio's render quantum size.
const RENDER_QUANTUM_FRAMES = 128;

/**
 * A JS FIFO implementation for the AudioWorklet. 3 assumptions for the
 * simpler operation:
 *  1. the push and the pull operation are done by 128 frames. (Web Audio
 *    API's render quantum size in the speficiation)
 *  2. the channel count of input/output cannot be changed dynamically.
 *    The AudioWorkletNode should be configured with the `.channelCount = k`
 *    (where k is the channel count you want) and
 *    `.channelCountMode = explicit`.
 *  3. This is for the single-thread operation. (obviously)
 *
 * @class
 */
class ChromeLabsRingBuffer {
  /**
   * @constructor
   * @param  {number} length Buffer length in frames.
   * @param  {number} channelCount Buffer channel count.
   */
  constructor(length, channelCount) {
    this._readIndex = 0;
    this._writeIndex = 0;
    this._framesAvailable = 0;

    this._channelCount = channelCount;
    this._length = length;
    this._channelData = [];
    for (let i = 0; i < this._channelCount; ++i) {
      this._channelData[i] = new Float32Array(length);
    }
  }

  /**
   * Getter for Available frames in buffer.
   *
   * @return {number} Available frames in buffer.
   */
  get framesAvailable() {
    return this._framesAvailable;
  }

  /**
   * Push a sequence of Float32Arrays to buffer.
   *
   * @param  {array} arraySequence A sequence of Float32Arrays.
   */
  push(arraySequence) {
    // The channel count of arraySequence and the length of each channel must
    // match with this buffer obejct.

    // Transfer data from the |arraySequence| storage to the internal buffer.
    let sourceLength = arraySequence[0].length;
    for (let i = 0; i < sourceLength; ++i) {
      let writeIndex = (this._writeIndex + i) % this._length;
      for (let channel = 0; channel < this._channelCount; ++channel) {
        this._channelData[channel][writeIndex] = arraySequence[channel][i];
      }
    }

    this._writeIndex += sourceLength;
    if (this._writeIndex >= this._length) {
      this._writeIndex = 0;
    }

    // For excessive frames, the buffer will be overwritten.
    this._framesAvailable += sourceLength;
    if (this._framesAvailable > this._length) {
      this._framesAvailable = this._length;
    }
  }

  /**
   * Pull data out of buffer and fill a given sequence of Float32Arrays.
   *
   * @param  {array} arraySequence An array of Float32Arrays.
   */
  pull(arraySequence) {
    // The channel count of arraySequence and the length of each channel must
    // match with this buffer obejct.

    // If the FIFO is completely empty, do nothing.
    if (this._framesAvailable === 0) {
      return;
    }

    let destinationLength = arraySequence[0].length;

    // Transfer data from the internal buffer to the |arraySequence| storage.
    for (let i = 0; i < destinationLength; ++i) {
      let readIndex = (this._readIndex + i) % this._length;
      for (let channel = 0; channel < this._channelCount; ++channel) {
        arraySequence[channel][i] = this._channelData[channel][readIndex];
      }
    }

    this._readIndex += destinationLength;
    if (this._readIndex >= this._length) {
      this._readIndex = 0;
    }

    this._framesAvailable -= destinationLength;
    if (this._framesAvailable < 0) {
      this._framesAvailable = 0;
    }
  }
} // class ChromeLabsRingBuffer

