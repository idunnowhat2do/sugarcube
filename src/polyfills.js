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
if(typeof document!=="undefined"&&!("classList" in document.createElement("a"))){(function(j){if(!("HTMLElement" in j)&&!("Element" in j)){return}var a="classList",f="prototype",m=(j.HTMLElement||j.Element)[f],b=Object,k=String[f].trim||function(){return this.replace(/^\s+|\s+$/g,"")},c=Array[f].indexOf||function(q){var p=0,o=this.length;for(;p<o;p++){if(p in this&&this[p]===q){return p}}return -1},n=function(o,p){this.name=o;this.code=DOMException[o];this.message=p},g=function(p,o){if(o===""){throw new n("SYNTAX_ERR","An invalid or illegal string was specified")}if(/\s/.test(o)){throw new n("INVALID_CHARACTER_ERR","String contains an invalid character")}return c.call(p,o)},d=function(s){var r=k.call(s.className),q=r?r.split(/\s+/):[],p=0,o=q.length;for(;p<o;p++){this.push(q[p])}this._updateClassName=function(){s.className=this.toString()}},e=d[f]=[],i=function(){return new d(this)};n[f]=Error[f];e.item=function(o){return this[o]||null};e.contains=function(o){o+="";return g(this,o)!==-1};e.add=function(){var s=arguments,r=0,p=s.length,q,o=false;do{q=s[r]+"";if(g(this,q)===-1){this.push(q);o=true}}while(++r<p);if(o){this._updateClassName()}};e.remove=function(){var t=arguments,s=0,p=t.length,r,o=false;do{r=t[s]+"";var q=g(this,r);if(q!==-1){this.splice(q,1);o=true}}while(++s<p);if(o){this._updateClassName()}};e.toggle=function(p,q){p+="";var o=this.contains(p),r=o?q!==true&&"remove":q!==false&&"add";if(r){this[r](p)}return !o};e.toString=function(){return this.join(" ")};if(b.defineProperty){var l={get:i,enumerable:true,configurable:true};try{b.defineProperty(m,a,l)}catch(h){if(h.number===-2146823252){l.enumerable=false;b.defineProperty(m,a,l)}}}else{if(b[f].__defineGetter__){m.__defineGetter__(a,i)}}}(window))};

/**
 * onhashchange
 */
(function(window) {

	// exit if the browser implements the event
	console.log("[polyfill: window.onhashchange]");
	if ("onhashchange" in window) { return; }
	console.log("    > window.onhashchange not natively supported; polyfilling...");

	var   location = window.location
		, oldURL   = location.href
		, oldHash  = location.hash;

	// check the location hash on a 200ms interval
	setInterval(function() {
		var   newURL  = location.href
			, newHash = location.hash;

		// if a handler has been bound and the hash has changed...
		if (typeof window.onhashchange === "function" && newHash !== oldHash)
		{
			// then, call the handler
			window.onhashchange({
				  type  : "hashchange"
				, oldURL: oldURL
				, newURL: newURL
			});

			// finally, update the state vars
			  oldURL  = newURL
			, oldHash = newHash;
		}
	}, 200);

}(window));


/***********************************************************************************************************************
** [Polyfills, Piecemeal]
***********************************************************************************************************************/
/**
 * the value of the element, the index of the element, and the Array object being traversed
 */
if (!Array.prototype.filter)
{
	Array.prototype.filter = function (fun /*, thisp*/)
	{
		"use strict";

		if (this == null || typeof fun != "function")
		{
			throw new TypeError();
		}

		var t = Object(this);
		var len = t.length >>> 0;
		var res = [];
		var thisp = arguments[1];
		for (var i = 0; i < len; i++)
		{
			if (i in t)
			{
				var val = t[i]; // in case fun mutates this
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
 * Works like String.indexOf
 */
if (!Array.prototype.indexOf)
{
	Array.prototype.indexOf = function (item, from)
	{
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
 * Returns a copy of the base string with 'count' characters replaced with 'str', starting at 'at'
 */
if (!String.prototype.splice)
{
	String.prototype.splice = function(at, count, str)
	{
		return (this.slice(0, at) + str + this.slice(at + Math.abs(count)));
	};
}

/**
 * Returns a string with all whitespace removed from both sides of the base string
 */
if (!String.prototype.trim)
{
	String.prototype.trim = function ()
	{
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
		return this.replace(/^\s+/g, "");
	};
}

/**
 * Returns a string with all whitespace removed from the right side of the base string
 */
if (!String.prototype.rtrim)
{
	String.prototype.rtrim = function ()
	{
		return this.replace(/\s+$/g, "");
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
