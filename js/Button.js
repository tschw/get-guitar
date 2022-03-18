import { VariableColor } from './VariableColor.js'

const opacity = { a: 0.2, b: 1.0 };
const fillColor = new VariableColor( 120, 0.5, { a: 0.15, b: 0.38 }, opacity );
const strokeColor = new VariableColor( 0, 0, 0.7, opacity );

const smoothing = 0.25;

export class Button {

	#animationState;

	constructor( xLeft, yTop, width, height, caption, enabled, highlit ) {

		this.xLeft = xLeft;
		this.yTop = yTop;
		this.width = width;
		this.height = height;
		this.caption = caption;

		this.enabled = enabled != null ? enabled : true;
		this.highlit = highlit != null ? highlit : false;

		this.#animationState = {

			opacity: this.enabled ? 1 : 0,
			lightness: this.highlit ? 1 : 0
		};
	}

	attenuate() {

		let idle = true;
		function checkIdle( value ) {

			const closeEnough = 1 / 1024;

			if ( Math.abs(value) > closeEnough ) idle = false;
			return value;
		}

		const state = this.#animationState;

		const targetOpacity = this.enabled ? 1 : 0;
		state.opacity += checkIdle( targetOpacity - state.opacity ) * smoothing;

		const targetLightness = this.highlit ? 1 : 0;
		state.lightness += checkIdle(
				targetLightness - state.lightness ) * smoothing;

		return idle;
	}

	paint( c2d ) {

		const state = this.#animationState;

		c2d.lineWidth = 2;
		c2d.setLineDash( [] );
		c2d.strokeStyle = strokeColor.toString( state.opacity );
		c2d.fillStyle = fillColor.toString( state.lightness, state.opacity );

		c2d.beginPath();
		c2d.rect( this.xLeft, this.yTop, this.width, this.height );

		c2d.fill();
		c2d.stroke();

		c2d.fillStyle = '#cccccc';
		c2d.font = '18px arial';
		c2d.textBaseline = 'middle';

		const textMeasure = c2d.measureText( this.caption );

		const textWidth =
				textMeasure.actualBoundingBoxRight -
				textMeasure.actualBoundingBoxLeft;
		const textHeight =
				textMeasure.actualBoundingBoxAscent +
				textMeasure.actualBoundingBoxDescent;

		c2d.fillText( this.caption,
				this.xLeft + ( this.width - textWidth ) / 2,
				this.yTop + this.height / 2 );
	}

	isContained( x, y ) {

		return x >= this.xLeft && x <= this.xLeft + this.width &&
				y >= this.yTop && y <= this.yTop + this.height;
	}

	highlightIfContained( x, y ) {

		const contained = this.isContained( x, y );
		if ( this.enabled ) this.highlit = contained;
		return contained;
	}
}
