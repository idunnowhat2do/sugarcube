/***********************************************************************************************************************
 *
 * utility.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Story, Wikifier, strings */

/***********************************************************************************************************************
 * Utility Functions
 **********************************************************************************************************************/
/*
	[DEPRECATED] Returns the jQuery-wrapped target element(s) after making them accessible clickables (ARIA compatibility).
*/
function addAccessibleClickHandler(targets, selector, fn, one, namespace) { // eslint-disable-line no-unused-vars
	if (arguments.length < 2) {
		throw new Error("addAccessibleClickHandler insufficient number of parameters");
	}

	if (typeof selector === "function") {
		namespace = one;
		one       = fn;
		fn        = selector;
		selector  = undefined;
	}

	if (typeof fn !== "function") {
		throw new TypeError("addAccessibleClickHandler handler parameter must be a function");
	}

	return jQuery(targets).ariaClick({
		namespace : namespace,
		one       : !!one,
		selector  : selector
	}, fn);
}

/*
	Appends a new <style> element to the document's <head>.
*/
function addStyle(css) { // eslint-disable-line no-unused-vars
	var style = document.getElementById("style-story");
	if (style === null) {
		style      = document.createElement("style");
		style.id   = "style-story";
		style.type = "text/css";
		document.head.appendChild(style);
	}
	style = new StyleWrapper(style);

	// Check for wiki image transclusion.
	var	matchRe = /\[[<>]?[Ii][Mm][Gg]\[(?:\s|\S)*?\]\]+/g;
	if (matchRe.test(css)) {
		css = css.replace(matchRe, function (wikiImage) {
			var markup = Wikifier.helpers.parseSquareBracketedMarkup({
				source     : wikiImage,
				matchStart : 0
			});
			if (markup.hasOwnProperty("error") || markup.pos < wikiImage.length) {
				return wikiImage;
			}

			var source = markup.source;
			// Handle image passage transclusion.
			if (source.slice(0, 5) !== "data:" && Story.has(source)) {
				var passage = Story.get(source);
				if (passage.tags.contains("Twine.image")) {
					source = passage.text;
				}
			}
			/*
				The source may be URI- or Base64-encoded, so we cannot use encodeURIComponent()
				here.  Instead, we simply encode any double quotes, since the URI will be
				delimited by them.
			*/
			return 'url("' + source.replace(/"/g, "%22") + '")';
		});
	}

	style.add(css);
}

/*
 	Returns a deep copy of the passed object

	n.b. 1. `clone()` does not clone functions, however, since function definitions are immutable,
	        the only issues are with expando properties and scope.  The former really should not
	        be done.  The latter is problematic either way (damned if you do, damned if you don't).
	     2. `clone()` does not maintain referential relationships (e.g. multiple references to the
	        same object will, post-cloning, refer to different equivalent objects; i.e. each
	        reference will get its own clone of the original object).
*/
function clone(orig) {
	/*
		Immediately return non-objects.
	*/
	if (typeof orig !== "object" || orig == null) { // lazy equality for null
		return orig;
	}

	/*
		Honor native clone methods.
	*/
	if (typeof orig.clone === "function") {
		return orig.clone(true);
	} else if (orig.nodeType && typeof orig.cloneNode === "function") {
		return orig.cloneNode(true);
	}

	/*
		Create a copy of the original object.

		n.b. 1. Each non-generic object that we wish to support must receive a special case below.
		     2. Since we're using the `instanceof` operator to identify special cases, this may
		        fail to properly identify such cases if the author engages in cross-<iframe>
		        object manipulation.  The solution to this problem would be for the author to
		        pass messages between the frames, rather than doing direct cross-frame object
		        manipulation.  That is, in fact, what they should be doing in the first place.
		     3. We cannot use `Object.prototype.toString.call(orig)` to solve #2 because the shims
		        for `Map` and `Set` return `[object Object]` rather than `[object Map]` and
		        `[object Set]`.
	*/
	var copy;
	if (Array.isArray(orig)) { // considering #2, `orig instanceof Array` might be more appropriate
		copy = [];
	} else if (orig instanceof Date) {
		copy = new Date(orig.getTime());
	} else if (orig instanceof Map) {
		copy = new Map();
		orig.forEach(function (v, k) { copy.set(k, clone(v)); });
	} else if (orig instanceof RegExp) {
		copy = new RegExp(orig);
	} else if (orig instanceof Set) {
		copy = new Set();
		orig.forEach(function (v) { copy.add(clone(v)); });
	} else { // unknown or generic object
		// Try to ensure that the returned object has the same prototype as the original.
		copy = Object.create(Object.getPrototypeOf(orig));
	}

	/*
		Duplicate the original object's own enumerable properties (n.b. this will include
		expando properties on non-generic objects).
	*/
	Object.keys(orig).forEach(function (name) {
		/*
			This does not preserve ES5 property attributes.  Neither does the delta coding
			or serialization code, however, so it's not really an issue for SugarCube.
		*/
		copy[name] = clone(orig[name]);
	});

	return copy;
}

/*
	Converts <br> elements to <p> elements within the given node tree.
*/
function convertBreaksToParagraphs(source) { // eslint-disable-line no-unused-vars
	var	output = document.createDocumentFragment(),
		para   = document.createElement("p"),
		node;
	while ((node = source.firstChild) !== null) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			var tagName = node.nodeName.toUpperCase();
			switch (tagName) {
			case "BR":
				if (
					   node.nextSibling !== null
					&& node.nextSibling.nodeType === Node.ELEMENT_NODE
					&& node.nextSibling.nodeName.toUpperCase() === "BR"
				) {
					source.removeChild(node.nextSibling);
					source.removeChild(node);
					output.appendChild(para);
					para = document.createElement("p");
					continue;
				} else if (!para.hasChildNodes()) {
					source.removeChild(node);
					continue;
				}
				break;
			case "ADDRESS":
			case "ARTICLE":
			case "ASIDE":
			case "BLOCKQUOTE":
			case "CENTER":
			case "DIV":
			case "DL":
			case "FIGURE":
			case "FOOTER":
			case "FORM":
			case "H1":
			case "H2":
			case "H3":
			case "H4":
			case "H5":
			case "H6":
			case "HEADER":
			case "HR":
			case "MAIN":
			case "NAV":
			case "OL":
			case "P":
			case "PRE":
			case "SECTION":
			case "TABLE":
			case "UL":
				if (para.hasChildNodes()) {
					output.appendChild(para);
					para = document.createElement("p");
				}
				output.appendChild(node);
				continue;
			}
		}
		para.appendChild(node);
	}
	if (para.hasChildNodes()) {
		output.appendChild(para);
	}
	source.appendChild(output);
}

/*
	Returns the new DOM element, optionally appending it to the passed DOM element, if any.
*/
function insertElement(place, type, id, classNames, text, title) {
	var el = document.createElement(type);

	// Add attributes/properties.
	if (id) {
		el.id = id;
	}
	if (classNames) {
		el.className = classNames;
	}
	if (title) {
		el.title = title;
	}

	// Add content.
	if (text) {
		insertText(el, text);
	}

	// Append it to the given node.
	if (place) {
		place.appendChild(el);
	}

	return el;
}

/*
	Returns the new DOM element, after appending it to the passed DOM element.
*/
function insertText(place, text) {
	return place.appendChild(document.createTextNode(text));
}

/*
	Returns the simple string representation of the passed value or, if there is none,
	the passed default value.
*/
function printableStringOrDefault(val, defVal) { // eslint-disable-line no-unused-vars
	switch (typeof val) {
	case "number":
		if (isNaN(val)) {
			return defVal;
		}
		break;
	case "object":
		if (val === null) {
			return defVal;
		} else if (Array.isArray(val) || val instanceof Set) {
			return Array.from(val).map(function (v) {
				return printableStringOrDefault(v, defVal);
			}).join(", ");
		} else if (val instanceof Map) {
			return Array.from(val).map(function (kv) {
				return "("
					+ printableStringOrDefault(kv[0], defVal)
					+ " \u21D2 "
					+ printableStringOrDefault(kv[1], defVal)
					+ ")";
			}).join(", ");
		} else if (val instanceof Date) {
			return val.toLocaleString();
		}
		return "[object]";
	case "function":
	case "undefined":
		return defVal;
	}
	return String(val);
}

/*
	Removes all children from the passed DOM node.
*/
function removeChildren(node) {
	if (node) {
		while (node.hasChildNodes()) {
			node.removeChild(node.firstChild);
		}
	}
}

/*
	Removes the passed DOM node.
*/
function removeElement(node) { // eslint-disable-line no-unused-vars
	if (typeof node.remove === "function") {
		node.remove();
	} else if (node.parentNode) {
		node.parentNode.removeChild(node);
	}
}

/*
	Returns `document.activeElement` or `null`.
*/
function safeActiveElement() { // eslint-disable-line no-unused-vars
	/*
		1. IE9 contains a bug where trying to access the active element of an iframe's
		   parent document (i.e. `window.parent.document.activeElement`) will throw an
		   exception, so we must allow for an exception to be thrown.

		2. We could simply return `undefined` here, but since the API's default behavior
		   should be to return `document.body` or `null` when there is no selection, we
		   choose to return `null` in all non-element cases (i.e. whether it returns
		   `null` or throws an exception).  Just a bit of normalization.
	*/
	try {
		return document.activeElement || null;
	} catch (e) {
		return null;
	}
}

/*
	Wikifies a passage into a DOM element corresponding to the passed ID and returns the element.
*/
function setPageElement(id, titles, defaultText) { // eslint-disable-line no-unused-vars
	var el = typeof id === "object" ? id : document.getElementById(id);
	if (el == null) { // lazy equality for null
		return null;
	}

	removeChildren(el);
	if (!Array.isArray(titles)) {
		titles = [ titles ];
	}
	for (var i = 0, iend = titles.length; i < iend; ++i) {
		if (Story.has(titles[i])) {
			new Wikifier(el, Story.get(titles[i]).processText().trim());
			return el;
		}
	}
	if (defaultText != null) { // lazy equality for null
		defaultText = defaultText.trim();
		if (defaultText !== "") {
			new Wikifier(el, defaultText);
		}
	}
	return el;
}

/*
	Appends an error message to the passed DOM element.
*/
function throwError(place, message, title) { // eslint-disable-line no-unused-vars
	insertElement(place, "span", null, "error", strings.errors.title + ": " + message, title);
	return false;
}

/*
	Fades a DOM element in or out

	n.b. Unused, included only for compatibility
*/
function fade(el, options) { // eslint-disable-line no-unused-vars
	/* eslint-disable no-use-before-define */
	function tick() {
		current += 0.05 * direction;
		setOpacity(proxy, Math.easeInOut(current));
		if (direction === 1 && current >= 1 || direction === -1 && current <= 0) {
			el.style.visibility = options.fade === "in" ? "visible" : "hidden";
			proxy.parentNode.replaceChild(el, proxy);
			proxy = null;
			window.clearInterval(intervalId);
			if (options.onComplete) {
				options.onComplete();
			}
		}
	}
	function setOpacity(el, opacity) { // eslint-disable-line no-shadow
		var l = Math.floor(opacity * 100);

		// Old IE.
		el.style.zoom = 1;
		el.style.filter = "alpha(opacity=" + l + ")";

		// CSS.
		el.style.opacity = opacity;
	}

	var	current,
		proxy      = el.cloneNode(true),
		direction  = options.fade === "in" ? 1 : -1,
		intervalId;
	el.parentNode.replaceChild(proxy, el);
	if (options.fade === "in") {
		current = 0;
		proxy.style.visibility = "visible";
	} else {
		current = 1;
	}
	setOpacity(proxy, current);
	intervalId = window.setInterval(tick, 25);
	/* eslint-enable no-use-before-define */
}

/*
	Scrolls the browser window to ensure that a DOM element is in view

	n.b. Unused, included only for compatibility
*/
function scrollWindowTo(el, increment) { // eslint-disable-line no-unused-vars
	/* eslint-disable no-use-before-define */
	function tick() {
		progress += increment;
		window.scroll(0, start + direction * (distance * Math.easeInOut(progress)));
		if (progress >= 1) {
			window.clearInterval(intervalId);
		}
	}
	function findPosY(el) { // eslint-disable-line no-shadow
		var curtop = 0;
		while (el.offsetParent) {
			curtop += el.offsetTop;
			el = el.offsetParent;
		}
		return curtop;
	}
	function ensureVisible(el) { // eslint-disable-line no-shadow
		var	posTop    = findPosY(el),
			posBottom = posTop + el.offsetHeight,
			winTop    = window.scrollY ? window.scrollY : document.body.scrollTop,
			winHeight = window.innerHeight ? window.innerHeight : document.body.clientHeight,
			winBottom = winTop + winHeight;
		if (posTop < winTop) {
			return posTop;
		} else {
			if (posBottom > winBottom) {
				if (el.offsetHeight < winHeight) {
					return posTop - (winHeight - el.offsetHeight) + 20;
				} else {
					return posTop;
				}
			} else {
				return posTop;
			}
		}
	}

	// Normalize increment.
	if (increment == null) { // lazy equality for null
		increment = 0.1;
	} else {
		if (typeof increment !== "number") {
			increment = Number(increment);
		}
		if (isNaN(increment) || increment < 0) {
			increment = 0.1;
		} else if (increment > 1) {
			increment = 1;
		}
	}

	var	start      = window.scrollY ? window.scrollY : document.body.scrollTop,
		end        = ensureVisible(el),
		distance   = Math.abs(start - end),
		progress   = 0,
		direction  = start > end ? -1 : 1,
		intervalId = window.setInterval(tick, 25);
	/* eslint-enable no-use-before-define */
}


/***********************************************************************************************************************
 * Util Object Static Methods
 **********************************************************************************************************************/
var Util = Object.defineProperties({}, {

	/*
		Returns whether the passed value is numeric.
	*/
	isNumeric : {
		value : function (obj) {
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
	},

	/*
		Returns whether the passed value is boolean-ish.
	*/
	isBoolean : {
		value : function (obj) {
			return typeof obj === "boolean" || typeof obj === "string" && (obj === "true" || obj === "false");
		}
	},

	/*
		Returns a lowercased and hyphen encoded version of the passed string.
	*/
	slugify : {
		value : function (str) {
			return String(str)
				.trim()
				.replace(/[^\w\s\u2013\u2014-]+/g, '')
				.replace(/[_\s\u2013\u2014-]+/g, '-')
				.toLocaleLowerCase();
		}
	},

	/*
		Returns an entity encoded version of the passed string.
	*/
	escape : {
		value : function (str) {
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
	},

	/*
		Returns a decoded version of the passed entity encoded string.
	*/
	unescape : {
		value : function (str) {
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
	},

	/*
		Returns the evaluation of the passed expression, throwing if there were errors.
	*/
	evalExpression : {
		value : function (expression) {
			"use strict";
			// The parens are to protect object literals from being confused with block statements.
			return eval("(" + expression + ")"); // eslint-disable-line no-eval
		}
	},

	/*
		Evaluates the passed statements, throwing if there were errors.
	*/
	evalStatements : {
		value : function (statements) {
			"use strict";
			// The enclosing anonymous function is to isolate the passed code within its own scope.
			eval("(function(){" + statements + "\n})();"); // eslint-disable-line no-eval
			return true;
		}
	},

	/*
		Diff operations enumeration.
	*/
	DiffOp : {
		value : Object.freeze({
			Delete      : 0,
			SpliceArray : 1,
			Copy        : 2,
			CopyDate    : 3
		})
	},

	/*
		Returns a patch object containing the differences between the original and the destination objects.
	*/
	diff : {
		value : function (orig, dest) /* diff object */ {
			"use strict";
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
								/* diff[p] = [ Util.DiffOp.Copy, destP ]; */
								if (origP.toString() !== destP.toString()) {
									diff[p] = [ Util.DiffOp.Copy, destP ];
								}
							} else if (typeof origP !== "object" || origP === null) {
								// Values are scalars or null.
								diff[p] = [ Util.DiffOp.Copy, destP ];
							} else {
								// Values are objects.
								var	origPType = objToString.call(origP),
									destPType = objToString.call(destP);
								if (origPType === destPType) {
									// Values are objects of the same prototype.
									if (origPType === "[object Date]") {
										// Special case: Date object.
										if (+origP !== +destP) {
											diff[p] = [ Util.DiffOp.CopyDate, +destP ];
										}
									} else if (origPType === "[object RegExp]") {
										// Special case: RegExp object.
										if (origP.toString() !== destP.toString()) {
											diff[p] = [ Util.DiffOp.Copy, clone(destP) ];
										}
									} else {
										var recurse = Util.diff(origP, destP);
										if (recurse !== null) {
											diff[p] = recurse;
										}
									}
								} else {
									// Values are objects of different prototypes.
									diff[p] = [ Util.DiffOp.Copy, clone(destP) ];
								}
							}
						} else {
							// Values are of different types.
							diff[p] = [
								Util.DiffOp.Copy,
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
								diff[aOpRef] = [ Util.DiffOp.SpliceArray, np, np ];
							}
							if (np < diff[aOpRef][1]) {
								diff[aOpRef][1] = np;
							}
							if (np > diff[aOpRef][2]) {
								diff[aOpRef][2] = np;
							}
						} else {
							diff[p] = Util.DiffOp.Delete;
						}
					}
				} else {
					// Key only exists in dest.
					diff[p] = [
						Util.DiffOp.Copy,
						typeof destP !== "object" || destP === null ? destP : clone(destP)
					];
				}
			}
			return Object.keys(diff).length !== 0 ? diff : null;
		}
	},

	/*
		Returns an object resulting from updating the original object with the difference object.
	*/
	patch : {
		value : function (orig, diff) /* patched object */ {
			"use strict";
			var	keys    = Object.keys(diff || {}),
				patched = clone(orig);
			for (var i = 0, klen = keys.length; i < klen; ++i) {
				var	p     = keys[i],
					diffP = diff[p];
				if (diffP === Util.DiffOp.Delete) {
					delete patched[p];
				} else if (Array.isArray(diffP)) {
					switch (diffP[0]) {
					case Util.DiffOp.SpliceArray:
						patched.splice(diffP[1], 1 + (diffP[2] - diffP[1]));
						break;
					case Util.DiffOp.Copy:
						patched[p] = clone(diffP[1]);
						break;
					case Util.DiffOp.CopyDate:
						patched[p] = new Date(diffP[1]);
						break;
					}
				} else {
					patched[p] = Util.patch(patched[p], diffP);
				}
			}
			return patched;
		}
	},

	/*
		Returns the number of miliseconds represented by the passed CSS time string.
	*/
	fromCSSTime : {
		value : function (cssTime) {
			"use strict";
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
	},

	/*
		Returns the CSS time string represented by the passed number of milliseconds.
	*/
	toCSSTime : {
		value : function (msec) {
			"use strict";
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
	}

});

// Setup aliases
Object.defineProperties(Util, {

	/*
		[DEPRECATED] Backup Math.random, in case it's replaced later.
	*/
	random : {
		value : Math.random
	},

	/*
		[DEPRECATED] Alias of `Util.escape`.
	*/
	entityEncode : {
		value : Util.escape
	},

	/*
		[DEPRECATED] Alias of `Util.unescape`.
	*/
	entityDecode : {
		value : Util.unescape
	}

});


/***********************************************************************************************************************
 * Seedable PRNG (wrapper for seedrandom.js)
 **********************************************************************************************************************/
// Setup the SeedablePRNG constructor
function SeedablePRNG(seed, useEntropy) {
	/* eslint-disable no-shadow, new-cap */
	Object.defineProperties(this, new Math.seedrandom(seed, useEntropy, function (prng, seed) {
		return {
			_prng : {
				value : prng
			},
			seed : {
				/*
					TODO: Make this non-writable.
				*/
				writable : true,
				value    : seed
			},
			pull : {
				writable : true,
				value    : 0
			},
			random : {
				value : function () {
					++this.pull;
					return this._prng();
				}
			}
		};
	}));
	/* eslint-enable no-shadow, new-cap */
}

// Setup the SeedablePRNG static methods
Object.defineProperties(SeedablePRNG, {
	marshal : {
		value : function (prng) {
			if (!prng || !prng.hasOwnProperty("seed") || !prng.hasOwnProperty("pull")) {
				throw new Error("PRNG is missing required data");
			}

			return {
				seed : prng.seed,
				pull : prng.pull
			};
		}
	},

	unmarshal : {
		value : function (prngObj) {
			if (!prngObj || !prngObj.hasOwnProperty("seed") || !prngObj.hasOwnProperty("pull")) {
				throw new Error("PRNG object is missing required data");
			}

			/*
				Create a new PRNG using the original seed and pull values until it has
				reached the original pull count.
			*/
			var prng = new SeedablePRNG(prngObj.seed, false);
			for (var i = prngObj.pull; i > 0; --i) {
				prng.random();
			}

			return prng;
		}
	}
});


/***********************************************************************************************************************
 * StyleWrapper
 **********************************************************************************************************************/
// Setup the StyleWrapper constructor
function StyleWrapper(style) {
	/*
	if (style == null || !(style instanceof HTMLStyleElement)) { // lazy equality for null
	*/
	if (style == null) { // lazy equality for null
		throw new TypeError("StyleWrapper style parameter must be an HTMLStyleElement object");
	}
	Object.defineProperties(this, {
		style : {
			value : style
		}
	});
}

// Setup the StyleWrapper prototype
Object.defineProperties(StyleWrapper.prototype, {
	isEmpty : {
		value : function () {
			/*
			return this.style.styleSheet
				? this.style.styleSheet.cssText === "" // for IE ≤ 10
				: this.style.hasChildNodes();          // for all other browsers (incl. IE ≥ 11)
			*/
			return this.style.cssRules.length === 0; // should work in all browsers (I think…)
		}
	},
	set : {
		value : function (css) {
			this.clear();
			this.add(css);
		}
	},
	add : {
		value : function (css) {
			if (this.style.styleSheet) { // for IE ≤ 10
				this.style.styleSheet.cssText += css;
			} else { // for all other browsers (incl. IE ≥ 11)
				this.style.appendChild(document.createTextNode(css));
			}
		}
	},
	clear : {
		value : function () {
			if (this.style.styleSheet) { // for IE ≤ 10
				this.style.styleSheet.cssText = "";
			} else { // for all other browsers (incl. IE ≥ 11)
				removeChildren(this.style);
			}
		}
	}
});


/***********************************************************************************************************************
 * AudioWrapper
 **********************************************************************************************************************/
// Setup the AudioWrapper constructor
function AudioWrapper(audio) {
	Object.defineProperties(this, {
		audio : {
			value : audio
		},
		_faderId : {
			writable : true,
			value    : null
		}
	});
	if (this.audio.preload !== "metadata" && this.audio.preload !== "auto") {
		this.audio.preload = "metadata";
	}
}

/*
	Setup the AudioWrapper prototype

	n.b. The various data constants (e.g. for comparison to `readyState` or `networkState`)
	     are not defined by all browsers on the descendant elements `HTMLAudioElement` and
	     `HTMLVideoElement` (notably, IE/Edge do not).  Therefore, the base media element,
	     `HTMLMediaElement`, must be used to reference the constants.
*/
Object.defineProperties(AudioWrapper.prototype, {
	/*
		Getters/Setters
	*/
	duration : {
		get : function () {
			return this.audio.duration;
		}
	},
	time : {
		get : function () {
			return this.audio.currentTime;
		},
		set : function (time) {
			/*
				If we try to modify the audio clip's `.currentTime` property before its metadata
				has been loaded, it will throw an `InvalidStateError` (since it doesn't know its
				duration, allowing `.currentTime` to be set would be undefined behavior), so we
				must check its readiness first.
			*/
			if (this.hasMetadata()) {
				this.audio.currentTime = time;
			} else {
				jQuery(this.audio)
					.off("loadedmetadata.AudioWrapper:time")
					.one("loadedmetadata.AudioWrapper:time", function () {
						this.currentTime = time;
					});
			}
		}
	},
	volume : {
		get : function () {
			return this.audio.volume;
		},
		set : function (vol) {
			this.audio.volume = Math.clamp(vol, 0, 1);
		}
	},
	controls : {
		get : function () {
			return this.audio.controls;
		},
		set : function (state) {
			this.audio.controls = !!state;
		}
	},

	/*
		Methods
	*/
	hasMetadata : {
		value : function () {
			return this.audio.readyState >= HTMLMediaElement.HAVE_METADATA;
		}
	},
	hasData : {
		value : function () {
			return this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
		}
	},
	noSource : {
		value : function () {
			return this.audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
		}
	},
	isPlaying : {
		value : function () {
			return !(this.audio.ended || this.audio.paused || !this.hasData());
		}
	},
	isEnded : {
		value : function () {
			return this.audio.ended;
		}
	},
	isPaused : {
		value : function () {
			return this.audio.paused;
		}
	},
	isMuted : {
		value : function () {
			return this.audio.muted;
		}
	},
	isLooped : {
		value : function () {
			return this.audio.loop;
		}
	},

	load : {
		value : function () {
			if (this.audio.preload !== "auto") {
				this.audio.preload = "auto";
			}
			this.audio.load();
		}
	},
	play : {
		value : function () {
			if (!this.hasData()) {
				this.load();
			}
			this.audio.play();
		}
	},
	pause : {
		value : function () {
			this.audio.pause();
		}
	},
	stop : {
		value : function () {
			this.audio.pause();
			this.time = 0;
		}
	},

	mute : {
		value : function () {
			this.audio.muted = true;
		}
	},
	unmute : {
		value : function () {
			this.audio.muted = false;
		}
	},
	loop : {
		value : function () {
			this.audio.loop = true;
		}
	},
	unloop : {
		value : function () {
			this.audio.loop = false;
		}
	},

	fadeWithDuration : {
		value : function (duration, from, to) {
			if (this._faderId !== null) {
				clearInterval(this._faderId);
				this._faderId = null;
			}
			from = Math.clamp(from, 0, 1);
			to   = Math.clamp(to, 0, 1);
			if (from === to) {
				return;
			}
			this.volume = from;

			/*
				We listen for the `timeupdate` event here, rather than `playing`, because
				various browsers (notably, mobile browsers) are poor at firing media events
				in a timely fashion, so we use `timeupdate` to ensure that we don't start
				the fade until the track is actually progressing.
			*/
			jQuery(this.audio)
				.off("timeupdate.AudioWrapper:fadeWithDuration")
				.one("timeupdate.AudioWrapper:fadeWithDuration", (function (self) {
					return function () {
						var min, max;
						if (from < to) {
							// Fade in.
							min = from;
							max = to;
						} else {
							// Fade out.
							min = to;
							max = from;
						}
						duration = Math.clamp(duration, 1, self.duration || 5);
						var	interval = 25, // in milliseconds
							delta    = (to - from) / (duration / (interval / 1000));
						self._faderId = setInterval(function () {
							if (!self.isPlaying()) {
								clearInterval(self._faderId);
								self._faderId = null;
								return;
							}
							self.volume = Math.clamp(self.volume + delta, min, max);
							if (self.volume === 0) {
								self.pause();
							}
							if (self.volume === to) {
								clearInterval(self._faderId);
								self._faderId = null;
							}
						}, interval);
					};
				})(this));

			this.play();
		}
	},
	fade : {
		value : function (from, to) {
			this.fadeWithDuration(5, from, to);
		}
	},
	fadeIn : {
		value : function () {
			this.fade(this.volume, 1);
		}
	},
	fadeOut : {
		value : function () {
			this.fade(this.volume, 0);
		}
	},

	onPlay : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).on("playing.AudioWrapper:onPlay", callback);
			} else {
				jQuery(this.audio).off("playing.AudioWrapper:onPlay");
			}
		}
	},
	onePlay : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).one("playing.AudioWrapper:onePlay", callback);
			} else {
				jQuery(this.audio).off("playing.AudioWrapper:onePlay");
			}
		}
	},

	onPause : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).on("pause.AudioWrapper:onPause", callback);
			} else {
				jQuery(this.audio).off("pause.AudioWrapper:onPause");
			}
		}
	},
	onePause : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).one("pause.AudioWrapper:onePause", callback);
			} else {
				jQuery(this.audio).off("pause.AudioWrapper:onePause");
			}
		}
	},

	onEnd : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).on("ended.AudioWrapper:onEnd", callback);
			} else {
				jQuery(this.audio).off("ended.AudioWrapper:onEnd");
			}
		}
	},
	oneEnd : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).one("ended.AudioWrapper:oneEnd", callback);
			} else {
				jQuery(this.audio).off("ended.AudioWrapper:oneEnd");
			}
		}
	},

	clone : {
		value : function () {
			return new AudioWrapper(this.audio.cloneNode(true));
		}
	}
});

