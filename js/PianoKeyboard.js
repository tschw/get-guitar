import { numberToNoteName, NaturalScale } from './Music.js'

const isBlackKey = (index) => ( NaturalScale & ( 1 << ( index % 12 ) ) ) == 0;

const BlackKeyFractionalHeight = 0.65;
const BlackKeyWidthUpscale = 1.1;

const HighestNoteLimit = 9 * 12 - 1;


export class PianoKeyboard {

	constructor( yTop, width, height,
			lowestNote, numberOfWhiteKeys, highlighting ) {

		this.yTop = yTop;
		this.width = width;
		this.height = height;

		this.highlighting = highlighting;

		this.lowestNote = lowestNote;
		this.numberOfWhiteKeys = numberOfWhiteKeys;
	}

	canScrollViewport( direction ) {

		const lowest = this.lowestNote + direction;
		const highest = lowest + this.#numberOfKeys();
		return lowest >= 0 && highest <= HighestNoteLimit;
	}

	scrollViewport( direction ) {

		do {

			this.lowestNote += direction;

		} while ( isBlackKey( this.lowestNote ) );
	}

	#numberOfKeys() {

		let n = 0;

		for ( let nW = 0; nW < this.numberOfWhiteKeys; ++ n )

			if ( ! isBlackKey( n + this.lowestNote ) ) ++ nW;

		return n;
	}

	paint( c2d ) {

		const w = this.width;
		const h = this.height;
		const n = this.#numberOfKeys();
		const nW = this.numberOfWhiteKeys;
		const hB = h * BlackKeyFractionalHeight;

		const yMin = this.yTop;
		const yMaxW = yMin + h;
		const yMaxB = yMin + hB;

		c2d.lineWidth = 1;
		c2d.font = '10px arial';
		c2d.textBaseline = 'middle';

		c2d.save();
		c2d.rect( 0, yMin, w, h );
		c2d.clip();

		let iW = 0;
		for ( let i = 0; i < n; ++ i ) {

			const note = this.lowestNote + i;
			if ( isBlackKey( note ) ) continue;

			const xMin = w * iW / nW;
			const xMax = w * ++ iW / nW;

			c2d.fillStyle = '#777777';
			c2d.strokeStyle = '#ffffff';

			c2d.beginPath();
			c2d.rect( xMin, yMin, xMax - xMin, h );
			c2d.fill();
			c2d.stroke();

			this.highlighting.paint( c2d, note, xMin, yMaxB, xMax, yMaxW );

			if ( i == 0 || i == n - 1 ) {

				const label = numberToNoteName( note );
				const wC = c2d.measureText( label ).width;

				c2d.fillStyle = '#ffffff';
				c2d.fillText( label,
						( xMin + xMax - wC ) / 2, ( yMaxB + yMaxW ) / 2 );
			}
		}

		iW = 0;
		const xExtent = ( w * 0.5 / n ) * BlackKeyWidthUpscale;
		const yMinH = yMin + hB / 2;

		for ( let i = -1; i <= n; ++ i ) {

			const note = this.lowestNote + i;

			if ( ! isBlackKey( note + 12 ) ) {

				if ( i >= 0 ) ++ iW;
				continue;
			}

			const xCenter = w * iW / nW;
			const xMin = xCenter - xExtent;
			const xMax = xCenter + xExtent;

			c2d.fillStyle = '#101010';
			c2d.strokeStyle = '#000000';

			c2d.beginPath();
			c2d.rect( xMin, yMin, xMax - xMin, hB );
			c2d.fill();
			c2d.stroke();

			this.highlighting.paint( c2d, note, xMin, yMinH, xMax, yMaxB );
		}

		c2d.restore();
	}

	noteAtCoordinates( x, y ) {

		const w = this.width;
		const h = this.height;
		const n = this.#numberOfKeys();
		const nW = this.numberOfWhiteKeys;
		const hB = h * BlackKeyFractionalHeight;

		const yMin = this.yTop;
		const yMaxB = yMin + hB;

		const xExtent = ( w * 0.5 / n ) * BlackKeyWidthUpscale;

		let iW = 0;
		for ( let i = 0; i < n; ++ i ) {

			const note = this.lowestNote + i;
			if ( ! isBlackKey( note ) ) { ++ iW; continue; }

			const xCenter = w * iW / nW;
			const xMin = xCenter - xExtent;
			const xMax = xCenter + xExtent;

			if ( x < xMin || x >= xMax || y < yMin || y >= yMaxB ) continue;

			return note;
		}

		const yMaxW = yMin + h;

		iW = 0;
		for ( let i = 0; i < n; ++ i ) {

			const note = this.lowestNote + i;
			if ( isBlackKey( note ) ) continue;

			const xMin = w * iW / nW;
			const xMax = w * ( iW + 1 ) / nW;
			++ iW;

			if ( x < xMin || x >= xMax || y < yMin || y >= yMaxW ) continue;

			return note;
		}

		return null;
	}
}
