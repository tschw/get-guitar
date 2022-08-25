
export class BitMaskDelta {

	constructor( opt_startValue ) {

		this.mask = 0;
		this.bits = 0;
		this.prev = opt_startValue || 0;
	}

	update(currentValue) {

		this.mask = currentValue ^ this.prev;
		this.bits = currentValue & this.mask;
		this.prev = currentValue;

		return this;
	}

	apply(value) {

		return (value & ~this.mask) | this.bits;
	}
}

