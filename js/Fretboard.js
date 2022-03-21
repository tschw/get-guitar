import { Highlighting } from './Highlighting.js'
import { noteNameToNumber } from './Music.js'

// The frequency is inverse proportional to the length of that
// part of the string that can oscillate. Semitones affect the
// frequency exponentially, that is there is a constant factor
// from one note to its chromatic successor.
//
// Knowing that 12 semitone steps have to multiply up to a an
// octave (that is, shortening the string to its half, thus
// doubling the frequency) we can calculate the position of
// each fret in respect to the length of the entire string.
const fretStringPosition = (i) => 1 - 2**(-i/12);

export class Fretboard {

	constructor( width, height, tuning, numberOfFrets, highlighting ) {

		this.width = width;
		this.height = height;

		this.highlighting = highlighting;

		this.stringSlots = Fretboard.parseStringSlots( tuning );
		this.numberOfFrets = numberOfFrets;
	}

	static parseStringSlots( tuning ) {

		const result = [];

		const splitParts = /([^:]*):\s*((?:[A-G]\d\s*)+)/g;
		const eachString = /(([A-G])\d)\s*/g;

		const fail = tuning.replaceAll(
				splitParts, function(_, caption, strings) {

			result.push( { caption, tuning: null } );

			const parsed = [];
			strings.replaceAll(eachString,
					function(_, noteWithOctave, note) {

				parsed.push( { caption: note, tuning:
					noteNameToNumber( noteWithOctave ) } );
			});
			Array.prototype.push.apply( result, parsed.reverse() );

			return "";
		});
		return ! fail ? result : null;
	}

	paint( c2d ) {

		c2d.setLineDash( [] );

		// Paint frets:

		const nSlots = this.stringSlots.length;
		const stringSlotHeight = this.height / nSlots;
		const markerRadius = stringSlotHeight * 0.125;
		const markerElevation = stringSlotHeight * 0.125;

		for ( let i = 0; i < this.numberOfFrets; ++ i ) {

			const x = this.#fretPosition( i ) * this.width;
			let marker = null;

			switch (i % 12) {

				case 0:
					marker = 'double';
					c2d.lineWidth = 3;
					c2d.strokeStyle = '#ffffff';
					break;
				case 7:
					marker = 'double';
				case 5:
					marker ||= 'single';
					c2d.lineWidth = 3;
					c2d.strokeStyle = '#cccccc';
					break;
				case 9:
					marker = 'single';
				case 3:
					c2d.lineWidth = 2;
					c2d.strokestyle = '#888888';
					break;
				default:
					c2d.lineWidth = 1;
					c2d.strokeStyle = '#aaaaaa';
			}

			c2d.beginPath();
			c2d.moveTo( x, 0 );
			c2d.lineTo( x, this.height );
			c2d.stroke();

			if ( i < 1 || ! marker ) continue;

			const xPrev = this.#fretPosition( i - 1 ) * this.width;
			const xMiddle = ( x + xPrev ) / 2;
			const fretWidth = x - xPrev;
			const xLeft = xMiddle - fretWidth * 0.245;
			const xRight = xMiddle + fretWidth * 0.24;

			c2d.fillStyle = '#dddddd';

			for ( let j = 0; j < nSlots; ++ j ) {

				const stringSlot = this.stringSlots[ j ];
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

			const stringSlot = this.stringSlots[ i ];
			const haveString = stringSlot.tuning != null;

			yMin = yMax;
			yMax = this.height * ( i + 1 ) / nSlots;

			const y = ( yMax + yMin ) / 2;

			c2d.lineWidth = 1;
			c2d.setLineDash( [] );

			// Paint caption:

			c2d.fillStyle = '#cccccc';

			if ( ! haveString ) {

				c2d.font = '24px arial';
				c2d.textBaseline = 'alphabetic';

				const textMeasure = c2d.measureText( stringSlot.caption );

				c2d.clearRect(
						textMeasure.actualBoundingBoxLeft,
						yMax - textMeasure.actualBoundingBoxAscent,
						textMeasure.actualBoundingBoxRight -
							textMeasure.actualBoundingBoxLeft,
						textMeasure.actualBoundingBoxDescent +
							textMeasure.actualBoundingBoxAscent );

				c2d.fillText( stringSlot.caption, 0, yMax );
			} else {

				c2d.font = '12px arial';
				c2d.textBaseline = 'middle';
				c2d.fillText( stringSlot.caption, 0, y );
			}

			// Paint string and slot separator:

			if ( ! haveString ) continue;

			const xAfterText = c2d.measureText(
					stringSlot.caption + ' ' ).width;
			c2d.beginPath();
			c2d.moveTo( xAfterText, y );
			c2d.lineTo( this.width, y );
			c2d.stroke();

			if ( i == nSlots - 1 ) continue;

			c2d.setLineDash( [ 1, 15 ] );
			c2d.beginPath();
			c2d.moveTo( 0, yMax );
			c2d.lineTo( this.width, yMax );
			c2d.stroke();
		}

		// Paint highlighting:

		return this.#forEachBoundingBox( (note, xMin, yMin, xMax, yMax) =>
			this.highlighting.paint( c2d, note, xMin, yMin, xMax, yMax ) );
	}

	noteAtCoordinates( x, y ) {

		return this.#forEachBoundingBox( (note, xMin, yMin, xMax, yMax) =>
				(x >= xMin && y >= yMin && x < xMax && y < yMax) ? note : null );
	}


	#fretPosition( i ) {

		const lastFret = fretStringPosition( this.numberOfFrets );
		const lastFretBefore = fretStringPosition( this.numberOfFrets - 1 );
		const openStringOffset = lastFret - lastFretBefore;
		const visibleStringLength = lastFret;

		return (fretStringPosition(i) + openStringOffset) /
				(visibleStringLength + openStringOffset);
	}

	#forEachBoundingBox( f ) {

		let xMin = 0, xMax = 0;
		for ( let i = 0; i < this.numberOfFrets + 1; ++ i ) {

			xMin = xMax;
			xMax = this.#fretPosition( i ) * this.width;

			let yMin = 0, yMax = 0;
			const nSlots = this.stringSlots.length;
			for ( let j = 0; j < nSlots; ++ j ) {

				yMin = yMax;
				yMax = this.height * ( j + 1 ) / nSlots;
				const stringSlot = this.stringSlots[ j ];

				if ( stringSlot.tuning == null ) continue;

				const actualNote = stringSlot.tuning + i;
				const result = f( actualNote, xMin, yMin, xMax, yMax );
				if ( result != null ) return result;
			}
		}
	}
}
