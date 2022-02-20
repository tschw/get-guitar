
const fillSmoothing = 0.1;
const strokeSmoothing = 0.15;
const maxInactive = 1 / 1024;

export class Highlighting {

	constructor() {

		this._state = new Array( 12 );
		for ( let i = 0; i < 12; ++ i )

			this._state[ i ] = {
				actualNote: -1, stroke: 0, fill: 0, fillTarget: 0
			};

		this.highlightedNote = null;
	}

	attenuate() {

		const highlight = this.highlightedNote;
		const highlightInOctave = highlight != null ? highlight % 12 : -1;

		let idle = true;
		function checkIdle( value ) {

			if ( Math.abs(value) > maxInactive ) idle = false;
			return value;
		}

		for ( let i = 0; i < 12; ++ i ) {

			const s = this._state[ i ];

			s.fill += checkIdle( s.fillTarget - s.fill ) * fillSmoothing;

			s.stroke = ( i == highlightInOctave ) ? 1 :
				s.stroke - checkIdle( s.stroke ) * strokeSmoothing;
		}

		return idle;
	}

	toggleSelection( note ) {

		const maximumOpacity = 0.7;

		const noteInOctave = note % 12;
		const state = this._state[ noteInOctave ];

		const isSelected = state.fillTarget > maxInactive;
		if ( isSelected ) {
			state.fillTarget = 0;
			state.actualNote = -1;
		} else {
			state.fillTarget = maximumOpacity;
			state.actualNote = note;
		}
	}

	paint( c2d, note, xMin, yMin, xMax, yMax ) {

		const w = xMax - xMin;
		const h = yMax - yMin;
		const x = ( xMin + xMax ) / 2;
		const y = ( yMin + yMax ) / 2;
		const r = Math.min( w, h ) / 4;
		const noteInOctave = note % 12;

		const state = this._state[ noteInOctave ]
		const octaveDistance = Math.abs( state.actualNote - note ) / 12;

		c2d.strokeStyle = `rgba(255, 255, 255, ${ state.stroke })`;
		const colorString = hsl2rgb(
			5 + noteInOctave * 30, 1, 0.5 + octaveDistance * 0.1, state.fill );
		c2d.fillStyle = colorString;

		c2d.beginPath();

		if ( state.actualNote == -1 || note == state.actualNote ) {

			c2d.arc( x, y, r, 0, Math.PI * 2 );

		} else if ( note > state.actualNote ) {

			c2d.moveTo( x, y - r );
			c2d.lineTo( x + r, y + r );
			c2d.lineTo( x - r, y + r );
			c2d.closePath();

		} else /* ( note < state.actualnote ) */ {

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
	const a=s*Math.min(l,1-l);
	const f= (n,k=(n+h/30)%12) => l - a*Math.max(Math.min(k-3,9-k,1),-1);
	return `rgba(${f(0) * 255},${f(8)*255},${f(4)*255},${alpha})`;
}

