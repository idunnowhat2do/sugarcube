/***********************************************************************************************************************
 *
 * util.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global clone, evalJavaScript */

var Util = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	/*******************************************************************************************************************
	 * Type Functions
	 ******************************************************************************************************************/
	/**
		Returns whether the passed value is a finite number or a numeric string which yields
		a finite number when parsed.
	**/
	function utilIsNumeric(obj) {
		switch (typeof obj) {
		case "number":
			/* no-op */
			break;
		case "string":
			obj = Number(obj);
			break;
		default:
			return false;
		}
		return isFinite(obj) && !isNaN(obj);
	}

	/**
		Returns whether the passed value is a boolean or one of the strings "true" or "false".
	**/
	function utilIsBoolean(obj) {
		return typeof obj === "boolean" || typeof obj === "string" && (obj === "true" || obj === "false");
	}


	/*******************************************************************************************************************
	 * String Encoding Functions
	 ******************************************************************************************************************/
	/**
		Returns a lowercased and hyphen encoded version of the passed string.
	**/
	function utilSlugify(str) {
		return String(str)
			.trim()
			.replace(/[^\w\s\u2013\u2014-]+/g, '')
			.replace(/[_\s\u2013\u2014-]+/g, '-')
			.toLocaleLowerCase();
	}

	/**
		Returns an entity encoded version of the passed string.
	**/
	function utilEscape(str) {
		if (str == null) { // lazy equality for null
			return "";
		}
		var	htmlCharsRe    = /[&<>"'`]/g,
			hasHtmlCharsRe = RegExp(htmlCharsRe.source), // to drop the global flag
			htmlCharsMap   = {
				"&" : "&amp;",
				"<" : "&lt;",
				">" : "&gt;",
				'"' : "&quot;",
				"'" : "&#39;",
				"`" : "&#96;"
			};
		str = String(str);
		return str && hasHtmlCharsRe.test(str)
			? str.replace(htmlCharsRe, function (c) { return htmlCharsMap[c]; })
			: str;
	}

	/**
		Returns a decoded version of the passed entity encoded string.
	**/
	function utilUnescape(str) {
		if (str == null) { // lazy equality for null
			return "";
		}
		var	escapedHtmlRe    = /&(?:amp|lt|gt|quot|apos|#39|#x27|#96|#x60);/g,
			hasEscapedHtmlRe = RegExp(escapedHtmlRe.source), // to drop the global flag
			escapedHtmlMap   = {
				"&amp;"  : "&",
				"&lt;"   : "<",
				"&gt;"   : ">",
				"&quot;" : '"',
				"&apos;" : "'", // apostrophe from XML shenanigans
				"&#39;"  : "'", // apostrophe from decimal NCR
				"&#x27;" : "'", // apostrophe from hexadecimal NCR (fuck you, Underscorejs)
				"&#96;"  : "`", // backtick from decimal NCR
				"&#x60;" : "`"  // backtick from hexadecimal NCR (fuck you, Underscorejs)
			};
		str = String(str);
		return str && hasEscapedHtmlRe.test(str)
			? str.replace(escapedHtmlRe, function (c) { return escapedHtmlMap[c]; })
			: str;
	}


	/*******************************************************************************************************************
	 * Conversion Functions
	 ******************************************************************************************************************/
	/**
		Returns the number of miliseconds represented by the passed CSS time string.
	**/
	function utilFromCSSTime(cssTime) {
		var	re    = /^([+-]?[0-9]+(?:\.[0-9]+)?)\s*(m?s)$/, // more forgiving than the specification requires
			match = re.exec(cssTime);
		if (match === null) {
			throw new Error('invalid time value: "' + cssTime + '"');
		}
		if (match[2] === "ms") {
			return Number(match[1]);
		} else {
			return Number(match[1]) * 1000;
		}
	}

	/**
		Returns the CSS time string represented by the passed number of milliseconds.
	**/
	function utilToCSSTime(msec) {
		if (typeof msec !== "number" || isNaN(msec) || !isFinite(msec)) {
			var what;
			switch (typeof msec) {
			case "string":
				what = '"' + msec + '"';
				break;
			case "number":
				what = String(msec);
				break;
			default:
				what = Object.prototype.toString.call(msec);
				break;
			}
			throw new Error("invalid milliseconds: " + what);
		}
		return msec + "ms";
	}


	/*******************************************************************************************************************
	 * Diff Functions
	 ******************************************************************************************************************/
	/*
		Diff operations enumeration.
	*/
	var _DiffOp = Object.freeze({ // eslint-disable-line no-unused-vars
		Delete      : 0,
		SpliceArray : 1,
		Copy        : 2,
		CopyDate    : 3
	});

	/**
		Returns a patch object containing the differences between the orig and the dest objects.
	**/
	function utilDiff(orig, dest) /* diff object */ {
		var	objToString = Object.prototype.toString,
			origIsArray = Array.isArray(orig),
			keys        = []
							.concat(Object.keys(orig), Object.keys(dest))
							.sort()
							.filter(function (v, i, a) { // eslint-disable-line no-shadow
								return i === 0 || a[i - 1] !== v;
							}),
			diff        = {},
			aOpRef;
		for (var i = 0, klen = keys.length; i < klen; ++i) {
			var	p     = keys[i],
				origP = orig[p],
				destP = dest[p];
			if (orig.hasOwnProperty(p)) {
				if (dest.hasOwnProperty(p)) {
					// Key exists in both.
					if (origP === destP) {
						// Values are exactly the same, so do nothing.
						continue;
					}
					if (typeof origP === typeof destP) {
						// Values are of the same basic type.
						if (typeof origP === "function") {
							// Values are functions.
							/* diff[p] = [ _DiffOp.Copy, destP ]; */
							if (origP.toString() !== destP.toString()) {
								diff[p] = [ _DiffOp.Copy, destP ];
							}
						} else if (typeof origP !== "object" || origP === null) {
							// Values are scalars or null.
							diff[p] = [ _DiffOp.Copy, destP ];
						} else {
							// Values are objects.
							var	origPType = objToString.call(origP),
								destPType = objToString.call(destP);
							if (origPType === destPType) {
								// Values are objects of the same prototype.
								if (origPType === "[object Date]") {
									// Special case: Date object.
									if (+origP !== +destP) {
										diff[p] = [ _DiffOp.CopyDate, +destP ];
									}
								} else if (origPType === "[object RegExp]") {
									// Special case: RegExp object.
									if (origP.toString() !== destP.toString()) {
										diff[p] = [ _DiffOp.Copy, clone(destP) ];
									}
								} else {
									var recurse = Util.diff(origP, destP);
									if (recurse !== null) {
										diff[p] = recurse;
									}
								}
							} else {
								// Values are objects of different prototypes.
								diff[p] = [ _DiffOp.Copy, clone(destP) ];
							}
						}
					} else {
						// Values are of different types.
						diff[p] = [
							_DiffOp.Copy,
							typeof destP !== "object" || destP === null ? destP : clone(destP)
						];
					}
				} else {
					// Key only exists in orig.
					if (origIsArray && Util.isNumeric(p)) {
						var np = +p;
						if (!aOpRef) {
							aOpRef = "";
							do {
								aOpRef += "~";
							} while (keys.some(function (v) { return v === this.val; }, { val : aOpRef }));
							diff[aOpRef] = [ _DiffOp.SpliceArray, np, np ];
						}
						if (np < diff[aOpRef][1]) {
							diff[aOpRef][1] = np;
						}
						if (np > diff[aOpRef][2]) {
							diff[aOpRef][2] = np;
						}
					} else {
						diff[p] = _DiffOp.Delete;
					}
				}
			} else {
				// Key only exists in dest.
				diff[p] = [
					_DiffOp.Copy,
					typeof destP !== "object" || destP === null ? destP : clone(destP)
				];
			}
		}
		return Object.keys(diff).length !== 0 ? diff : null;
	}

	/**
		Returns an object resulting from updating the orig object with the diff object.
	**/
	function utilPatch(orig, diff) /* patched object */ {
		var	keys    = Object.keys(diff || {}),
			patched = clone(orig);
		for (var i = 0, klen = keys.length; i < klen; ++i) {
			var	p     = keys[i],
				diffP = diff[p];
			if (diffP === _DiffOp.Delete) {
				delete patched[p];
			} else if (Array.isArray(diffP)) {
				switch (diffP[0]) {
				case _DiffOp.SpliceArray:
					patched.splice(diffP[1], 1 + (diffP[2] - diffP[1]));
					break;
				case _DiffOp.Copy:
					patched[p] = clone(diffP[1]);
					break;
				case _DiffOp.CopyDate:
					patched[p] = new Date(diffP[1]);
					break;
				}
			} else {
				patched[p] = Util.patch(patched[p], diffP);
			}
		}
		return patched;
	}


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Type Functions.
		*/
		isNumeric : { value : utilIsNumeric },
		isBoolean : { value : utilIsBoolean },

		/*
			String Encoding Functions.
		*/
		slugify  : { value : utilSlugify },
		escape   : { value : utilEscape },
		unescape : { value : utilUnescape },

		/*
			Conversion Functions.
		*/
		fromCSSTime : { value : utilFromCSSTime },
		toCSSTime   : { value : utilToCSSTime },

		/*
			Diff Functions.
		*/
		diff  : { value : utilDiff },
		patch : { value : utilPatch },

		/*
			Legacy Aliases.
		*/
		random         : { value : Math.random },
		entityEncode   : { value : utilEscape },
		entityDecode   : { value : utilUnescape },
		evalExpression : { value : evalJavaScript }, // External (see: utility/helperfunctions.js).
		evalStatements : { value : evalJavaScript }  // External (see: utility/helperfunctions.js).
	}));

})();

