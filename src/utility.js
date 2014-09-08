/***********************************************************************************************************************
** [Begin utility.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Libraries]
***********************************************************************************************************************/
/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
var saveAs=saveAs||navigator.msSaveBlob&&navigator.msSaveBlob.bind(navigator)||function(e){"use strict";var t=e.document,n=function(){return e.URL||e.webkitURL||e},r=e.URL||e.webkitURL||e,i=t.createElementNS("http://www.w3.org/1999/xhtml","a"),s="download"in i,o=function(n){var r=t.createEvent("MouseEvents");r.initMouseEvent("click",true,false,e,0,0,0,0,0,false,false,false,false,0,null);n.dispatchEvent(r)},u=e.webkitRequestFileSystem,a=e.requestFileSystem||u||e.mozRequestFileSystem,f=function(t){(e.setImmediate||e.setTimeout)(function(){throw t},0)},l="application/octet-stream",c=0,h=[],p=function(){var e=h.length;while(e--){var t=h[e];if(typeof t==="string"){r.revokeObjectURL(t)}else{t.remove()}}h.length=0},d=function(e,t,n){t=[].concat(t);var r=t.length;while(r--){var i=e["on"+t[r]];if(typeof i==="function"){try{i.call(e,n||e)}catch(s){f(s)}}}},v=function(t,r){var f=this,p=t.type,v=false,m,g,y=function(){var e=n().createObjectURL(t);h.push(e);return e},b=function(){d(f,"writestart progress write writeend".split(" "))},w=function(){if(v||!m){m=y(t)}if(g){g.location.href=m}else{window.open(m,"_blank")}f.readyState=f.DONE;b()},E=function(e){return function(){if(f.readyState!==f.DONE){return e.apply(this,arguments)}}},S={create:true,exclusive:false},x;f.readyState=f.INIT;if(!r){r="download"}if(s){m=y(t);i.href=m;i.download=r;o(i);f.readyState=f.DONE;b();return}if(e.chrome&&p&&p!==l){x=t.slice||t.webkitSlice;t=x.call(t,0,t.size,l);v=true}if(u&&r!=="download"){r+=".download"}if(p===l||u){g=e}if(!a){w();return}c+=t.size;a(e.TEMPORARY,c,E(function(e){e.root.getDirectory("saved",S,E(function(e){var n=function(){e.getFile(r,S,E(function(e){e.createWriter(E(function(n){n.onwriteend=function(t){g.location.href=e.toURL();h.push(e);f.readyState=f.DONE;d(f,"writeend",t)};n.onerror=function(){var e=n.error;if(e.code!==e.ABORT_ERR){w()}};"writestart progress write abort".split(" ").forEach(function(e){n["on"+e]=f["on"+e]});n.write(t);f.abort=function(){n.abort();f.readyState=f.DONE};f.readyState=f.WRITING}),w)}),w)};e.getFile(r,{create:false},E(function(e){e.remove();n()}),E(function(e){if(e.code===e.NOT_FOUND_ERR){n()}else{w()}}))}),w)}),w)},m=v.prototype,g=function(e,t){return new v(e,t)};m.abort=function(){var e=this;e.readyState=e.DONE;d(e,"abort")};m.readyState=m.INIT=0;m.WRITING=1;m.DONE=2;m.error=m.onwritestart=m.onprogress=m.onwrite=m.onabort=m.onerror=m.onwriteend=null;e.addEventListener("unload",p,false);return g}(self)


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
	var okeys = Object.keys(orig),  // Object.keys() or Object.getOwnPropertyNames() ?
		dup;
	// Ensure the returned object has the same prototype as the original
	if (Array.isArray(orig)) {
		// Array object case; this must be done separate from the general case or the prototype will be wrong
		dup = [];
	} else {
		// General, non-array, object case
		var proto = has.getPrototypeOf ? Object.getPrototypeOf(orig) : orig.__proto__;
		dup = proto ? Object.create(proto) : orig.constructor.prototype;  // the latter case should only be reached by very old browsers
	}
	for (var i = 0, len = okeys.length; i < len; i++) {  // this allows cloning of expando properties as well
		dup[okeys[i]] = clone(orig[okeys[i]]);
		// n.b The above does not preserve ES5 property attributes like 'writable', 'enumerable', etc.
		//     That could be achieved by using the following instead.
		//Object.defineProperty(dup, okeys[i], clone(Object.getOwnPropertyDescriptor(orig, okeys[i])));
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
 * Returns an integer count of how many turns have passed since the last instance of the given passage occurred within
 * the story history or -1 if it does not exist; if multiple passages are given, returns the lowest count (which can be -1)
 */
function lastVisited(/* variadic */) {
	if (state.isEmpty || arguments.length === 0) { return -1; }

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
 * Returns a random integer within the given range (min–max)
 *   n.b. Using Math.round() will give you a non-uniform distribution!
 */
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
 * Returns a random float within the given range (min–max)
 */
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
 * Returns a new array containing the tags of the given passage(s)
 */
function tags(/* variadic */) {
	if (arguments.length === 0) { return tale.get(state.active.title).tags.slice(0); }

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
	if (state.isEmpty) { return 0; }

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
	if (arguments.length === 0) { return 0; }

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
	if (arguments.length === 0) { return; }

	return Array.prototype.concat.apply([], arguments).random();
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
	 * Backup Math.random, in case it's replaced later
	 */
	random : Math.random,

	/**
	 * Returns whether the passed value is numeric
	 */
	isNumeric : function (obj) {
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
	isBoolean : function (obj) {
		return typeof obj === "boolean" || (typeof obj === "string" && (obj === "true" || obj === "false"));
	},

	/**
	 * Returns a lowercased and underscore encoded version of the passed string
	 */
	slugify : function (str) {
		return str
			.trim()
			.replace(/[^\w\s\u2013\u2014-]+/g, '')
			.replace(/[_\s\u2013\u2014-]+/g, '-')
			.toLocaleLowerCase();
	},

	/**
	 * Returns the evaluation of the passed expression, throwing if there were errors
	 */
	evalExpression : function (expression) {
		"use strict";
		// the parens are to protect object literals from being confused with block statements
		return eval("(" + expression + ")");
	},

	/**
	 * Returns whether the evaluation of the passed statements completed without thrown exceptions
	 */
	evalStatements : function (statements) {
		"use strict";
		// the enclosing anonymous function is to isolate the passed code within its own scope
		eval("(function(){" + statements + "\n}());");
		return true;
	},

	/**
	 * Diff operations enumeration
	 */
	DiffOp : Object.freeze({
		Delete      : 0,
		SpliceArray : 1,
		Copy        : 2,
		CopyDate    : 3
	}),

	/**
	 * Returns a patch object containing the differences between the original and the destination objects
	 */
	diff : function (orig, dest) /* diff object */ {
		"use strict";
		var keys    = [].concat(Object.keys(orig), Object.keys(dest))
				        .sort().filter(function (v, i, a) { return (i === 0 || a[i-1] != v); }),
			diff    = {},
			isArray = Array.isArray(orig),
			aOpRef;
		for (var i = 0, klen = keys.length; i < klen; i++) {
			var p     = keys[i],
				origP = orig[p],
				destP = dest[p];
			if (orig.hasOwnProperty(p)) {
				if (dest.hasOwnProperty(p)) {
					// key exists in both
					if (origP === destP) {
						// values are exactly the same, so do nothing
						continue;
					}
					if (typeof origP === typeof destP) {
						// values are of the same basic type
						if (typeof origP === "function") {
							/*
							// values are functions, which are problematic to test, so we simply copy
							diff[p] = [ Util.DiffOp.Copy, clone(destP) ];
							*/
							if (origP.toString() !== destP.toString()) {
								diff[p] = [ Util.DiffOp.Copy, clone(destP) ];
							}
						} else if (typeof origP !== "object" || origP === null) {
							// values are scalars or null
							diff[p] = [ Util.DiffOp.Copy, destP ];
						} else if (Object.prototype.toString.call(origP) === Object.prototype.toString.call(destP)) {
							// values are objects of the same prototype
							if (origP instanceof Date) {
								if ((+origP) !== (+destP)) {
									diff[p] = [ Util.DiffOp.CopyDate, +destP ];
								}
							} else if (origP instanceof RegExp) {
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
							// values are objects of different prototypes
							diff[p] = [ Util.DiffOp.Copy, clone(destP) ];
						}
					} else {
						// values are of different types
						diff[p] = [ Util.DiffOp.Copy, (typeof destP !== "object" || destP === null) ? destP : clone(destP) ];
					}
				} else {
					// key only exists in orig
					if (isArray && Util.isNumeric(p)) {
						var np = +p;
						if (!aOpRef) {
							aOpRef = "";
							do {
								aOpRef += "~";
							} while (keys.some(function (v) { return v === this.val; }, { val: aOpRef }));
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
				// key only exists in dest
				diff[p] = [ Util.DiffOp.Copy, (typeof destP !== "object" || destP === null) ? destP : clone(destP) ];
			}
		}
		return (Object.keys(diff).length !== 0) ? diff : null;
	},

	/**
	 * Returns an object resulting from updating the original object with the difference object
	 */
	patch : function (orig, diff) /* patched object */ {
		"use strict";
		var keys    = Object.keys(diff || {}),
			patched = clone(orig);
		for (var i = 0, klen = keys.length; i < klen; i++) {
			var p     = keys[i],
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
	},

	/**
	 * [DEPRECATED] Returns a JSON-based serialization of the passed object
	 *   n.b. Just a legacy alias for JSON.stringify now, see 'intrinsics.js' for the new serialization code
	 */
	serialize : JSON.stringify,

	/**
	 * [DEPRECATED] Returns a copy of the original object from the passed JSON-based serialization
	 *   n.b. Just a legacy alias for JSON.parse now, see 'intrinsics.js' for the new serialization code
	 */
	deserialize : JSON.parse,

	/**
	 * [DEPRECATED] Returns a v4 Universally Unique IDentifier (UUID), a.k.a. Globally Unique IDentifier (GUID)
	 *   n.b. Just a legacy alias for UUID.generate now
	 */
	generateUuid : UUID.generate

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
	for (var i = 0; i < prngObj.count; i++) {
		prng.random();
	}

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
		if (has.localStorage) {
			this.store = window.localStorage;
		}
		break;
	case "sessionStorage":
		this.name = storeName;
		if (has.sessionStorage) {
			this.store = window.sessionStorage;
		}
		break;
	default:
		throw new Error("unknown storage type");
		break;
	}
	this.prefix = storePrefix + ".";
}

KeyValueStore.prototype.setItem = function (sKey, sValue, quiet) {
	if (!sKey) { return false; }

	var oKey = sKey;

	sKey = this.prefix + sKey;
	sValue = JSON.stringify(sValue);

	if (this.store) {
		try {
			sValue = LZString.compressToUTF16(sValue);
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
			if (!quiet) {
				technicalAlert(null, 'unable to store key "' + oKey + '"; '
					+ (/quota_?(?:exceeded|reached)/i.test(e.name) ? this.name + " quota exceeded" : "unknown error")
					, e);
			}
			return false;
		}
	} else {
		try {
			sValue = LZString.compressToBase64(sValue);
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
			document.cookie = cookie.join("; ");
		} catch (e) {
			if (!quiet) {
				technicalAlert(null, 'unable to store key "' + oKey + '"; cookie error: ' + e.message, e);
			}
			return false;
		}
		if (!this.hasItem(oKey)) {
			if (!quiet) {
				technicalAlert(null, 'unable to store key "' + oKey + '"; unknown cookie error');
			}
			return false;
		}
	}
	return true;
};

KeyValueStore.prototype.getItem = function (sKey) {
	if (!sKey) { return null; }

	var oKey   = sKey,
		legacy = false;

	sKey = this.prefix + sKey;

	if (this.store) {
		var sValue = this.store.getItem(sKey);
		if (sValue != null) {  // use lazy equality
			if (DEBUG) { console.log('    > attempting to load value for key "' + oKey + '"'); }
			/* legacy */
			if (sValue.slice(0, 2) === "#~") {
				// try it as a flagged, compressed value
				sValue = JSON.parse(LZString.decompressFromUTF16(sValue.slice(2)));
				legacy = true;
			} else {
				try {
			/* /legacy */
					// try it as an unflagged, compressed value
					sValue = JSON.parse(LZString.decompressFromUTF16(sValue));
			/* legacy */
				} catch (e) {
					// finally, try it as an uncompressed value
					sValue = JSON.parse(sValue);
					legacy = true;
				}
			}
			// attempt to upgrade the legacy value
			if (legacy && !this.setItem(oKey, sValue, true)) {
				throw new Error('unable to upgrade legacy value for key "' + oKey + '" to new format');
			}
			/* /legacy */
			return sValue;
		}
	} else {
		sKey = escape(sKey);
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++) {
			var bits = cookies[i].split("=");
			if (bits[0].trim() === sKey) {
				var sValue = unescape(bits[1]);
				if (DEBUG) { console.log('    > attempting to load value for key "' + oKey + '"'); }
				/* legacy */
				if (sValue.slice(0, 2) === "#~") {
					// try it as a flagged, compressed value
					sValue = JSON.parse(LZString.decompressFromBase64(sValue.slice(2)));
					legacy = true;
				} else {
					try {
				/* /legacy */
						// try it as an unflagged, compressed value
						sValue = JSON.parse(LZString.decompressFromBase64(sValue));
				/* legacy */
					} catch (e) {
						// finally, try it as an uncompressed value
						sValue = JSON.parse(sValue);
						legacy = true;
					}
				}
				// attempt to upgrade the legacy value
				if (legacy && !this.setItem(oKey, sValue, true)) {
					throw new Error('unable to upgrade legacy value for key "' + oKey + '" to new format');
				}
				/* /legacy */
				return sValue;
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
			if (bits[0].trim() === sKey) {
				return true;
			}
		}
	}
	return false;
};


/***********************************************************************************************************************
** [End utility.js]
***********************************************************************************************************************/
