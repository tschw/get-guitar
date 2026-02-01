import { bitCount } from './Utility.js'

import {
		TonalityInfoByIndex,
		HarmonicStructureByIndex,
		HarmonicStructureByString,
		TonalityInfosOfStructures } from './TonalityInfo.js'

const NoHighlight = -1, LeftArrow = -2, RightArrow = -3;

class Editor {

	onChange;

	#c2d;
	#elem;
	#bits = 0;
	#iLit = NoHighlight;

	constructor( canvas, onChange ) {

		this.#c2d = canvas.getContext( '2d' );
		this.#elem = canvas;
		this.onChange = onChange;
		canvas.addEventListener( 'mousedown', e => this.#click( e ) );
		canvas.addEventListener( 'mousemove', e => this.#hover( e ) );
		canvas.addEventListener( 'mouseleave', e => this.#hoverOut() );
	}

	set width( value ) {

		const canvas = this.#elem;
		canvas.style.width = ( canvas.width = value ) + 'px';
		canvas.style.height =
			( canvas.height = value * 0.618 / 16 ) + 'px';
		this.#paint();
	}

	get width() {

		return + this.#elem.width;
	}

	get bits() { return this.#bits; }

	set bits( value ) {

		if ( this.#bits.value != value ) {
			this.#bits = value;
			this.#paint();
		}
	}

	#forBounds( f ) {

		const width = this.#elem.width;
		const stepX = width / 16, lY = this.#elem.height - 1;

		const offsX = stepX * 0.5;
		const extX = offsX * 0.618;

		for ( let i = 0; i < 16; ++ i ) {

			const cX = offsX + i * stepX;
			f( i, cX - extX, cX + extX );
		}
	}

	#paint() {

		const c2d = this.#c2d,
				bits = this.#bits, iLit = this.#iLit,
				w = this.#elem.width, h = this.#elem.height;

		c2d.clearRect( 0, 0, w, h );

		let xLL = 0, xLR = 0;
		this.#forBounds( ( i, xL, xR ) => {

			const lit = i == iLit,
					bit = 1 << ( i + 10 ) % 12,
					left = i < 2, right = i >= 14;

			const leftArrow = left && iLit == LeftArrow,
					rightArrow = right && iLit == RightArrow;

			// colors: over set, over clear, set, arrows, preview
			const on = ( bits & bit ) != 0, mid = ! ( left || right );
			const color = mid ? lit ? on ? '#ccc' : '#888' :
					'#eee' : leftArrow || rightArrow ? '#eee' : '#666';

			const yMid = h * 0.5;
			const yUpperMid = yMid - h * 0.18;
			const yLowerMid = yMid + h * 0.18;

			c2d.strokeStyle = color;

			if ( leftArrow ) {

				if ( i == 0 ) xLL = xL, xLR = xR;
				else {
					c2d.beginPath();
					c2d.moveTo( xLL, yMid );
					c2d.lineTo( xLR, 0 );
					c2d.lineTo( xLR, yUpperMid );
					c2d.lineTo( xR, yUpperMid );
					c2d.lineTo( xR, yLowerMid );
					c2d.lineTo( xLR, yLowerMid );
					c2d.lineTo( xLR, h );
					c2d.closePath();
					c2d.stroke();
				}

			} else if ( rightArrow ) {

				if ( i == 14 ) xLL = xL, xLR = xR;
				else {
					c2d.beginPath();
					c2d.moveTo( xR, yMid );
					c2d.lineTo( xL, h );
					c2d.lineTo( xL, yLowerMid );
					c2d.lineTo( xLL, yLowerMid );
					c2d.lineTo( xLL, yUpperMid );
					c2d.lineTo( xL, yUpperMid );
					c2d.lineTo( xL, 0 );
					c2d.closePath();
					c2d.stroke();
				}

			} else if ( lit || on ) {

				c2d.fillStyle = color;
				c2d.fillRect( xL, 0, xR - xL, h );
			} else {

				c2d.strokeRect( xL, 0, xR - xL, h );
			}
		} );
	}

	#pointerAt( event ) {

		let result = -1;
		const elem = this.#elem;
		const x = event.offsetX *
				elem.width / elem.getBoundingClientRect().width;
		this.#forBounds( ( i, xL, xR ) => {

			if ( x >= xL && x < xR ) result = i;
			else if ( result < 0 && x > xL ) result = ~ i;
		} );
		return result;
	}

	#click( event ) {

		let bits = this.#bits, i = this.#pointerAt( event );
		if ( i >= 2 && i < 14 )
			bits ^= 1 << i - 2;
		else {
			const j = Math.abs( i );

			if ( j < 2 )
				bits = bits >> 1 | ( bits & 1 ) << 11;
			else if ( j >= 14 )
				bits = bits << 1 & 0xfff | ( bits & 0x800 ) >> 11;
		}

		if ( bits != this.#bits ) {

			this.#bits = bits;
			this.onChange( bits );
			this.#paint();
		}
	}

	#hover( event ) {

		const i = this.#pointerAt( event );
		const j = Math.abs( i ),
				clickable = i > -2 || i < -14;

		this.#elem.style.cursor = clickable ? 'pointer' : 'default';

		let iLit = i >= 2 && i < 14 ? i
				: j < 2 ? LeftArrow : j >= 14 ? RightArrow : NoHighlight;

		if ( iLit != this.#iLit ) {

			this.#iLit = iLit;
			this.#paint();
		}
	}

	#hoverOut() {

		if ( this.#iLit != NoHighlight ) {

			this.#iLit = NoHighlight;
			this.#paint();
		}
	}
}

class Visual {

	#c2d;
	#elem;
	#bitsA = 0;
	#bitsB = 0;

	constructor( canvas ) {

		this.#c2d = canvas.getContext( '2d' );
		this.#elem = canvas;

		canvas.width = canvas.clientWidth;
		canvas.height = canvas.clientHeight;
		this.#paint();
	}

	setState( structure ) {

		this.#bitsA = structure.bits;
		this.#bitsB = structure.fifths.bits;
		this.#paint();
	}

	#paint() {

		const c2d = this.#c2d,
				elem = this.#elem;

		const w = elem.width,
				h = elem.height,
				OffsA = Math.PI * 2.5,
				StepA = Math.PI * 2 / 12;

		const ExtA = StepA * 0.2,
				outerR = h / 4 - 2,
				innerR = outerR * 0.618;

		function paintRing( cX, cY, bits ) {

			for ( let i = 0; i < 12; ++ i, bits >>= 1 ) {

				const a = ( OffsA - StepA * i ) % ( Math.PI * 2 );

				const p01 = a + ExtA, p23 = a - ExtA,
					p0X = cX + Math.cos( p01 ) * innerR, p0Y = cY - Math.sin( p01 ) * innerR,
					p1X = cX + Math.cos( p01 ) * outerR, p1Y = cY - Math.sin( p01 ) * outerR,
					p2X = cX + Math.cos( p23 ) * outerR, p2Y = cY - Math.sin( p23 ) * outerR,
					p3X = cX + Math.cos( p23 ) * innerR, p3Y = cY - Math.sin( p23 ) * innerR;

				c2d.strokeStyle = bits & 1 ? '#fff' : '#bbb';

				c2d.beginPath();
				c2d.moveTo( p0X, p0Y );
				c2d.lineTo( p1X, p1Y );
				c2d.lineTo( p2X, p2Y );
				c2d.lineTo( p3X, p3Y );
				c2d.closePath();

				if ( bits & 1 )
					c2d.fill();
				else
					c2d.stroke();
			}
		}

		c2d.clearRect( 0, 0, w, h );
		c2d.fillStyle = '#fff';
		paintRing( w * 0.5, h / 4, this.#bitsA );
		paintRing( w * 0.5, h * 3 / 4, this.#bitsB );
	}
}

class SearchCriterion {

	equalsDefault = null;

	#min = 0;
	#max = 0;

	#eq; #eqv; #gt; #gtv; #lt; #ltv;
	#uiDeps;

	constructor( template, container, onChange ) {

		const thiz = this, element = container != template.parentElement ?
				container.appendChild( template.cloneNode( true ) ) : template;

		this.element = element;

		[	this.#eq, this.#eqv,
			this.#gt, this.#gtv,
			this.#lt, this.#ltv 	] = element.children;

		const [ eq, eqv, gt, gtv, lt, ltv ] = element.children;

		function setNumericValue( elem, v ) {

			if ( Number.isFinite( v ) ) elem.valueAsNumber = v;
			else elem.value = "";
		}

		function clampValue( elem ) {

			let v = elem.valueAsNumber;
			if ( v < + elem.min ) v = thiz.#min;
			else if ( v > + elem.max ) v = thiz.#max;
			setNumericValue( elem, v );
		}

		function uiDeps() {

			const min = thiz.#min, max = thiz.#max;

			if ( ! ( gt.disabled = lt.disabled = min >= max - 1 ) ) {

				const searchMin = ! gt.checked ? min : gtv.valueAsNumber + 1,
						searchMax = ! lt.checked ? max : ltv.valueAsNumber - 1;

				if ( searchMin == searchMax ) {

					eq.checked = true;
					eqv.value = searchMin.toString();

					gt.checked = false;
					lt.checked = false;
				}

				gtv.max = ( ltv.disabled =
						! lt.checked ) ? max : ltv.valueAsNumber - 2;
				ltv.min = ( gtv.disabled =
						! gt.checked ) ? min : gtv.valueAsNumber + 2;

				clampValue( gtv );
				clampValue( ltv );

			} else gtv.disabled = ltv.disabled = true;

			if ( gtv.disabled ) setNumericValue( gtv, min );
			if ( ltv.disabled ) setNumericValue( ltv, max );

			if ( ! ( eq.disabled = min >= max ) ) {

				if ( eqv.disabled = ! eq.checked ) eqv.value = "";
				else clampValue( eqv );

			} else eqv.disabled = true;
		}

		eq.addEventListener( 'input', event => {

			if ( eq.checked ) {

				const v = thiz.equalsDefault, min = thiz.#min, max = thiz.#max;
				eqv.value = v != null &&
						v >= min && v <= max ? v : min + max >> 1;
				gt.checked = false;
				lt.checked = false;
			}
			onChange();
			uiDeps();
		} );

		gt.addEventListener( 'input', event => {

			if ( gt.checked )
				eq.checked = false;
			onChange();
			uiDeps();
		} );

		lt.addEventListener( 'input', event => {

			if ( lt.checked )
				eq.checked = false;
			onChange();
			uiDeps();
		} );

		const inputHandler = () => { uiDeps(); onChange(); }
		eqv.addEventListener( 'input', inputHandler );
		gtv.addEventListener( 'input', inputHandler );
		ltv.addEventListener( 'input', inputHandler );

		eq.checked = gt.checked = lt.checked = false;
		this.#uiDeps = uiDeps;

		this.setValueRange( 0, 0 );
	}

	setValueRange( min, max ) {

		this.#min = min;
		this.#max = max;
		const minStr = min.toString(), maxStr = max.toString();
		this.#eqv.min = minStr;
		this.#eqv.max = maxStr;
		this.#gtv.min = minStr;
		this.#ltv.max = maxStr;
		this.#uiDeps();
	}

	matches( value ) {

		return this.#eq.checked ? value == this.#eqv.valueAsNumber :
				! ( this.#gt.checked && value <= this.#gtv.valueAsNumber
				|| this.#lt.checked && value >= this.#ltv.valueAsNumber );
	}
}

const Accessors = {

	'cardinality': s => s.cardinality,
	'index': s => s.indexInCardinality,
	'positions': s => s.distinctChromaticPositions,
	'modes': s => s.distinctModes,
	'tpComplement': s => s.transposeToInverse,
	'minAdjacencySteps': s => s.minAdjacency,
	'minAdjacencyFifths': s => s.fifths.minAdjacency,
	'maxAdjacencySteps': s => s.maxAdjacency,
	'maxAdjacencyFifths': s => s.fifths.maxAdjacency,
	'minGapSizeSteps': s => s.minGapSize,
	'minGapSizeFifths': s => s.fifths.minGapSize,
	'maxGapSizeSteps': s => s.maxGapSize,
	'maxGapSizeFifths': s => s.fifths.maxGapSize,
	'gapsSteps': s => s.gaps,
	'gapsFifths': s => s.fifths.gaps
};

export class HarmonyExplorer {

	onChange;

	#tables;
	#editor;
	#structure;
	#position;
	#pinpos;
	#invert;
	#pinpat;
	#visual;
	#outputs;
	#criteria;
	#minima;
	#maxima;

	constructor( container, onChange ) {

		this.element = container;
		this.onChange = onChange;

		const criteria = [ ],
				getElem = s => container.querySelector( s ),
				getElems = s => container.querySelectorAll( s );

		const tables = getElems( 'table' ),
				template = getElem( 'search.criterion' ),
				searchInputHandler = event => this.#updateSearch();

		function prepTable( table, selector, minima, maxima ) {

			table.querySelectorAll( selector ).forEach( ( cell, i ) => {

					criteria.push( new SearchCriterion(
							template, cell, searchInputHandler ) );
			} );
		}

		prepTable( tables[ 0 ], 'td:nth-child(3)' );
		prepTable( tables[ 1 ], 'td:nth-child(odd)' );

		this.#tables = tables;
		this.#editor = new Editor(
				getElem( 'canvas.editor' ),
				bits => this.#editorInput( bits ) );
		this.reflow();

		const structure = getElem( 'select[name=structure]' ),
				invert = getElem( 'button[name=invert]' ),
				pinpat = getElem( 'input[name=pinpat]' );

		this.#structure = structure;
		this.#position = getElem( 'output[name=position]' );
		this.#pinpos = getElem( 'input[name=pinpos]' );
		this.#invert = invert;
		this.#pinpat = pinpat;
		this.#visual = new Visual( getElem( 'canvas.visual' ) );
		this.#outputs = getElems( 'output:not([name=position])' );
		this.#criteria = criteria;
		const nCriteria = criteria.length;
		this.#minima = new Array( nCriteria );
		this.#maxima = new Array( nCriteria );

		invert.addEventListener( 'click', event => this.#complementClick() );
		pinpat.addEventListener( 'change', event => this.#uiDeps() );

		structure.addEventListener( 'change',
				event => this.#structureChange(
					HarmonicStructureByString[ event.target.value ] ) );

		this.#updateSearch();
	}

	reflow() {

		const tables = this.#tables;
		this.#editor.width = tables[ 0 ].width = tables[ 1 ].clientWidth;
	}

	setState( bits ) {

		if ( bits != this.#editor.bits ) {
			this.#editor.bits = bits;
			this.#loadValue( bits );
		}
	}

	#changeState( bits ) {

		this.setState( bits );
		this.onChange( bits );
	}

	#editorInput( bits ) {

		this.#loadValue( bits );
		this.onChange( bits );
	}

	#structureChange( s ) {

		const structOffs = s.index * 12,
				tiNow = TonalityInfoByIndex[ this.#editor.bits ];

		const position = tiNow.position,
				getBits = p => TonalityInfosOfStructures[ structOffs + p ].index;

		let bits = getBits( position );

		if ( ! this.#pinpos.checked ) {

			const bitsToFitTo = tiNow.index;

			for ( let d = -6, minOff = 13, minDist = 13; d <= 5; ++ d ) {

				const dist = Math.abs( d ),
						candidate = getBits( ( position + 12 + d ) % 12 );

				const off = bitCount( candidate ^ bitsToFitTo );
				if ( off < minOff || off == minOff && dist < minDist ) {

					bits = candidate;

					minOff = off;
					minDist = dist;
				}
			}
		}
		this.#changeState( bits );
	}

	#complementClick() {

		let bits = this.#editor.bits ^ 0xfff;

		if ( ! this.#pinpat.checked )
			this.#structureChange( TonalityInfoByIndex[ bits ].structure );
		else this.#changeState( bits );
	}

	#updateSearch() {

		const result = [ ],
				minima = this.#minima.fill( Number.POSITIVE_INFINITY ),
				maxima = this.#maxima.fill( Number.NEGATIVE_INFINITY );

		for ( const s of HarmonicStructureByIndex ) {

			const mismatches = this.#mismatchingCriteria( s );
			if ( mismatches == 0 ) result.push( s );

			this.#accumulateSearchExtrema( s, mismatches );
		}

		this.#criteria.forEach( ( criterion, index ) =>
				criterion.setValueRange( minima[ index ], maxima[ index ] ) );

		result.sort( ( a, b ) => a.cardinality - b.cardinality
				|| a.indexInCardinality - b.indexInCardinality );

		const structure = this.#structure;
		const options = structure.options, selectedValue =
				TonalityInfoByIndex[ this.#editor.bits ].structure.asString;
		options.length = 0;
		for ( const s of result ) {
			const e = document.createElement( 'option' );
			e.selected = ( e.label = e.value = s.asString ) == selectedValue;
			options.add( e );
		}
	}

	#mismatchingCriteria( s ) {

		let bits = 0;
		this.#iterateAttributes( s, ( value, index ) => {

			if ( ! this.#criteria[ index ].matches( value ) )
				bits |= 1 << index;
		} );
		return bits;
	}

	#accumulateSearchExtrema( s, mismatching ) {

		this.#iterateAttributes( s, ( value, index ) => {

			if ( mismatching == 0 || mismatching == 1 << index ) {

				const minima = this.#minima, maxima = this.#maxima;
				if ( value < minima[ index ] ) minima[ index ] = value;
				if ( value > maxima[ index ] ) maxima[ index ] = value;
			}
		} );
	}

	#iterateAttributes( s, f ) {

		let criterionIndex = 0;
		for ( const elem of this.#outputs ) {

			const attributeValue = Accessors[ elem.name ]( s );
			f( attributeValue, criterionIndex ++ );
		}
	}

	#loadValue( bits ) {

		const criteria = this.#criteria,
				outputs = this.#outputs,
				ti = TonalityInfoByIndex[ bits ];

		let s = ti.structure;

		this.#iterateAttributes( s, ( v, i ) => {

			criteria[ i ].equalsDefault = outputs[ i ].value = v;
		} );

		this.#visual.setState( s );
		this.#position.value = ti.position;
		this.#structure.value = ti.structure.asString;
		this.#uiDeps();
	}

	#uiDeps() {

		const ti = TonalityInfoByIndex[ this.#editor.bits ];
		const s = ti.structure;
		this.#invert.disabled =
				s === s.complement && ! this.#pinpat.checked;
	}
}
