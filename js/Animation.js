class Animation {

	#privateState;

	constructor() {

		this.render = () => undefined;
		this.unhighlight = () => undefined;

		this.unhighlightTimeout = 2000;

		this.#privateState = { };
		this.#onFrame();
	}

	requestRefresh() {

		const _ = this.#privateState;

		if ( _.frameId == null )
			_.frameId = window.requestAnimationFrame( () => this.#onFrame() );
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

		const _ = this.#privateState;
		_.frameId = null;

		this.render();

		window.clearTimeout( _.highlightTimeoutId );

		_.highlightTimeoutId = window.setTimeout(
				this.unhighlight, this.unhighlightTimeout );
	}
}

const animation = new Animation();
export { animation }
