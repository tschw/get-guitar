
const fillSmoothing = 0.1;
const strokeSmoothing = 0.15;

export class Highlighting {

	#animationState;

	constructor() {

		this.selection = 0;
		this.highlightedNote = null;

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

		const highlight = this.highlightedNote;
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
		const colorString = hsl2rgb(
				5 + noteInOctave * 30, 1, 0.5, state.fill );
		c2d.fillStyle = colorString;

		c2d.beginPath();

		if ( this.highlightedNote == null ||
				this.highlightedNote == note ||
				this.highlightedNote % 12 != noteInOctave ) {

			c2d.arc( x, y, r, 0, Math.PI * 2 );

		} else if ( note > this.highlightedNote ) {

			c2d.moveTo( x, y - r );
			c2d.lineTo( x + r, y + r );
			c2d.lineTo( x - r, y + r );
			c2d.closePath();

		} else /* ( note < this.highlightedNote ) */ {

			c2d.moveTo( x, y + r );
			c2d.lineTo( x + r, y - r );
			c2d.lineTo( x - r, y - r );
			c2d.closePath();
		}
		c2d.fill();
		c2d.stroke();
	}
}

function hsl2rgb( h, s, l, alpha ) {

	// found here: https://stackoverflow.com/questions/36721830
	const a =s*Math.min( l , 1-l );
	const f = ( n, k = ( n + h /30 ) % 12 ) =>
			l - a * Math.max( Math.min( k - 3, 9 - k, 1 ), -1 );
	return `rgba(${ f(0) * 255 },${ f(8) * 255 },${ f(4) * 255 },${ alpha })`;
}

