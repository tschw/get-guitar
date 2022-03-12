export class Button {

	constructor( x, y, width, height, caption ) {

		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.caption = caption;

		this.highlit = false;
	}

	paint( c2d ) {

		c2d.lineWidth = 2;
		c2d.setLineDash( [] );
		c2d.strokeStyle = '#cccccc';
		c2d.fillStyle = this.highlit ? '#30a030' : '#103010';

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
