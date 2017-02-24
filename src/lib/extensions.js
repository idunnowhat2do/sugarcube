/***********************************************************************************************************************
 *
 * lib/extensions.js
 *
 * Copyright © 2013–2017 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

/*
	JavaScript Polyfills.

	NOTE: The ES5 and ES6 polyfills come from the `es5-shim.js` and `es6-shim.js` libraries.
*/
(() => {
	'use strict';

	// Starting whitespace regular expressions.
	const _startingSpaceCharsRe = /^[\s\u00A0\uFEFF][\s\u00A0\uFEFF]*/; // include additional sequences for older browsers

	// Ending whitespace regular expressions.
	const _endingSpaceCharsRe = /[\s\u00A0\uFEFF][\s\u00A0\uFEFF]*$/; // include additional sequences for older browsers


	/*******************************************************************************************************************
	 * Utility Functions.
	 ******************************************************************************************************************/
	/*
		Trims whitespace from either the start or end of the given string.
	*/
	function _trimStringFrom(str, where) {
		const val = String(str);

		switch (where) {
		case 'start':
			return val && _startingSpaceCharsRe.test(val)
				? val.replace(_startingSpaceCharsRe, '')
				: val;

		case 'end':
			return val && _endingSpaceCharsRe.test(val)
				? val.replace(_endingSpaceCharsRe, '')
				: val;

		default:
			throw new Error(`_trimFrom called with incorrect where parameter value: "${where}"`);
		}
	}

	/*
		Generates a pad string based upon the given string and length.
	*/
	function _createPadString(length, padding) {
		const targetLength = Number.parseInt(length, 10) || 0;

		if (targetLength < 1) {
			return '';
		}

		let padString = typeof padding === 'undefined' ? '' : String(padding);

		if (padString === '') {
			padString = ' ';
		}

		while (padString.length < targetLength) {
			const curPadLength    = padString.length;
			const remainingLength = targetLength - curPadLength;

			padString += curPadLength > remainingLength
				? padString.slice(0, remainingLength)
				: padString;
		}

		if (padString.length > targetLength) {
			padString = padString.slice(0, targetLength);
		}

		return padString;
	}


	/*******************************************************************************************************************
	 * Polyfills.
	 ******************************************************************************************************************/
	/*
		[ES2016] Returns whether the given element was found within the array.
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

					if (needle === current || needle !== needle && current !== current) {
						return true;
					}
				}

				return false;
			}
		});
	}

	/*
		[ES2017] Returns a string based on concatenating the given padding, repeated as necessary,
		to the start of the string so that the given length is reached.

		NOTE: This pads based upon Unicode code units, rather than code points.
	*/
	if (!String.prototype.padStart) {
		Object.defineProperty(String.prototype, 'padStart', {
			configurable : true,
			writable     : true,

			value(length, padding) {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.padStart called on null or undefined');
				}

				const baseString   = String(this);
				const baseLength   = baseString.length;
				const targetLength = Number.parseInt(length, 10);

				if (targetLength <= baseLength) {
					return baseString;
				}

				return _createPadString(targetLength - baseLength, padding) + baseString;
			}
		});
	}

	/*
		[ES2017] Returns a string based on concatenating the given padding, repeated as necessary,
		to the end of the string so that the given length is reached.

		NOTE: This pads based upon Unicode code units, rather than code points.
	*/
	if (!String.prototype.padEnd) {
		Object.defineProperty(String.prototype, 'padEnd', {
			configurable : true,
			writable     : true,

			value(length, padding) {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.padEnd called on null or undefined');
				}

				const baseString   = String(this);
				const baseLength   = baseString.length;
				const targetLength = Number.parseInt(length, 10);

				if (targetLength <= baseLength) {
					return baseString;
				}

				return baseString + _createPadString(targetLength - baseLength, padding);
			}
		});
	}

	/*
		[ES Proposal] Returns a string with all whitespace removed from the start of the string.
	*/
	if (!String.prototype.trimStart) {
		Object.defineProperty(String.prototype, 'trimStart', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimStart called on null or undefined');
				}

				return _trimStringFrom(this, 'start');
			}
		});
	}
	if (!String.prototype.trimLeft) {
		Object.defineProperty(String.prototype, 'trimLeft', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimLeft called on null or undefined');
				}

				return _trimStringFrom(this, 'start');
			}
		});
	}

	/*
		[ES Proposal] Returns a string with all whitespace removed from the end of the string.
	*/
	if (!String.prototype.trimEnd) {
		Object.defineProperty(String.prototype, 'trimEnd', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimEnd called on null or undefined');
				}

				return _trimStringFrom(this, 'end');
			}
		});
	}
	if (!String.prototype.trimRight) {
		Object.defineProperty(String.prototype, 'trimRight', {
			configurable : true,
			writable     : true,

			value() {
				if (this == null) { // lazy equality for null
					throw new TypeError('String.prototype.trimRight called on null or undefined');
				}

				return _trimStringFrom(this, 'end');
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

		let min;
		let max;

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

	/*
		Returns an object (`{ char, start, end }`) containing the Unicode code point at
		position `pos`, its starting position, and its ending position—surrogate pairs
		are properly handled.  If `pos` is out-of-bounds, returns an object containing
		the empty string and start/end positions of `-1`.

		This function is necessary because JavaScript strings are sequences of UTF-16
		code units, so surrogate pairs are exposed and thus must be handled.  While the
		ES6/2015 standard does improve the situation somewhat, it does not alleviate
		the need for this function.

		NOTE: Will throw exceptions on invalid surrogate-pair sequences.

		IDEA: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charAt
	*/
	function _getCodePointStartAndEnd(str, pos) {
		const code = str.charCodeAt(pos);

		// Given position was out-of-bounds.
		if (Number.isNaN(code)) {
			return { char : '', start : -1, end : -1 };
		}

		// Code unit is not a UTF-16 surrogate.
		if (code < 0xD800 || code > 0xDFFF) {
			return {
				char  : str.charAt(pos),
				start : pos,
				end   : pos
			};
		}

		// Code unit is a high surrogate (D800–DBFF).
		if (code >= 0xD800 && code <= 0xDBFF) {
			const nextPos = pos + 1;

			// End of string.
			if (nextPos >= str.length) {
				throw new Error('high surrogate without trailing low surrogate');
			}

			const nextCode = str.charCodeAt(nextPos);

			// Next code unit is not a low surrogate (DC00–DFFF).
			if (nextCode < 0xDC00 || nextCode > 0xDFFF) {
				throw new Error('high surrogate without trailing low surrogate');
			}

			return {
				char  : str.charAt(pos) + str.charAt(nextPos),
				start : pos,
				end   : nextPos
			};
		}

		// Code unit is a low surrogate (DC00–DFFF) in the first position.
		if (pos === 0) {
			throw new Error('low surrogate without leading high surrogate');
		}

		const prevPos  = pos - 1;
		const prevCode = str.charCodeAt(prevPos);

		// Previous code unit is not a high surrogate (D800–DBFF).
		if (prevCode < 0xD800 || prevCode > 0xDBFF) {
			throw new Error('low surrogate without leading high surrogate');
		}

		return {
			char  : str.charAt(prevPos) + str.charAt(pos),
			start : prevPos,
			end   : pos
		};
	}


	/*******************************************************************************************************************
	 * Extensions, General.
	 ******************************************************************************************************************/
	/*
		Returns a random element from the given array, within the range of the lower and upper
		bounds, if they are specified.
	*/
	Object.defineProperty(Array, 'random', {
		configurable : true,
		writable     : true,

		value(array, lowerBound, upperBound) {
			let lower = lowerBound;
			let upper = upperBound;

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

			const indexOf = Array.prototype.indexOf;
			const needle  = arguments[0];
			let pos   = Number(arguments[1]) || 0;
			let count = 0;

			while ((pos = indexOf.call(this, needle, pos)) !== -1) {
				++count;
				++pos;
			}

			return count;
		}
	});

	/*
		Removes and returns all of the given elements from the array.
	*/
	Object.defineProperty(Array.prototype, 'delete', {
		configurable : true,
		writable     : true,

		value(/* needles */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.delete called on null or undefined');
			}

			if (arguments.length === 0) {
				return [];
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return [];
			}

			const indexOf = Array.prototype.indexOf;
			const push    = Array.prototype.push;
			const splice  = Array.prototype.splice;
			const needles = Array.prototype.concat.apply([], arguments);
			const result  = [];

			for (let i = 0, iend = needles.length; i < iend; ++i) {
				const needle = needles[i];
				let pos = 0;

				while ((pos = indexOf.call(this, needle, pos)) !== -1) {
					push.apply(result, splice.call(this, pos, 1));
				}
			}

			return result;
		}
	});

	/*
		Removes and returns all of the elements at the given indices from the array.
	*/
	Object.defineProperty(Array.prototype, 'deleteAt', {
		configurable : true,
		writable     : true,

		value(/* indices */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.deleteAt called on null or undefined');
			}

			if (arguments.length === 0) {
				return [];
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return [];
			}

			const splice     = Array.prototype.splice;
			const cpyIndices = [
				...(new Set(
					Array.prototype.concat.apply([], arguments)
						// Map negative indices to their positive counterparts,
						// so the Set can properly filter out duplicates.
						.map(x => x < 0 ? Math.max(0, length + x) : x)
				)).values()
			];
			const delIndices = [...cpyIndices].sort((a, b) => b - a);
			const result     = [];

			// Copy the elements (in original indices order).
			for (let i = 0, iend = cpyIndices.length; i < iend; ++i) {
				result[i] = this[cpyIndices[i]];
			}

			// Delete the elements (in descending numeric order).
			for (let i = 0, iend = delIndices.length; i < iend; ++i) {
				splice.call(this, delIndices[i], 1);
			}

			return result;
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

			return Array.prototype.reduce.call(
				this,
				(prev, cur) => prev.concat(Array.isArray(cur) ? cur.flatten() : cur),
				[]
			);
		}
	});

	/*
		Returns whether all of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'includesAll', {
		configurable : true,
		writable     : true,

		value(/* needles */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.includesAll called on null or undefined');
			}

			if (arguments.length === 1) {
				if (Array.isArray(arguments[0])) {
					return Array.prototype.includesAll.apply(this, arguments[0]);
				}

				return Array.prototype.includes.apply(this, arguments);
			}

			for (let i = 0, iend = arguments.length; i < iend; ++i) {
				if (
					!Array.prototype.some.call(this, function (val) {
						return val === this.val || val !== val && this.val !== this.val;
					}, { val : arguments[i] })
				) {
					return false;
				}
			}

			return true;
		}
	});

	/*
		Returns whether any of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'includesAny', {
		configurable : true,
		writable     : true,

		value(/* needles */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.includesAny called on null or undefined');
			}

			if (arguments.length === 1) {
				if (Array.isArray(arguments[0])) {
					return Array.prototype.includesAny.apply(this, arguments[0]);
				}

				return Array.prototype.includes.apply(this, arguments);
			}

			for (let i = 0, iend = arguments.length; i < iend; ++i) {
				if (
					Array.prototype.some.call(this, function (val) {
						return val === this.val || val !== val && this.val !== this.val;
					}, { val : arguments[i] })
				) {
					return true;
				}
			}

			return false;
		}
	});

	/*
		Removes and returns a random element from the array, within the range of the lower and
		upper bounds, if they are specified.
	*/
	Object.defineProperty(Array.prototype, 'pluck', {
		configurable : true,
		writable     : true,

		value(lowerBound, upperBound) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.pluck called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return;
			}

			let lower = lowerBound;
			let upper = upperBound;

			if (arguments.length === 1) {
				upper = lower;
				lower = 0;
			}

			if (lower == null) { // lazy equality for null
				lower = 0;
			}
			else if (lower < 0) {
				lower = length + lower;

				if (lower < 0) {
					lower = 0;
				}
			}
			else if (lower >= length) {
				lower = length - 1;
			}

			if (upper == null) { // lazy equality for null
				upper = length - 1;
			}
			else if (upper < 0) {
				upper = length + upper;

				if (upper < 0) {
					upper = length - 1;
				}
			}
			else if (upper >= length) {
				upper = length - 1;
			}

			return Array.prototype.splice.call(this, _random(lower, upper), 1)[0];
		}
	});

	/*
		Returns a random element from the array, within the range of the lower and upper bounds,
		if they are specified.
	*/
	Object.defineProperty(Array.prototype, 'random', {
		configurable : true,
		writable     : true,

		value(lowerBound, upperBound) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.random called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return;
			}

			let lower = lowerBound;
			let upper = upperBound;

			if (arguments.length === 1) {
				upper = lower;
				lower = 0;
			}

			if (lower == null) { // lazy equality for null
				lower = 0;
			}
			else if (lower < 0) {
				lower = length + lower;

				if (lower < 0) {
					lower = 0;
				}
			}
			else if (lower >= length) {
				lower = length - 1;
			}

			if (upper == null) { // lazy equality for null
				upper = length - 1;
			}
			else if (upper < 0) {
				upper = length + upper;

				if (upper < 0) {
					upper = length - 1;
				}
			}
			else if (upper >= length) {
				upper = length - 1;
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

			const length = this.length >>> 0;

			if (length === 0) {
				return;
			}

			for (let i = length - 1; i > 0; --i) {
				const j    = Math.floor(_nativeMathRandom() * (i + 1));
				// const swap = this[i];
				// this[i] = this[j];
				// this[j] = swap;
				[this[i], this[j]] = [this[j], this[i]];
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

			const slice = Array.prototype.slice;
			const fn    = this;
			const bound = slice.call(arguments, 0);

			return function () {
				const applied = [];
				let argc = 0;

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
			const value = Number(num);
			return Number.isNaN(value) ? NaN : value.clamp(min, max);
		}
	});

	/*
		Returns a decimal number eased from 0 to 1.

		NOTE: The magnitude of the returned value decreases if num < 0.5 or increases if num > 0.5.
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

			let min = Number(arguments[0]);
			let max = Number(arguments[1]);

			if (min > max) {
				[min, max] = [max, min];
			}

			return Math.min(Math.max(this, min), max);
		}
	});

	/*
		Returns a copy of the given string with all RegExp metacharacters escaped.
	*/
	if (!RegExp.escape) {
		(() => {
			const _regExpMetaCharsRe    = /[\\^$*+?.()|[\]{}]/g;
			const _hasRegExpMetaCharsRe = new RegExp(_regExpMetaCharsRe.source); // to drop the global flag

			Object.defineProperty(RegExp, 'escape', {
				configurable : true,
				writable     : true,

				value(str) {
					const val = String(str);
					return val && _hasRegExpMetaCharsRe.test(val)
						? val.replace(_regExpMetaCharsRe, '\\$&')
						: val;
				}
			});
		})();
	}

	/*
		Returns a formatted string, after replacing each format item in the given format string
		with the text equivalent of the corresponding argument's value.
	*/
	(() => {
		const _formatRegExp    = /{(\d+)(?:,([+-]?\d+))?}/g;
		const _hasFormatRegExp = new RegExp(_formatRegExp.source); // to drop the global flag

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

					// const padding = Array(plen + 1).join(pad);
					const padding = String(pad).repeat(plen);
					return align < 0 ? str + padding : padding + str;
				}

				if (arguments.length < 2) {
					return arguments.length === 0 ? '' : format;
				}

				const args = arguments.length === 2 && Array.isArray(arguments[1])
					? [...arguments[1]]
					: Array.prototype.slice.call(arguments, 1);

				if (args.length === 0) {
					return format;
				}

				if (!_hasFormatRegExp.test(format)) {
					return format;
				}

				// Possibly required by some old buggy browsers.
				_formatRegExp.lastIndex = 0;

				return format.replace(_formatRegExp, (match, index, align) => {
					let retval = args[index];

					if (retval == null) { // lazy equality for null
						return '';
					}

					while (typeof retval === 'function') {
						retval = retval();
					}

					switch (typeof retval) {
					case 'string': /* no-op */ break;
					case 'object': retval = JSON.stringify(retval); break;
					default:       retval = String(retval); break;
					}

					return padString(retval, !align ? 0 : Number.parseInt(align, 10), ' ');
				});
			}
		});
	})();

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

			const indexOf = String.prototype.indexOf;
			const step    = needle.length;
			let pos     = Number(arguments[1]) || 0;
			let count   = 0;

			while ((pos = indexOf.call(this, needle, pos)) !== -1) {
				++count;
				pos += step;
			}

			return count;
		}
	});

	/*
		Returns a copy of the base string with `delCount` characters replaced with `replacement`, starting at `startAt`.
	*/
	Object.defineProperty(String.prototype, 'splice', {
		configurable : true,
		writable     : true,

		value(startAt, delCount, replacement) {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.splice called on null or undefined');
			}

			const length = this.length >>> 0;

			if (length === 0) {
				return '';
			}

			let start = Number(startAt);

			if (!Number.isSafeInteger(start)) {
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

			let count = Number(delCount);

			if (!Number.isSafeInteger(count) || count < 0) {
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
		Returns a copy of the base string with the first Unicode code point uppercased,
		according to any locale-specific rules.
	*/
	Object.defineProperty(String.prototype, 'toLocaleUpperFirst', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.toLocaleUpperFirst called on null or undefined');
			}

			// Required as `this` could be a `String` object or come from a `call()` or `apply()`.
			const str = String(this);

			// Get the first code point—may be one or two code units—and its end position.
			const { char, end } = _getCodePointStartAndEnd(str, 0);

			return end === -1 ? '' : char.toLocaleUpperCase() + str.slice(end + 1);
		}
	});

	/*
		Returns a copy of the base string with the first Unicode code point uppercased.
	*/
	Object.defineProperty(String.prototype, 'toUpperFirst', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.toUpperFirst called on null or undefined');
			}

			// Required as `this` could be a `String` object or come from a `call()` or `apply()`.
			const str = String(this);

			// Get the first code point—may be one or two code units—and its end position.
			const { char, end } = _getCodePointStartAndEnd(str, 0);

			return end === -1 ? '' : char.toUpperCase() + str.slice(end + 1);
		}
	});


	/*******************************************************************************************************************
	 * Extensions, JSON.
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

		value(code, data) {
			if (typeof code !== 'string') {
				throw new TypeError('JSON.reviveWrapper code parameter must be a string');
			}

			return ['(revive:eval)', [code, data]];
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
							/* eslint-disable no-eval */
							// For post-v2.9.0 `JSON.reviveWrapper()`.
							if (Array.isArray(value[1])) {
								const $ReviveData$ = value[1][1]; // eslint-disable-line no-unused-vars
								value = eval(value[1][0]);
							}

							// For regular expressions, functions, and pre-v2.9.0 `JSON.reviveWrapper()`.
							else {
								value = eval(value[1]);
							}
							/* eslint-enable no-eval */
						}
						catch (ex) { /* no-op; although, perhaps, it would be better to throw an error here */ }
						break;
					}
				}

				/* legacy */
				else if (typeof value === 'string' && value.slice(0, 10) === '@@revive@@') {
					try {
						value = eval(value.slice(10)); // eslint-disable-line no-eval
					}
					catch (ex) { /* no-op; although, perhaps, it would be better to throw an error here */ }
				}
				/* /legacy */

				/*
					Call the custom reviver, if specified.
				*/
				if (typeof reviver === 'function') {
					try {
						value = reviver(key, value);
					}
					catch (ex) { /* no-op; although, perhaps, it would be better to throw an error here */ }
				}

				return value;
			});
		}
	});


	/*******************************************************************************************************************
	 * Extensions, Deprecated.
	 ******************************************************************************************************************/
	/*
		[DEPRECATED] Returns whether the given element was found within the array.
	*/
	Object.defineProperty(Array.prototype, 'contains', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.contains called on null or undefined');
			}

			return Array.prototype.includes.apply(this, arguments);
		}
	});

	/*
		[DEPRECATED] Returns whether all of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'containsAll', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.containsAll called on null or undefined');
			}

			return Array.prototype.includesAll.apply(this, arguments);
		}
	});

	/*
		[DEPRECATED] Returns whether any of the given elements were found within the array.
	*/
	Object.defineProperty(Array.prototype, 'containsAny', {
		configurable : true,
		writable     : true,

		value(/* needle [, fromIndex] */) {
			if (this == null) { // lazy equality for null
				throw new TypeError('Array.prototype.containsAny called on null or undefined');
			}

			return Array.prototype.includesAny.apply(this, arguments);
		}
	});

	/*
		[DEPRECATED] Returns an array of link titles, parsed from the string.

		NOTE: Unused in SugarCube, only included for compatibility.
	*/
	Object.defineProperty(String.prototype, 'readBracketedList', {
		configurable : true,
		writable     : true,

		value() {
			if (this == null) { // lazy equality for null
				throw new TypeError('String.prototype.readBracketedList called on null or undefined');
			}

			// RegExp groups: Double-square-bracket quoted | Unquoted.
			const re    = new RegExp('(?:\\[\\[((?:\\s|\\S)*?)\\]\\])|([^"\'\\s]\\S*)', 'gm');
			const names = [];
			let match;

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
})();
