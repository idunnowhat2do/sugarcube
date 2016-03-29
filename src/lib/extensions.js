/***********************************************************************************************************************
 *
 * lib/extensions.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Wikifier */
/* eslint-disable no-extend-native */

/*
	Returns `document.activeElement` or `null`.
*/
function safeActiveElement() {
	'use strict';

	/*
		IE9 contains a bug where trying to access the active element of an iframe's
		parent document (i.e. `window.parent.document.activeElement`) will throw an
		exception, so we must allow for an exception to be thrown.

		We could simply return `undefined` here, but since the API's default behavior
		should be to return `document.body` or `null` when there is no selection, we
		choose to return `null` in all non-element cases (i.e. whether it returns
		`null` or throws an exception).  Just a bit of normalization.
	*/
	try {
		return document.activeElement || null;
	}
	catch (e) {
		return null;
	}
}


/*
	JavaScript Polyfills.

	n.b. Most of the ES5 & ES6 polyfills now come from the `es5-shim.js` and `es6-shim.js`
	     libraries, respectively.
*/
(() => {
	'use strict';

	/*******************************************************************************************************************
	 * JavaScript Polyfills.
	 ******************************************************************************************************************/
	/*
		[ES5] We just do a simple shim, without the second argument, since that's all we need here.
	*/
	// if (!Object.create || typeof Object.create !== 'function') {
	// 	Object.defineProperty(Object, 'create', {
	// 		configurable : true,
	// 		writable     : true,
	// 		value        : (function () {
	// 			function Type() {}
	//
	// 			return function (proto) {
	// 				if (arguments.length === 0) {
	// 					throw new Error('polyfill Object.create implementation requires a parameter');
	// 				}
	//
	// 				if (arguments.length !== 1) {
	// 					throw new Error('polyfill Object.create implementation only accepts one parameter');
	// 				}
	//
	// 				let obj;
	//
	// 				if (proto === null) {
	// 					obj = { __proto__ : null };
	// 				}
	// 				else {
	// 					if (typeof proto !== 'object' && typeof proto !== 'function') {
	// 						throw new TypeError('polyfill Object.create proto parameter must be an object or null');
	// 					}
	//
	// 					/* eslint-disable no-proto */
	// 					Type.prototype = proto;
	// 					obj            = new Type();
	// 					obj.__proto__  = proto;
	// 					/* eslint-enable no-proto */
	// 				}
	//
	// 				return obj;
	// 			};
	// 		})()
	// 	});
	// }

	/*
		[ES7/Proposed] Returns whether the given element was found within the array.
	*/
	if (!Array.prototype.includes) {
		Object.defineProperty(Array.prototype, 'includes', {
			configurable : true,
			writable     : true,

			value(/* needle [, fromIndex] */) {
				if (this == null) { // lazy equality for null
					throw new TypeError('Array.prototype.includes called on null or undefined');
				}

				if (arguments.length === 0) {
					return false;
				}

				const length = this.length >>> 0;

				if (length === 0) {
					return false;
				}

				const needle = arguments[0];
				let i = Number(arguments[1]) || 0;

				if (i < 0) {
					i = Math.max(0, length + i);
				}

				for (/* empty */; i < length; ++i) {
					const current = this[i];

					if (
						   needle === current
						|| (needle !== needle && current !== current) // eslint-disable-line no-extra-parens
					) {
						return true;
					}
				}

				return false;
			}
		});
	}
})();


/*
	JavaScript Extensions.
*/
(() => {
	'use strict';

	const _nativeMathRandom = Math.random;


	/*******************************************************************************************************************
	 * Utility Functions.
	 ******************************************************************************************************************/
	/*
		Returns a pseudo-random whole number (integer) within the range of the given bounds.
	*/
	function _random(/* variadic(min:inclusive, max:inclusive) */) {
		if (arguments.length === 0) {
			throw new Error('_random called with insufficient parameters');
		}

		let min, max;

		if (arguments.length === 1) {
			min = 0;
			max = arguments[0];
		}
		else {
			min = arguments[0];
			max = arguments[1];
		}

		if (min > max) {
			[min, max] = [max, min];
		}

		return Math.floor(_nativeMathRandom() * (max - min + 1)) + min;
	}


	/*******************************************************************************************************************
	 * JavaScript Extensions, General.
	 ******************************************************************************************************************/
	/*
		Returns a random value from the given array, within the range of the lower and upper
		bounds, if they are specified.
	*/
	Object.defineProperty(Array, 'random', {
		configurable : true,
		writable     : true,

		value(array, lowerBound, upperBound) {
			let
				lower = lowerBound,
				upper = upperBound;

			if (arguments.length === 2) {
				upper = lower;
				lower = 0;
			}

			if (Array.isArray(array)) {
				return array.random(lower, upper);
			}
			else if (array.hasOwnProperty('length')) {
				return [...array].random(lower, upper);
			}

			return;
		}
	});

	/*
		Returns whether the given element was found within the array.
	*/
	Object.defineProperty(Array.prototype, 'contains', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.contains called on null or undefined');
			}

			return Array.prototype.indexOf.apply(this, arguments) !== -1;
		}
	});

	/*
		Returns whether all of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'containsAll', {
		configurable : true,
		writable     : true,

		value(/* needles */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.containsAll called on null or undefined');
			}

			if (arguments.length === 1) {
				if (Array.isArray(arguments[0])) {
					return Array.prototype.containsAll.apply(this, arguments[0]);
				}
				else {
					return Array.prototype.indexOf.apply(this, arguments) !== -1;
				}
			}
			else {
				for (let i = 0, iend = arguments.length; i < iend; ++i) {
					if (
						!Array.prototype.some.call(this, function (v) {
							return v === this.val;
						}, { val : arguments[i] })
					) {
						return false;
					}
				}

				return true;
			}
		}
	});

	/*
		Returns whether any of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'containsAny', {
		configurable : true,
		writable     : true,

		value(/* needles */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.containsAny called on null or undefined');
			}

			if (arguments.length === 1) {
				if (Array.isArray(arguments[0])) {
					return Array.prototype.containsAny.apply(this, arguments[0]);
				}
				else {
					return Array.prototype.indexOf.apply(this, arguments) !== -1;
				}
			}
			else {
				for (let i = 0, iend = arguments.length; i < iend; ++i) {
					if (
						Array.prototype.some.call(this, function (v) {
							return v === this.val;
						}, { val : arguments[i] })
					) {
						return true;
					}
				}

				return false;
			}
		}
	});

	/*
		Returns the number of times the given element was found within the array.
	*/
	Object.defineProperty(Array.prototype, 'count', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex ] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.count called on null or undefined');
			}

			const
				indexOf = Array.prototype.indexOf,
				needle  = arguments[0];
			let
				pos   = Number(arguments[1]) || 0,
				count = 0;

			while ((pos = indexOf.call(this, needle, pos)) !== -1) {
				++count;
				++pos;
			}

			return count;
		}
	});

	/*
		Returns whether the given element was found within, and removed from, the array (from left-to-right).
	*/
	Object.defineProperty(Array.prototype, 'delete', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex ] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.delete called on null or undefined');
			}

			const pos = Array.prototype.indexOf.apply(this, arguments);

			if (pos === -1) {
				return false;
			}

			Array.prototype.splice.call(this, pos, 1);
			return true;
		}
	});

	/*
		Returns the number of times the given element was found within, and removed from, the array.
	*/
	Object.defineProperty(Array.prototype, 'deleteAll', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex ] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.deleteAll called on null or undefined');
			}

			const
				indexOf = Array.prototype.indexOf,
				splice  = Array.prototype.splice,
				needle  = arguments[0];
			let
				pos   = Number(arguments[1]) || 0,
				count = 0;

			while ((pos = indexOf.call(this, needle, pos)) !== -1) {
				splice.call(this, pos, 1);
				++count;
			}

			return count;
		}
	});

	/*
		Returns whether the given element was found within, and removed from, the array (from right-to-left).
	*/
	Object.defineProperty(Array.prototype, 'deleteRight', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex ] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.deleteRight called on null or undefined');
			}

			const pos = Array.prototype.lastIndexOf.apply(this, arguments);

			if (pos === -1) {
				return false;
			}

			Array.prototype.splice.call(this, pos, 1);
			return true;
		}
	});

	/*
		Returns a new array consisting of the flattened source array (flat map reduce).
	*/
	Object.defineProperty(Array.prototype, 'flatten', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.flatten called on null or undefined');
			}

			return this.reduce((prev, cur) => prev.concat(Array.isArray(cur) ? cur.flatten() : cur), []);
		}
	});

	/*
		Removes and returns a random value from the array, within the range of the lower and
		upper bounds, if they are specified.
	*/
	Object.defineProperty(Array.prototype, 'pluck', {
		configurable : true,
		writable     : true,

		value(lowerBound, upperBound) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.pluck called on null or undefined');
			}

			if (this.length === 0) {
				return;
			}

			let
				lower = lowerBound,
				upper = upperBound;

			if (arguments.length === 1) {
				upper = lower;
				lower = 0;
			}

			if (lower == null) { // lazy equality for null
				lower = 0;
			}
			else if (lower < 0) {
				lower = this.length + lower;

				if (lower < 0) {
					lower = 0;
				}
			}
			else if (lower >= this.length) {
				lower = this.length - 1;
			}

			if (upper == null) { // lazy equality for null
				upper = this.length - 1;
			}
			else if (upper < 0) {
				upper = this.length + upper;

				if (upper < 0) {
					upper = this.length - 1;
				}
			}
			else if (upper >= this.length) {
				upper = this.length - 1;
			}

			return Array.prototype.splice.call(this, _random(lower, upper), 1)[0];
		}
	});

	/*
		Returns a random value from the array, within the range of the lower and upper bounds,
		if they are specified.
	*/
	Object.defineProperty(Array.prototype, 'random', {
		configurable : true,
		writable     : true,

		value(lowerBound, upperBound) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.random called on null or undefined');
			}

			if (this.length === 0) {
				return;
			}

			let
				lower = lowerBound,
				upper = upperBound;

			if (arguments.length === 1) {
				upper = lower;
				lower = 0;
			}

			if (lower == null) { // lazy equality for null
				lower = 0;
			}
			else if (lower < 0) {
				lower = this.length + lower;

				if (lower < 0) {
					lower = 0;
				}
			}
			else if (lower >= this.length) {
				lower = this.length - 1;
			}

			if (upper == null) { // lazy equality for null
				upper = this.length - 1;
			}
			else if (upper < 0) {
				upper = this.length + upper;

				if (upper < 0) {
					upper = this.length - 1;
				}
			}
			else if (upper >= this.length) {
				upper = this.length - 1;
			}

			return this[_random(lower, upper)];
		}
	});

	/*
		Randomly shuffles the array.
	*/
	Object.defineProperty(Array.prototype, 'shuffle', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.shuffle called on null or undefined');
			}

			if (this.length === 0) {
				return;
			}

			for (let i = this.length - 1; i > 0; --i) {
				const
					j    = Math.floor(_nativeMathRandom() * (i + 1)),
					swap = this[i];
				this[i] = this[j];
				this[j] = swap;
			}

			return this;
		}
	});

	/*
		Returns a bound function that supplies the given arguments to the base function, followed
		by the arguments are supplied to the bound function, whenever it is called.
	*/
	Object.defineProperty(Function.prototype, 'partial', {
		configurable : true,
		writable     : true,

		value(/* variadic */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Function.prototype.partial called on null or undefined');
			}

			const
				slice = Array.prototype.slice,
				fn    = this,
				bound = slice.call(arguments, 0);

			return function () {
				const
					applied = [];
				let
					argc = 0;

				for (let i = 0; i < bound.length; ++i) {
					applied.push(bound[i] === undefined ? arguments[argc++] : bound[i]);
				}

				return fn.apply(this, applied.concat(slice.call(arguments, argc)));
			};
		}
	});

	/*
		Returns the given numerical clamped to the specified bounds.
	*/
	Object.defineProperty(Math, 'clamp', {
		configurable : true,
		writable     : true,

		value(num, min, max) {
			const n = Number(num);
			return isNaN(n) ? NaN : n.clamp(min, max);
		}
	});

	/*
		Returns a decimal number eased from 0 to 1.

		n.b. The magnitude of the returned value decreases if num < 0.5 or increases if num > 0.5.
	*/
	Object.defineProperty(Math, 'easeInOut', {
		configurable : true,
		writable     : true,

		value(num) {
			return 1 - (Math.cos(Number(num) * Math.PI) + 1) / 2;
		}
	});

	/*
		Returns the number clamped to the specified bounds.
	*/
	Object.defineProperty(Number.prototype, 'clamp', {
		configurable : true,
		writable     : true,

		value(/* min, max */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Number.prototype.clamp called on null or undefined');
			}

			if (arguments.length !== 2) {
				throw new Error('Number.prototype.clamp called with an incorrect number of parameters');
			}

			let
				min = parseInt(arguments[0], 10),
				max = parseInt(arguments[1], 10);

			if (min > max) {
				[min, max] = [max, min];
			}

			let n = Number(this);

			if (n < min) { n = min; }

			if (n > max) { n = max; }

			return n;
		}
	});

	/*
		Returns a copy of the given string with all RegExp metacharacters escaped.
	*/
	if (!RegExp.escape) {
		const
			_regExpMetaCharsRe    = /[\\^$*+?.()|[\]{}]/g,
			_hasRegExpMetaCharsRe = new RegExp(_regExpMetaCharsRe.source); // to drop the global flag

		Object.defineProperty(RegExp, 'escape', {
			configurable : true,
			writable     : true,

			value(str) {
				const s = String(str);
				return s && _hasRegExpMetaCharsRe.test(s)
					? s.replace(_regExpMetaCharsRe, '\\$&')
					: s;
			}
		});
	}

	/*
		Returns a formatted string, after replacing each format item in the given format string
		with the text equivalent of the corresponding argument's value.
	*/
	Object.defineProperty(String, 'format', {
		configurable : true,
		writable     : true,

		value(format) {
			function padString(str, align, pad) {
				if (!align) {
					return str;
				}

				const plen = Math.abs(align) - str.length;

				if (plen < 1) {
					return str;
				}

				const padding = Array(plen + 1).join(pad);
				return align < 0 ? str + padding : padding + str;
			}

			if (arguments.length < 2) {
				return arguments.length === 0 ? '' : format;
			}

			const args = arguments.length === 2 && Array.isArray(arguments[1])
				? arguments[1].slice(0)
				: Array.prototype.slice.call(arguments, 1);

			if (args.length === 0) {
				return format;
			}

			return format.replace(/{(\d+)(?:,([+-]?\d+))?}/g, (match, index, align) => {
				let retval = args[index];

				if (retval == null) { // lazy equality for null
					return '';
				}

				while (typeof retval === 'function') {
					retval = retval();
				}

				switch (typeof retval) {
				case 'string':
					/* nothing */
					break;

				case 'object':
					retval = JSON.stringify(retval);
					break;

				default:
					retval = String(retval);
					break;
				}

				return padString(retval, !align ? 0 : parseInt(align, 10), ' ');
			});
		}
	});

	/*
		Returns whether the given string was found within the string.
	*/
	Object.defineProperty(String.prototype, 'contains', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.contains called on null or undefined');
			}

			return String.prototype.indexOf.apply(this, arguments) !== -1;
		}
	});

	/*
		Returns the number of times the given substring was found within the string.
	*/
	Object.defineProperty(String.prototype, 'count', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex ] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.count called on null or undefined');
			}

			const needle = String(arguments[0] || '');

			if (needle === '') {
				return 0;
			}

			const
				indexOf = String.prototype.indexOf,
				step    = needle.length;
			let
				pos     = Number(arguments[1]) || 0,
				count   = 0;

			while ((pos = indexOf.call(this, needle, pos)) !== -1) {
				++count;
				pos += step;
			}
			return count;
		}
	});

	/*
		Returns a copy of the base string with `count` characters replaced with `replacement`, starting at `startAt`.
	*/
	Object.defineProperty(String.prototype, 'splice', {
		configurable : true,
		writable     : true,

		value(startAt, charCount, replacement) {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.splice called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return '';
			}

			let start = +startAt || 0;

			if (!isFinite(start)) {
				start = 0;
			}
			else if (start < 0) {
				start += length;

				if (start < 0) {
					start = 0;
				}
			}

			if (start > length) {
				start = length;
			}

			let count = +charCount || 0;

			if (!isFinite(count) || count < 0) {
				count = 0;
			}

			let res = this.slice(0, start);

			if (typeof replacement !== 'undefined') {
				res += replacement;
			}

			if (start + count < length) {
				res += this.slice(start + count);
			}

			return res;
		}
	});

	/*
		Returns an array of strings, split from the string, or an empty array if the string is empty.
	*/
	Object.defineProperty(String.prototype, 'splitOrEmpty', {
		configurable : true,
		writable     : true,

		value(/* [ separator [, limit ]] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.splitOrEmpty called on null or undefined');
			}

			// Required as `this` could be a `String` object or come from a `call()` or `apply()`.
			if (String(this) === '') {
				return [];
			}

			return String.prototype.split.apply(this, arguments);
		}
	});

	/*
		[FF-extension] Returns a string with all whitespace removed from the left side of the string.
	*/
	if (!String.prototype.trimLeft) {
		Object.defineProperty(String.prototype, 'trimLeft', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimLeft called on null or undefined');
				}

				return this.replace(/^[\s\uFEFF\xA0]+/, ''); // include UTF BOM and NBSP
			}
		});
	}

	/*
		[FF-extension] Returns a string with all whitespace removed from the right side of the string.
	*/
	if (!String.prototype.trimRight) {
		Object.defineProperty(String.prototype, 'trimRight', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimRight called on null or undefined');
				}

				return this.replace(/[\s\uFEFF\xA0]+$/, ''); // include UTF BOM and NBSP
			}
		});
	}

	/*
		[DEPRECATED] Returns a string with all whitespace removed from the left side of the base string.

		n.b. Just a legacy alias for String.prototype.trimLeft now.
	*/
	Object.defineProperty(String.prototype, 'ltrim', {
		configurable : true,
		writable     : true,
		value        : String.prototype.trimLeft
	});

	/*
		[DEPRECATED] Returns a string with all whitespace removed from the right side of the base string.

		n.b. Just a legacy alias for String.prototype.trimRight now.
	*/
	Object.defineProperty(String.prototype, 'rtrim', {
		configurable : true,
		writable     : true,
		value        : String.prototype.trimRight
	});

	/*
		[DEPRECATED] Returns an array of link titles, parsed from the string.

		n.b. Unused in SugarCube, only included for compatibility.
	*/
	Object.defineProperty(String.prototype, 'readBracketedList', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.readBracketedList called on null or undefined');
			}

			// RegExp groups: Double-square-bracket quoted | Unquoted.
			const
				re    = new RegExp('(?:\\[\\[((?:\\s|\\S)*?)\\]\\])|([^"\'\\s]\\S*)', 'gm'),
				names = [];
			let
				match;

			while ((match = re.exec(this)) !== null) {
				if (match[1]) { // double-square-bracket quoted
					names.push(match[1]);
				}
				else if (match[2]) { // unquoted
					names.push(match[2]);
				}
			}

			return names;
		}
	});


	/*******************************************************************************************************************
	 * JavaScript Extensions, JSON.
	 ******************************************************************************************************************/
	/*
		Define `toJSON()` methods on each prototype we wish to support.
	*/
	Object.defineProperty(Date.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			return ['(revive:date)', this.toISOString()];
		}
	});
	Object.defineProperty(Function.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			/*
				The enclosing parenthesis here are necessary to force the function expression code
				string, returned by `this.toString()`, to be evaluated as an expression during
				revival.  Without them, the function expression, which is likely nameless, will be
				evaluated as a function definition—which will throw a syntax error exception, since
				function definitions must have a name.
			*/
			return ['(revive:eval)', `(${this.toString()})`];
		}
	});
	Object.defineProperty(Map.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			return ['(revive:map)', [...this]];
		}
	});
	Object.defineProperty(RegExp.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			return ['(revive:eval)', this.toString()];
		}
	});
	Object.defineProperty(Set.prototype, 'toJSON', {
		configurable : true,
		writable     : true,

		value() {
			return ['(revive:set)', [...this]];
		}
	});

	/*
		Utility method to allow users to easily wrap their code in the revive wrapper.
	*/
	Object.defineProperty(JSON, 'reviveWrapper', {
		configurable : true,
		writable     : true,

		value(code) {
			if (typeof code !== 'string') {
				throw new TypeError('JSON.reviveWrapper code parameter must be a string');
			}

			return ['(revive:eval)', code];
		}
	});

	/*
		Backup the original `JSON.parse()` and replace it with a revive wrapper aware version.
	*/
	Object.defineProperty(JSON, '_real_parse', {
		value : JSON.parse
	});
	Object.defineProperty(JSON, 'parse', {
		configurable : true,
		writable     : true,

		value(text, reviver) {
			return JSON._real_parse(text, (key, val) => {
				let value = val;

				/*
					Attempt to revive wrapped values.
				*/
				if (Array.isArray(value) && value.length === 2) {
					switch (value[0]) {
					case '(revive:set)':
						value = new Set(value[1]);
						break;
					case '(revive:map)':
						value = new Map(value[1]);
						break;
					case '(revive:date)':
						value = new Date(value[1]);
						break;
					case '(revive:eval)':
						try {
							value = eval(value[1]); // eslint-disable-line no-eval
						}
						catch (e) { /* no-op; although, perhaps, it would be better to throw an error here */ }
						break;
					}
				}

				/* legacy */
				else if (typeof value === 'string' && value.slice(0, 10) === '@@revive@@') {
					try {
						value = eval(value.slice(10)); // eslint-disable-line no-eval
					}
					catch (e) { /* no-op; although, perhaps, it would be better to throw an error here */ }
				}
				/* /legacy */

				/*
					Call the custom reviver, if specified.
				*/
				if (typeof reviver === 'function') {
					try {
						value = reviver(key, value);
					}
					catch (e) { /* no-op; although, perhaps, it would be better to throw an error here */ }
				}

				return value;
			});
		}
	});
})();


/***********************************************************************************************************************
 * jQuery Plugins.
 **********************************************************************************************************************/
/*
	`ariaClick([options,] handler)` method plugin.

	Makes the target element(s) WAI-ARIA compatible clickables.

	n.b. Has a dependency in the `safeActiveElement()` function (see: top of file).
*/
(() => {
	'use strict';

	/*
		Event handler & utility functions.

		n.b. Do not replace the anonymous functions herein with arrow functions.
	*/
	function onKeypressFn(evt) {
		// 13 is Enter/Return, 32 is Space.
		if (evt.which === 13 || evt.which === 32) {
			evt.preventDefault();

			// To allow delegation, attempt to trigger the event on `document.activeElement`,
			// if possible, elsewise on `this`.
			jQuery(safeActiveElement() || this).trigger('click');
		}
	}

	function onClickFnWrapper(fn) {
		return function () {
			const $this = jQuery(this);

			// Toggle "aria-pressed" status, if the attribute exists.
			if ($this.is('[aria-pressed]')) {
				$this.attr('aria-pressed', $this.attr('aria-pressed') === 'true' ? 'false' : 'true');
			}

			// Call the true handler.
			fn.apply(this, arguments);
		};
	}

	function oneClickFnWrapper(fn) {
		return onClickFnWrapper(function () {
			// Remove both event handlers (keypress & click) and the other components.
			jQuery(this)
				.off('.aria-clickable')
				.removeAttr('tabindex aria-controls aria-pressed')
				.not('a,button')
					.removeAttr('role')
					.end()
				.filter('button')
					.prop('disabled', true);

			// Call the true handler.
			fn.apply(this, arguments);
		});
	}

	/*
		Extend jQuery's chainable methods with an `ariaClick()` method.
	*/
	jQuery.fn.extend({
		ariaClick(options, handler) {
			// Bail out if there are no target element(s) or parameters.
			if (this.length === 0 || arguments.length === 0) {
				return this;
			}

			let
				opts = options,
				fn   = handler;

			if (fn == null) { // lazy equality for null
				fn   = opts;
				opts = undefined;
			}

			opts = jQuery.extend({
				namespace : undefined,
				one       : false,
				selector  : undefined,
				data      : undefined,
				controls  : undefined,
				pressed   : undefined,
				label     : undefined
			}, opts);

			if (typeof opts.namespace !== 'string') {
				opts.namespace = '';
			}
			else if (opts.namespace[0] !== '.') {
				opts.namespace = `.${opts.namespace}`;
			}

			if (typeof opts.pressed === 'boolean') {
				opts.pressed = opts.pressed ? 'true' : 'false';
			}

			// Set `type` to `button` to suppress "submit" semantics, for <button> elements.
			this.filter('button').prop('type', 'button');

			// Set `role` to `button`, for non-<a>/-<button> elements.
			this.not('a,button').attr('role', 'button');

			// Set `tabindex` to `0` to make them focusable (unnecessary on <button> elements, but it doesn't hurt).
			this.attr('tabindex', 0);

			// Set `aria-controls`.
			if (opts.controls != null) { // lazy equality for null
				this.attr('aria-controls', opts.controls);
			}

			// Set `aria-pressed`.
			if (opts.pressed != null) { // lazy equality for null
				this.attr('aria-pressed', opts.pressed);
			}

			// Set `aria-label` and `title`.
			if (opts.label != null) { // lazy equality for null
				this.attr({
					'aria-label' : opts.label,
					title        : opts.label
				});
			}

			// Set the keypress handlers, for non-<button> elements.
			//   n.b. For the single-use case, the click handler will also remove this handler.
			this.not('button').on(
				`keypress.aria-clickable${opts.namespace}`,
				opts.selector,
				onKeypressFn
			);

			// Set the click handlers.
			//   n.b. To ensure both handlers are properly removed, `one()` must not be used here.
			this.on(
				`click.aria-clickable${opts.namespace}`,
				opts.selector,
				opts.data,
				opts.one ? oneClickFnWrapper(fn) : onClickFnWrapper(fn)
			);

			// Return `this` for further chaining.
			return this;
		}
	});
})();

/*
	`wiki(source)` method plugin.

	Wikifies the source text and appends the result to the target element(s).
*/
(() => {
	'use strict';

	/*
		Extend jQuery's chainable methods with a `wiki()` method.
	*/
	jQuery.fn.extend({
		wiki(source) {
			// Bail out if there are no target element(s) or parameters.
			if (this.length === 0 || arguments.length === 0) {
				return this;
			}

			// Wikify the source text into a fragment and append it to the target element(s).
			const frag = document.createDocumentFragment();
			new Wikifier(frag, source);
			this.append(frag);

			// Return `this` for further chaining.
			return this;
		}
	});
})();