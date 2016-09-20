/***********************************************************************************************************************
 *
 * lib/helpers.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global L10n, Story, StyleWrapper, Wikifier */

var { // eslint-disable-line no-var
	/* eslint-disable no-unused-vars */
	addStyle,
	clone,
	convertBreaks,
	setPageElement,
	throwError,
	toStringOrDefault
	/* eslint-enable no-unused-vars */
} = (() => {
	'use strict';

	/*
		Adds the given styles to the story's <style> element, creating it if necessary.
	*/
	function addStyle(css) {
		let style = document.getElementById('style-story');

		if (style === null) {
			style      = document.createElement('style');
			style.id   = 'style-story';
			style.type = 'text/css';
			document.head.appendChild(style);
		}

		style = new StyleWrapper(style);
		style.add(css);
	}

	/*
		Returns a deep copy of the given object.

		NOTE: 1. `clone()` does not clone functions, however, since function definitions are
		         immutable, the only issues are with expando properties and scope.  The former
		         really should not be done.  The latter is problematic either way (damned if
		         you do, damned if you don't).
		      2. `clone()` does not maintain referential relationships (e.g. multiple references
		         to the same object will, post-cloning, refer to different equivalent objects;
		         i.e. each reference will get its own clone of the original object).
	*/
	function clone(orig) {
		/*
			Immediately return non-objects.
		*/
		if (typeof orig !== 'object' || orig == null) { // lazy equality for null
			return orig;
		}

		/*
			Honor native clone methods.
		*/
		if (typeof orig.clone === 'function') {
			return orig.clone(true);
		}
		else if (orig.nodeType && typeof orig.cloneNode === 'function') {
			return orig.cloneNode(true);
		}

		/*
			Create a copy of the original object.

			NOTE: 1. Each non-generic object that we wish to support must receive a special
			         case below.
			      2. Since we're using the `instanceof` operator to identify special cases,
			         this may fail to properly identify such cases if the author engages in
			         cross-<iframe> object manipulation.  The solution to this problem would
			         be for the author to pass messages between the frames, rather than doing
			         direct cross-frame object manipulation.  That is, in fact, what they should
			         be doing in the first place.
			      3. We cannot use `Object.prototype.toString.call(orig)` to solve #2 because
			         the shims for `Map` and `Set` return `[object Object]` rather than
			         `[object Map]` and `[object Set]`.
		*/
		let copy;

		if (Array.isArray(orig)) { // considering #2, `orig instanceof Array` might be more appropriate
			copy = [];
		}
		else if (orig instanceof Date) {
			copy = new Date(orig.getTime());
		}
		else if (orig instanceof Map) {
			copy = new Map();
			orig.forEach((val, key) => { copy.set(key, clone(val)); });
		}
		else if (orig instanceof RegExp) {
			copy = new RegExp(orig);
		}
		else if (orig instanceof Set) {
			copy = new Set();
			orig.forEach(val => { copy.add(clone(val)); });
		}
		else { // unknown or generic object
			// Try to ensure that the returned object has the same prototype as the original.
			copy = Object.create(Object.getPrototypeOf(orig));
		}

		/*
			Duplicate the original object's own enumerable properties, which will include expando
			properties on non-generic objects.

			NOTE: This does not preserve ES5 property attributes.  Neither does the delta coding
			      or serialization code, however, so it's not really an issue at the moment.
		*/
		Object.keys(orig).forEach(name => copy[name] = clone(orig[name]));

		return copy;
	}

	/*
		Converts <br> elements to <p> elements within the given node tree.
	*/
	function convertBreaks(source) {
		const
			output = document.createDocumentFragment();
		let
			para = document.createElement('p'),
			node;

		while ((node = source.firstChild) !== null) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const tagName = node.nodeName.toUpperCase();

				switch (tagName) {
				case 'BR':
					if (
						   node.nextSibling !== null
						&& node.nextSibling.nodeType === Node.ELEMENT_NODE
						&& node.nextSibling.nodeName.toUpperCase() === 'BR'
					) {
						source.removeChild(node.nextSibling);
						source.removeChild(node);
						output.appendChild(para);
						para = document.createElement('p');
						continue;
					}
					else if (!para.hasChildNodes()) {
						source.removeChild(node);
						continue;
					}
					break;

				case 'ADDRESS':
				case 'ARTICLE':
				case 'ASIDE':
				case 'BLOCKQUOTE':
				case 'CENTER':
				case 'DIV':
				case 'DL':
				case 'FIGURE':
				case 'FOOTER':
				case 'FORM':
				case 'H1':
				case 'H2':
				case 'H3':
				case 'H4':
				case 'H5':
				case 'H6':
				case 'HEADER':
				case 'HR':
				case 'MAIN':
				case 'NAV':
				case 'OL':
				case 'P':
				case 'PRE':
				case 'SECTION':
				case 'TABLE':
				case 'UL':
					if (para.hasChildNodes()) {
						output.appendChild(para);
						para = document.createElement('p');
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
		Wikifies a passage into a DOM element corresponding to the passed ID and returns the element.
	*/
	function setPageElement(idOrElement, titles, defaultText) {
		const el = typeof idOrElement === 'object'
			? idOrElement
			: document.getElementById(idOrElement);

		if (el == null) { // lazy equality for null
			return null;
		}

		const ids = Array.isArray(titles) ? titles : [titles];

		jQuery(el).empty();

		for (let i = 0, iend = ids.length; i < iend; ++i) {
			if (Story.has(ids[i])) {
				new Wikifier(el, Story.get(ids[i]).processText().trim());
				return el;
			}
		}

		if (defaultText != null) { // lazy equality for null
			const text = String(defaultText).trim();

			if (text !== '') {
				new Wikifier(el, text);
			}
		}

		return el;
	}

	/*
		Appends an error message to the passed DOM element.
	*/
	function throwError(place, message, title) {
		jQuery(document.createElement('span'))
			.addClass('error')
			.attr('title', title)
			.text(`${L10n.get('errorTitle')}: ${message || 'unknown error'}`)
			.appendTo(place);
		return false;
	}

	/*
		Returns the simple string representation of the passed value or, if there is none,
		the passed default value.
	*/
	function toStringOrDefault(value, defValue) {
		switch (typeof value) {
		case 'number':
			if (Number.isNaN(value)) {
				return defValue;
			}
			break;

		case 'object':
			if (value === null) {
				return defValue;
			}
			else if (Array.isArray(value) || value instanceof Set) {
				return [...value].map(val => toStringOrDefault(val, defValue)).join(', ');
			}
			else if (value instanceof Map) {
				const
					tSOD = toStringOrDefault,
					str  = [...value]
						.map(kv => `${tSOD(kv[0], defValue)} \u21D2 ${tSOD(kv[1], defValue)}`)
						.join('; ');
				return `(\u202F${str}\u202F)`;
			}
			else if (value instanceof Date) {
				return value.toLocaleString();
			}
			else if (typeof value.toString === 'function') {
				return value.toString();
			}

			return Object.prototype.toString.call(value);

		case 'function':
		case 'undefined':
			return defValue;
		}

		return String(value);
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		addStyle          : { value : addStyle },
		clone             : { value : clone },
		convertBreaks     : { value : convertBreaks },
		setPageElement    : { value : setPageElement },
		throwError        : { value : throwError },
		toStringOrDefault : { value : toStringOrDefault }
	}));
})();
