/***********************************************************************************************************************
** [Begin utility.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Libraries]
***********************************************************************************************************************/
/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
var saveAs=saveAs||navigator.msSaveBlob&&navigator.msSaveBlob.bind(navigator)||function(e){"use strict";var t=e.document,n=function(){return e.URL||e.webkitURL||e},r=e.URL||e.webkitURL||e,i=t.createElementNS("http://www.w3.org/1999/xhtml","a"),s="download"in i,o=function(n){var r=t.createEvent("MouseEvents");r.initMouseEvent("click",true,false,e,0,0,0,0,0,false,false,false,false,0,null);n.dispatchEvent(r)},u=e.webkitRequestFileSystem,a=e.requestFileSystem||u||e.mozRequestFileSystem,f=function(t){(e.setImmediate||e.setTimeout)(function(){throw t},0)},l="application/octet-stream",c=0,h=[],p=function(){var e=h.length;while(e--){var t=h[e];if(typeof t==="string"){r.revokeObjectURL(t)}else{t.remove()}}h.length=0},d=function(e,t,n){t=[].concat(t);var r=t.length;while(r--){var i=e["on"+t[r]];if(typeof i==="function"){try{i.call(e,n||e)}catch(s){f(s)}}}},v=function(t,r){var f=this,p=t.type,v=false,m,g,y=function(){var e=n().createObjectURL(t);h.push(e);return e},b=function(){d(f,"writestart progress write writeend".split(" "))},w=function(){if(v||!m){m=y(t)}if(g){g.location.href=m}else{window.open(m,"_blank")}f.readyState=f.DONE;b()},E=function(e){return function(){if(f.readyState!==f.DONE){return e.apply(this,arguments)}}},S={create:true,exclusive:false},x;f.readyState=f.INIT;if(!r){r="download"}if(s){m=y(t);i.href=m;i.download=r;o(i);f.readyState=f.DONE;b();return}if(e.chrome&&p&&p!==l){x=t.slice||t.webkitSlice;t=x.call(t,0,t.size,l);v=true}if(u&&r!=="download"){r+=".download"}if(p===l||u){g=e}if(!a){w();return}c+=t.size;a(e.TEMPORARY,c,E(function(e){e.root.getDirectory("saved",S,E(function(e){var n=function(){e.getFile(r,S,E(function(e){e.createWriter(E(function(n){n.onwriteend=function(t){g.location.href=e.toURL();h.push(e);f.readyState=f.DONE;d(f,"writeend",t)};n.onerror=function(){var e=n.error;if(e.code!==e.ABORT_ERR){w()}};"writestart progress write abort".split(" ").forEach(function(e){n["on"+e]=f["on"+e]});n.write(t);f.abort=function(){n.abort();f.readyState=f.DONE};f.readyState=f.WRITING}),w)}),w)};e.getFile(r,{create:false},E(function(e){e.remove();n()}),E(function(e){if(e.code===e.NOT_FOUND_ERR){n()}else{w()}}))}),w)}),w)},m=v.prototype,g=function(e,t){return new v(e,t)};m.abort=function(){var e=this;e.readyState=e.DONE;d(e,"abort")};m.readyState=m.INIT=0;m.WRITING=1;m.DONE=2;m.error=m.onwritestart=m.onprogress=m.onwrite=m.onabort=m.onerror=m.onwriteend=null;e.addEventListener("unload",p,false);return g}(self)


/***********************************************************************************************************************
** [Global Object/Prototype Extensions] (ad hoc extensions to global objects and prototypes is a BAD IDEA!)
***********************************************************************************************************************/
/**
 * Returns a decimal number eased from 0 to 1
 */
Math.easeInOut = function (i)
{
	return (1 - ((Math.cos(i * Math.PI) + 1) / 2));
};

/**
 * Returns the passed numerical clamped to the specified bounds
 */
Math.clamp = function (num, min, max)
{
	num = Number(num);

	return isNaN(num) ? NaN : num.clamp(min, max);
};

/**
 * Returns the number clamped to the specified bounds
 */
Number.prototype.clamp = function (min, max)
{
	var num = Number(this);

	if (num < min) { num = min; }
	if (num > max) { num = max; }

	return num;
};

/**
 * Returns an array of link titles, parsed from the string
 *   n.b. Unused in SugarCube, only included for compatibility
 */
String.prototype.readBracketedList = function ()
{
	// RegExp groups: Double-square-bracket quoted | Unquoted
	var   pattern = "(?:\\[\\[((?:\\s|\\S)*?)\\]\\])|([^\"'\\s]\\S*)"	//"(?:\\[\\[([^\\]]+)\\]\\])|([^\\s$]+)"
		, re      = new RegExp(pattern, "gm")
		, names   = [];
	do
	{
		var match = re.exec(this);
		if (match)
		{
			// Double-square-bracket quoted
			if (match[1])
			{
				names.push(match[1]);
			}

			// Unquoted
			else if (match[2])
			{
				names.push(match[2]);
			}
		}
	} while (match);
	return names;
};


/***********************************************************************************************************************
** [Function Library]
***********************************************************************************************************************/
/**
 * Returns whether the passed value is numeric
 */
function isNumeric(obj)
{
	return typeof obj === "number" || (!isNaN(parseFloat(obj)) && isFinite(obj));
}

/**
 * Returns whether the passed value is boolean-ish
 */
function isBoolean(obj)
{
	return typeof obj === "boolean" || (typeof obj === "string" && (obj === "true" || obj === "false"));
}

/**
 * Returns the DOM element corresponding to the passed ID or null on failure
 */
function $(id)
{
	return (typeof id == "string") ? document.getElementById(id) : null;
}

/**
 * Returns a shallow copy of the passed object
 *   n.b. Unused in SugarCube, only included for compatibility
 */
function clone(original)
{
	var clone = {};
	for (var property in original)
	{
		clone[property] = original[property];
	}
	return clone;
}

/**
 * Returns a deep copy of the passed object
 */
function deepCopy(orig)
{
	if (orig === null || typeof orig != 'object')
	{
		return orig;
	}

	// Honor native/custom clone methods
	if (typeof orig.clone == 'function')
	{
		return orig.clone(true);
	}

	// Special cases:
	// Date
	if (orig instanceof Date)
	{
		return new Date(orig.getTime());
	}
	// RegExp
	if (orig instanceof RegExp)
	{
		return new RegExp(orig);
	}
	// DOM Elements
	if (orig.nodeType && typeof orig.cloneNode == 'function')
	{
		return orig.cloneNode(true);
	}

	// If we've reached here, we have a regular object, array, or function
	if (Array.isArray(orig))
	{
		var ret = [];

		for (var i = 0; i < orig.length; i++)
		{
			// Note: this does NOT preserve ES5 property attributes like 'writable', 'enumerable', etc.
			// That could be achieved by using Object.getOwnPropertyNames and Object.defineProperty
			ret.push(deepCopy(orig[i]));
		}
	}
	else
	{
		// Make sure the returned object has the same prototype as the original
		var proto = (Object.getPrototypeOf ? Object.getPrototypeOf(orig) : orig.__proto__);
		if (!proto)
		{
			proto = orig.constructor.prototype;	//this line would probably only be reached by very old browsers
		}
		var ret = Object.create(proto);

		for (var key in orig)
		{
			// Note: this does NOT preserve ES5 property attributes like 'writable', 'enumerable', etc.
			// That could be achieved by using Object.getOwnPropertyNames and Object.defineProperty
			ret[key] = deepCopy(orig[key]);
		}
	}
	return ret;
}

/**
 * Returns the new DOM element, optionally appending it to the passed DOM element (if any)
 */
function insertElement(place, type, id, className, text)
{
	var el = document.createElement(type);

	if (id)
	{
		el.id = id;
	}
	if (className)
	{
		el.className = className;
	}
	if (text)
	{
		insertText(el, text);
	}
	if (place)
	{
		place.appendChild(el);
	}
	return el;
}

/**
 * Returns the new <a> element, optionally appending it to the passed DOM element (if any)
 */
function insertPassageLink(place, passage, text, classNames)
{
	var el = document.createElement("a");

	el.className = tale.has(passage) ? "internalLink" : "brokenLink";
	if (classNames)
	{
		el.className += " " + classNames;
	}
	if (passage)
	{
		el.setAttribute("data-passage", passage);
	}
	if (text)
	{
		insertText(el, text);
	}
	if (place)
	{
		place.appendChild(el);
	}
	return el;
}

/**
 * Returns the new DOM element, after appending it to the passed DOM element
 */
function insertText(place, text)
{
	return place.appendChild(document.createTextNode(text));
}

/**
 * Removes all children from the passed DOM element
 */
function removeChildren(el)
{
	while (el.hasChildNodes())
	{
		el.removeChild(el.firstChild);
	}
}

/**
 * Wikifies a passage into a DOM element corresponding to the passed ID
 */
function setPageElement(id, title, defaultText)
{
	var place = $(id);
	if (place)
	{
		removeChildren(place);
		if (tale.has(title))
		{
			new Wikifier(place, tale.get(title).text);
		}
		else if (defaultText != null && defaultText !== "")	// use != to catch both null & undefined
		{
			new Wikifier(place, defaultText);
		}
	}
}

/**
 * Appends a new <style> element to the document's <head>
 */
function addStyle(css)
{
	var head = (document.head || document.getElementsByTagName('head')[0]);
	if (document.createStyleSheet)
	{
		// old IE browsers
		head.insertAdjacentHTML("beforeEnd", "\u00a0<style>" + css + "</style>");
	}
	else
	{
		// modern, hopefully, browsers
		var style = document.createElement("style");
		style.type = "text/css";
		if (style.styleSheet)
		{
			style.styleSheet.cssText = css;
		}
		else
		{
			style.appendChild(document.createTextNode(css));
		}
		head.appendChild(style);
	}
}

/**
 * Appends an error message to the passed DOM element
 */
function throwError(place, message)
{
	insertElement(place, "span", null, "error", "Error: " + message);
 }

/**
 * Fades a DOM element in or out
 *   n.b. Unused in SugarCube, only included for compatibility
 */
function fade(el, options)
{
	var current;
	var proxy = el.cloneNode(true);
	var direction = (options.fade == "in") ? 1 : -1;
	el.parentNode.replaceChild(proxy, el);
	if (options.fade == "in")
	{
		current = 0;
		proxy.style.visibility = "visible"
	}
	else
	{
		current = 1;
	}
	setOpacity(proxy, current);
	var interval = window.setInterval(tick, 25);

	function tick()
	{
		current += 0.05 * direction;
		setOpacity(proxy, Math.easeInOut(current));
		if (((direction == 1) && (current >= 1)) || ((direction == -1) && (current <= 0)))
		{
			el.style.visibility = (options.fade == "in") ? "visible" : "hidden";
			proxy.parentNode.replaceChild(el, proxy);
			proxy = null;
			window.clearInterval(interval);
			if (options.onComplete)
			{
				options.onComplete();
			}
		}
	}
	function setOpacity(el, opacity)
	{
		var l = Math.floor(opacity * 100);

		// old IE
		el.style.zoom = 1;
		el.style.filter = "alpha(opacity=" + l + ")";

		// CSS
		el.style.opacity = opacity;
	}
}

/**
 * Scrolls the browser window to ensure that a DOM element is in view
 */
function scrollWindowTo(el)
{
	function tick()
	{
		progress += 0.1;
		window.scrollTo(0, start + direction * (distance * Math.easeInOut(progress)));
		if (progress >= 1)
		{
			window.clearInterval(interval);
		}
	}
	function findPosY(el)
	{
		var curtop = 0;
		while (el.offsetParent)
		{
			curtop += el.offsetTop;
			el = el.offsetParent;
		}
		return curtop;
	}
	function ensureVisible(el)
	{
		var   posTop    = findPosY(el)
			, posBottom = posTop + el.offsetHeight
			, winTop    = window.scrollY ? window.scrollY : body.scrollTop
			, winHeight = window.innerHeight ? window.innerHeight : body.clientHeight
			, winBottom = winTop + winHeight;
		if (posTop < winTop)
		{
			return posTop;
		}
		else
		{
			if (posBottom > winBottom)
			{
				if (el.offsetHeight < winHeight)
				{
					return (posTop - (winHeight - el.offsetHeight) + 20);
				}
				else
				{
					return posTop;
				}
			}
			else
			{
				return posTop;
			}
		}
	}

	var   body      = (document.body || document.getElementsByTagName('body')[0])
		, start     = window.scrollY ? window.scrollY : body.scrollTop
		, end       = ensureVisible(el)
		, distance  = Math.abs(start - end)
		, progress  = 0
		, direction = (start > end) ? -1 : 1
		, interval  = window.setInterval(tick, 25);
}

/**
 * Returns a lowercased and underscore encoded version of the passed string
 */
function slugify(str)
{
	return str
		.trim()
		.replace(/[^\w\s\u2013\u2014-]+/g, '')
		.replace(/[_\s\u2013\u2014-]+/g, '_')
		.toLocaleLowerCase();
}

/**
 * Returns a base64 encoding of the passed UTF-8 string
 */
function utf8ToBase64(str)
{
	return window.btoa(unescape(encodeURIComponent(str)));
}

/**
 * Returns a UTF-8 string from the passed base64 encoding
 */
function base64ToUtf8(str)
{
	return decodeURIComponent(escape(window.atob(str)));
}

/**
 * Returns a v4 Universally Unique IDentifier (UUID), a.k.a. Globally Unique IDentifier (GUID)
 *     [RFC4122] http://www.ietf.org/rfc/rfc4122.txt
 */
function generateUuid()
{
	/*
	// this version is vulnerable to bad Math.random() generators which can lead
	// to collisions (I'm looking at you Chrome)
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});
	*/

	// this version uses a combination of Math.random() and Date().getTime() to harden itself
	// against bad Math.random() generators and reduce the likelihood of a collision
	var d = new Date().getTime();
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = (d + Math.random()*16)%16 | 0;
		d = Math.floor(d/16);
		return (c === 'x' ? r : (r&0x7|0x8)).toString(16);
	});
}


/***********************************************************************************************************************
** [Storage Management]
***********************************************************************************************************************/
function KeyValueStore(storeName, storePrefix)
{
	this.store = null;
	switch (storeName)
	{
	case "cookie":
		this.name  = "cookie";
		break;
	case "localStorage":
		this.name  = storeName;
		if (config.hasLocalStorage)
		{
			this.store = window.localStorage;
		}
		break;
	case "sessionStorage":
		this.name  = storeName;
		if (config.hasSessionStorage)
		{
			this.store = window.sessionStorage;
		}
		break;
	default:
		throw new Error("Unknown storage type.");
		break;
	}
	this.prefix = storePrefix + ".";
}

KeyValueStore.prototype.setItem = function (sKey, sValue)
{
	if (!sKey) { return false; }

	var oKey = sKey;

	sKey = this.prefix + sKey;
	sValue = JSON.stringify(sValue);

	if (this.store)
	{
		try
		{
			this.store.setItem(sKey, sValue);
		}
		catch(e)
		{
			if (e == QUOTA_EXCEEDED_ERR)
			{
				window.alert("Unable to store key; " + this.name + " quota exceeded");
			}
			return false;
		}
	}
	else
	{
		var cookie = [ escape(sKey) + "=" + escape(sValue) ];
		// no expiry means a session cookie
		switch (this.name)
		{
		case "cookie":
			// fallthrough
		case "localStorage":
			cookie.push("expires=Tue, 19 Jan 2038 03:14:07 GMT");
			break;
		}
		cookie.push("path=/");
		try
		{
			console.log("    > setItem:cookie: " + cookie.join("; "));
			document.cookie = cookie.join("; ");
		}
		catch (e)
		{
			window.alert("Unable to store key; cookie error: " + e.message);
			return false;
		}
		if (!this.hasItem(oKey))
		{
			window.alert("Unable to store key; unknown cookie error");
			return false;
		}
	}
	return true;
};

KeyValueStore.prototype.getItem = function (sKey)
{
	if (!sKey) { return null; }

	sKey = this.prefix + sKey;

	if (this.store)
	{
		if (this.store.getItem(sKey))
		{
			return JSON.parse(this.store.getItem(sKey));
		}
	}
	else
	{
		sKey = escape(sKey);
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++)
		{
			var bits = cookies[i].split("=");
			if (bits[0].trim() === sKey)
			{
				return JSON.parse(unescape(bits[1]));
			}
		}
	}
	return null;
};

KeyValueStore.prototype.removeItem = function (sKey)
{
	if (!sKey) { return false; }

	sKey = this.prefix + sKey;

	if (this.store)
	{
		this.store.removeItem(sKey);
	}
	else
	{
		document.cookie = escape(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
	}
	return true;
};

KeyValueStore.prototype.removeMatchingItems = function (sKey)
{
	if (!sKey) { return false; }

	console.log("[<KeyValueStore>.removeMatchingItems()]");

	var matched = [];
	var keyRegexp = new RegExp(("^" + this.prefix + sKey).replace(/\./g, "\\.") + ".*");
	if (this.store)
	{
		for (var i = 0; i < this.store.length; i++)
		{
			var key = this.store.key(i);
			if (keyRegexp.test(key))
			{
				matched.push(key);
			}
		}
	}
	else
	{
		sKey = escape(sKey);
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++)
		{
			var bits = cookies[i].split("=");
			var key = bits[0].trim();
			if (keyRegexp.test(key))
			{
				matched.push(key);
			}
		}
	}
	for (var i = 0; i < matched.length; i++)
	{
		console.log("    > removing key: " + matched[i]);
		this.removeItem(matched[i]);
	}
	return true;
};

KeyValueStore.prototype.hasItem = function (sKey)
{
	if (!sKey) { return false; }

	sKey = this.prefix + sKey;

	if (this.store)
	{
		if (this.store.getItem(sKey))
		{
			return true;
		}
	}
	else
	{
		sKey = escape(sKey);
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++)
		{
			var bits = cookies[i].split("=");
			if (bits[0].trim() == sKey)
			{
				return true;
			}
		}
	}
	return false;
};


/***********************************************************************************************************************
** [End utility.js]
***********************************************************************************************************************/
