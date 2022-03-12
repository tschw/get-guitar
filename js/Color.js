export function hsl2rgb( h, s, l, alpha ) {

	// found here: https://stackoverflow.com/questions/36721830
	const a =s*Math.min( l , 1-l );
	const f = ( n, k = ( n + h /30 ) % 12 ) =>
			l - a * Math.max( Math.min( k - 3, 9 - k, 1 ), -1 );
	return `rgba(${ f(0) * 255 },${ f(8) * 255 },${ f(4) * 255 },${ alpha })`;
}
