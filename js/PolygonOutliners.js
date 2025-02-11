
import { bulkLerp, clockwise, checkStyle } from './Utility.js'

class PolygonOutliner {

	constructor() {

		if ( this.constructor === PolygonOutliner )
			throw "attempt ot instantiate abstract class";
	}

	begin()					{ return this; }
	vertex( x, y )			{ return this; }
	close()					{ return this; }
}

class CanvasPath extends PolygonOutliner {

	c2d;
	#first;

	begin() {

		this.c2d.beginPath();
		this.#first = true;
		return this;
	}

	vertex( x, y ) {

		if ( this.#first ) {

			this.#first = false;
			this.c2d.moveTo( x, y );
		} else {

			this.c2d.lineTo( x, y );
		}
		return this;
	}

	close() {

		this.c2d.closePath();
		return this;
	}
}

class SegmentingPolygonOutliner extends PolygonOutliner {

	#begin = { x: 0, y: 0, valid: false };
	#xPrev = 0;
	#yPrev = 0;

	_line( x0,y0, x1,y1 ) { }


	constructor() {

		super();
		if ( this.constructor === SegmentingPolygonOutliner )
			throw "attempt ot instantiate abstract class";
	}

	begin() {

		this.#begin.valid = false;
		return this;
	}

	close() {

		const begin = this.#begin;
		if ( begin.valid )
			this.vertex( begin.x, begin.y );
		return this;
	}

	vertex( x, y ) {

		const begin = this.#begin;
		if ( begin.valid )

			this._line( this.#xPrev, this.#yPrev, x, y );

		else {

			begin.x = x;
			begin.y = y;

			begin.valid = true;
		}

		this.#xPrev = x;
		this.#yPrev = y;
		return this;
	}
}

class LitStrokes extends SegmentingPolygonOutliner {

	c2d;

	ldx = -0.707;
	ldy = -0.707;
	phongExp = 1.0;

	color = new Float64Array( 4 );
	colorLit = new Float64Array( 4 );
	#currColor = new Float64Array( 4 );

	_line( x0,y0, x1,y1 ) {

		const dx = x1 - x0, dy = y1 - y0;
		const l = Math.sqrt( dx * dx + dy * dy );
		const nx = dy / l, ny = -dx / l;
		const blend = Math.pow(
				( nx * this.ldx + ny * this.ldy ) * -0.5 + 0.5, this.phongExp );

		const c2d = this.c2d;
		c2d.strokeStyle = checkStyle( `rgba(${ bulkLerp(
				this.#currColor, this.colorLit, this.color, blend ).
						map( n => n.toPrecision( 3 ) ).join( ',' ) })` );

		c2d.beginPath();
		c2d.moveTo( x0, y0 );
		c2d.lineTo( x1, y1 );
		c2d.stroke();

		/* // Debug: visualization of normals
		{
			c2d.strokeStyle = '#240000';
			c2d.beginPath();
			const x = ( x0 + x1 ) * 0.5;
			const y = ( y0 + y1 ) * 0.5;
			c2d.moveTo( x, y );
			c2d.lineTo( x + nx * 10, y + ny * 10 );
			c2d.stroke();
		} */
	}
}

class PointContainment extends SegmentingPolygonOutliner {

	x;
	y;

	result = false;

	begin() {

		this.result = true;
		return SegmentingPolygonOutliner.prototype.begin.call( this );
	}

	_line( x0,y0, x1,y1 ) {

		this.result &&= clockwise( x0, y0, x1, y1, this.x, this.y );
	}
}

const canvasPath = new CanvasPath();
const litStrokes = new LitStrokes();
const pointContainment = new PointContainment();

export {
	canvasPath,
	litStrokes,
	pointContainment
}

