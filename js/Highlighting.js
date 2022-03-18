import { VariableColor } from './VariableColor.js'

const fillSmoothing = 0.1;
const strokeSmoothing = 0.15;

export class Highlighting {

	#colors;
	#animationState;

	constructor() {

		this.selection = 0;
		this.highlitNote = null;

		this.#colors = new Array( 12 );
		for ( let i = 0; i != 12; ++ i )
			this.#colors[ i ] = new VariableColor( 5 + 30 * i, 1, 0.5, { } );

		this.#animationState = new Array( 12 );
		for ( let i = 0; i < 12; ++ i )
			this.#animationState[ i ] = { stroke: 0, fill: 0 };
	}

	attenuate() {

		let idle = true;
		function checkIdle( value ) {

			const closeEnough = 1 / 1024;

			if ( Math.abs(value) > closeEnough ) idle = false;
			return value;
		}

		const highlight = this.highlitNote;
		const highlightInOctave = highlight != null ? highlight % 12 : -1;

		for ( let i = 0; i < 12; ++ i ) {

			const s = this.#animationState[ i ];

			const isSelected = ( this.selection & (1 << i) ) != 0;
			const isHighlit = i == highlightInOctave;

			const targetOpacity = isSelected ? 0.7 : 0.0;
			const targetHighlight = isHighlit ? 1.0 : 0.0;

			s.fill += checkIdle( targetOpacity - s.fill ) * fillSmoothing;
			s.stroke += checkIdle( targetHighlight - s.stroke ) * strokeSmoothing;
		}

		return idle;
	}

	paint( c2d, note, xMin, yMin, xMax, yMax ) {

		const w = xMax - xMin;
		const h = yMax - yMin;
		const x = ( xMin + xMax ) / 2;
		const y = ( yMin + yMax ) / 2;
		const r = Math.min( w, h ) / 4;
		const noteInOctave = note % 12;

		const state = this.#animationState[ noteInOctave ]

		c2d.strokeStyle = `rgba(255, 255, 255, ${ state.stroke })`;
		c2d.fillStyle = this.#colors[ noteInOctave ].toString( state.fill );

		c2d.beginPath();

		if ( this.highlitNote == null ||
				this.highlitNote == note ||
				this.highlitNote % 12 != noteInOctave ) {

			c2d.arc( x, y, r, 0, Math.PI * 2 );

		} else {

			const a = r * 1.19;
			const h = a * 1.732; // 1.732... = sqrt( 3 )
			const e = h / 3;

			if ( note > this.highlitNote ) {

				c2d.moveTo( x, y - h + e );
				c2d.lineTo( x + a, y + e );
				c2d.lineTo( x - a, y + e );
				c2d.closePath();

			} else /* ( note < this.highlitNote ) */ {

				c2d.moveTo( x, y + h - e );
				c2d.lineTo( x + a, y - e );
				c2d.lineTo( x - a, y - e );
				c2d.closePath();
			}
		}

		c2d.fill();
		c2d.stroke();
	}
}

