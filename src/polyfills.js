/***********************************************************************************************************************
** [Begin polyfills.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Polyfills, Libraries]
***********************************************************************************************************************/
/**
 * classList
 */
/*! @source http://purl.eligrey.com/github/classList.js/blob/master/classList.js*/
;if("document" in self&&!("classList" in document.createElement("_"))){(function(j){"use strict";if(!("Element" in j)){return}var a="classList",f="prototype",m=j.Element[f],b=Object,k=String[f].trim||function(){return this.replace(/^\s+|\s+$/g,"")},c=Array[f].indexOf||function(q){var p=0,o=this.length;for(;p<o;p++){if(p in this&&this[p]===q){return p}}return -1},n=function(o,p){this.name=o;this.code=DOMException[o];this.message=p},g=function(p,o){if(o===""){throw new n("SYNTAX_ERR","an invalid or illegal string was specified")}if(/\s/.test(o)){throw new n("INVALID_CHARACTER_ERR","string contains an invalid character")}return c.call(p,o)},d=function(s){var r=k.call(s.getAttribute("class")||""),q=r?r.split(/\s+/):[],p=0,o=q.length;for(;p<o;p++){this.push(q[p])}this._updateClassName=function(){s.setAttribute("class",this.toString())}},e=d[f]=[],i=function(){return new d(this)};n[f]=Error[f];e.item=function(o){return this[o]||null};e.contains=function(o){o+="";return g(this,o)!==-1};e.add=function(){var s=arguments,r=0,p=s.length,q,o=false;do{q=s[r]+"";if(g(this,q)===-1){this.push(q);o=true}}while(++r<p);if(o){this._updateClassName()}};e.remove=function(){var t=arguments,s=0,p=t.length,r,o=false;do{r=t[s]+"";var q=g(this,r);if(q!==-1){this.splice(q,1);o=true}}while(++s<p);if(o){this._updateClassName()}};e.toggle=function(p,q){p+="";var o=this.contains(p),r=o?q!==true&&"remove":q!==false&&"add";if(r){this[r](p)}return !o};e.toString=function(){return this.join(" ")};if(b.defineProperty){var l={get:i,enumerable:true,configurable:true};try{b.defineProperty(m,a,l)}catch(h){if(h.number===-2146823252){l.enumerable=false;b.defineProperty(m,a,l)}}}else{if(b[f].__defineGetter__){m.__defineGetter__(a,i)}}}(self))};


/***********************************************************************************************************************
** [Polyfills, Piecemeal]
***********************************************************************************************************************/
/**
 * Adds support for window.history.state to browsers which lack it (notably some versions of Safari/iOS)
 */
if (("history" in window) && ("pushState" in window.history) && !("state" in window.history)) {
	DEBUG("[Polyfill: window.history.state]");
	(function (origPush, origReplace) {
		// initialize window.history.state to null
		window.history.state = null;

		// replace the default pushState()/replaceState() methods with wrappers
		// which set window.history.state to the appropriate value
		window.history.pushState = function (state) {
			origPush.apply(window.history, arguments);
			window.history.state = state;
		};
		window.history.replaceState = function (state) {
			origReplace.apply(window.history, arguments);
			window.history.state = state;
		};

		// add an event handler for popstate which sets window.history.state to
		// the appropriate value, and make the handler initiate capture so that
		// it will be called before any other popstate handlers
		window.addEventListener("popstate", function (evt) {
			DEBUG("[Polyfill: window.history.state -> popstate handler]");
			window.history.state = evt.state;
		}, true);
	})(window.history.pushState, window.history.replaceState);
}

/**
 * Returns the first index at which an element can be found within the array, or -1 if it is not present
 */
if (!Array.prototype.indexOf) {
	Object.defineProperty(Array.prototype, "indexOf", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (needle, from) {
			"use strict";
			if (this == null) {
				throw new TypeError("Array.prototype.indexOf called on null or undefined");
			}

			var list   = Object(this),
				length = list.length >>> 0;

			from = +from || 0;
			if (!isFinite(from)) {
				from = 0;
			}
			if (from < 0) {
				from += length;
				if (from < 0) {
					from = 0;
				}
			}

			for (/* empty*/; from < length; from++) {
				if (list[from] === needle) {
					return from;
				}
			}
			return -1;
		}
	});
}

/**
 * Returns whether an element may be found within the array, returning true or false as appropriate
 */
if (!Array.prototype.contains) {
	Object.defineProperty(Array.prototype, "contains", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (/* needle */) {
			"use strict";
			return Array.prototype.indexOf.apply(this, arguments) !== -1;
		}
	});
}

/**
 * Creates a new array with all elements that pass the test implemented by the provided function
 */
if (!Array.prototype.filter) {
	Object.defineProperty(Array.prototype, "filter", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (filterFn /* , thisp */) {
			"use strict";
			if (this == null) {
				throw new TypeError("Array.prototype.filter called on null or undefined");
			}
			if (typeof filterFn !== "function") {
				throw new TypeError("Array.prototype.filter callback parameter must be a function");
			}

			var list   = Object(this),
				length = list.length >>> 0,
				res    = [],
				thisp  = arguments[1];

			for (var i = 0; i < length; i++) {
				if (i in list) {
					var val = list[i];
					if (filterFn.call(thisp, val, i, list)) {
						res.push(val);
					}
				}
			}
			return res;
		}
	});
}

/**
 * Returns a value from the array, if an element in the array satisfies the provided testing function, otherwise undefined is returned
 */
if (!Array.prototype.find) {
	Object.defineProperty(Array.prototype, "find", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (callback /* , thisp */) {
			"use strict";
			if (this == null) {
				throw new TypeError("Array.prototype.find called on null or undefined");
			}
			if (typeof callback !== "function") {
				throw new TypeError("Array.prototype.find callback parameter must be a function");
			}

			var list   = Object(this),
				length = list.length >>> 0,
				thisp  = arguments[1];

			for (var i = 0; i < length; i++) {
				if (i in list) {
					var val = list[i];
					if (callback.call(thisp, val, i, list)) {
						return val;
					}
				}
			}
			return undefined;
		}
	});
}

/**
 * Creates a new array with the results of calling a provided function on every element in this array
 */
if (!Array.prototype.map) {
	Object.defineProperty(Array.prototype, "map", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (callback /* , thisp */) {
			"use strict";
			if (this == null) {
				throw new TypeError("Array.prototype.map called on null or undefined");
			}
			if (typeof callback !== "function") {
				throw new TypeError("Array.prototype.map callback parameter must be a function");
			}

			var list   = Object(this),
				length = list.length >>> 0,
				res    = new Array(length),
				thisp  = arguments[1];

			for (var i = 0; i < length; i++) {
				if (i in list) {
					var val = list[i];
					res[i] = callback.call(thisp, val, i, list);
				}
			}
			return res;
		}
	});
}

/**
 * Tests whether some element in the array passes the test implemented by the provided function
 */
if (!Array.prototype.some) {
	Object.defineProperty(Array.prototype, "some", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (callback /*, thisp */) {
			"use strict";
			if (this == null) {
				throw new TypeError("Array.prototype.some called on null or undefined");
			}
			if (typeof callback !== "function") {
				throw new TypeError("Array.prototype.some callback parameter must be a function");
			}

			var list   = Object(this),
				length = list.length >>> 0,
				thisp  = arguments[1];

			for (var i = 0; i < length; i++) {
				if (i in list) {
					var val = list[i];
					if (callback.call(thisp, val, i, list)) {
						return true;
					}
				}
			}
			return false;
		}
	});
}

/**
 * Returns the array status of the passed variable
 */
if (!Array.isArray) {
	Object.defineProperty(Array, "isArray", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (obj) {
			"use strict";
			return Object.prototype.toString.call(obj) === "[object Array]";
		}
	});
}

/**
 * Returns the integral part of a number by removing any fractional digits, it does not round
 */
if (!Math.trunc) {
	Object.defineProperty(Math, "trunc", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (num) {
			"use strict";
			return (num < 0) ? Math.ceil(num) : Math.floor(num);
		}
	});
}

/**
 * Returns whether one string may be found within another string, returning true or false as appropriate
 */
if (!String.prototype.contains) {
	Object.defineProperty(String.prototype, "contains", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (/* needle */) {
			"use strict";
			return String.prototype.indexOf.apply(this, arguments) !== -1;
		}
	});
}

/**
 * Returns a copy of the base string with 'count' characters replaced with 'replacement', starting at 'start'
 */
if (!String.prototype.splice) {
	Object.defineProperty(String.prototype, "splice", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (start, count, replacement) {
			"use strict";
			if (this == null) {
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
			if ((start + count) < length) {
				res += this.slice(start + count);
			}
			return res;
		}
	});
}

/**
 * Returns a string with all whitespace removed from both sides of the base string
 */
if (!String.prototype.trim) {
	Object.defineProperty(String.prototype, "trim", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function () {
			"use strict";
			//return this.replace(/^\s+/, "").replace(/\s+$/, "");
			return this.replace(/^\s+|\s+$/g, "");
		}
	});
}

/**
 * Returns a string with all whitespace removed from the left side of the base string
 */
if (!String.prototype.ltrim) {
	Object.defineProperty(String.prototype, "ltrim", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function () {
			"use strict";
			return this.replace(/^\s+/, "");
		}
	});
}

/**
 * Returns a string with all whitespace removed from the right side of the base string
 */
if (!String.prototype.rtrim) {
	Object.defineProperty(String.prototype, "rtrim", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function () {
			"use strict";
			return this.replace(/\s+$/, "");
		}
	});
}

/**
 * If Object.create isn't already defined, we just do the simple shim, without the second argument, since that's all we need here
 */
if (!Object.create || typeof Object.create !== "function") {
	Object.defineProperty(Object, "create", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : (function () {
			function F(){}

			return function (proto) {
				"use strict";
				if (arguments.length !== 1) {
					throw new Error("polyfill Object.create implementation only accepts one parameter");
				}
				if (proto == null) {
					throw new TypeError("Object.create proto parameter is null or undefined");
				}
				if (typeof proto !== "object") {
					throw new TypeError("Object.create proto parameter must be an object");
				}

				F.prototype = proto;
				return new F();
			};
		}())
	});
}


/***********************************************************************************************************************
** [End polyfills.js]
***********************************************************************************************************************/
