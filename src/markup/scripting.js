/***********************************************************************************************************************
 *
 * markup/scripting.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Engine, Patterns, State, Story */

var Scripting = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/* eslint-disable no-unused-vars */

	/*******************************************************************************************************************
	 * Deprecated Legacy Functions.
	 ******************************************************************************************************************/
	/*
		[DEPRECATED] Returns the jQuery-wrapped target element(s) after making them accessible
		clickables (ARIA compatibility).

		NOTE: Unused, included only for compatibility.
	*/
	function addAccessibleClickHandler(targets, selector, handler, one, namespace) {
		if (arguments.length < 2) {
			throw new Error('addAccessibleClickHandler insufficient number of parameters');
		}

		let fn, opts;

		if (typeof selector === 'function') {
			fn = selector;
			opts = {
				namespace : one,
				one       : !!handler
			};
		}
		else {
			fn = handler;
			opts = {
				namespace,
				one : !!one,
				selector
			};
		}

		if (typeof fn !== 'function') {
			throw new TypeError('addAccessibleClickHandler handler parameter must be a function');
		}

		return jQuery(targets).ariaClick(opts, fn);
	}

	/*
		[DEPRECATED] Returns a new DOM element, optionally appending it to the passed DOM element, if any.

		NOTE: Unused, included only for compatibility.
	*/
	function insertElement(place, type, id, classNames, text, title) { // eslint-disable-line max-params
		const $el = jQuery(document.createElement(type));

		// Add attributes/properties.
		if (id) {
			$el.attr('id', id);
		}

		if (classNames) {
			$el.addClass(classNames);
		}

		if (title) {
			$el.attr('title', title);
		}

		// Add text content.
		if (text) {
			$el.text(text);
		}

		// Append it to the given node.
		if (place) {
			$el.appendTo(place);
		}

		return $el[0];
	}

	/*
		[DEPRECATED] Creates a new text node and appends it to the passed DOM element.

		NOTE: Unused, included only for compatibility.
	*/
	function insertText(place, text) {
		jQuery(place).append(document.createTextNode(text));
	}

	/*
		[DEPRECATED] Removes all children from the passed DOM node.

		NOTE: Unused, included only for compatibility.
	*/
	function removeChildren(node) {
		jQuery(node).empty();
	}

	/*
		[DEPRECATED] Removes the passed DOM node.

		NOTE: Unused, included only for compatibility.
	*/
	function removeElement(node) {
		jQuery(node).remove();
	}

	/*
		[DEPRECATED] Fades a DOM element in or out.

		NOTE: Unused, included only for compatibility.
	*/
	function fade(el, options) {
		/* eslint-disable no-param-reassign */
		const
			direction = options.fade === 'in' ? 1 : -1;
		let
			current,
			proxy      = el.cloneNode(true),
			intervalId; // eslint-disable-line prefer-const

		function tick() {
			current += 0.05 * direction;
			setOpacity(proxy, Math.easeInOut(current));

			if (direction === 1 && current >= 1 || direction === -1 && current <= 0) {
				el.style.visibility = options.fade === 'in' ? 'visible' : 'hidden';
				proxy.parentNode.replaceChild(el, proxy);
				proxy = null;
				window.clearInterval(intervalId);

				if (options.onComplete) {
					options.onComplete();
				}
			}
		}

		function setOpacity(el, opacity) {
			// Old IE.
			el.style.zoom = 1;
			el.style.filter = `alpha(opacity=${Math.floor(opacity * 100)})`;

			// CSS.
			el.style.opacity = opacity;
		}

		el.parentNode.replaceChild(proxy, el);

		if (options.fade === 'in') {
			current = 0;
			proxy.style.visibility = 'visible';
		}
		else {
			current = 1;
		}

		setOpacity(proxy, current);
		intervalId = window.setInterval(tick, 25);
		/* eslint-enable no-param-reassign */
	}

	/*
		[DEPRECATED] Scrolls the browser window to ensure that a DOM element is in view.

		NOTE: Unused, included only for compatibility.
	*/
	function scrollWindowTo(el, incrementBy) {
		/* eslint-disable no-param-reassign */
		let increment = incrementBy != null ? Number(incrementBy) : 0.1; // lazy equality for null

		if (Number.isNaN(increment) || !Number.isFinite(increment) || increment < 0) {
			increment = 0.1;
		}
		else if (increment > 1) {
			increment = 1;
		}

		const
			start     = window.scrollY ? window.scrollY : document.body.scrollTop,
			end       = ensureVisible(el),
			distance  = Math.abs(start - end),
			direction = start > end ? -1 : 1;
		let
			progress   = 0,
			intervalId; // eslint-disable-line prefer-const

		function tick() {
			progress += increment;
			window.scroll(0, start + direction * (distance * Math.easeInOut(progress)));

			if (progress >= 1) {
				window.clearInterval(intervalId);
			}
		}

		function findPosY(el) { // eslint-disable-line no-shadow
			let curtop = 0;

			while (el.offsetParent) {
				curtop += el.offsetTop;
				el = el.offsetParent;
			}

			return curtop;
		}

		function ensureVisible(el) { // eslint-disable-line no-shadow
			const
				posTop    = findPosY(el),
				posBottom = posTop + el.offsetHeight,
				winTop    = window.scrollY ? window.scrollY : document.body.scrollTop,
				winHeight = window.innerHeight ? window.innerHeight : document.body.clientHeight,
				winBottom = winTop + winHeight;

			if (posTop < winTop) {
				return posTop;
			}
			else {
				if (posBottom > winBottom) {
					if (el.offsetHeight < winHeight) {
						return posTop - (winHeight - el.offsetHeight) + 20;
					}
					else {
						return posTop;
					}
				}
				else {
					return posTop;
				}
			}
		}

		intervalId = window.setInterval(tick, 25);
		/* eslint-enable no-param-reassign */
	}


	/*******************************************************************************************************************
	 * User Functions.
	 ******************************************************************************************************************/
	/**
		Returns a random value from its given arguments.
	**/
	function either(/* variadic */) {
		if (arguments.length === 0) {
			return;
		}

		return Array.prototype.concat.apply([], arguments).random();
	}

	/**
		Returns whether a passage with the given title exists within the story
		history.  If multiple passage titles are given, returns the logical-AND
		aggregate of the set.
	**/
	function hasVisited(/* variadic */) {
		if (arguments.length === 0) {
			throw new Error('hasVisited called with insufficient parameters');
		}
		if (State.isEmpty()) {
			return false;
		}

		const
			needles = Array.prototype.concat.apply([], arguments),
			played  = State.passages;

		for (let i = 0, iend = needles.length; i < iend; ++i) {
			if (!played.includes(needles[i])) {
				return false;
			}
		}

		return true;
	}

	/**
		Returns the number of turns that have passed since the last instance of the given passage
		occurred within the story history or `-1` if it does not exist.  If multiple passages are
		given, returns the lowest count (which can be `-1`).
	**/
	function lastVisited(/* variadic */) {
		if (arguments.length === 0) {
			throw new Error('lastVisited called with insufficient parameters');
		}
		if (State.isEmpty()) {
			return -1;
		}

		const
			needles = Array.prototype.concat.apply([], arguments),
			played  = State.passages,
			uBound  = played.length - 1;
		let
			turns = State.turns;

		for (let i = 0, iend = needles.length; i < iend && turns > -1; ++i) {
			const lastIndex = played.lastIndexOf(needles[i]);
			turns = Math.min(turns, lastIndex === -1 ? -1 : uBound - lastIndex);
		}

		return turns;
	}

	/**
		Returns the title of the current passage.
	**/
	function passage() {
		return State.passage;
	}

	/**
		Returns the title of a previous passage, either the most recent one whose title does not
		match that of the active passage or the one at the optional offset, or an empty string,
		if there is no such passage.
	**/
	function previous(/* legacy: offset */) {
		const passages = State.passages;

		/* legacy: behavior with an offset */
		if (arguments.length > 0) {
			const offset = Number(arguments[0]);

			if (!Number.isSafeInteger(offset) || offset < 1) {
				throw new RangeError('previous offset parameter must be a positive integer greater than zero');
			}

			return passages.length > offset ? passages[passages.length - 1 - offset] : '';
		}
		/* /legacy */

		for (let i = passages.length - 2; i >= 0; --i) {
			if (passages[i] !== State.passage) {
				return passages[i];
			}
		}

		return '';
	}

	/**
		Returns a pseudo-random whole number (integer) within the range of the given bounds.
	**/
	function random(/* variadic(min:inclusive, max:inclusive) */) {
		if (arguments.length === 0) {
			throw new Error('random called with insufficient parameters');
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

		return Math.floor(State.random() * (max - min + 1)) + min;
	}

	/**
		Returns a pseudo-random real number (floating-point) within the range of the given bounds.

		NOTE: Unlike with its sibling function `random()`, the `max` parameter is exclusive,
		      not inclusive (i.e. the range goes to, but does not include, the given value).
	**/
	function randomFloat(/* variadic(min:inclusive, max:exclusive) */) {
		if (arguments.length === 0) {
			throw new Error('randomFloat called with insufficient parameters');
		}

		let min, max;

		if (arguments.length === 1) {
			min = 0.0;
			max = arguments[0];
		}
		else {
			min = arguments[0];
			max = arguments[1];
		}

		if (min > max) {
			[min, max] = [max, min];
		}

		return State.random() * (max - min) + min;
	}

	/**
		Returns a new array consisting of all of the tags of the given passages.
	**/
	function tags(/* variadic */) {
		if (arguments.length === 0) {
			return Story.get(State.passage).tags.slice(0);
		}

		const passages = Array.prototype.concat.apply([], arguments);
		let tags = [];

		for (let i = 0, iend = passages.length; i < iend; ++i) {
			tags = tags.concat(Story.get(passages[i]).tags);
		}

		return tags;
	}

	/**
		Returns the number of milliseconds which have passed since the current passage was rendered.
	**/
	function time() {
		return Engine.lastPlay === null ? 0 : Date.now() - Engine.lastPlay;
	}

	/**
		Returns the number of passages that the player has visited.

		NOTE: Passages which were visited but have been undone (e.g. via the Backward button
		      or the `<<back>>` macro) are no longer part of the in-play story history and
		      thus are not tallied.  Passages which were visited but have expired from the
		      story history, on the other hand, are tallied.
	**/
	function turns() {
		return State.turns;
	}

	/**
		Returns a reference to the current $variables store.
	**/
	function variables() {
		return State.variables;
	}

	/**
		Returns the number of times that the passage with the given title exists within the story
		history.  If multiple passage titles are given, returns the lowest count.
	**/
	function visited(/* variadic */) {
		if (State.isEmpty()) {
			return 0;
		}

		const
			needles = Array.prototype.concat.apply([], arguments.length === 0 ? [State.passage] : arguments),
			played  = State.passages;
		let
			count = State.turns;

		for (let i = 0, iend = needles.length; i < iend && count > 0; ++i) {
			count = Math.min(count, played.count(needles[i]));
		}

		return count;
	}

	/**
		Returns the number of passages within the story history which are tagged with all of the given tags.
	**/
	function visitedTags(/* variadic */) {
		if (arguments.length === 0) {
			throw new Error('visitedTags called with insufficient parameters');
		}
		if (State.isEmpty()) {
			return 0;
		}

		const
			needles = Array.prototype.concat.apply([], arguments),
			nLength = needles.length,
			played  = State.passages,
			seen    = new Map();
		let
			count = 0;

		for (let i = 0, iend = played.length; i < iend; ++i) {
			const title = played[i];

			if (seen.has(title)) {
				if (seen.get(title)) {
					++count;
				}
			}
			else {
				const tags = Story.get(title).tags;

				if (tags.length > 0) {
					let found = 0;

					for (let j = 0; j < nLength; ++j) {
						if (tags.includes(needles[j])) {
							++found;
						}
					}

					if (found === nLength) {
						++count;
						seen.set(title, true);
					}
					else {
						seen.set(title, false);
					}
				}
			}
		}

		return count;
	}

	/* eslint-enable no-unused-vars */


	/*******************************************************************************************************************
	 * Parsing Functions.
	 ******************************************************************************************************************/
	/*
		Returns the given string after converting all TwineScript syntactical sugars to
		their native JavaScript counterparts.
	*/
	const parse = (() => {
		const
			parseMap = Object.freeze({
				/* eslint-disable quote-props */
				// Story $variable sigil-prefix.
				'$'     : 'State.variables.',
				// Temporary _variable sigil-prefix.
				'_'     : 'TempVariables.',
				// Assignment operators.
				'to'    : '=',
				// Equality operators.
				'eq'    : '==',
				'neq'   : '!=',
				'is'    : '===',
				'isnot' : '!==',
				// Relational operators.
				'gt'    : '>',
				'gte'   : '>=',
				'lt'    : '<',
				'lte'   : '<=',
				// Logical operators.
				'and'   : '&&',
				'or'    : '||',
				// Unary operators.
				'not'   : '!',
				'def'   : '"undefined" !== typeof',
				'ndef'  : '"undefined" === typeof'
				/* eslint-enable quote-props */
			}),
			parseRe  = new RegExp([
				'(""|\'\')',                                          // 1=Empty quotes
				'("(?:\\\\.|[^"\\\\])+")',                            // 2=Double quoted, non-empty
				"('(?:\\\\.|[^'\\\\])+')",                            // 3=Single quoted, non-empty
				'([=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}]+)',       // 4=Operator delimiters
				'([^"\'=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}\\s]+)' // 5=Barewords
			].join('|'), 'g'),
			varTest  = new RegExp(`^${Patterns.variable}`);

		function parse(rawCodeString) {
			if (parseRe.lastIndex !== 0) {
				throw new RangeError('Scripting.parse last index is non-zero at start');
			}

			let
				code  = rawCodeString,
				match;

			while ((match = parseRe.exec(code)) !== null) {
				// no-op: Empty quotes | Double quoted | Single quoted | Operator delimiters

				/*
					Barewords.
				*/
				if (match[5]) {
					let token = match[5];

					/*
						If the token is simply a dollar-sign or underscore, then it's either
						just the raw character or, probably, a function alias, so skip it.
					*/
					if (token === '$' || token === '_') {
						continue;
					}

					/*
						If the token is a story $variable or temporary _variable, reset it
						to just its sigil—for later mapping.
					*/
					else if (varTest.test(token)) {
						token = token[0];
					}

					/*
						If the token is `is`, check to see if it's followed by `not`, if so,
						convert them into the `isnot` operator.

						NOTE: This is a safety feature, since `$a is not $b` probably sounds
						      reasonable to most users.
					*/
					else if (token === 'is') {
						const
							start = parseRe.lastIndex,
							part  = code.slice(start);

						if (/^\s+not\b/.test(part)) {
							code = code.splice(start, part.search(/\S/));
							token = 'isnot';
						}
					}

					/*
						If the finalized token has a mapping, replace it within the code string
						with its counterpart.

						NOTE: We must use `parseMap.hasOwnProperty(token)` here, rather than simply
						      using something like `parseMap[token]`, otherwise tokens which match
						      properties from the prototype chain will cause shenanigans.
					*/
					if (parseMap.hasOwnProperty(token)) {
						code = code.splice(
							match.index,    // starting index
							token.length,   // replace how many
							parseMap[token] // replacement string
						);
						parseRe.lastIndex += parseMap[token].length - token.length;
					}
				}
			}

			return code;
		}

		return parse;
	})();


	/*******************************************************************************************************************
	 * Eval Functions.
	 ******************************************************************************************************************/
	/* eslint-disable no-eval, no-extra-parens, no-unused-vars */
	/*
		Evaluates the given JavaScript code and returns the result, throwing if there were errors.
	*/
	function evalJavaScript(code, output) {
		return (function (code, output) {
			return eval(code);
		}).call(output ? { output } : null, String(code), output);
	}

	/*
		Evaluates the given TwineScript code and returns the result, throwing if there were errors.
	*/
	function evalTwineScript(code, output) {
		return (function (code, output) {
			return eval(code);
		}).call(output ? { output } : null, parse(String(code)), output);
	}
	/* eslint-enable no-eval, no-extra-parens, no-unused-vars */


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		parse           : { value : parse },
		evalJavaScript  : { value : evalJavaScript },
		evalTwineScript : { value : evalTwineScript }
	}));
})();
