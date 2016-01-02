/***********************************************************************************************************************
 *
 * utility/extensions.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global random, safeActiveElement */
/* eslint-disable no-extend-native */

/***********************************************************************************************************************
 * JavaScript Polyfills
 **********************************************************************************************************************/
/*
	NOTE: Most of the ES5 & ES6 polyfills now come from the `es5-shim.js` & `es6-shim.js` libraries, respectively.
*/

/*
	[ES7] Returns whether the given element was found within the array.
*/
if (!Array.prototype.includes) {
	Object.defineProperty(Array.prototype, "includes", {
		configurable : true,
		writable     : true,
		value        : function (/* needle [, fromIndex] */) {
			"use strict";
			if (this == null) { // lazy equality for null
				throw new TypeError("Array.prototype.includes called on null or undefined");
			}

			return Array.prototype.indexOf.apply(this, arguments) !== -1;
		}
	});
}

/*
	[ES5] We just do a simple shim, without the second argument, since that's all we need here.
*/
if (!Object.create || typeof Object.create !== "function") {
	Object.defineProperty(Object, "create", {
		configurable : true,
		writable     : true,
		/* eslint-disable no-proto */
		value        : (function () {
			"use strict";
			function F() {}

			return function (proto) {
				if (arguments.length === 0) {
					throw new Error("polyfill Object.create implementation requires a parameter");
				}
				if (arguments.length !== 1) {
					throw new Error("polyfill Object.create implementation only accepts one parameter");
				}

				var	obj;
				if (proto === null) {
					obj = { __proto__ : null };
				} else {
					if (typeof proto !== "object" && typeof proto !== "function") {
						throw new TypeError("polyfill Object.create proto parameter must be an object or null");
					}

					F.prototype   = proto;
					obj           = new F();
					obj.__proto__ = proto;
				}
				return obj;
			};
		})()
		/* eslint-enable no-proto */
	});
}


/***********************************************************************************************************************
 * JavaScript Extensions, General
 **********************************************************************************************************************/
/*
	Returns a random value from the given array in the range of lower and upper, if they are specified.
*/
Object.defineProperty(Array, "random", {
	configurable : true,
	writable     : true,
	value        : function (array, lower, upper) {
		"use strict";
		if (arguments.length === 2) {
			upper = lower;
			lower = 0;
		}
		if (Array.isArray(array)) {
			return array.random(lower, upper);
		} else if (array.hasOwnProperty("length")) {
			return Array.from(array).random(lower, upper);
		}
		return undefined;
	}
});

/*
	Returns whether the given element was found within the array.
*/
Object.defineProperty(Array.prototype, "contains", {
	configurable : true,
	writable     : true,
	value        : function (/* needle [, fromIndex] */) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("Array.prototype.contains called on null or undefined");
		}

		return Array.prototype.indexOf.apply(this, arguments) !== -1;
	}
});

/*
	Returns whether all of the given elements were found within the array.
*/
Object.defineProperty(Array.prototype, "containsAll", {
	configurable : true,
	writable     : true,
	value        : function (/* needles */) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("Array.prototype.containsAll called on null or undefined");
		}

		if (arguments.length === 1) {
			if (Array.isArray(arguments[0])) {
				return Array.prototype.containsAll.apply(this, arguments[0]);
			} else {
				return Array.prototype.indexOf.apply(this, arguments) !== -1;
			}
		} else {
			for (var i = 0, iend = arguments.length; i < iend; ++i) {
				if (!Array.prototype.some.call(this, function (v) { return v === this.val; }, { val : arguments[i] })) {
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
Object.defineProperty(Array.prototype, "containsAny", {
	configurable : true,
	writable     : true,
	value        : function (/* needles */) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("Array.prototype.containsAny called on null or undefined");
		}

		if (arguments.length === 1) {
			if (Array.isArray(arguments[0])) {
				return Array.prototype.containsAny.apply(this, arguments[0]);
			} else {
				return Array.prototype.indexOf.apply(this, arguments) !== -1;
			}
		} else {
			for (var i = 0, iend = arguments.length; i < iend; ++i) {
				if (Array.prototype.some.call(this, function (v) { return v === this.val; }, { val : arguments[i] })) {
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
Object.defineProperty(Array.prototype, "count", {
	configurable : true,
	writable     : true,
	value        : function (/* needle [, fromIndex ] */) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("Array.prototype.count called on null or undefined");
		}

		var	indexOf = Array.prototype.indexOf,
			needle  = arguments[0],
			pos     = Number(arguments[1] || 0),
			count   = 0;

		while ((pos = indexOf.call(this, needle, pos)) !== -1) {
			++count;
			++pos;
		}
		return count;
	}
});

/*
	Returns a new array consisting of the flattened source array (flat map reduce).
*/
Object.defineProperty(Array.prototype, "flatten", {
	configurable : true,
	writable     : true,
	value        : function () {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("Array.prototype.flatten called on null or undefined");
		}

		return this.reduce(function (prev, cur) {
			return prev.concat(Array.isArray(cur) ? cur.flatten() : cur);
		}, []);
	}
});

/*
	Removes and returns a random value from the array in the range of lower and upper, if they are specified.
*/
Object.defineProperty(Array.prototype, "pluck", {
	configurable : true,
	writable     : true,
	value        : function (lower, upper) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("Array.prototype.pluck called on null or undefined");
		}
		if (this.length === 0) {
			return;
		}

		if (arguments.length === 1) {
			upper = lower;
			lower = 0;
		}
		if (lower == null) { // lazy equality for null
			lower = 0;
		} else if (lower < 0) {
			lower = 0;
		} else if (lower >= this.length) {
			lower = this.length - 1;
		}
		if (upper == null) { // lazy equality for null
			upper = this.length - 1;
		} else if (upper < 0) {
			upper = 0;
		} else if (upper >= this.length) {
			upper = this.length - 1;
		}
		return Array.prototype.splice.call(this, random(lower, upper), 1)[0];
	}
});

/*
	Returns a random value from the array in the range of lower and upper, if they are specified.
*/
Object.defineProperty(Array.prototype, "random", {
	configurable : true,
	writable     : true,
	value        : function (lower, upper) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("Array.prototype.random called on null or undefined");
		}
		if (this.length === 0) {
			return;
		}

		if (arguments.length === 1) {
			upper = lower;
			lower = 0;
		}
		if (lower == null) { // lazy equality for null
			lower = 0;
		} else if (lower < 0) {
			lower = 0;
		} else if (lower >= this.length) {
			lower = this.length - 1;
		}
		if (upper == null) { // lazy equality for null
			upper = this.length - 1;
		} else if (upper < 0) {
			upper = 0;
		} else if (upper >= this.length) {
			upper = this.length - 1;
		}
		return this[random(lower, upper)];
	}
});

/*
	Randomly shuffles the array.
*/
Object.defineProperty(Array.prototype, "shuffle", {
	configurable : true,
	writable     : true,
	value        : function () {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("Array.prototype.shuffle called on null or undefined");
		}
		if (this.length === 0) {
			return;
		}

		for (var i = this.length - 1; i > 0; --i) {
			var	j    = Math.floor(Math.random() * (i + 1)),
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
Object.defineProperty(Function.prototype, "partial", {
	configurable : true,
	writable     : true,
	value        : function (/* variadic */) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("Function.prototype.partial called on null or undefined");
		}

		var	slice = Array.prototype.slice,
			fn    = this,
			bound = slice.call(arguments, 0);
		return function () {
			var	applied = [],
				argc    = 0;
			for (var i = 0; i < bound.length; ++i) {
				applied.push(bound[i] === undefined ? arguments[argc++] : bound[i]);
			}
			return fn.apply(this, applied.concat(slice.call(arguments, argc)));
		};
	}
});

/*
	Returns the given numerical clamped to the specified bounds.
*/
Object.defineProperty(Math, "clamp", {
	configurable : true,
	writable     : true,
	value        : function (num, min, max) {
		"use strict";
		num = Number(num);
		return isNaN(num) ? NaN : num.clamp(min, max);
	}
});

/*
	Returns a decimal number eased from 0 to 1.

	n.b. The magnitude of the returned value decreases if num < 0.5 or increases if num > 0.5.
*/
Object.defineProperty(Math, "easeInOut", {
	configurable : true,
	writable     : true,
	value        : function (num) {
		"use strict";
		num = Number(num);
		return 1 - (Math.cos(num * Math.PI) + 1) / 2;
	}
});

/*
	Returns the number clamped to the specified bounds.
*/
Object.defineProperty(Number.prototype, "clamp", {
	configurable : true,
	writable     : true,
	value        : function (min, max) {
		"use strict";
		var num = Number(this);
		if (num < min) { num = min; }
		if (num > max) { num = max; }
		return num;
	}
});

/*
	Returns a copy of the given string with all RegExp metacharacters escaped.
*/
Object.defineProperty(RegExp, "escape", {
	configurable : true,
	writable     : true,
	value        : function (str) {
		"use strict";
		return String(str).replace(/[-.*+?^${}()|\[\]\/\\]/g, "\\$&");
	}
});

/*
	Returns a formatted string, after replacing each format item in the given format string
	with the text equivalent of the corresponding argument's value.
*/
Object.defineProperty(String, "format", {
	configurable : true,
	writable     : true,
	value        : function (format) {
		"use strict";
		function padString(str, align, pad) {
			if (!align) {
				return str;
			}
			var plen = Math.abs(align) - str.length;
			if (plen < 1) {
				return str;
			}
			var padding = Array(plen + 1).join(pad);
			return align < 0 ? str + padding : padding + str;
		}

		if (arguments.length < 2) {
			return arguments.length === 0 ? "" : format;
		}

		var args = arguments.length === 2 && Array.isArray(arguments[1])
			? arguments[1].slice(0)
			: Array.prototype.slice.call(arguments, 1);

		if (args.length === 0) {
			return format;
		}

		return format.replace(/{(\d+)(?:,([+-]?\d+))?}/g, function (match, index, align) {
			var retval = args[index];
			if (retval == null) { // lazy equality for null
				return "";
			}
			while (typeof retval === "function") {
				retval = retval();
			}
			switch (typeof retval) {
			case "string":
				/* nothing */
				break;
			case "object":
				retval = JSON.stringify(retval);
				break;
			default:
				retval = String(retval);
				break;
			}
			return padString(retval, !align ? 0 : parseInt(align, 10), " ");
		});
	}
});

/*
	Returns whether the given string was found within the string.
*/
Object.defineProperty(String.prototype, "contains", {
	configurable : true,
	writable     : true,
	value        : function (/* needle [, fromIndex] */) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("String.prototype.contains called on null or undefined");
		}

		return String.prototype.indexOf.apply(this, arguments) !== -1;
	}
});

/*
	Returns the number of times the given string was found within the string.
*/
Object.defineProperty(String.prototype, "count", {
	configurable : true,
	writable     : true,
	value        : function (/* needle [, fromIndex ] */) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("String.prototype.count called on null or undefined");
		}

		var needle = String(arguments[0] || "");

		if (needle === "") {
			return 0;
		}

		var	indexOf = String.prototype.indexOf,
			step    = needle.length,
			pos     = Number(arguments[1] || 0),
			count   = 0;

		while ((pos = indexOf.call(this, needle, pos)) !== -1) {
			++count;
			pos += step;
		}
		return count;
	}
});

/*
	Returns a copy of the base string with `count` characters replaced with `replacement`, starting at `start`.
*/
Object.defineProperty(String.prototype, "splice", {
	configurable : true,
	writable     : true,
	value        : function (start, count, replacement) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("String.prototype.splice called on null or undefined");
		}

		var length = this.length >>> 0;

		if (length === 0) {
			return "";
		}

		start = +start || 0;
		if (!isFinite(start)) {
			start = 0;
		} else if (start < 0) {
			start += length;
			if (start < 0) {
				start = 0;
			}
		}
		if (start > length) {
			start = length;
		}

		count = +count || 0;
		if (!isFinite(count) || count < 0) {
			count = 0;
		}

		var res = this.slice(0, start);
		if (typeof replacement !== "undefined") {
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
Object.defineProperty(String.prototype, "splitOrEmpty", {
	configurable : true,
	writable     : true,
	value        : function (/* [ separator [, limit ]] */) {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("String.prototype.splitOrEmpty called on null or undefined");
		}
		if (String(this) === "") { // required as `this` could be a `String` object or come from a `call()` or `apply()`
			return [];
		}

		return String.prototype.split.apply(this, arguments);
	}
});

/*
	[FF-extension] Returns a string with all whitespace removed from the left side of the string.
*/
if (!String.prototype.trimLeft) {
	Object.defineProperty(String.prototype, "trimLeft", {
		configurable : true,
		writable     : true,
		value        : function () {
			"use strict";
			if (this == null) { // lazy equality for null
				throw new TypeError("String.prototype.trimLeft called on null or undefined");
			}

			return this.replace(/^[\s\uFEFF\xA0]+/, ""); // include UTF BOM and NBSP
		}
	});
}

/*
	[FF-extension] Returns a string with all whitespace removed from the right side of the string.
*/
if (!String.prototype.trimRight) {
	Object.defineProperty(String.prototype, "trimRight", {
		configurable : true,
		writable     : true,
		value        : function () {
			"use strict";
			if (this == null) { // lazy equality for null
				throw new TypeError("String.prototype.trimRight called on null or undefined");
			}

			return this.replace(/[\s\uFEFF\xA0]+$/, ""); // include UTF BOM and NBSP
		}
	});
}

/*
	[DEPRECATED] Returns a string with all whitespace removed from the left side of the base string.

	n.b. Just a legacy alias for String.prototype.trimLeft now.
*/
Object.defineProperty(String.prototype, "ltrim", {
	configurable : true,
	writable     : true,
	value        : String.prototype.trimLeft
});

/*
	[DEPRECATED] Returns a string with all whitespace removed from the right side of the base string.

	n.b. Just a legacy alias for String.prototype.trimRight now.
*/
Object.defineProperty(String.prototype, "rtrim", {
	configurable : true,
	writable     : true,
	value        : String.prototype.trimRight
});

/*
	Returns an array of link titles, parsed from the string.

	n.b. Unused in SugarCube, only included for compatibility.
*/
Object.defineProperty(String.prototype, "readBracketedList", {
	configurable : true,
	writable     : true,
	value        : function () {
		"use strict";
		if (this == null) { // lazy equality for null
			throw new TypeError("String.prototype.readBracketedList called on null or undefined");
		}

		// RegExp groups: Double-square-bracket quoted | Unquoted.
		var	re    = new RegExp("(?:\\[\\[((?:\\s|\\S)*?)\\]\\])|([^\"'\\s]\\S*)", "gm"),
			match,
			names = [];
		while ((match = re.exec(this)) !== null) {
			if (match[1]) { // double-square-bracket quoted
				names.push(match[1]);
			} else if (match[2]) { // unquoted
				names.push(match[2]);
			}
		}
		return names;
	}
});


/***********************************************************************************************************************
 * JavaScript Extensions, JSON/serialization
 **********************************************************************************************************************/
/*
	Define `toJSON()` methods on each prototype we wish to support.
*/
Object.defineProperty(Date.prototype, "toJSON", {
	configurable : true,
	writable     : true,
	value        : function () {
		"use strict";
		return [ "(revive:date)", this.toISOString() ];
	}
});
Object.defineProperty(Function.prototype, "toJSON", {
	configurable : true,
	writable     : true,
	value        : function () {
		"use strict";
		// The parenthesis are necessary here to force evaluation as an expression.
		return [ "(revive:eval)", '(' + this.toString() + ')' ];
	}
});
Object.defineProperty(Map.prototype, "toJSON", {
	configurable : true,
	writable     : true,
	value        : function () {
		"use strict";
		return [ "(revive:map)", Array.from(this) ];
	}
});
Object.defineProperty(RegExp.prototype, "toJSON", {
	configurable : true,
	writable     : true,
	value        : function () {
		"use strict";
		return [ "(revive:eval)", this.toString() ];
	}
});
Object.defineProperty(Set.prototype, "toJSON", {
	configurable : true,
	writable     : true,
	value        : function () {
		"use strict";
		return [ "(revive:set)", Array.from(this) ];
	}
});

/*
	Utility method to allow users to easily wrap their code in the revive wrapper.
*/
Object.defineProperty(JSON, "reviveWrapper", {
	configurable : true,
	writable     : true,
	value        : function (code) {
		"use strict";
		if (typeof code !== "string") {
			throw new TypeError("JSON.reviveWrapper code parameter must be a string");
		}
		return [ "(revive:eval)", code ];
	}
});

/*
	Backup the original `JSON.parse()` and replace it with a revive wrapper aware version.
*/
Object.defineProperties(JSON, {
	"_real_parse" : {
		value : JSON.parse
	},
	"parse" : {
		configurable : true,
		writable     : true,
		value        : function (text, reviver) {
			"use strict";
			return JSON._real_parse(text, function (key, value) {
				/*
					Attempt to revive wrapped values.
				*/
				if (Array.isArray(value) && value.length === 2) {
					switch (value[0]) {
					case "(revive:set)":
						value = new Set(value[1]);
						break;
					case "(revive:map)":
						value = new Map(value[1]);
						break;
					case "(revive:date)":
						value = new Date(value[1]);
						break;
					case "(revive:eval)":
						try {
							value = eval(value[1]); // eslint-disable-line no-eval
						} catch (e) { /* no-op; although, perhaps, it would be better to throw an error here */ }
						break;
					}
				}

				/* legacy */
				else if (typeof value === "string" && value.slice(0, 10) === "@@revive@@") {
					try {
						value = eval(value.slice(10)); // eslint-disable-line no-eval
					} catch (e) { /* no-op; although, perhaps, it would be better to throw an error here */ }
				}
				/* /legacy */

				/*
					Call the custom reviver, if specified.
				*/
				if (typeof reviver === "function") {
					try {
						value = reviver(key, value);
					} catch (e) { /* no-op; although, perhaps, it would be better to throw an error here */ }
				}
				return value;
			});
		}
	}
});


/***********************************************************************************************************************
 * jQuery Plugins
 **********************************************************************************************************************/
/*
	`ariaClick([options,] fn)` method plugin.

	Makes the target element(s) WAI-ARIA compatible clickables.

	n.b. Has an external dependency in the `safeActiveElement()` function (see: `utility.js`).
*/
(function () {

	/*
		Event handler & utility functions.
	*/
	var	onKeypressFn = function (evt) {
			// 13 is Enter/Return, 32 is Space.
			if (evt.which === 13 || evt.which === 32) {
				evt.preventDefault();

				// To allow delegation, attempt to trigger the event on `document.activeElement`,
				// if possible, elsewise on `this`.
				jQuery(safeActiveElement() || this).trigger("click");
			}
		},
		onClickFnWrapper = function (fn) {
			return function () {
				// Toggle "aria-pressed" status, if the attribute exists.
				var $this = jQuery(this);
				if ($this.is("[aria-pressed]")) {
					$this.attr("aria-pressed", $this.attr("aria-pressed") === "true" ? "false" : "true");
				}

				// Call the true handler.
				fn.apply(this, arguments);
			};
		},
		oneClickFnWrapper = function (fn) {
			return onClickFnWrapper(function () {
				// Remove both event handlers (keypress & click) and the other components.
				jQuery(this)
					.off(".aria-clickable")
					.removeAttr("tabindex aria-controls aria-pressed")
					.not("a,button")
						.removeAttr("role")
						.end()
					.filter("button")
						.prop("disabled", true);

				// Call the true handler.
				fn.apply(this, arguments);
			});
		};

	/*
		Extend jQuery's chainable methods with an `ariaClick()` method.
	*/
	jQuery.fn.extend({
		ariaClick : function (options, fn) {
			if (arguments.length === 0) {
				return this;
			}

			if (fn == null) { // lazy equality for null
				fn      = options;
				options = undefined;
			}

			options = jQuery.extend({
				namespace : undefined,
				one       : false,
				selector  : undefined,
				data      : undefined,
				controls  : undefined,
				pressed   : undefined,
				label     : undefined
			}, options);
			if (typeof options.namespace !== "string") {
				options.namespace = "";
			} else if (options.namespace[0] !== ".") {
				options.namespace = "." + options.namespace;
			}
			if (typeof options.pressed === "boolean") {
				options.pressed = options.pressed ? "true" : "false";
			}

			// Set `type` to `button` to suppress "submit" semantics, for <button> elements.
			this.filter("button").prop("type", "button");

			// Set `role` to `button`, for non-<a>/-<button> elements.
			this.not("a,button").attr("role", "button");

			// Set `tabindex` to `0` to make them focusable (unnecessary on <button> elements, but it doesn't hurt).
			this.attr("tabindex", 0);

			// Set `aria-controls`.
			if (options.controls != null) { // lazy equality for null
				this.attr("aria-controls", options.controls);
			}

			// Set `aria-pressed`.
			if (options.pressed != null) { // lazy equality for null
				this.attr("aria-pressed", options.pressed);
			}

			// Set `aria-label` and `title`.
			if (options.label != null) { // lazy equality for null
				this.attr({
					"aria-label" : options.label,
					"title"      : options.label
				});
			}

			// Set the keypress handlers, for non-<button> elements.
			//   n.b. For the single-use case, the click handler will also remove this handler.
			this.not("button").on(
				"keypress.aria-clickable" + options.namespace,
				options.selector,
				onKeypressFn
			);

			// Set the click handlers.
			//   n.b. To ensure both handlers are properly removed, `one()` must not be used here.
			this.on(
				"click.aria-clickable" + options.namespace,
				options.selector,
				options.data,
				options.one ? oneClickFnWrapper(fn) : onClickFnWrapper(fn)
			);

			return this;
		}
	});

})();

