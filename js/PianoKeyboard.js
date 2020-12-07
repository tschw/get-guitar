
const blackKeys = 0b010101001010;

const isBlackKey = (index) => ( blackKeys & (1 << (index % 12)) ) != 0;

const blackKeyFractionalHeight = 0.65;
const blackKeyWidthUpscale = 1.2;

export class PianoKeyboard {

	constructor( width, height, firstOctave, numberOfOctaves, highlighting ) {

		this.width = width;
		this.height = height;

		this.highlighting = highlighting;

		this.firstOctave = firstOctave
		this.numberOfKeys = numberOfOctaves * 12;
		this.numberOfWhiteKeys = numberOfOctaves * 7;
	}

	paint( c2d ) {

		const w = this.width;
		const h = this.height;
		const n = this.numberOfKeys;
		const nW = this.numberOfWhiteKeys;
		const hB = h * blackKeyFractionalHeight;

		c2d.clearRect( 0, 0, w, h );


		let whiteKeyIndex = 0
		for ( let i = 0; i < this.numberOfKeys; ++ i ) {

			if ( isBlackKey(i) ) continue;

			const iW = whiteKeyIndex ++;
			const xMin = w * iW / nW;
			const xMax = w * (iW + 1) / nW;

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

			const note = i + this.firstOctave * 12;
			this.highlighting.paint( c2d, note, xMin, hB, xMax, h );
		}

		for ( let i = 0; i < this.numberOfKeys; ++ i ) {

			if ( ! isBlackKey(i) ) continue;

			const n = this.numberOfKeys;
			const xCenter = w * (i + 0.5) / n;
			const xExtent = (w * 0.5 / n) * blackKeyWidthUpscale;
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

			const note = i + this.firstOctave * 12;
			this.highlighting.paint( c2d, note, xMin, hB / 2, xMax, hB );
		}
	}

	noteAtCoordinates( x, y ) {

		const w = this.width;
		const h = this.height;
		const n = this.numberOfKeys;
		const nW = this.numberOfWhiteKeys;
		const hB = h * blackKeyFractionalHeight;

		for ( let i = 0; i < this.numberOfKeys; ++ i ) {

			if ( ! isBlackKey(i) ) continue;

			const n = this.numberOfKeys;
			const xCenter = w * (i + 0.5) / n;
			const xExtent = (w * 0.5 / n) * blackKeyWidthUpscale;
			const xMin = xCenter - xExtent;
			const xMax = xCenter + xExtent;

			if ( x < xMin || x >= xMax || y < 0 || y >= hB ) continue;

			return i + this.firstOctave * 12;
		}

		let whiteKeyIndex = 0
		for ( let i = 0; i < this.numberOfKeys; ++ i ) {

			if ( isBlackKey(i) ) continue;

			const iW = whiteKeyIndex ++;
			const xMin = w * iW / nW;
			const xMax = w * (iW + 1) / nW;

			if ( x < xMin || x >= xMax || y < 0 || y >= h ) continue;

			return i + this.firstOctave * 12;
		}
	}
}
