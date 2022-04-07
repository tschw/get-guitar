import { VariableColor } from './VariableColor.js'
import { animation } from './Animation.js'

const FillSmoothing = 0.9;
const ShapeSmoothing = 0.91;
const StrokeSmoothing = 0.85;

const NumberOfNotes = 11 * 12;

const ShapeSegmentation = 24;
const TriangleRadiusUpscale = 1.22;

export class Highlighting {

	#colors;
	#animationState;

	constructor() {

		this.selection = 0;
		this.highlitNote = null;
		this.highlitTonality = 0;

		this.#colors = [
			new VariableColor(   0, 0.9, 0.4, {} ), // C
			new VariableColor(   0, 0.5, 0.8, {} ), // C#
			new VariableColor(  65, 0.9, 0.4, {} ), // D
			new VariableColor(  65, 0.5, 0.8, {} ), // D#
			new VariableColor(  30, 0.9, 0.4, {} ), // E
			new VariableColor( 180, 0.9, 0.4, {} ), // F
			new VariableColor( 180, 0.5, 0.8, {} ), // F#
			new VariableColor( 110, 0.9, 0.4, {} ), // G
			new VariableColor( 110, 0.5, 0.8, {} ), // G#
			new VariableColor( 240, 0.9, 0.4, {} ), // A
			new VariableColor( 240, 0.5, 0.8, {} ), // A#
			new VariableColor( 270, 0.9, 0.4, {} )  // B
		];

		const colorVariation = new Array( 12 );
		for ( let i = 0; i < 12; ++ i )
			colorVariation[ i ] = { stroke: 0, fill: 0 };

		this.#animationState = {

			color: colorVariation,
			shape: new Float32Array( NumberOfNotes )
		};
	}

	attenuate() {

		const animationState = this.#animationState;

		const highlight = this.highlitNote;
		const highlitTonality = this.highlitTonality;

		const highlightValid = highlight != null && highlitTonality == 0;
		const highlightInOctave = highlightValid ? highlight % 12 : -1;

		const colorVariation = animationState.color;

		for ( let noteInOctave = 0; noteInOctave < 12; ++ noteInOctave ) {

			const s = colorVariation[ noteInOctave ];

			const noteBit = 1 << noteInOctave;
			const isHighlit =
					noteInOctave == highlightInOctave ||
					( this.highlitTonality & noteBit ) != 0;
			const isSelected = ( this.selection & noteBit ) != 0;

			const targetOpacity = isSelected ? 0.7 : 0.0;
			const targetHighlight = isHighlit ? 1.0 : 0.0;

			s.fill += animation.delta( s.fill, targetOpacity, FillSmoothing);
			s.stroke += animation.delta(
					s.stroke, targetHighlight, StrokeSmoothing );
		}

		const shapeState = animationState.shape;

		for ( let note = 0; note < NumberOfNotes; ++ note ) {

			let targetShape = 0;

			if ( highlightValid && note != highlight ) {

				const noteInOctave = note % 12;

				if ( noteInOctave == highlightInOctave )
					targetShape = Math.sign( note - highlight );
			}

			let shape = shapeState[ note ];
			if ( shape == targetShape ) continue;
			shape += animation.delta( shape, targetShape, ShapeSmoothing );
			shapeState[ note ] = shape;
		}
	}

	paint( c2d, note, xMin, yMin, xMax, yMax ) {

		const animationState = this.#animationState;

		const w = xMax - xMin;
		const h = yMax - yMin;
		const x = ( xMin + xMax ) / 2;
		const y = ( yMin + yMax ) / 2;
		const r = Math.min( w, h ) / 4;
		const noteInOctave = note % 12;

		const c = animationState.color[ noteInOctave ];
		const stroke = c.stroke, fill = c.fill;
		if ( stroke == 0 && fill == 0 ) return;

		c2d.strokeStyle = `rgba(255, 255, 255, ${ c.stroke })`;
		c2d.fillStyle = this.#colors[ noteInOctave ].toString( c.fill );

		c2d.beginPath();

		const s = animationState.shape[ note ];

		if ( s == 0 ) {

			c2d.arc( x, y, r, 0, Math.PI * 2 );

		} else if ( s == 1 || s == -1 ) {

			const h = 3 * r * TriangleRadiusUpscale / 2;
			const a = h * 0.5 / 0.866; // sqrt( 3 ) / 2
			const e = h / 3;

			if ( s == 1 ) {

				c2d.moveTo( x, y - h + e );
				c2d.lineTo( x + a, y + e );
				c2d.lineTo( x - a, y + e );
				c2d.closePath();

			} else /* ( s == 0 ) */ {

				c2d.moveTo( x, y + h - e );
				c2d.lineTo( x + a, y - e );
				c2d.lineTo( x - a, y - e );
				c2d.closePath();
			}

		} else {

			const morph = Math.abs( s );
			const targetRotation = s > 0 ? 0 : Math.PI;
			const startRotation = targetRotation - 2 * Math.PI;

			const rotation = ( 1 - morph ) * startRotation + morph * targetRotation;

			const VertexAngle = Math.PI * 2 / 3;
			const StartAngle = Math.PI * 0.5 - VertexAngle * 0.5;

			const Step = Math.PI * 2 / ShapeSegmentation;

			for ( let i = 0; i < ShapeSegmentation; ++ i ) {

				const angle = i * Step;
				const phase = ( angle + VertexAngle
						- StartAngle ) % VertexAngle + StartAngle;
				const cotPhase = Math.cos( phase ) / Math.sin( phase );
				const triangleUnitRadius = 0.5 * Math.sqrt( 1 + cotPhase ** 2 );

				const morphRadius = r * ( ( 1 - morph ) +
						morph * triangleUnitRadius * TriangleRadiusUpscale );

				const vx = x + Math.cos( angle + rotation ) * morphRadius;
				const vy = y + Math.sin( angle + rotation ) * morphRadius;

				if ( i != 0 )
					c2d.lineTo( vx, vy );
				else c2d.moveTo( vx, vy );
			}

			c2d.closePath();
		}

		if ( fill != 0 ) c2d.fill();
		if ( stroke != 0 ) c2d.stroke();
	}
}

