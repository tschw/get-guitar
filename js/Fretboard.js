import { Highlighting } from './Highlighting.js'

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

	constructor( width, height, stringSlots, numberOfFrets, highlighting ) {

		this.width = width;
		this.height = height;

		this.highlighting = highlighting;

		this.stringSlots = stringSlots;
		this._numberOfFrets = numberOfFrets;

		const lastFret = fretStringPosition( numberOfFrets );
		const lastFretBefore = fretStringPosition( numberOfFrets - 1 );
		const openStringOffset = lastFret - lastFretBefore;
		const visibleStringLength = lastFret;

		const numberOfFretsWithOpenString = numberOfFrets + 1;
		this._fretPosition = new Array( numberOfFretsWithOpenString );
		for ( let i = 0; i < numberOfFretsWithOpenString; ++ i )
			this._fretPosition[ i ] =
				(fretStringPosition(i) + openStringOffset) /
				(visibleStringLength + openStringOffset);
	}

	paint( c2d ) {

		c2d.clearRect( 0, 0, this.width, this.height );
		c2d.strokeStyle = '#aaaaaa';

		// Paint frets:

		for ( let i = 0; i < this._numberOfFrets; ++ i ) {

			const x = this._fretPosition[ i ] * this.width;

			c2d.lineWidth = (i % 12 == 0) ? 3 : 1;
			c2d.setLineDash( [] );
			c2d.beginPath();
			c2d.moveTo(x, 0);
			c2d.lineTo(x, this.height);
			c2d.stroke();
		}

		let yMin = 0, yMax = 0;
		const nSlots = this.stringSlots.length;
		for ( let i = 0; i < nSlots; ++ i ) {

			const stringSlot = this.stringSlots[ i ];
			const haveString = stringSlot.tuning !== undefined

			yMin = yMax;
			yMax = this.height * (i + 1) / nSlots;

			const y = ( yMax + yMin ) / 2;

			c2d.lineWidth = 1;
			c2d.setLineDash( [] );

			// Paint caption:

			c2d.fillStyle = '#cccccc';
			c2d.font = haveString ? '12px arial' : '24px arial';
			c2d.textBaseline = 'middle';

			const textMeasure = c2d.measureText( stringSlot.caption );
			c2d.clearRect(
				textMeasure.actualBoundingBoxLeft,
				y - textMeasure.actualBoundingBoxAscent,
				textMeasure.actualBoundingBoxRight -
					textMeasure.actualBoundingBoxLeft,
				textMeasure.actualBoundingBoxDescent +
					textMeasure.actualBoundingBoxAscent );

			c2d.fillText( stringSlot.caption, 0, y );

			// Paint string and slot separator:

			if ( ! haveString ) continue

			const xAfterText = c2d.measureText(
					stringSlot.caption + ' ' ).width;
			c2d.beginPath();
			c2d.moveTo( xAfterText, y );
			c2d.lineTo( this.width, y );
			c2d.stroke();

			if ( i == nSlots - 1 ) continue

			c2d.setLineDash( [ 1, 15 ] );
			c2d.beginPath();
			c2d.moveTo( 0, yMax );
			c2d.lineTo( this.width, yMax );
			c2d.stroke();
		}

		// Paint highlighting:

		return this._forEachBoundingBox( (note, xMin, yMin, xMax, yMax) =>
			this.highlighting.paint( c2d, note, xMin, yMin, xMax, yMax ) );
	}

	noteAtCoordinates( x, y ) {

		return this._forEachBoundingBox( (note, xMin, yMin, xMax, yMax) =>
				(x >= xMin && y >= yMin && x < xMax && y < yMax) ? note : null );
	}

	_forEachBoundingBox( f ) {

		let xMin = 0, xMax = 0;
		for ( let i = 0; i < this._numberOfFrets + 1; ++ i ) {

			xMin = xMax;
			xMax = this._fretPosition[ i ] * this.width;

			let yMin = 0, yMax = 0;
			const nSlots = this.stringSlots.length;
			for ( let j = 0; j < nSlots; ++ j ) {

				yMin = yMax;
				yMax = this.height * (j + 1) / nSlots;
				const stringSlot = this.stringSlots[ j ];

				if ( stringSlot.tuning === undefined )

					continue;

				const actualNote = stringSlot.tuning + i;
				const result = f( actualNote, xMin, yMin, xMax, yMax );
				if ( result != null ) return result;
			}
		}
	}
}