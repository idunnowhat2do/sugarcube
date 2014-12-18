/***********************************************************************************************************************
 *
 * userlib.js
 *
 * Copyright © 2013–2014 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

/***********************************************************************************************************************
 * User Utility Functions
 **********************************************************************************************************************/
/**
 * Returns an integer count of how many turns have passed since the last instance of the given passage occurred within
 * the story history or -1 if it does not exist; if multiple passages are given, returns the lowest count (which can be -1)
 */
function lastVisited(/* variadic */) {
	if (state.isEmpty() || arguments.length === 0) {
		return -1;
	}

	var passages = Array.prototype.concat.apply([], arguments),
		turns;
	if (passages.length > 1) {
		turns = state.length;
		for (var i = 0, iend = passages.length; i < iend; i++) {
			turns = Math.min(turns, lastVisited(passages[i]));
		}
	} else {
		var hist  = state.history,
			title = passages[0];
		for (turns = state.length - 1; turns >= 0; turns--) {
			if (hist[turns].title === title) { break; }
		}
		if (turns !== -1) {
			turns = state.length - 1 - turns;
		}
	}
	return turns;
}

/**
 * Returns the title of a previous passage, either the directly preceding one or the one at the optional offset, or an empty string, if there is no such passage
 */
function previous(offset) {
	if (arguments.length === 0) {
		offset = 1;
	} else if (offset < 1) {
		throw new Error("previous offset parameter must be a positive integer greater than zero");
	}

	return (state.length > offset) ? state.peek(offset).title : "";
}

/**
 * Returns a random integer within the given range (min–max)
 *   n.b. Using Math.round() will give you a non-uniform distribution!
 */
function random(min, max) {
	if (arguments.length === 0) {
		throw new Error("random called with insufficient arguments");
	} else if (arguments.length === 1) {
		max = min;
		min = 0;
	}
	if (min > max) {
		var swap = max;
		max = min;
		min = swap;
	}

	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random float within the given range (min–max)
 */
function randomFloat(min, max) {
	if (arguments.length === 0) {
		throw new Error("randomFloat called with insufficient arguments");
	} else if (arguments.length === 1) {
		max = min;
		min = 0.0;
	}
	if (min > max) {
		var swap = max;
		max = min;
		min = swap;
	}

	return (Math.random() * (max - min)) + min;
}

/**
 * Returns a new array containing the tags of the given passage(s)
 */
function tags(/* variadic */) {
	if (arguments.length === 0) {
		return tale.get(state.active.title).tags.slice(0);
	}

	var passages = Array.prototype.concat.apply([], arguments),
		tags     = [];
	for (var i = 0, iend = passages.length; i < iend; i++) {
		tags = tags.concat(tale.get(passages[i]).tags);
	}
	return tags;
}

/**
 * Returns an integer count of how many times the given passage exists within the story history;
 * if multiple passages are given, returns the lowest count
 */
function visited(/* variadic */) {
	if (state.isEmpty()) {
		return 0;
	}

	var passages = Array.prototype.concat.apply([], (arguments.length === 0) ? [state.active.title] : arguments),
		count;
	if (passages.length > 1) {
		count = state.length;
		for (var i = 0, iend = passages.length; i < iend; i++) {
			count = Math.min(count, visited(passages[i]));
		}
	} else {
		var hist  = state.history,
			title = passages[0];
		count = 0;
		for (var i = 0, iend = state.length; i < iend; i++) {
			if (hist[i].title === title) { count++; }
		}
	}
	return count;
}

/**
 * Returns an integer count of how many passages within the story history are tagged with all of the given tags
 */
function visitedTags(/* variadic */) {
	if (arguments.length === 0) {
		return 0;
	}

	var list  = Array.prototype.concat.apply([], arguments),
		llen  = list.length,
		count = 0;
	for (var i = 0, iend = state.length; i < iend; i++) {
		var tags = tale.get(state.history[i].title).tags;
		if (tags.length !== 0) {
			var found = 0;
			for (var j = 0; j < llen; j++) {
				if (tags.contains(list[j])) { found++; }
			}
			if (found === llen) { count++; }
		}
	}
	return count;
}

/**
 * Vanilla-header compatibility shims
 */
function either(/* variadic */) {
	if (arguments.length === 0) {
		return;
	}

	return Array.prototype.concat.apply([], arguments).random();
}
function visitedTag(/* variadic */) { return visitedTags.apply(null, arguments); }
function turns() { return state.length; }
function passage() { return state.active.title; }

