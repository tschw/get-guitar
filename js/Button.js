import { VariableColor } from './VariableColor.js'
import { animation } from './Animation.js'

const Opacity = { a: 0.2, b: 0.9 };

const DefaultFillColor = new VariableColor(
		120, 0.5, { a: 0.15, b: 0.38 }, Opacity );

const DefaultStrokeColor = new VariableColor( 0, 0, 0.7, Opacity );

const Smoothing = 0.75;


export class Button {

	#animationState;

	constructor( xLeft, yTop, width, height, label ) {

		this.xLeft = xLeft;
		this.yTop = yTop;
		this.width = width;
		this.height = height;
		this.label = label;

		this.enabled = true;
		this.highlit = false;

		this.#animationState = {

			opacity: this.enabled ? 1 : 0,
			lightness: this.highlit ? 1 : 0
		};

		this.fillColor = DefaultFillColor;
		this.textColor = DefaultStrokeColor;
		this.strokeColor = DefaultStrokeColor;
	}

	paint( c2d ) {

		const state = this.#animationState;

		c2d.lineWidth = 2;
		c2d.setLineDash( [] );
		c2d.strokeStyle = this.strokeColor.toString( state.opacity );
		c2d.fillStyle =
				this.fillColor.toString( state.lightness, state.opacity );

		c2d.beginPath();
		c2d.rect( this.xLeft, this.yTop, this.width, this.height );

		c2d.fill();
		c2d.stroke();

		c2d.fillStyle = this.textColor.toString( state.opacity );
		c2d.font = '18px arial';
		c2d.textBaseline = 'middle';

		const textMeasure = c2d.measureText( this.label );

		const textWidth =
				textMeasure.actualBoundingBoxRight -
				textMeasure.actualBoundingBoxLeft;
		const textHeight =
				textMeasure.actualBoundingBoxAscent +
				textMeasure.actualBoundingBoxDescent;

		c2d.fillText( this.label,
				this.xLeft + ( this.width - textWidth ) / 2,
				this.yTop + this.height / 2 );

		state.opacity += animation.delta(
				state.opacity, this.enabled ? 1 : 0, Smoothing );

		state.lightness += animation.delta(
				state.lightness, this.highlit ? 1 : 0, Smoothing );
	}

	isContained( x, y ) {

		return x >= this.xLeft && x <= this.xLeft + this.width &&
				y >= this.yTop && y <= this.yTop + this.height;
	}

	highlightIfContained( x, y ) {

		const contained = this.isContained( x, y );
		if ( this.enabled )
			this.highlit = animation.ifStateChange( this.highlit, contained );
		return contained;
	}

	setEnabled( enable ) {

		if ( this.enabled && ! enable ) this.highlit = false;
		this.enabled = animation.ifStateChange( this.enabled, enable );
	}

	unhighlight() {

		this.highlit = animation.ifStateChange( this.highlit, false );
	}
}
