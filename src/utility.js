/***********************************************************************************************************************
** [Begin utility.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Libraries]
***********************************************************************************************************************/
/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
var saveAs=saveAs||navigator.msSaveBlob&&navigator.msSaveBlob.bind(navigator)||function(e){"use strict";var t=e.document,n=function(){return e.URL||e.webkitURL||e},r=e.URL||e.webkitURL||e,i=t.createElementNS("http://www.w3.org/1999/xhtml","a"),s="download"in i,o=function(n){var r=t.createEvent("MouseEvents");r.initMouseEvent("click",true,false,e,0,0,0,0,0,false,false,false,false,0,null);n.dispatchEvent(r)},u=e.webkitRequestFileSystem,a=e.requestFileSystem||u||e.mozRequestFileSystem,f=function(t){(e.setImmediate||e.setTimeout)(function(){throw t},0)},l="application/octet-stream",c=0,h=[],p=function(){var e=h.length;while(e--){var t=h[e];if(typeof t==="string"){r.revokeObjectURL(t)}else{t.remove()}}h.length=0},d=function(e,t,n){t=[].concat(t);var r=t.length;while(r--){var i=e["on"+t[r]];if(typeof i==="function"){try{i.call(e,n||e)}catch(s){f(s)}}}},v=function(t,r){var f=this,p=t.type,v=false,m,g,y=function(){var e=n().createObjectURL(t);h.push(e);return e},b=function(){d(f,"writestart progress write writeend".split(" "))},w=function(){if(v||!m){m=y(t)}if(g){g.location.href=m}else{window.open(m,"_blank")}f.readyState=f.DONE;b()},E=function(e){return function(){if(f.readyState!==f.DONE){return e.apply(this,arguments)}}},S={create:true,exclusive:false},x;f.readyState=f.INIT;if(!r){r="download"}if(s){m=y(t);i.href=m;i.download=r;o(i);f.readyState=f.DONE;b();return}if(e.chrome&&p&&p!==l){x=t.slice||t.webkitSlice;t=x.call(t,0,t.size,l);v=true}if(u&&r!=="download"){r+=".download"}if(p===l||u){g=e}if(!a){w();return}c+=t.size;a(e.TEMPORARY,c,E(function(e){e.root.getDirectory("saved",S,E(function(e){var n=function(){e.getFile(r,S,E(function(e){e.createWriter(E(function(n){n.onwriteend=function(t){g.location.href=e.toURL();h.push(e);f.readyState=f.DONE;d(f,"writeend",t)};n.onerror=function(){var e=n.error;if(e.code!==e.ABORT_ERR){w()}};"writestart progress write abort".split(" ").forEach(function(e){n["on"+e]=f["on"+e]});n.write(t);f.abort=function(){n.abort();f.readyState=f.DONE};f.readyState=f.WRITING}),w)}),w)};e.getFile(r,{create:false},E(function(e){e.remove();n()}),E(function(e){if(e.code===e.NOT_FOUND_ERR){n()}else{w()}}))}),w)}),w)},m=v.prototype,g=function(e,t){return new v(e,t)};m.abort=function(){var e=this;e.readyState=e.DONE;d(e,"abort")};m.readyState=m.INIT=0;m.WRITING=1;m.DONE=2;m.error=m.onwritestart=m.onprogress=m.onwrite=m.onabort=m.onerror=m.onwriteend=null;e.addEventListener("unload",p,false);return g}(self)


/***********************************************************************************************************************
** [Global Object/Prototype Extensions]
***********************************************************************************************************************/
/**
 * Returns a random value from the passed array in the range of lower and upper, if they are specified
 */
Object.defineProperty(Array, "random", {
	enumerable   : false,
	configurable : true,
	writable     : true,
	value        : function (array, lower, upper) {
		if (Array.isArray(array)) {
			return array.random(lower, upper);
		} else if (array.hasOwnProperty("length")) {
			return Array.prototype.slice.call(array, 0).random(lower, upper);
		}
		return undefined;
	}
});

/**
 * Returns a random value from the array in the range of lower and upper, if they are specified
 */
Object.defineProperty(Array.prototype, "random", {
	enumerable   : false,
	configurable : true,
	writable     : true,
	value        : function (lower, upper) {
		if (lower == null) {  // use lazy equality
			lower = 0;
		} else if (lower < 0) {
			lower = 0;
		} else if (lower >= this.length) {
			lower = this.length - 1;
		}
		if (upper == null) {  // use lazy equality
			upper = this.length - 1;
		} else if (upper < 0) {
			upper = 0;
		} else if (upper >= this.length) {
			upper = this.length - 1;
		}
		return this[random(lower, upper)];
	}
});

/**
 * Returns the passed numerical clamped to the specified bounds
 */
Object.defineProperty(Math, "clamp", {
	enumerable   : false,
	configurable : true,
	writable     : true,
	value        : function (num, min, max) {
		num = Number(num);
		return isNaN(num) ? NaN : num.clamp(min, max);
	}
});

/**
 * Returns the number clamped to the specified bounds
 */
Object.defineProperty(Number.prototype, "clamp", {
	enumerable   : false,
	configurable : true,
	writable     : true,
	value        : function (min, max) {
		var num = Number(this);
		if (num < min) { num = min; }
		if (num > max) { num = max; }
		return num;
	}
});

/**
 * Returns a decimal number eased from 0 to 1
 */
Object.defineProperty(Math, "easeInOut", {
	enumerable   : false,
	configurable : true,
	writable     : true,
	value        : function (num) {
		return (1 - ((Math.cos(num * Math.PI) + 1) / 2));
	}
});

/**
 * Returns an array of link titles, parsed from the string
 *   n.b. Unused in SugarCube, only included for compatibility
 */
Object.defineProperty(String.prototype, "readBracketedList", {
	enumerable   : false,
	configurable : true,
	writable     : true,
	value        : function () {
		// RegExp groups: Double-square-bracket quoted | Unquoted
		var pattern = "(?:\\[\\[((?:\\s|\\S)*?)\\]\\])|([^\"'\\s]\\S*)",  //"(?:\\[\\[([^\\]]+)\\]\\])|([^\\s$]+)"
			re      = new RegExp(pattern, "gm"),
			names   = [];
		do {
			var match = re.exec(this);
			if (match) {
				if (match[1]) {
					// Double-square-bracket quoted
					names.push(match[1]);
				} else if (match[2]) {
					// Unquoted
					names.push(match[2]);
				}
			}
		} while (match);
		return names;
	}
});

/**
 * Returns a formatted string, after replacing each format item in the given format string with the text equivalent of the corresponding argument's value
 */
if (!String.format) {
	Object.defineProperty(String, "format", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (format) {
			function padString(str, align, pad) {
				if (!align) { return str; }
				var plen = Math.abs(align) - str.length;
				if (plen < 1) { return str; }
				var padding = Array(plen + 1).join(pad);
				return (align < 0)
					? str + padding
					: padding + str;
			}

			if (arguments.length < 2) { return (arguments.length === 0) ? "" : format; }

			var args = (arguments.length === 2 && Array.isArray(arguments[1]))
				? arguments[1].slice(0)
				: Array.prototype.slice.call(arguments, 1);

			if (args.length === 0) { return format; }

			return format.replace(/{(\d+)(?:,([+-]?\d+))?}/g, function (match, index, align) {
				var retval = args[index];
				if (retval == null) { return ""; }  // use lazy equality
				while (typeof retval === "function") { retval = retval(); }
				if (typeof retval === "object") { retval = JSON.stringify(retval); }
				return padString(retval, (!align) ? 0 : parseInt(align), " ");
			});
		}
	});
}


/***********************************************************************************************************************
** [Function Library]
***********************************************************************************************************************/
/**
 * Returns a deep copy of the passed object
 */
function clone(orig) {
	if (orig == null || typeof orig !== "object") {  // use lazy equality on null check
		return orig;
	}

	// Honor native/custom clone methods
	if (typeof orig.clone === "function") {
		return orig.clone(true);
	}

	// Special cases
	if (orig instanceof Date) {
		return new Date(orig.getTime());
	}
	if (orig instanceof RegExp) {
		return new RegExp(orig);
	}
	if (orig.nodeType && typeof orig.cloneNode === "function") {
		return orig.cloneNode(true);
	}

	// If we've reached here, we have a regular object, array, or function
	//   n.b This does NOT preserve ES5 property attributes like 'writable', 'enumerable', etc.
	//       That could be achieved by using Object.getOwnPropertyNames and Object.defineProperty
	var okeys = Object.keys(orig),
		dup;
	// Ensure the returned object has the same prototype as the original
	if (Array.isArray(orig)) {
		// Array object case; this must be done separate from the general case or the prototype will be wrong
		dup = [];
	} else {
		// General, non-array, object case
		var proto = (typeof Object.getPrototypeOf === "function") ? Object.getPrototypeOf(orig) : orig.__proto__;
		dup = proto ? Object.create(proto) : orig.constructor.prototype;  // the latter case should only be reached by very old browsers
	}
	for (var i = 0, len = okeys.length; i < len; i++) {
		dup[okeys[i]] = clone(orig[okeys[i]]);
	}
	return dup;
}

/**
 * Returns the new DOM element, optionally appending it to the passed DOM element (if any)
 */
function insertElement(place, type, id, classNames, text, title) {
	var el = document.createElement(type);

	// add attributes
	if (id) {
		el.id = id;
	}
	if (classNames) {
		el.className = classNames;
	}
	if (title) {
		el.title = title;
	}

	// add content
	if (text) {
		insertText(el, text);
	}

	// append it to the given node
	if (place) {
		place.appendChild(el);
	}

	return el;
}

/**
 * Returns the new DOM element, after appending it to the passed DOM element
 */
function insertText(place, text) {
	return place.appendChild(document.createTextNode(text));
}

/**
 * Removes all children from the passed DOM node
 */
function removeChildren(node) {
	if (node) {
		while (node.hasChildNodes()) {
			node.removeChild(node.firstChild);
		}
	}
}

/**
 * Removes the passed DOM node
 */
function removeElement(node) {
	if (typeof node.remove === "function") {
		node.remove();
	} else if (el.parentNode) {
		node.parentNode.removeChild(node);
	}
}

/**
 * Wikifies a passage into a DOM element corresponding to the passed ID and returns the element
 */
function setPageElement(id, titles, defaultText) {
	var el = (typeof id === "object") ? id : document.getElementById(id);
	if (el) {
		removeChildren(el);
		if (!Array.isArray(titles)) { titles = [ titles ]; }
		for (var i = 0; i < titles.length; i++) {
			if (tale.has(titles[i])) {
				new Wikifier(el, tale.get(titles[i]).processText().trim());
				return el;
			}
		}
		if (defaultText != null && defaultText !== "") {  // use lazy equality on null check
			new Wikifier(el, defaultText);
		}
	}
	return el;
}

/**
 * Appends a new <style> element to the document's <head>
 */
function addStyle(css) {
	var style = document.createElement("style");
	style.type = "text/css";

	// check for Twine 1.4 Base64 image passage transclusion
	var matchRe = new RegExp(formatter.byName["image"].lookaheadRegExp.source, "gm"),
		parseRe = new RegExp(Wikifier.textPrimitives.image);
	if (matchRe.test(css)) {
		css = css.replace(matchRe, function(wikiImage) {
			var parseMatch = parseRe.exec(wikiImage);
			if (parseMatch !== null) {
				// 1=(left), 2=(right), 3=(title), 4=source, 5=(~), 6=(link), 7=(set)
				var source = parseMatch[4];
				if (source.slice(0, 5) !== "data:" && tale.has(source)) {
					var passage = tale.get(source);
					if (passage.tags.contains("Twine.image")) {
						source = passage.text;
					}
				}
				return "url(" + source + ")";
			}
			return wikiImage;
		});
	}

	if (style.styleSheet) {
		// for IE
		style.styleSheet.cssText = css;
	} else {
		// for everyone else
		style.appendChild(document.createTextNode(css));
	}

	document.head.appendChild(style);
}

/**
 * Appends an error message to the passed DOM element
 */
function throwError(place, message, title) {
	insertElement(place, "span", null, "error", "Error: " + message, title);
	return false;
}

/**
 * Fades a DOM element in or out
 *   n.b. Unused in SugarCube, only included for compatibility
 */
function fade(el, options) {
	function tick() {
		current += 0.05 * direction;
		setOpacity(proxy, Math.easeInOut(current));
		if (((direction == 1) && (current >= 1)) || ((direction == -1) && (current <= 0))) {
			el.style.visibility = (options.fade == "in") ? "visible" : "hidden";
			proxy.parentNode.replaceChild(el, proxy);
			proxy = null;
			window.clearInterval(intervalId);
			if (options.onComplete) {
				options.onComplete();
			}
		}
	}
	function setOpacity(el, opacity) {
		var l = Math.floor(opacity * 100);

		// old IE
		el.style.zoom = 1;
		el.style.filter = "alpha(opacity=" + l + ")";

		// CSS
		el.style.opacity = opacity;
	}

	var current,
		proxy      = el.cloneNode(true),
		direction  = (options.fade == "in") ? 1 : -1,
		intervalId;
	el.parentNode.replaceChild(proxy, el);
	if (options.fade == "in") {
		current = 0;
		proxy.style.visibility = "visible";
	} else {
		current = 1;
	}
	setOpacity(proxy, current);
	intervalId = window.setInterval(tick, 25);
}

/**
 * Scrolls the browser window to ensure that a DOM element is in view
 *   n.b. Unused in SugarCube, only included for compatibility
 */
function scrollWindowTo(el, increment) {
	function tick() {
		progress += increment;
		window.scroll(0, start + direction * (distance * Math.easeInOut(progress)));
		if (progress >= 1) {
			window.clearInterval(intervalId);
		}
	}
	function findPosY(el) {
		var curtop = 0;
		while (el.offsetParent) {
			curtop += el.offsetTop;
			el = el.offsetParent;
		}
		return curtop;
	}
	function ensureVisible(el) {
		var posTop    = findPosY(el),
			posBottom = posTop + el.offsetHeight,
			winTop    = window.scrollY ? window.scrollY : document.body.scrollTop,
			winHeight = window.innerHeight ? window.innerHeight : document.body.clientHeight,
			winBottom = winTop + winHeight;
		if (posTop < winTop) {
			return posTop;
		} else {
			if (posBottom > winBottom) {
				if (el.offsetHeight < winHeight) {
					return (posTop - (winHeight - el.offsetHeight) + 20);
				} else {
					return posTop;
				}
			} else {
				return posTop;
			}
		}
	}

	// normalize increment
	if (increment == null) {  // use lazy equality
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

	var start      = window.scrollY ? window.scrollY : document.body.scrollTop,
		end        = ensureVisible(el),
		distance   = Math.abs(start - end),
		progress   = 0,
		direction  = (start > end) ? -1 : 1,
		intervalId = window.setInterval(tick, 25);
}


/***********************************************************************************************************************
** [Function Library, Story Utilities]
***********************************************************************************************************************/
/**
 * Returns a random integer in the range of min and max
 *   n.b. Using Math.round() will give you a non-uniform distribution!
 */
function getRandom(/* min, max */) { return random.apply(null, arguments); }
function random(min, max) {
	if (arguments.length === 0) { throw new Error("random called with insufficient arguments"); }
	if (arguments.length === 1) {
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
 * Returns a random float in the range of min and max
 */
function getRandomArbitrary(/* min, max */) { return randomFloat.apply(null, arguments); }
function randomFloat(min, max) {
	if (arguments.length === 0) { throw new Error("randomFloat called with insufficient arguments"); }
	if (arguments.length === 1) {
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
 * Returns a new array containing the tags of the passage(s)
 */
function tags(/* variadic */) {
	if (arguments.length === 0) {
		return tale.get(state.active.title).tags.slice(0);
	} else {
		var tags = [];
		for (var i = 0; i < arguments.length; i++) {
			tags = tags.concat(tale.get(arguments[i]).tags);
		}
		return tags;
	}
}

/**
 * Returns an integer count of how many times the passage exists within the story history
 */
function visited(title) {
	if (arguments.length === 0) { title = state.active.title; }

	var count = 0;
	for (var i = 0; i < state.length; i++) {
		if (state.history[i].title === title) { count++; }
	}
	return count;
}

/**
 * Returns an integer count of how many passages within the story history are tagged with all of the tags
 */
function visitedTags(/* variadic */) {
	if (arguments.length === 0) { return 0; }

	var count = 0;
	for (var i = 0; i < state.length; i++) {
		var tags = tale.get(state.history[i].title).tags;
		if (tags.length !== 0) {
			var found = 0;
			for (var j = 0; j < arguments.length; j++) {
				if (tags.contains(arguments[j])) { found++; }
			}
			if (found === arguments.length) { count++; }
		}
	}
	return count;
}

/**
 * Vanilla-header compatibility shims
 */
function either(/* variadic */) {
	if (arguments.length === 0) { return; }

	var list = [];
	for (var i = 0; i < arguments.length; i++) {
		list = list.concat(arguments[i]);
	}
	return list.random();
}
function visitedTag(/* variadic */) { return visitedTags.apply(null, arguments); }
function turns() { return state.length; }
function passage() { return state.active.title; }
function previous() { return (state.length > 1) ? state.peek(1).title : ""; }


/***********************************************************************************************************************
** [Function Library (namespaced via static Util object)]
***********************************************************************************************************************/
var Util = {

	/**
	 * Backup Math.random for system-level tasks, like generateUuid(), in case it's replaced later
	 */
	random: Math.random,

	/**
	 * Returns whether the passed value is numeric
	 */
	isNumeric: function (obj) {
		switch (typeof obj) {
		case "boolean":
			/* FALL-THROUGH */
		case "object":
			return false;
		case "string":
			obj = Number(obj);
			break;
		}
		return isFinite(obj) && !isNaN(obj);
		/*
		if (typeof obj === "string") {
			obj = Number(obj);
		}
		return (typeof obj === "number") ? isFinite(obj) && !isNaN(obj) : false;
		*/
	},

	/**
	 * Returns whether the passed value is boolean-ish
	 */
	isBoolean: function (obj) {
		return typeof obj === "boolean" || (typeof obj === "string" && (obj === "true" || obj === "false"));
	},

	/**
	 * Returns a lowercased and underscore encoded version of the passed string
	 */
	slugify: function (str) {
		return str
			.trim()
			.replace(/[^\w\s\u2013\u2014-]+/g, '')
			.replace(/[_\s\u2013\u2014-]+/g, '-')
			.toLocaleLowerCase();
	},

	/**
	 * Returns the evaluation of the passed expression, throwing if there were errors
	 */
	evalExpression: function (expression) {
		"use strict";
		// the parens are to protect object literals from being confused with block statements
		return eval("(" + expression + ")");
	},

	/**
	 * Returns whether the evaluation of the passed statements completed without thrown exceptions
	 */
	evalStatements: function (statements) {
		"use strict";
		// the enclosing anonymous function is to isolate the passed code within its own scope
		try {
			eval("(function(){" + statements + "\n}());");
			return true;
		} catch (e) {
			return false;
		}
	},

	/**
	 * Returns a patch object containing the differences between the original and the destination objects
	 */
	diff: function (orig, dest) /* diff object */ {
		var keys = [].concat(Object.keys(orig), Object.keys(dest)),
			diff = {};
		for (var i = 0, len = keys.length; i < len; i++) {
			var p  = keys[i],
				ep = (p[0] === "-") ? "-" + p : p;
			if (orig.hasOwnProperty(p)) {
				if (typeof orig[p] === typeof dest[p]) {
					if (orig[p] === null || typeof orig[p] !== "object") {
						if (orig[p] !== dest[p]) {
							diff[ep] = dest[p];
						}
					} else {
						var recurse = Util.diff(orig[p], dest[p]);
						if (Object.keys(recurse).length !== 0) {
							diff[ep] = recurse;
						}
					}
				} else {
					if (dest.hasOwnProperty(p)) {
						diff[ep] = clone(dest[p]);
					} else {
						var rmp;
						if (Array.isArray(orig)) {
							rmp = "-i";
							var np = +p;
							if (!diff.hasOwnProperty(rmp)) {
								diff[rmp] = { b: np, e: np };
							}
							if (np < diff[rmp].b) {
								diff[rmp].b = np;
							}
							if (np > diff[rmp].e) {
								diff[rmp].e = np;
							}
						} else {
							rmp = "-p";
							if (!diff.hasOwnProperty(rmp)) {
								diff[rmp] = [];
							}
							diff[rmp].push(p);
						}
					}
				}
			} else {  // key belongs to dest
				if (dest[p] === null || typeof dest[p] !== "object") {
					diff[ep] = dest[p];
				} else {
					diff[ep] = clone(dest[p]);
				}
			}
		}
		return diff;
	},

	/**
	 * Returns an object resulting from updating the original object with the difference object
	 */
	patch: function (orig, diff) /* patched object */ {
		var keys    = Object.keys(diff),
			patched = clone(orig);
		for (var i = 0, klen = keys.length; i < klen; i++) {
			var p = keys[i];
			if (p === "-p") {
				for (var j = 0, dlen = diff[p].length; j < dlen; j++) {
					delete patched[diff[p][j]];
				}
			} else if (p === "-i") {
				patched.splice(diff[p].b, diff[p].e - diff[p].b + 1);
			} else {
				var ep = (p[0] === "-") ? p.slice(1) : p;
				if (diff[p] === null || typeof diff[p] !== "object") {
					patched[ep] = diff[p];
				} else {
					if (patched.hasOwnProperty(ep)) {
						patched[ep] = Util.patch(patched[ep], diff[p]);
					} else {
						patched[ep] = Util.patch({}, diff[p]);
					}
				}
			}
		}
		return patched;
	},

	/**
	 * Returns a JSON-based serialization of the passed object
	 *   n.b. Supports serialization of functions and some native objects
	 */
	serialize: function (obj) {
		return JSON.stringify(obj, function (key, value) {
			if (value != null) {  // use lazy equality
				if (typeof value === "function" || value instanceof RegExp) {
					return "#reviveSrc=(" + value.toString() + ")";
				}
			}
			return value;
		});
	},

	/**
	 * Returns a copy of the original object from the passed JSON-based serialization
	 *   n.b. Supports deserialization of functions and some native objects, if the notation was generated by the Util.serialize() static method
	 */
	deserialize: function (obj) {
		return JSON.parse(obj, function (key, value) {
			//if (typeof value === "string" && /^#reviveSrc=/.test(value))
			// magic number 11 is "#reviveSrc=".length
			if (typeof value === "string" && value.slice(0, 11) === "#reviveSrc=") {
				try {
					value = eval(value.slice(11));
				} catch (e) { /* noop; although, perhaps, it would be better to throw an error here */ }
			}
			return value;
		});
	},

	/**
	 * Returns a v4 Universally Unique IDentifier (UUID), a.k.a. Globally Unique IDentifier (GUID)
	 *     [RFC4122] http://www.ietf.org/rfc/rfc4122.txt
	 */
	generateUuid: function () {
		// this uses a combination of Util.random() and Date().getTime() to harden itself
		// against bad Math.random() generators and reduce the likelihood of a collision
		var d = new Date().getTime();
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			var r = (d + Util.random()*16)%16 | 0;
			d = Math.floor(d/16);
			return (c === 'x' ? r : (r&0x7|0x8)).toString(16);
		});
	}

};


/***********************************************************************************************************************
** [Seedable PRNG (wrapper for seedrandom.js)]
***********************************************************************************************************************/
function SeedablePRNG(seed, useEntropy) {
	return new Math.seedrandom(seed, useEntropy, function(prng, seed) {
		return {
			random : function () { this.count++; return this._prng(); },
			_prng  : prng,
			seed   : seed,
			count  : 0
		};
	});
}

SeedablePRNG.marshal = function (prng) {
	if (!prng || !prng.hasOwnProperty("seed") || !prng.hasOwnProperty("count")) {
		throw new Error("PRNG is missing required data");
	}

	return { seed: prng.seed, count: prng.count };
};

SeedablePRNG.unmarshal = function (prngObj) {
	if (!prngObj || !prngObj.hasOwnProperty("seed") || !prngObj.hasOwnProperty("count")) {
		throw new Error("PRNG object is missing required data");
	}

	// create a new PRNG using the original seed
	var prng = new SeedablePRNG(prngObj.seed, false);

	// pull values until the new PRNG is in sync with the original
	for (var i = 0; i < prngObj.count; i++) { prng.random(); }

	return prng;
};


/***********************************************************************************************************************
** [Storage Management]
***********************************************************************************************************************/
function KeyValueStore(storeName, storePrefix) {
	this.store = null;
	switch (storeName) {
	case "cookie":
		this.name = "cookie";
		break;
	case "localStorage":
		this.name = storeName;
		if (config.hasLocalStorage) {
			this.store = window.localStorage;
		}
		break;
	case "sessionStorage":
		this.name = storeName;
		if (config.hasSessionStorage) {
			this.store = window.sessionStorage;
		}
		break;
	default:
		throw new Error("unknown storage type");
		break;
	}
	this.prefix = storePrefix + ".";
}

KeyValueStore.prototype.setItem = function (sKey, sValue) {
	if (!sKey) { return false; }

	var oKey = sKey;

	sKey = this.prefix + sKey;
	sValue = Util.serialize(sValue);

	if (this.store) {
		try {
			sValue = "#~" + LZString.compressToUTF16(sValue);
		} catch (e) { /* noop */ }

		try {
			this.store.setItem(sKey, sValue);
		} catch (e) {
			/*
			 * Ideally, we could simply do something either like:
			 *     e.code === 22
			 * Or, preferably, like this:
			 *     e.code === DOMException.QUOTA_EXCEEDED_ERR
			 * However, both of those are browser convention, not part of the standard,
			 * and are not supported in all browsers.  So, we have to resort to pattern
			 * matching the damn name.
			 */
			technicalAlert(null, "unable to store key; "
				+ (/quota_?(?:exceeded|reached)/i.test(e.name) ? this.name + " quota exceeded" : "unknown error"), e);
			return false;
		}
	} else {
		try {
			sValue = "#~" + LZString.compressToBase64(sValue);
		} catch (e) { /* noop */ }

		var cookie = [ escape(sKey) + "=" + escape(sValue) ];
		// no expiry means a session cookie
		switch (this.name) {
		case "cookie":
			/* FALL-THROUGH */
		case "localStorage":
			cookie.push("expires=Tue, 19 Jan 2038 03:14:07 GMT");
			break;
		}
		cookie.push("path=/");
		try {
			document.cookie = cookie.join("; ");
		} catch (e) {
			technicalAlert(null, "unable to store key; cookie error: " + e.message, e);
			return false;
		}
		if (!this.hasItem(oKey)) {
			technicalAlert(null, "unable to store key; unknown cookie error");
			return false;
		}
	}
	return true;
};

KeyValueStore.prototype.getItem = function (sKey) {
	if (!sKey) { return null; }

	sKey = this.prefix + sKey;

	if (this.store) {
		var sValue = this.store.getItem(sKey);
		if (sValue != null) {  // use lazy equality
			if (sValue.slice(0, 2) === "#~") {
				if (DEBUG) { console.log("    > loading LZ-compressed value for: " + sKey); }
				return Util.deserialize(LZString.decompressFromUTF16(sValue.slice(2)));
			} else {
				if (DEBUG) { console.log("    > loading uncompressed value for: " + sKey); }
				return Util.deserialize(sValue);
			}
		}
	} else {
		sKey = escape(sKey);
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++) {
			var bits = cookies[i].split("=");
			if (bits[0].trim() === sKey) {
				var sValue = unescape(bits[1]);
				if (sValue.slice(0, 2) === "#~") {
					if (DEBUG) { console.log("    > loading LZ-compressed value for: " + sKey); }
					return Util.deserialize(LZString.decompressFromBase64(sValue.slice(2)));
				} else {
					if (DEBUG) { console.log("    > loading uncompressed value for: " + sKey); }
					return Util.deserialize(sValue);
				}
			}
		}
	}
	return null;
};

KeyValueStore.prototype.removeItem = function (sKey) {
	if (!sKey) { return false; }

	sKey = this.prefix + sKey;

	if (this.store) {
		this.store.removeItem(sKey);
	} else {
		document.cookie = escape(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
	}
	return true;
};

KeyValueStore.prototype.removeMatchingItems = function (sKey) {
	if (!sKey) { return false; }

	if (DEBUG) { console.log("[<KeyValueStore>.removeMatchingItems()]"); }

	var matched = [];
	var keyRegexp = new RegExp(("^" + this.prefix + sKey).replace(/\./g, "\\.") + ".*");
	if (this.store) {
		for (var i = 0; i < this.store.length; i++) {
			var key = this.store.key(i);
			if (keyRegexp.test(key)) {
				matched.push(key);
			}
		}
	} else {
		sKey = escape(sKey);
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++) {
			var bits = cookies[i].split("=");
			var key = bits[0].trim();
			if (keyRegexp.test(key)) {
				matched.push(key);
			}
		}
	}
	for (var i = 0; i < matched.length; i++) {
		if (DEBUG) { console.log("    > removing key: " + matched[i]); }
		this.removeItem(matched[i]);
	}
	return true;
};

KeyValueStore.prototype.hasItem = function (sKey) {
	if (!sKey) { return false; }

	sKey = this.prefix + sKey;

	if (this.store) {
		if (this.store.getItem(sKey)) {
			return true;
		}
	} else {
		sKey = escape(sKey);
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++) {
			var bits = cookies[i].split("=");
			if (bits[0].trim() == sKey) {
				return true;
			}
		}
	}
	return false;
};


/***********************************************************************************************************************
** [End utility.js]
***********************************************************************************************************************/
