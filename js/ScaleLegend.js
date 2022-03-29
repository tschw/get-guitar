import { Button } from './Button.js'
import { animation } from './Animation.js'

const ButtonsLeft = 4;
const ButtonsTop = 4;
const ButtonsWidth = 24;
const ButtonsHeight = 24;
const ButtonsSpacing = 14;
const ButtonsTextSpacing = 6;

const ButtonsDistance = ButtonsHeight + ButtonsSpacing;

const FractionalTextMiddle = 0.58;


export class ScaleLegend {

	#buttons;
	#labels;

	constructor( xLeft, yTop, width, height, scales ) {

		this.selectedScaleIndex = -1;
		this.toggleMode = true;

		const nScales = scales.length;
		const buttons = new Array( nScales );
		const labels = new Array( nScales );

		const buttonsLeft = xLeft + ButtonsLeft;
		const buttonsTop = yTop + ButtonsTop;

		for ( let i = 0; i != nScales; ++ i ) {

			const scale = scales[ i ];
			const button = new Button( buttonsLeft,
					buttonsTop + ButtonsDistance * i,
					ButtonsWidth, ButtonsHeight, '' );

			button.strokeColor = button.fillColor = scale.color;

			labels[ i ] = scale.label;
			buttons[ i ] = button;
		}

		this.#buttons = buttons;
		this.#labels = labels;
	}

	paint( c2d ) {


		const buttons = this.#buttons;
		const nButtons = buttons.length;

		const aButton = buttons[ 0 ];
		const x = aButton.xLeft + aButton.width + ButtonsTextSpacing;

		for ( let i = 0; i != nButtons; ++ i ) {

			const button = buttons[ i ];
			button.paint( c2d );

			const y = button.yTop + button.height * FractionalTextMiddle;
			c2d.fillText( this.#labels[ i ], x, y );
		}
	}

	highlightByIndex( i ) {

		const button = this.#buttons[ i ];
		button.highlit = animation.ifStateChange( button.highlit, true );
	}

	highlight( x, y ) {

		let index = -1;
		const buttons = this.#buttons;

		let i = 0;
		for ( let button of buttons ) {

			if ( button.highlightIfContained( x, y ) ) index = i;

			++ i;
		}

		const iSelected = this.selectedScaleIndex;
		if ( iSelected != -1 )

			buttons[ iSelected ].highlit = true;

		return index;
	}

	select( x, y ) {

		const buttons = this.#buttons;

		let i = 0, found = -1;

		for ( let button of buttons ) {

			if ( button.isContained( x, y ) ) found = i;

			++ i;
		}

		if ( found == -1 ) return false;

		const button = buttons[ found ];

		if ( found != this.selectedScaleIndex ) {

			this.selectedScaleIndex = found;
			button.highlit = animation.ifStateChange( button.highlight, true );

		} else if ( this.toggleMode ) {  
		
			this.selectedScaleIndex = -1;
			button.highlit = animation.ifStateChange( button.highlight, false );
		}

		this.unhighlight();

		return true;
	}

	unhighlight() {

		const i = this.selectedScaleIndex;
		const selectedButton = i == -1 ? null : this.#buttons[ i ];

		for ( let button of this.#buttons )
			if ( button != selectedButton )
				button.highlit = 
						animation.ifStateChange( button.highlight, false );
	}
}
