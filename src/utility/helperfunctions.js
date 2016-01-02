/***********************************************************************************************************************
 *
 * utility/helperfunctions.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Story, StyleWrapper, Wikifier, strings */

/***********************************************************************************************************************
 * Object Manipulation Functions
 **********************************************************************************************************************/
/*
 	Returns a deep copy of the passed object

	n.b. 1. `clone()` does not clone functions, however, since function definitions are immutable,
	        the only issues are with expando properties and scope.  The former really should not
	        be done.  The latter is problematic either way (damned if you do, damned if you don't).
	     2. `clone()` does not maintain referential relationships (e.g. multiple references to the
	        same object will, post-cloning, refer to different equivalent objects; i.e. each
	        reference will get its own clone of the original object).
*/
function clone(orig) { // eslint-disable-line no-unused-vars
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


/***********************************************************************************************************************
 * Miscellaneous Functions
 **********************************************************************************************************************/
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
				return printableStringOrDefault(kv[0], defVal)
					+ " \u21D2 "
					+ printableStringOrDefault(kv[1], defVal);
			}).join("; ");
		} else if (val instanceof Date) {
			return val.toLocaleString();
		} else if (typeof val.toString === "function" && val.toString !== Object.prototype.toString) {
			return val.toString();
		}
		return "[object]";
	case "function":
	case "undefined":
		return defVal;
	}
	return String(val);
}


/***********************************************************************************************************************
 * DOM Manipulation Functions
 **********************************************************************************************************************/
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

	// Add text content.
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


/***********************************************************************************************************************
 * Legacy Functions
 **********************************************************************************************************************/
/*
	[DEPRECATED] Returns the jQuery-wrapped target element(s) after making them accessible clickables (ARIA compatibility).

	n.b. Unused, included only for compatibility.
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
	Fades a DOM element in or out.

	n.b. Unused, included only for compatibility.
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
	Scrolls the browser window to ensure that a DOM element is in view.

	n.b. Unused, included only for compatibility.
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

