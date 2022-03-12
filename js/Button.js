import { hsl2rgb } from './Color.js'

const fillHue = 120;
const fillSaturation = 0.5;

const strokeColor = '200, 200, 200';

const lightnessNormal = 0.15;
const lightnessHighlit = 0.38;

const opacityEnabled = 1.0;
const opacityDisabled = 0.2;

const smoothing = 0.25;

export class Button {

	#animationState;

	constructor( x, y, width, height, caption, enabled, highlit ) {

		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.caption = caption;

		this.enabled = enabled != null ? enabled : true;
		this.highlit = highlit != null ? highlit : false;

		this.#animationState = {

			opacity: this.enabled ? opacityEnabled : opacityDisabled,
			lightness: this.highlit ? lightnessHighlit : lightnessNormal
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

		const targetOpacity = this.enabled ? opacityEnabled : opacityDisabled;
		state.opacity += checkIdle( targetOpacity - state.opacity ) * smoothing;

		const targetLightness =
				this.highlit ? lightnessHighlit : lightnessNormal;
		state.lightness += checkIdle(
				targetLightness - state.lightness ) * smoothing;

		return idle;
	}

	paint( c2d ) {

		const state = this.#animationState;

		c2d.lineWidth = 2;
		c2d.setLineDash( [] );
		c2d.strokeStyle = `rgba(${ strokeColor }, ${ state.opacity }`;
		c2d.fillStyle = hsl2rgb(
				fillHue, fillSaturation, state.lightness, state.opacity );

		c2d.beginPath();
		c2d.rect( this.x, this.y, this.width, this.height );

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
				this.x + ( this.width - textWidth ) / 2,
				this.y + this.height / 2 );
	}

	isContained( x, y ) {

		return x >= this.x && x <= this.x + this.width &&
				y >= this.y && y <= this.y + this.height;
	}

	highlightIfContained( x, y ) {

		this.highlit = this.isContained( x, y );
	}
}
