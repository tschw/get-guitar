import { VariableColor } from './VariableColor.js'
import { canvasPath, litStrokes, pointContainment } from './PolygonOutliners.js'
import { checkStyle } from './Utility.js'
import { animation } from './Animation.js'
import { noOp } from './Utility.js'

const Opacity = { a: 0.5, b: 0.8 };

const DefaultFillColor = new VariableColor(
		120, { a: 0.27, b: 0.62 }, { i: 0, a: 0.15, b: 0.23 }, Opacity );

export const DefaultStrokeColor = new VariableColor( 0.2, 0.1, { a: 0.5, b: 0.9 }, Opacity );

const DefaultTextPaddingX = 4, DefaultTextPaddingY = 4;

const CornerRadiusX = 6;
const CornerRadiusY = 6;
const CornerTesselation = 4;

const Smoothing = 0.75;
const SmoothingPulse = 0.88;

const DoNothing = function() { };

export class Button {

	action = noOp;

	visible = true;
	enabled = true;
	highlit = false;
	pulsing = false;

	fillColor = DefaultFillColor;
	textColor = DefaultStrokeColor;
	strokeColor = DefaultStrokeColor;

	#visualState = {
		width: 0, height: 0,
		opacity: 1, lightness: 0,
		pulse: 0, pulseTarget: 0
	};

	constructor( xLeft, yTop, width, height, label ) {

		this.xLeft = xLeft;
		this.yTop = yTop;
		this.width = width;
		this.height = height;
		this.label = label;
	}

	paint( c2d ) {

		if ( ! this.visible ) return;

		const state = this.#visualState;
		const opacity = state.opacity, lightness = state.lightness;

		c2d.font = '18px arial';
		c2d.textBaseline = 'middle';

		const textMeasure = c2d.measureText( this.label );

		const textWidth =
				textMeasure.actualBoundingBoxRight -
				textMeasure.actualBoundingBoxLeft;
		const textHeight =
				textMeasure.actualBoundingBoxAscent +
				textMeasure.actualBoundingBoxDescent;

		const width = this.width || textWidth + DefaultTextPaddingX;
		const height = this.height || textHeight + DefaultTextPaddingY;

		state.width = width;
		state.height = height;

		c2d.lineWidth = 2;
		c2d.setLineDash( [] );
		c2d.strokeStyle = checkStyle( this.strokeColor.toString( 0, opacity ) );
		c2d.fillStyle = checkStyle( this.fillColor.toString( lightness, opacity ) );

		canvasPath.c2d = c2d;
		this.#outline( canvasPath );
		c2d.fill();

		litStrokes.c2d = c2d;
		this.strokeColor.toRgba( 1.0, opacity, null, null, litStrokes.colorLit );
		this.strokeColor.toRgba( 0.0, opacity, null, null, litStrokes.color );
		this.#outline( litStrokes );

		c2d.fillStyle = checkStyle( this.textColor.toString( 0.75, opacity ) );
		c2d.fillText( this.label,
				this.xLeft + ( width - textWidth ) / 2, this.yTop + height / 2 );


		const enabled = this.enabled, highlit = this.highlit;
		const pulsing = enabled && this.pulsing, pulse = state.pulse;

		if ( pulsing ) {

			const pulseTarget = state.pulseTarget;
			if ( pulse == pulseTarget ) state.pulseTarget = 1 - pulse;

			state.pulse += animation.delta(
					pulse, state.pulseTarget, SmoothingPulse );

		} else {

			state.pulse = 0;
			state.pulseTarget = 0;
		}

		state.opacity += animation.delta( opacity, enabled ? 1 : 0, Smoothing );
		state.lightness += animation.delta( lightness,
				highlit ? 1 : pulsing ? pulse : 0, Smoothing );
	}

	#outline( p ) {

		const state = this.#visualState;

		p.begin();
		this.#outlineCorner( p, this.xLeft, this.yTop, CornerRadiusX, CornerRadiusY );
		this.#outlineCorner( p, this.xLeft + state.width, this.yTop, -CornerRadiusX, CornerRadiusY );
		this.#outlineCorner( p, this.xLeft + state.width, this.yTop + state.height, -CornerRadiusX, -CornerRadiusY );
		this.#outlineCorner( p, this.xLeft, this.yTop + state.height, CornerRadiusX, -CornerRadiusY );
		p.close();
	}

	#outlineCorner( p, x, y, dx, dy ) {

		if ( CornerTesselation <= 1 ) p.vertex( x, y );
		else {

			const arcCenterX = x + dx, arcCenterY = y + dy;
			const n = CornerTesselation;
			const d = Math.sign( dx * dy );
			const begin = Math.max( 0, - CornerTesselation * d + d );
			const until = Math.max( d, CornerTesselation * d );
			for ( let i = begin; i != until; i += d ) {

				const a = i * 0.5 * Math.PI / ( CornerTesselation - 1 );
				p.vertex( arcCenterX - dx * Math.cos( a ),
						arcCenterY - dy * Math.sin( a ) );
			}
		}

	}

	isContained( x, y ) {

		const state = this.#visualState;

		pointContainment.x = x;
		pointContainment.y = y;
		pointContainment.result = false;

		if ( this.visible && x >= this.xLeft && y >= this.yTop &&
				x < this.xLeft + state.width && y < this.yTop + state.height )

			this.#outline( pointContainment );

		return pointContainment.result;
	}

	actionIfContained( x, y ) {

		const contained = this.isContained( x, y );
		if ( this.enabled && contained ) this.action();
		return contained;
	}

	highlightIfContained( x, y ) {

		const contained = this.isContained( x, y );
		if ( this.enabled )
			this.highlit = animation.ifStateChange( this.highlit, contained );
		return contained;
	}

	unhighlight() {

		this.highlit = animation.ifStateChange( this.highlit, false );
	}
}
