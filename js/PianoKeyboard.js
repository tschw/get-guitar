import { naturalScale, numberToNoteName } from './Music.js'

const isBlackKey = (index) => ( naturalScale & ( 1 << ( index % 12 ) ) ) == 0;

const blackKeyFractionalHeight = 0.65;
const blackKeyWidthUpscale = 1.1;

const highestNote = 9 * 12 - 1;


export class PianoKeyboard {

	constructor( width, height, lowestNote, numberOfWhiteKeys, highlighting ) {

		this.width = width;
		this.height = height;

		this.highlighting = highlighting;

		this.lowestNote = lowestNote;
		this.numberOfWhiteKeys = numberOfWhiteKeys;
	}

	canScrollViewport( direction ) {

		const lowest = this.lowestNote + direction;
		const highest = lowest + this.#numberOfKeys();
		return lowest >= 0 && highest <= highestNote;
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
		const hB = h * blackKeyFractionalHeight;

		c2d.clearRect( 0, 0, w, h );
		c2d.lineWidth = 1;
		c2d.font = '10px arial';
		c2d.textBaseline = 'middle';

		let iW = 0;
		for ( let i = 0; i < n; ++ i ) {

			const note = this.lowestNote + i;
			if ( isBlackKey( note ) ) continue;

			const xMin = w * iW / nW;
			const xMax = w * ++ iW / nW;

			c2d.fillStyle = '#777777';
			c2d.strokeStyle = '#ffffff';

			c2d.beginPath();
			c2d.moveTo( xMin, 0 );
			c2d.lineTo( xMin, h );
			c2d.lineTo( xMax, h );
			c2d.lineTo( xMax, 0 );
			c2d.closePath();

			c2d.fill();
			c2d.stroke();

			this.highlighting.paint( c2d, note, xMin, hB, xMax, h );

			if ( i == 0 || i == n - 1 ) {

				const label = numberToNoteName( note );
				const wC = c2d.measureText( label ).width;

				c2d.fillStyle = '#ffffff';
				c2d.fillText( label,
						( xMin + xMax - wC ) / 2, ( h + hB ) / 2 );
			}
		}

		iW = 0;
		const xExtent = ( w * 0.5 / n ) * blackKeyWidthUpscale;

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
			c2d.moveTo( xMin, 0 );
			c2d.lineTo( xMin, hB );
			c2d.lineTo( xMax, hB );
			c2d.lineTo( xMax, 0 );
			c2d.closePath();

			c2d.fill();
			c2d.stroke();

			this.highlighting.paint( c2d, note, xMin, hB / 2, xMax, hB );
		}
	}

	noteAtCoordinates( x, y ) {

		const w = this.width;
		const h = this.height;
		const n = this.#numberOfKeys();
		const nW = this.numberOfWhiteKeys;
		const hB = h * blackKeyFractionalHeight;

		const xExtent = ( w * 0.5 / n ) * blackKeyWidthUpscale;

		let iW = 0;
		for ( let i = 0; i < n; ++ i ) {

			const note = this.lowestNote + i;
			if ( ! isBlackKey( note ) ) { ++ iW; continue; }

			const xCenter = w * iW / nW;
			const xMin = xCenter - xExtent;
			const xMax = xCenter + xExtent;

			if ( x < xMin || x >= xMax || y < 0 || y >= hB ) continue;

			return note;
		}

		iW = 0;
		for ( let i = 0; i < n; ++ i ) {

			const note = this.lowestNote + i;
			if ( isBlackKey( note ) ) continue;

			const xMin = w * iW / nW;
			const xMax = w * ( iW + 1 ) / nW;
			++ iW;

			if ( x < xMin || x >= xMax || y < 0 || y >= h ) continue;

			return note;
		}

		return null;
	}
}
