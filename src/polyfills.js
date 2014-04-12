/***********************************************************************************************************************
** [Begin polyfills.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Polyfills, Libraries]
***********************************************************************************************************************/
/**
 * atob & btoa
 */
/*! Base64.js v0.2.0 | (c) 2011-2012 David Chambers <dc@davidchambers.me> | Licensed under a WTFPL license */
(function(window){function t(t){this.message=t}var e="undefined"!=typeof exports?exports:window,r="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";t.prototype=Error(),t.prototype.name="InvalidCharacterError",e.btoa||(e.btoa=function(e){for(var o,n,a=0,i=r,c="";e.charAt(0|a)||(i="=",a%1);c+=i.charAt(63&o>>8-8*(a%1))){if(n=e.charCodeAt(a+=.75),n>255)throw new t("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");o=o<<8|n}return c}),e.atob||(e.atob=function(e){if(e=e.replace(/=+$/,""),1==e.length%4)throw new t("'atob' failed: The string to be decoded is not correctly encoded.");for(var o,n,a=0,i=0,c="";n=e.charAt(i++);~n&&(o=a%4?64*o+n:n,a++%4)?c+=String.fromCharCode(255&o>>(6&-2*a)):0)n=r.indexOf(n);return c})})(window);

/**
 * classList
 */
/*! @source http://purl.eligrey.com/github/classList.js/blob/master/classList.js */
;if("document" in self&&!("classList" in document.createElement("_"))){(function(j){"use strict";if(!("Element" in j)){return}var a="classList",f="prototype",m=j.Element[f],b=Object,k=String[f].trim||function(){return this.replace(/^\s+|\s+$/g,"")},c=Array[f].indexOf||function(q){var p=0,o=this.length;for(;p<o;p++){if(p in this&&this[p]===q){return p}}return -1},n=function(o,p){this.name=o;this.code=DOMException[o];this.message=p},g=function(p,o){if(o===""){throw new n("SYNTAX_ERR","An invalid or illegal string was specified")}if(/\s/.test(o)){throw new n("INVALID_CHARACTER_ERR","String contains an invalid character")}return c.call(p,o)},d=function(s){var r=k.call(s.getAttribute("class")||""),q=r?r.split(/\s+/):[],p=0,o=q.length;for(;p<o;p++){this.push(q[p])}this._updateClassName=function(){s.setAttribute("class",this.toString())}},e=d[f]=[],i=function(){return new d(this)};n[f]=Error[f];e.item=function(o){return this[o]||null};e.contains=function(o){o+="";return g(this,o)!==-1};e.add=function(){var s=arguments,r=0,p=s.length,q,o=false;do{q=s[r]+"";if(g(this,q)===-1){this.push(q);o=true}}while(++r<p);if(o){this._updateClassName()}};e.remove=function(){var t=arguments,s=0,p=t.length,r,o=false;do{r=t[s]+"";var q=g(this,r);if(q!==-1){this.splice(q,1);o=true}}while(++s<p);if(o){this._updateClassName()}};e.toggle=function(p,q){p+="";var o=this.contains(p),r=o?q!==true&&"remove":q!==false&&"add";if(r){this[r](p)}return !o};e.toString=function(){return this.join(" ")};if(b.defineProperty){var l={get:i,enumerable:true,configurable:true};try{b.defineProperty(m,a,l)}catch(h){if(h.number===-2146823252){l.enumerable=false;b.defineProperty(m,a,l)}}}else{if(b[f].__defineGetter__){m.__defineGetter__(a,i)}}}(self))};


/***********************************************************************************************************************
** [Polyfills, Piecemeal]
***********************************************************************************************************************/
/**
 * Adds support for window.history.state to browsers which lack it (notably some versions of Safari/iOS)
 */
if (("history" in window) && ("pushState" in window.history) && !("state" in window.history))
{
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
 * Returns the first index at which a given element can be found in the array, or -1 if it is not present.
 */
if (!Array.prototype.indexOf)
{
	Array.prototype.indexOf = function (item, from)
	{
		"use strict";

		if (this == null) { throw new TypeError(); }

		if (!from) { from = 0; }

		for (var i = from, len = this.length; i < len; i++)
		{
			if (this[i] === item)
			{
				return i;
			}
		}
		return -1;
	};
}

/**
 * Creates a new array with all elements that pass the test implemented by the provided function.
 */
if (!Array.prototype.filter)
{
	Array.prototype.filter = function (fun /*, thisp*/)
	{
		"use strict";

		if (this == null || typeof fun !== "function") { throw new TypeError(); }

		var   t     = Object(this)
			, len   = t.length >>> 0
			, res   = []
			, thisp = arguments[1];

		for (var i = 0; i < len; i++)
		{
			if (i in t)
			{
				var val = t[i];	// in case fun mutates this
				if (fun.call(thisp, val, i, t))
				{
					res.push(val);
				}
			}
		}

		return res;
	};
}

/**
 * Creates a new array with the results of calling a provided function on every element in this array.
 */
if (!Array.prototype.map)
{
	Array.prototype.map = function (fun /*, thisp */)
	{
		"use strict";

		if (this == null || typeof fun !== "function") { throw new TypeError(); }

		var   t     = Object(this)
			, len   = t.length >>> 0
			, res   = new Array(len)
			, thisp = arguments[1];

		for (var i = 0; i < len; i++)
		{
			if (i in t)
			{
				var val = t[i];	// in case fun mutates this
				res[i] = fun.call(thisp, val, i, t);
			}
		}

		return res;
	};
}

/**
 * Returns a value from the array, if an element in the array satisfies the provided testing function, otherwise undefined is returned.
 */
if (!Array.prototype.find)
{
	Object.defineProperty(Array.prototype, "find", {
		enumerable   : false,
		configurable : true,
		writable     : true,
		value        : function (predicate) {
			if (this == null)
			{
				throw new TypeError("Array.prototype.find called on null or undefined");
			}
			if (typeof predicate !== "function")
			{
				throw new TypeError("predicate must be a function");
			}

			var   list    = Object(this)
				, length  = list.length >>> 0
				, thisArg = arguments[1]
				, value;
			for (var i = 0; i < length; i++)
			{
				if (i in list)
				{
					value = list[i];
					if (predicate.call(thisArg, value, i, list))
					{
						return value;
					}
				}
			}
			return undefined;
		}
	});
}

/**
 * Tests whether some element in the array passes the test implemented by the provided function.
 */
if (!Array.prototype.some)
{
	Array.prototype.some = function(fun /*, thisp */)
	{
		"use strict";

		if (this == null || typeof fun !== "function") { throw new TypeError(); }

		var   t     = Object(this)
			, len   = t.length >>> 0
			, thisp = arguments[1];

		for (var i = 0; i < len; i++)
		{
			if (i in t)
			{
				var val = t[i];	// in case fun mutates this
				if (fun.call(thisp, val, i, t))
				{
					return true;
				}
			}
		}

		return false;
	};
}

/**
 * Returns the array status of the passed variable
 */
if (!Array.isArray)
{
	Array.isArray = function (obj)
	{
		return Object.prototype.toString.call(obj) === "[object Array]";
	};
}

/**
 * Returns a copy of the base string with 'count' characters replaced with 'replacement', starting at 'start'
 */
if (!String.prototype.splice)
{
	String.prototype.splice = function(start, count, replacement)
	{
		"use strict";

		if (this == null) { throw new TypeError(); }

		if (this.length === 0) { return ""; }

		if (typeof start === "undefined") { start = 0; }
		else if (start >= this.length) { return this; }

		if (typeof count === "undefined") { count = 0; }
		else if (count < 0) { count = Math.abs(count); }

		var res = this.slice(0, start);

		if (typeof replacement !== "undefined")
		{
			res += replacement;
		}
		if (start >= 0 || (start + count) < 0)
		{
			res += this.slice(start + count);
		}

		return res;
	};
}

/**
 * Returns a string with all whitespace removed from both sides of the base string
 */
if (!String.prototype.trim)
{
	String.prototype.trim = function ()
	{
		//return this.replace(/^\s+/, "").replace(/\s+$/, "");
		return this.replace(/^\s+|\s+$/g, "");
	};
}

/**
 * Returns a string with all whitespace removed from the left side of the base string
 */
if (!String.prototype.ltrim)
{
	String.prototype.ltrim = function ()
	{
		return this.replace(/^\s+/, "");
	};
}

/**
 * Returns a string with all whitespace removed from the right side of the base string
 */
if (!String.prototype.rtrim)
{
	String.prototype.rtrim = function ()
	{
		return this.replace(/\s+$/, "");
	};
}

/**
 * If Object.create isn't already defined, we just do the simple shim, without the second argument, since that's all we need here
 */
if (!Object.create)
{
	Object.create = (function ()
	{
		function F(){}

		return function (o)
		{
			if (arguments.length !== 1)
			{
				throw new Error("Object.create (polyfill) implementation only accepts one parameter.");
			}
			F.prototype = o;
			return new F();
		};
	}());
}


/***********************************************************************************************************************
** [End polyfills.js]
***********************************************************************************************************************/
