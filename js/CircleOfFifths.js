import { transpose, Tonality, noteNameInOctave } from './Music.js'
import { VariableColor } from './VariableColor.js'
import { animation } from './Animation.js'

const Deg2Rad = Math.PI / 180;
const TwoPi = Math.PI * 2;

const FractionalBullsEyeRadius = 0.25;

const StrokeColor = new VariableColor( 0, 0, 1, {} );
const FillSmoothing = 0.9;
const StrokeSmoothing = 0.85;
const MotionSmoothing = 0.75;


const scaleColor = ( hue ) => new VariableColor( hue,
			{ i: 0, a: 0.6, b: 0.8 }, { i: 0, a: 0.05, b: 0.35 }, { i: 1 } );

export class CircleOfFifths {

	#animationState;
	#cachedPickingResult;

	constructor( xLeft, yTop, size ) {

		this.xLeft = xLeft;
		this.yTop = yTop;
		this.size = size;

		this.scales = [

			{ color: scaleColor( 80 ), label: "Natural: Major / minor", tonality: Tonality.Natural },
			{ color: scaleColor( 50 ), label: "Ionian \u{1d130}5 / harmonic", tonality: Tonality.MinorHarmonic },
			{ color: scaleColor( 30 ), label: "Lydian \u{1d130}5 / melodic", tonality: Tonality.MinorMelodic },
			{ color: scaleColor( 6 ), label: "Harmonic / \u{1d12c} lydian \u{1d130}2 \u{1d130}5", tonality: Tonality.Harmonic },
			{ color: scaleColor( 290 ), label: "Dbl. harmonic / \u{1d12c} ionian \u{1d130}2 \u{1d130}5", tonality: Tonality.DoubleHarmonic },
			{ color: scaleColor( 205 ), label: "Pentatonic + blue note", tonality: Tonality.Blues6 },
			{ color: scaleColor( 170 ), label: "Natural + two blue notes", tonality: Tonality.Blues9 }
		];

		this.matchTonality = 0;

		this.highlitTonality = 0;
		this.selectedTonality = 0;

		this.highlitScale = null;
		this.selectedScale = null;

		this.#cachedPickingResult = { tonality: 0, key: 0, scaleIndex: -1 };

		this.#animationState = this.#createAnimationState();
	}

	#createAnimationState() {

		const nScales = this.scales.length, n = nScales * 12;

		const perTonality = new Array( n );

		for ( let i = 0; i != n; ++ i )
			perTonality[ i ] = { fill: 0, stroke: 0 };

		return { perTonality, selectedness: 0, jLastSelectedScale: nScales };
	}

	paint( c2d ) {

		const scales = this.scales;
		const nScales = scales.length;

		if ( this.#animationState.perTonality.length != nScales * 12 )

			this.#animationState = this.#createAnimationState();

		c2d.lineWidth = 1;
		c2d.font = '12px arial';
		c2d.textBaseline = 'middle';

		const rMax = this.size / 2;
		const rMin = rMax * FractionalBullsEyeRadius;
		const rSeg = ( rMax - rMin ) / nScales;
		const rText = rMax * 0.83;

		const xCenter = this.xLeft + rMax, yCenter = this.yTop + rMax;

		const animationState = this.#animationState;

		const tonality = this.matchTonality;
		const bcTonality = bitCount( tonality ) || 1;

		let jSelectedScale =
				nScales - 1 - scales.indexOf( this.selectedScale );
		let jLastSelectedScale = animationState.jLastSelectedScale;
		let targetSelectedness = 1;
		let flipMode = false;

		if ( jSelectedScale == nScales ) {

			jSelectedScale = jLastSelectedScale;
			targetSelectedness = 0;

		} else if ( jSelectedScale != jLastSelectedScale &&
				jLastSelectedScale != nScales ) {

			if ( animationState.selectedness == 1 )
				animationState.selectedness = 0;

			flipMode = true;
		}

		const selectedness = (
				animationState.selectedness += animation.delta( 
					animationState.selectedness,
					targetSelectedness, MotionSmoothing ) );

		const rSelectedInner = ! flipMode ? lerp(
				rMin + rSeg * jSelectedScale, rMin, selectedness ) : rMin;

		const rSelectedOuter = lerp( ! flipMode ?
				rMin + rSeg * jSelectedScale + rSeg : rMin, rMax, selectedness );

		if ( selectedness == 0 )
			animationState.jLastSelectedScale = nScales;

		else if ( selectedness == 1 )
			animationState.jLastSelectedScale = jSelectedScale;

		for ( let i = 0, a = 105; i != 12; ++ i, a -= 30 ) {

			const key = i * 7 % 12;

			const a0 = a * Deg2Rad;
			const a1 = ( a - 15 ) * Deg2Rad;
			const a2 = ( a - 30 ) * Deg2Rad;

			const x0 = Math.cos( a0 ), y0 = Math.sin( a0 );
			const x1 = Math.cos( a1 ), y1 = Math.sin( a1 );
			const x2 = Math.cos( a2 ), y2 = Math.sin( a2 );

			for (let j = 0; j != nScales; ++ j) {

				const scale = this.scales[ nScales - 1 - j ];
				const currentTonality = transpose( scale.tonality, key );

				let rInner = rMin + rSeg * j;
				let rOuter = rMin + rSeg * j + rSeg;

				if ( jSelectedScale != nScales ) {

					if ( j == jSelectedScale ) {

						rInner = rSelectedInner;
						rOuter = rSelectedOuter;

					} else if ( flipMode ) {

						if ( j != jLastSelectedScale ) continue;

						rInner = rSelectedOuter;
						rOuter = rMax;

					} else if ( j < jSelectedScale ) {		// ) i o <- si   so

						if ( rSelectedInner <= rInner ) continue;
						if ( rSelectedInner < rOuter ) rOuter = rSelectedInner;

					} else {								// ) si   so -> i o

						if ( rSelectedOuter >= rOuter ) continue;
						if ( rSelectedOuter > rInner ) rInner = rSelectedOuter;
					}
				}

				const isHighlit = this.highlitTonality == currentTonality ||
						this.highlitScale == scale &&
						this.selectedTonality == 0 &&
						this.selectedScale == null;

				const isSelected = this.selectedTonality == currentTonality;

				const match = 1 - bitCount( (
						currentTonality & tonality ) ^ tonality ) / bcTonality;

				const state = animationState.perTonality[ j * 12 + i ];

				state.fill += animation.delta( state.fill,
						Math.pow( match, 4.0 ) * 0.6 +
							( isSelected ? 0.4 : 0 ), FillSmoothing );

				state.stroke += animation.delta( state.stroke,
						isHighlit || isSelected ? 1 : 0, StrokeSmoothing );

				c2d.strokeStyle = StrokeColor.toString( state.stroke );
				c2d.fillStyle = scale.color.toString( state.fill );

				c2d.beginPath();
				c2d.moveTo( xCenter + rInner * x0, yCenter - rInner * y0 );
				c2d.lineTo( xCenter + rInner * x2, yCenter - rInner * y2 );
				c2d.lineTo( xCenter + rOuter * x2, yCenter - rOuter * y2 );
				c2d.lineTo( xCenter + rOuter * x0, yCenter - rOuter * y0 );
				c2d.closePath();
				c2d.fill();
				c2d.stroke();
			}

			const name = noteNameInOctave( key ) +
					" " + noteNameInOctave( ( key + 9 ) % 12 ).toLowerCase();
			c2d.fillStyle = '#fff';
			c2d.fillText( name, xCenter + x1 * rText - 
					c2d.measureText( name ).width / 2, yCenter - y1 * rText );
			c2d.stroke();
		}
	}

	isAnimating() {

		const scales = this.scales;
		const nScales = scales.length;

		const prevSelectedScale = scales[
				nScales - 1 - this.#animationState.jLastSelectedScale ];

		return this.selectedScale != prevSelectedScale;
	}

	pickAtCoordinates( x, y ) {

		if ( x < this.xLeft || y < this.yTop ) return null;

		const rMax = this.size / 2;
		const rx = x - this.xLeft - rMax, ry = this.yTop + rMax - y;

		const l = Math.sqrt( rx * rx + ry * ry );

		if ( l > rMax ) return null;

		const k = Math.round(
				Math.atan2( ry, rx ) / ( 30 * Deg2Rad ) );

		const a1 = k * 30 * Deg2Rad;
		const a0 = a1 + 15 * Deg2Rad;
		const a2 = a1 - 15 * Deg2Rad;

		const x0 = Math.cos( a0 ), y0 = Math.sin( a0 );
		const x2 = Math.cos( a2 ), y2 = Math.sin( a2 );

		const rMin = rMax * FractionalBullsEyeRadius;

		if ( clockwise( rx, ry,
				rMin * x0, rMin * y0,  rMin * x2, rMin * y2 ) )

			return null;

		const scales = this.scales;
		const nScales = scales.length;
		const rSeg = ( rMax - rMin ) / nScales;

		const animationState = this.#animationState;
		let jSelectedScale =
				nScales - 1 - scales.indexOf( this.selectedScale );
		let jLastSelectedScale = animationState.jLastSelectedScale;
		let flipMode = false;

		if ( jSelectedScale == nScales )

			jSelectedScale = jLastSelectedScale;

		else if ( jSelectedScale != jLastSelectedScale &&
				jLastSelectedScale != nScales )

			flipMode = true;

		const selectedness = animationState.selectedness;

		const rSelectedInner = ! flipMode ? lerp(
				rMin + rSeg * jSelectedScale, rMin, selectedness ) : rMin;

		const rSelectedOuter = lerp( ! flipMode ?
				rMin + rSeg * jSelectedScale + rSeg : rMin, rMax, selectedness );

		for ( let j = 0; j != nScales; ++ j ) {

			const rInner = rMin + rSeg * j;
			let rOuter = rMin + rSeg * j + rSeg - 1;

			if ( jSelectedScale != nScales ) {

				if ( j == jSelectedScale ) {

					rOuter = rSelectedOuter;

				} else if ( flipMode ) {

					if ( j != jLastSelectedScale ) continue;

					rOuter = rMax;

				} else if ( j < jSelectedScale ) {		// ) i o <- si   so

					if ( rSelectedInner <= rInner ) continue;
					if ( rSelectedInner < rOuter ) rOuter = rSelectedInner;

				} else {								// ) si   so -> i o

					if ( rSelectedOuter >= rOuter ) continue;
				}
			}

			if ( clockwise( rx, ry,
					rOuter * x0, rOuter * y0,  rOuter * x2, rOuter * y2 ) ) {
				const result = this.#cachedPickingResult;

				result.key = ( 12 + 3 - k ) * 7 % 12;
				result.scaleIndex = nScales - 1 - j;
				result.tonality = transpose(
						scales[ result.scaleIndex ].tonality, result.key );
				return result;
			}
		}

		return null;
	}
}

function lerp( a, b, t ) {

	return a + ( b - a ) * t;
}

function bitCount( x ) {

	let result = 0;
	for ( let y = x; y != 0; y >>>= 1 ) result += y & 1;
	return result;
}

function clockwise( x0,y0, x1,y1, x2,y2 ) {

	const x01 = x1 - x0, y01 = y1 - y0;
	const x02 = x2 - x0, y02 = y2 - y0;

	return x01 * y02 - x02 * y01 < 0;
}
