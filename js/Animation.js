import { noOp } from './Utility.js'

class Animation {

	render = () => noOp;
	unhighlight = () => noOp;

	unhighlightTimeout = 2000;

	#frameId = 0;
	#highlightTimeoutId = 0;

	requestRefresh() {

		if ( ! this.#frameId )
			this.#frameId =
					window.requestAnimationFrame( () => this.#onFrame() );
	}

	ifStateChange( now, target ) {

		if ( target != now ) this.requestRefresh();
		return target;
	}

	static #EPSILON = 1 / 256;

	delta( now, target, smoothing ) {

		const totalDifference = target - now;
		if ( totalDifference == 0 ) return 0;

		this.requestRefresh();

		return Math.abs( totalDifference ) > Animation.#EPSILON ?
				totalDifference * ( 1 - smoothing ) : totalDifference;
	}

	#onFrame() {

		this.#frameId = 0;

		this.render();

		window.clearTimeout( this.#highlightTimeoutId );

		this.#highlightTimeoutId = window.setTimeout(
				this.unhighlight, this.unhighlightTimeout );
	}
}

const animation = new Animation();
export { animation }
