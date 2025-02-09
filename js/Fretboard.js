import { Highlighting } from './Highlighting.js'
import { noteNameToNumber } from './Music.js'
import { animation } from './Animation.js'

const FractionalMarkerRadius = 0.125;
const FractionalMarkerElevation = 0.125;
const FractionalMarkerLeftDisplace = 0.245;
const FractionalMarkerRightDisplace = 0.24;

const LineDashOn = [ 1, 15 ];
const LineDashOff = [];

const MotionSmoothing = 0.7;

// The frequency is inverse proportional to the length of that
// part of the string that can oscillate. Semitones affect the
// frequency exponentially, that is there is a constant factor
// from one note to its chromatic successor.
//
// Knowing that 12 semitone steps have to multiply up to a an
// octave (that is, shortening the string to its half, thus
// doubling the frequency) we can calculate the position of
// each fret in respect to the length of the entire string.
const fretStringPosition = ( i ) => 1 - 2 ** ( -i / 12 );


export class Fretboard {

	#transitionOffset = 0;
	#transitionTarget = -1;

	tuningIndex = 0;

	constructor( width, height, numberOfFrets, settings, highlighting ) {

		this.width = width;
		this.height = height;

		this.highlighting = highlighting;
		this.numberOfFrets = numberOfFrets;

		this.settings = settings;
	}

	transitionToNextTuning() {

		if ( this.#transitionTarget == -1 ) {

			this.#transitionTarget = 1;
			animation.requestRefresh();
		}
	}

	paint( c2d ) {

		const tunings = this.settings.tunings;
		const nTunings = tunings.length;
		const mirrored = this.settings.local.mirrored;

		const width = this.width;

		const transitionOffset = this.#updatedTransitionOffset();
		const visibility = Math.abs( transitionOffset * 2 - 1 ) ** 2;

		c2d.save();
		c2d.rect( 0, 0, width, this.height * visibility );
		c2d.clip();

		// Paint frets:

		const tuning = tunings[ this.#actualTuningIndex() ];
		const nSlots = tuning.length;
		const stringSlotHeight = this.height / nSlots;
		const markerRadius = stringSlotHeight * FractionalMarkerRadius;
		const markerElevation = stringSlotHeight * FractionalMarkerElevation;

		for ( let i = 0; i < this.numberOfFrets; ++ i ) {

			const x = this.#fretPosition( i ) * width;
			let marker = null;

			switch ( i % 12 ) {

				case 0:
					marker = 'double';
					c2d.lineWidth = 3;
					c2d.strokeStyle = '#aaa';
					break;
				case 7:
					marker = 'double';
				case 5:
					marker ||= 'single';
					c2d.lineWidth = 3;
					c2d.strokeStyle = '#888';
					break;
				case 9:
					marker = 'single';
				case 3:
					c2d.lineWidth = 2;
					c2d.strokestyle = '#444';
					break;
				default:
					c2d.lineWidth = 1;
					c2d.strokeStyle = '#666';
			}

			c2d.beginPath();
			c2d.moveTo( x, 0 );
			c2d.lineTo( x, this.height );
			c2d.stroke();

			if ( i < 1 || ! marker ) continue;

			const xPrev = this.#fretPosition( i - 1 ) * width;
			const xMiddle = ( x + xPrev ) / 2;
			const fretWidth = x - xPrev;
			const xLeft = xMiddle - fretWidth * FractionalMarkerLeftDisplace;
			const xRight = xMiddle + fretWidth * FractionalMarkerRightDisplace;

			c2d.fillStyle = '#ddd';

			for ( let j = 0; j < nSlots; ++ j ) {

				const stringSlot = tuning[ j ];
				if ( stringSlot.tuning != null ) continue;

				const y = this.height * ( j + 1 ) / nSlots - markerElevation;

				c2d.beginPath();
				if ( marker == 'single' )

					c2d.arc( xMiddle, y, markerRadius, 0, Math.PI * 2 );

				else if ( marker == 'double' ) {

					c2d.arc( xLeft, y, markerRadius, 0, Math.PI * 2 );
					c2d.arc( xRight, y, markerRadius, 0, Math.PI * 2 );
				}
				c2d.fill();
			}
		}

		let yMin = 0, yMax = 0;
		for ( let i = 0; i < nSlots; ++ i ) {

			const stringSlot = tuning[ i ];
			const haveString = stringSlot.tuning != null;

			yMin = yMax;
			yMax = this.height * ( i + 1 ) / nSlots;

			const y = ( yMax + yMin ) / 2;

			c2d.lineWidth = 1;
			c2d.setLineDash( LineDashOff );

			// Paint caption or label:

			if ( ! haveString ) {

				c2d.font = '24px arial';
				c2d.textBaseline = 'alphabetic';

				const label = ' ' + stringSlot.label;
				const textMeasure = c2d.measureText( label );

				c2d.fillStyle = 'rgba(17,34,51,0.3)';
				c2d.fillRect(
						textMeasure.actualBoundingBoxLeft,
						yMax - textMeasure.actualBoundingBoxAscent,
						textMeasure.actualBoundingBoxRight -
							textMeasure.actualBoundingBoxLeft,
						textMeasure.actualBoundingBoxDescent +
							textMeasure.actualBoundingBoxAscent );

				c2d.fillStyle = '#fff';
				c2d.fillText( label, 0, yMax );
			} else {

				c2d.font = '12px arial';
				c2d.textBaseline = 'middle';
				c2d.fillText( stringSlot.label, 0, y );
			}

			// Paint string and slot separator:

			if ( ! haveString ) continue;

			const xAfterText = c2d.measureText( stringSlot.label + ' ' ).width;
			c2d.beginPath();
			c2d.moveTo( xAfterText, y );
			c2d.lineTo( this.width, y );
			c2d.stroke();

			if ( i == nSlots - 1 ) continue;

			c2d.setLineDash( LineDashOn );
			c2d.beginPath();
			c2d.moveTo( 0, yMax );
			c2d.lineTo( this.width, yMax );
			c2d.stroke();
		}

		// Paint highlighting:

		this.#forEachBoundingBox( (note, xMin, yMin, xMax, yMax) =>
			this.highlighting.paint( c2d, note, xMin, yMin, xMax, yMax ) );

		c2d.restore();
	}

	noteAtCoordinates( x, y ) {

		return this.#forEachBoundingBox( (note, xMin, yMin, xMax, yMax) =>
				(x >= xMin && y >= yMin && x < xMax && y < yMax) ? note : null );
	}

	#actualTuningIndex() {

		const n = this.settings.tunings.length;
		return ( this.tuningIndex + Math.round( this.#transitionOffset ) ) % n;
	}

	#updatedTransitionOffset() {

		const transitionTarget = this.#transitionTarget;
		let transitionOffset = this.#transitionOffset;

		if ( transitionTarget == -1 ) return transitionOffset;

		transitionOffset += animation.delta(
				transitionOffset, transitionTarget, MotionSmoothing );

		if ( transitionOffset == 1 ) {

			transitionOffset = 0;
			this.tuningIndex =
					( this.tuningIndex + 1 ) % this.settings.tunings.length;

			this.#transitionTarget = -1;
		}
		this.#transitionOffset = transitionOffset;
		return transitionOffset;
	}


	#fretPosition( i ) {

		const lastFret = fretStringPosition( this.numberOfFrets );
		const lastFretBefore = fretStringPosition( this.numberOfFrets - 1 );
		const openStringOffset = lastFret - lastFretBefore;
		const visibleStringLength = lastFret;
		let x = (fretStringPosition(i) + openStringOffset) /
				(visibleStringLength + openStringOffset);
		return ! this.settings.local.mirrored ? x : 1 - x;
	}

	#forEachBoundingBox( f ) {

		const tunings = this.settings.tunings;
		const tuning = tunings[ this.#actualTuningIndex() ];
		const mirrored = this.settings.local.mirrored;

		const width = this.width;

		let xA = 0, xB = mirrored ? width : 0;
		for ( let i = 0; i < this.numberOfFrets + 1; ++ i ) {

			xA = xB;
			xB = this.#fretPosition( i ) * width;

			let yMin = 0, yMax = 0;
			const nSlots = tuning.length;
			for ( let j = 0; j < nSlots; ++ j ) {

				yMin = yMax;
				yMax = this.height * ( j + 1 ) / nSlots;
				const stringSlot = tuning[ j ];

				if ( stringSlot.tuning == null ) continue;

				const actualNote = stringSlot.tuning + i;
				const result = ! mirrored ?
						f( actualNote, xA, yMin, xB, yMax ):
						f( actualNote, xB, yMin, xA, yMax );
				if ( result != null ) return result;
			}
		}

		return null;
	}
}
