const FlagVariableAlpha = 8;
const FlagOpaque = 16;
const FlagsVariableColor = 7;
const FlagsVariable = FlagsVariableColor | FlagVariableAlpha;

const JSONSignature = [ 'h', 's', 'l', 'a' ];


export class VariableColor {

	#privateState;

	constructor( hue, saturation, lightness, alpha ) {

		let flags = 0;
		let flag = 1, i = 0;

		function param( x, defaultValue ) {

			const flagToRaise = flag;
			flag <<= 1;

			if ( Number.isFinite( x ) ) return x;
			if ( x == null ) return defaultValue;

			const hasIndex = x.hasOwnProperty( 'i' );
			const hasBounds =
					x.hasOwnProperty( 'a' ) && x.hasOwnProperty( 'b' );

			if ( hasBounds && x.a == x.b ) {

				if ( ! hasIndex ) ++ i;
				return x.a;
			}

			flags |= flagToRaise;

			return hasIndex && hasBounds ? x : {

					i: hasIndex ? x.i : i ++,
					a: hasBounds ? x.a : 0,
					b: hasBounds ? x.b : 1
			};
		}

		const h = param( hue, 0 ), s = param( saturation, 1 ),
				l = param( lightness, 0.5 ), a = param( alpha, 1 );

		flags |= a == 1 ? FlagOpaque : 0;

		this.#privateState = { h, s, l, a, flags,
				cachedString: null, rgba: new Float32Array( 4 ) };
	}

	toRgba( valueVar0, valueVar1, valueVar2, valueVar3,
			result = new Float32Array( 4 ) ) {

		const _ = this.#privateState;

		let flag = 1;

		function paramValue( x ) {

			const isConstant = ! ( _.flags & flag );
			flag <<= 1;

			if ( isConstant ) return x;

			const i = x.i;
			const v = i == 0 ? valueVar0
					: i == 1 ? valueVar1
					: i == 2 ? valueVar2
					: valueVar3;

			return v == null ? x.b : x.a + v * ( x.b - x.a );
		}

		const h = paramValue( _.h ),
				s = paramValue( _.s ), l = paramValue( _.l );

		// found here: https://stackoverflow.com/questions/36721830
		const a = s * Math.min( l , 1 - l );
		const f = ( n, k = ( n + h / 30 ) % 12 ) => Math.ceil(
				( l - a * Math.max( Math.min( k - 3, 9 - k, 1 ), -1 ) ) * 255 );
		result[ 0 ] = f( 0 ); result[ 1 ] = f( 8 ); result[ 2 ] = f( 4 );

		result[ 3 ] = paramValue( _.a );
		return result;
	}

	toString( valueVar0, valueVar1, valueVar2, valueVar3 ) {

		const _ = this.#privateState;
		const c = this.toRgba(
				valueVar0, valueVar1, valueVar2, valueVar3, _.rgba ).map( x => {

					if ( ! Number.isFinite( x ) ) throw "ouch";
					return x.toPrecision( 3 );
				} );

		const rgb = `${ c[ 0 ] },${ c[ 1 ] },${ c[ 2 ] }`;

		if ( ! ( _.flags & FlagsVariableColor ) ) {

			if ( _.flags & FlagOpaque )

				return ( _.cachedString = `rgb(${ rgb })` );

			else if ( ! ( _.flags & FlagVariableAlpha ) )

				return ( _.cachedString =
							`rgba(${ rgb },${ _.a.toPrecision( 3 ) })` );

			else {

				_.cachedString = `rgba\(${ rgb },`;
				return `${ _.cachedString }${ c[ 3 ] }\)`;
			}
		}

		return ( _.flags & FlagOpaque ) ?
				`rgb(${ rgb })` : `rgba(${ rgb },${ c[ 3 ] })`;
	}

	toJSON() {

		const _ = this.#privateState;
		return { h: _.h, s: _.s, l: _.l, a: _.a };
	}

	static reviveFromJSON( k, v ) {

		for ( const property of JSONSignature )
			if ( ! v.hasOwnProperty( property ) )
				return v;

		return new Color( v.h, v.s, v.l, v.a );
	}
}
