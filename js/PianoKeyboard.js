import { Tonality, numberToNoteName, numberToFlatNoteName } from './Music.js'
import { VariableColor } from './VariableColor.js'
import { litStrokes } from './PolygonOutliners.js'
import { animation } from './Animation.js'

const ColorBlackKeys = new VariableColor( 0, 0, { a: 0, b: 0.3 }, 1 );

const isBlackKey = ( i ) => ( Tonality.Natural & ( 1 << ( i % 12 ) ) ) == 0;

const BlackKeyFractionalHeight = 0.65;
const BlackKeyFractionalWidth = 0.65;

const HighestNoteLimit = 9 * 12 - 1;

const MotionSmoothing = 0.55;


export class PianoKeyboard {

	#scrollOffset = 0;
	#scrollTarget = -1;

	constructor( yTop, width, height,
			numberOfWhiteKeys, settings, highlighting ) {

		this.yTop = yTop;
		this.width = width;
		this.height = height;

		this.settings = settings;
		this.confState = settings.state.local;
		this.highlighting = highlighting;

		this.numberOfWhiteKeys = numberOfWhiteKeys;
	}

	canScrollViewport( direction ) {

		const lowest = this.confState.keysLowestWhite + direction;
		const highest = lowest + this.#numberOfKeys();
		return lowest >= 0 && highest <= HighestNoteLimit;
	}

	scrollViewport( direction ) {

		if ( this.isScrolling() ||
				! this.canScrollViewport( direction ) ) return;

		const o = ( this.#scrollOffset = 1 - (
				this.#scrollTarget = direction * 0.5 + 0.5 ) );

		if ( o == 1 ) {
			this.confState.keysLowestWhite = this.#nextLowestWhiteKey( -1 );
			this.settings.persist();
		}

		animation.requestRefresh();
	}

	isScrolling() {

		return this.#scrollTarget != -1;
	}

	paint( c2d ) {

		const o = this.#updatedScrollOffset();

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

		const confState = this.confState;

		let iW = 0;
		for ( let i = 0; i < n; ++ i ) {

			const note = confState.keysLowestWhite + i;
			if ( isBlackKey( note ) ) continue;

			const xMin = w * ( iW - o ) / nW;
			const xMax = w * ( ++ iW - o ) / nW;

			c2d.fillStyle = '#777777';
			c2d.strokeStyle = '#ffffff';

			c2d.beginPath();
			c2d.rect( xMin, yMin, xMax - xMin, h );
			c2d.fill();
			c2d.stroke();

			this.highlighting.paint( c2d, note, xMin, yMaxB, xMax, yMaxW );

			if ( confState.keysNoteNamesWhite ) {

				const label = numberToNoteName( note );
				const wC = c2d.measureText( label ).width;

				c2d.fillStyle = '#eee';
				c2d.fillText( label,
						( xMin + xMax - wC ) / 2, ( yMaxB + yMaxW ) / 2 );
			}
		}

		iW = 0;
		const xExtent = ( w * 0.5 / nW ) * BlackKeyFractionalWidth;
		const yMinH = yMin + hB / 2;

		for ( let i = -1; i <= n; ++ i ) {

			const note = confState.keysLowestWhite + i;

			if ( ! isBlackKey( note + 12 ) ) {

				if ( i >= 0 ) ++ iW;
				continue;
			}

			const xCenter = w * ( iW - o ) / nW;
			const xMin = xCenter - xExtent;
			const xMax = xCenter + xExtent;

			c2d.fillStyle = '#101010';
			c2d.strokeStyle = '#000000';

			c2d.beginPath();
			c2d.rect( xMin, yMin, xMax - xMin, hB );
			c2d.fill();
			litStrokes.c2d = c2d;
			c2d.lineWidth = 4;
			ColorBlackKeys.toRgba( 1.0, null, null, null, litStrokes.colorLit );
			ColorBlackKeys.toRgba( 0.0, null, null, null, litStrokes.color );
			litStrokes.begin();
			litStrokes.vertex( xMax, yMin );
			litStrokes.vertex( xMax, yMin + hB );
			litStrokes.vertex( xMin, yMin + hB );
			litStrokes.vertex( xMin, yMin );
			c2d.lineWidth = 1;

			this.highlighting.paint( c2d, note, xMin, yMinH, xMax, yMaxB );

			const showNamesSharp = confState.keysNoteNamesBlackSharp,
					showNamesFlat = confState.keysNoteNamesBlackFlat;

			if ( showNamesSharp || showNamesFlat ) {

				c2d.fillStyle = '#eee';

				let label = numberToNoteName( note );
				const metrics = c2d.measureText( label );
				let wC = metrics.width;
				let hL = 1.5 * (
						metrics.actualBoundingBoxAscent +
							metrics.actualBoundingBoxDescent );

				if ( showNamesSharp && showNamesFlat ) {

					c2d.fillText(
							label, ( xMin + xMax - wC ) / 2,
								( yMin + yMaxB ) / 2 - hL );

					hL = 0;
				} else hL *= 0.5;

				if ( showNamesFlat ) {

					label = numberToFlatNoteName( note );
					wC = c2d.measureText( label ).width;
				}

				c2d.fillText( label,
						( xMin + xMax - wC ) / 2, ( yMin + yMaxB ) / 2 - hL );
			}
		}

		c2d.restore();
	}

	noteAtCoordinates( x, y ) {

		const w = this.width;
		const h = this.height;
		const yMin = this.yTop;

		if ( x > w || y < yMin || y > yMin + h ) return null;

		const hB = h * BlackKeyFractionalHeight;
		const yMaxB = yMin + hB;

		const o = this.#scrollOffset;
		const n = this.#numberOfKeys();
		const nW = this.numberOfWhiteKeys;

		const xExtent = ( w * 0.5 / nW ) * BlackKeyFractionalWidth;

		let iW = 0;
		for ( let i = 0; i < n; ++ i ) {

			const note = this.confState.keysLowestWhite + i;
			if ( ! isBlackKey( note ) ) { ++ iW; continue; }

			const xCenter = w * ( iW - o ) / nW;
			const xMin = xCenter - xExtent;
			const xMax = xCenter + xExtent;

			if ( x < xMin || x >= xMax || y < yMin || y >= yMaxB ) continue;

			return note;
		}

		const yMaxW = yMin + h;

		iW = 0;
		for ( let i = 0; i < n; ++ i ) {

			const note = this.confState.keysLowestWhite + i;
			if ( isBlackKey( note ) ) continue;

			const xMin = w * ( iW - o ) / nW;
			const xMax = w * ( ++ iW - o ) / nW;

			if ( x < xMin || x >= xMax || y < yMin || y >= yMaxW ) continue;

			return note;
		}

		return null;
	}

	#nextLowestWhiteKey( direction ) {

		let result = this.confState.keysLowestWhite;
		do { result += direction; } while ( isBlackKey( result ) );
		return result;
	}

	#numberOfVisibleWhiteKeys() {

		return this.numberOfWhiteKeys + ( this.isScrolling() ? 1 : 0 );
	}

	#numberOfKeys() {

		let n = 0;

		for ( let iW = 0, nW = this.#numberOfVisibleWhiteKeys(); iW < nW; ++ n )

			if ( ! isBlackKey( n + this.confState.keysLowestWhite ) ) ++ iW;

		return n;
	}

	#updatedScrollOffset() {

		const scrollTarget = this.#scrollTarget;
		if ( scrollTarget == -1 ) return 0;

		let scrollOffset = this.#scrollOffset;

		scrollOffset += animation.delta(
				scrollOffset, scrollTarget, MotionSmoothing );

		if ( scrollOffset == scrollTarget ) {

			if ( scrollOffset == 1 ) {

				scrollOffset = 0;
				this.confState.keysLowestWhite = this.#nextLowestWhiteKey( 1 );
				this.settings.persist();
			}

			this.#scrollTarget = -1;
		}

		this.#scrollOffset = scrollOffset;
		return scrollOffset;
	}
}
