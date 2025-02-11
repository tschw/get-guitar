import { Button, DefaultStrokeColor } from './Button.js'
import { checkStyle } from './Utility.js'
import { animation } from './Animation.js'

const ButtonsLeft = 4;
const ButtonsTop = 4;
const ButtonsWidth = 27;
const ButtonsHeight = 27;

const ButtonsSpacing = 16;
const ButtonsTextSpacing = 6;

const ButtonsDistance = ButtonsHeight + ButtonsSpacing;

const FractionalTextMiddle = 0.56;
const MotionSmoothing = 0.75;

export class ScaleLegend {

	#buttons;
	#labels;
	#actualScrollOffset = 0;
	#targetScrollOffset = 0;

	selectedScaleIndex = -1;
	toggleMode = true;

	constructor( xLeft, yTop, width, height, scales ) {

		this.xLeft = xLeft;
		this.yTop = yTop;
		this.width = width;
		this.height = height;

		const nScales = scales.length;
		const buttons = new Array( nScales );
		const labels = new Array( nScales );

		for ( let i = 0; i != nScales; ++ i ) {

			const scale = scales[ i ];
			const button = new Button( 0, 0,
					ButtonsWidth, ButtonsHeight, '' );

			button.action = () => this.#selectByIndex( i );
			button.strokeColor = button.fillColor = scale.color;

			labels[ i ] = scale.label;
			buttons[ i ] = button;
		}

		this.#buttons = buttons;
		this.#labels = labels;
	}

	paint( c2d ) {

		const xLeft = this.xLeft;
		const yTop = this.yTop;
		const yMax = yTop + this.height;

		c2d.save();
		c2d.rect( xLeft, yTop, this.width, this.height );
		c2d.clip();

		const buttons = this.#buttons;
		const nButtons = buttons.length;

		const buttonsLeft = xLeft + ButtonsLeft;
		const buttonsTop = yTop + ButtonsTop - ButtonsDistance * (
				this.#actualScrollOffset +=
					animation.delta( this.#actualScrollOffset,
					this.#targetScrollOffset, MotionSmoothing ) );

		const xText = buttonsLeft + ButtonsWidth + ButtonsTextSpacing;

		for ( let i = 0; i != nButtons; ++ i ) {

			const button = buttons[ i ];
			const buttonTop = buttonsTop + ButtonsDistance * i;

			button.xLeft = buttonsLeft;
			button.yTop = buttonTop;

			if ( buttonTop + ButtonsHeight < yTop || buttonTop > yMax )

				continue;

			button.paint( c2d );

			const yText = buttonTop + button.height * FractionalTextMiddle;
			c2d.font = '16px arial';
			c2d.fillStyle = checkStyle( DefaultStrokeColor.toString( 0.5, 1.0 ) );
//			c2d.fillStyle = button.strokeColor.toString( 2.2, 0.7 );
			c2d.fillText( this.#labels[ i ], xText, yText );
		}

		c2d.restore();
	}

	highlightByIndex( i ) {

		const button = this.#buttons[ i ];
		button.highlit = animation.ifStateChange( button.highlit, true );

		if ( this.selectedScaleIndex == -1 ) this.scrollToView( i );
	}

	highlight( x, y ) {

		const buttons = this.#buttons;

		let index = -1;
		if ( ! this.#isClipped( x, y ) ) {

			buttons.forEach( ( b, i ) => {
				if ( b.highlightIfContained( x, y ) ) index = i; } );

		} else this.unhighlight();

		const iSelected = this.selectedScaleIndex;
		if ( iSelected != -1 )

			buttons[ iSelected ].highlit = true;

		return index;
	}

	select( x, y ) {

		if ( ! this.#isClipped( x, y ) )
			for ( const button of this.#buttons )
				if ( button.actionIfContained( x, y ) ) return true;

		return false;
	}

	#selectByIndex( index ) {

		const buttons = this.#buttons;
		const button = buttons[ index ];

		if ( index != this.selectedScaleIndex ) {

			const visibleButtons = this.#visibleButtons();
			const firstVisible = this.#actualScrollOffset;
			const lastVisible = firstVisible + visibleButtons - 1;

			if ( index == firstVisible && this.#targetScrollOffset > 0 ) {

				-- this.#targetScrollOffset;
				animation.requestRefresh();

			} else if ( index == lastVisible && index != buttons.length - 1 ) {

				++ this.#targetScrollOffset;
				animation.requestRefresh();
			}

			this.selectedScaleIndex = index;
			button.highlit = animation.ifStateChange( button.highlight, true );

		} else if ( this.toggleMode ) {  
		
			this.selectedScaleIndex = -1;
			button.highlit = animation.ifStateChange( button.highlight, false );
		}

		this.unhighlight();
	}

	unhighlight() {

		const i = this.selectedScaleIndex;
		const selectedButton = i == -1 ? null : this.#buttons[ i ];

		for ( const button of this.#buttons )
			if ( button != selectedButton )
				button.highlit = 
						animation.ifStateChange( button.highlight, false );
	}

	isAnimating() {

		return this.#actualScrollOffset != this.#targetScrollOffset;
	}

	scrollViewport( direction ) {

		if ( ! this.canScrollViewport( direction ) ) return;

		this.#targetScrollOffset += direction;
		animation.requestRefresh();
	}

	canScrollViewport( direction ) {

		const newScrollOffset = this.#targetScrollOffset + direction;
		if ( newScrollOffset < 0 ) return false;

		const maxScrollOffset = this.#buttons.length - this.#visibleButtons();
		return newScrollOffset <= maxScrollOffset;
	}

	scrollToView( index ) {

		const scrollOffset = this.#targetScrollOffset;

		if ( index < scrollOffset )

			this.#targetScrollOffset =
					animation.ifStateChange( scrollOffset, index );

		else {

			const visibleButtons = this.#visibleButtons();
			const firstInvisibleIndex = scrollOffset + visibleButtons;

			if ( index >= firstInvisibleIndex )

				this.#targetScrollOffset = animation.ifStateChange(
						scrollOffset, index - ( visibleButtons - 1 ) );
		}
	}

	#visibleButtons() {

		return Math.floor( this.height / ButtonsDistance );
	}

	#isClipped( x, y ) {

		const xMin = this.xLeft + ButtonsLeft;
		const xMax = xMin + ButtonsWidth;
		if ( x < xMin || x > xMax ) return true;

		const yTop = this.yTop;
		const yMax = yTop + this.height;
		if ( y < yTop || y > yMax ) return true;

		return false;
	}

}
