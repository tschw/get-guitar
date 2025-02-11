export function noOp() { }

export function lerp( a, b, t ) {

	return a + ( b - a ) * t;
}

export function bulkLerp( r, a, b, t ) {

	for ( let i = 0, n = r.length; i != n; ++ i )
		r[ i ] = lerp( a[ i ], b[ i ], t );

	return r;
}

export function bitCount( x ) {

	let result = 0;
	let bits = x;
	while ( bits !== 0 ) {

		bits &= bits - 1;
		result += 1;
	}
	return result;
}

export function clockwise( x0,y0, x1,y1, x2,y2 ) {

	const x01 = x1 - x0, y01 = y1 - y0;
	const x02 = x2 - x0, y02 = y2 - y0;

	return x01 * y02 - x02 * y01 > 0;
}

export function formatBinary( bits, maxPaddingZeroes = 32 ) {

	const binaryString = bits.toString( 2 );
	const paddingZeroes =
			Math.max( 0, maxPaddingZeroes - binaryString.length );
	return "0".repeat( paddingZeroes ) + binaryString;
}

export function checkStyle( s ) {

	/*
	if ( typeof s != 'string' ) {
		throw "non-string argument";
	}

	if ( s.indexOf( 'NaN' ) != -1 ) {
		throw "'NaN' substring detected";
	}*/
	return s;
}
