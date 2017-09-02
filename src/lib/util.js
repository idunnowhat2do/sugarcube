/***********************************************************************************************************************

	lib/util.js

	Copyright © 2013–2017 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Has, Scripting */

var Util = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		Type Functions.
	*******************************************************************************************************************/
	/*
 		Returns a pseudo-enumeration created from the given object.
 	*/
 	function utilToEnum(obj) {
 		return Object.freeze(Object.assign(Object.create(null), obj));
 	}

	/*
		Returns the value of the `@@toStringTag` property of the given object.

		NOTE: In ≤ES5, returns the value of the `[[Class]]` internal slot.
	*/
	function utilToStringTag(obj) {
		return Object.prototype.toString.call(obj).slice(8, -1);
	}

	/*
		Returns whether the passed value is a finite number or a numeric string which
		yields a finite number when parsed.
	*/
	function utilIsNumeric(obj) {
		let num;

		switch (typeof obj) {
		case 'number':
			num = obj;
			break;

		case 'string':
			num = Number(obj);
			break;

		default:
			return false;
		}

		return !Number.isNaN(num) && Number.isFinite(num);
	}

	/*
		Returns whether the passed value is a boolean or one of the strings "true"
		or "false".
	*/
	function utilIsBoolean(obj) {
		return typeof obj === 'boolean' || typeof obj === 'string' && (obj === 'true' || obj === 'false');
	}


	/*******************************************************************************************************************
		String Encoding Functions.
	*******************************************************************************************************************/
	/*
		Returns a lowercased and hyphen encoded version of the passed string.
	*/
	function utilSlugify(str) {
		return String(str)
			.trim()
			.replace(/[^\w\s\u2013\u2014-]+/g, '')
			.replace(/[_\s\u2013\u2014-]+/g, '-')
			.toLocaleLowerCase();
	}

	/*
		Returns an entity encoded version of the passed string.

		NOTE: Only escapes the five primary special characters and the backquote.
	*/
	const _htmlCharsRe    = /[&<>"'`]/g;
	const _hasHtmlCharsRe = new RegExp(_htmlCharsRe.source); // to drop the global flag
	const _htmlCharsMap   = Object.freeze({
		'&' : '&amp;',
		'<' : '&lt;',
		'>' : '&gt;',
		'"' : '&quot;',
		"'" : '&#39;',
		'`' : '&#96;'
	});

	function utilEscape(str) {
		if (str == null) { // lazy equality for null
			return '';
		}

		const val = String(str);
		return val && _hasHtmlCharsRe.test(val)
			? val.replace(_htmlCharsRe, ch => _htmlCharsMap[ch])
			: val;
	}

	/*
		Returns a decoded version of the passed entity encoded string.

		NOTE: The extended replacement set here, in contrast to `utilEscape()`,
		      is required due to observed stupidity from various sources.
	*/
	const _escapedHtmlRe    = /&(?:amp|#38|#x26|lt|#60|#x3c|gt|#62|#x3e|quot|#34|#x22|apos|#39|#x27|#96|#x60);/gi;
	const _hasEscapedHtmlRe = new RegExp(_escapedHtmlRe.source, 'i'); // to drop the global flag
	const _escapedHtmlMap   = Object.freeze({
		'&amp;'  : '&', // ampersand (HTML character entity, XML predefined entity)
		'&#38;'  : '&', // ampersand (decimal numeric character reference)
		'&#x26;' : '&', // ampersand (hexadecimal numeric character reference)
		'&lt;'   : '<', // less-than (HTML character entity, XML predefined entity)
		'&#60;'  : '<', // less-than (decimal numeric character reference)
		'&#x3c;' : '<', // less-than (hexadecimal numeric character reference)
		'&gt;'   : '>', // greater-than (HTML character entity, XML predefined entity)
		'&#62;'  : '>', // greater-than (decimal numeric character reference)
		'&#x3e;' : '>', // greater-than (hexadecimal numeric character reference)
		'&quot;' : '"', // double quote (HTML character entity, XML predefined entity)
		'&#34;'  : '"', // double quote (decimal numeric character reference)
		'&#x22;' : '"', // double quote (hexadecimal numeric character reference)
		'&apos;' : "'", // apostrophe (XML predefined entity)
		'&#39;'  : "'", // apostrophe (decimal numeric character reference)
		'&#x27;' : "'", // apostrophe (hexadecimal numeric character reference)
		'&#96;'  : '`', // backquote (decimal numeric character reference)
		'&#x60;' : '`'  // backquote (hexadecimal numeric character reference)
	});

	function utilUnescape(str) {
		if (str == null) { // lazy equality for null
			return '';
		}

		const val = String(str);
		return val && _hasEscapedHtmlRe.test(val)
			? val.replace(_escapedHtmlRe, entity => _escapedHtmlMap[entity.toLowerCase()])
			: val;
	}

	/*
		Returns an object (`{ char, start, end }`) containing the Unicode character at
		position `pos`, its starting position, and its ending position—surrogate pairs
		are properly handled.  If `pos` is out-of-bounds, returns an object containing
		the empty string and start/end positions of `-1`.

		This function is necessary because JavaScript strings are sequences of UTF-16
		code units, so surrogate pairs are exposed and thus must be handled.  While the
		ES6/2015 standard does improve the situation somewhat, it does not alleviate
		the need for this function.

		NOTE: Returns the individual code units of invalid surrogate pairs as-is.

		IDEA: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charAt
	*/
	function utilCharAndPosAt(text, position) {
		const str  = String(text);
		const pos  = Math.trunc(position);
		const code = str.charCodeAt(pos);

		// Given position was out-of-bounds.
		if (Number.isNaN(code)) {
			return { char : '', start : -1, end : -1 };
		}

		const retval = {
			char  : str.charAt(pos),
			start : pos,
			end   : pos
		};

		// Code unit is not a UTF-16 surrogate.
		if (code < 0xD800 || code > 0xDFFF) {
			return retval;
		}

		// Code unit is a high surrogate (D800–DBFF).
		if (code >= 0xD800 && code <= 0xDBFF) {
			const nextPos = pos + 1;

			// End of string.
			if (nextPos >= str.length) {
				return retval;
			}

			const nextCode = str.charCodeAt(nextPos);

			// Next code unit is not a low surrogate (DC00–DFFF).
			if (nextCode < 0xDC00 || nextCode > 0xDFFF) {
				return retval;
			}

			retval.char = retval.char + str.charAt(nextPos);
			retval.end = nextPos;
			return retval;
		}

		// Code unit is a low surrogate (DC00–DFFF) in the first position.
		if (pos === 0) {
			return retval;
		}

		const prevPos  = pos - 1;
		const prevCode = str.charCodeAt(prevPos);

		// Previous code unit is not a high surrogate (D800–DBFF).
		if (prevCode < 0xD800 || prevCode > 0xDBFF) {
			return retval;
		}

		retval.char = str.charAt(prevPos) + retval.char;
		retval.start = prevPos;
		return retval;
	}


	/*******************************************************************************************************************
		Time Functions.
	*******************************************************************************************************************/
	/*
		Returns the number of milliseconds elapsed since a reference instant.

		NOTE: Use the Performance API, if available, elsewise use Date as a
		      failover.  The Performance API is preferred for its monotonic
		      clock—meaning, it's not subject to the vagaries of timezone
		      changes and time leaps, as is Date.
	*/
	function utilNow() {
		return (Has.performance ? performance : Date).now();
	}


	/*******************************************************************************************************************
		Conversion Functions.
	*******************************************************************************************************************/
	/*
		Returns the number of miliseconds represented by the passed CSS time string.
	*/
	function utilFromCssTime(cssTime) {
		const re    = /^([+-]?(?:\d*\.)?\d+)([Mm]?[Ss])$/;
		const match = re.exec(String(cssTime));

		if (match === null) {
			throw new SyntaxError(`invalid time value syntax: "${cssTime}"`);
		}

		let msec = Number(match[1]);

		if (/^[Ss]$/.test(match[2])) {
			msec *= 1000;
		}

		if (Number.isNaN(msec) || !Number.isFinite(msec)) {
			throw new RangeError(`invalid time value: "${cssTime}"`);
		}

		return msec;
	}

	/*
		Returns the CSS time string represented by the passed number of milliseconds.
	*/
	function utilToCssTime(msec) {
		if (typeof msec !== 'number' || Number.isNaN(msec) || !Number.isFinite(msec)) {
			let what;

			switch (typeof msec) {
			case 'string':
				what = `"${msec}"`;
				break;

			case 'number':
				what = String(msec);
				break;

			default:
				what = Object.prototype.toString.call(msec);
				break;
			}

			throw new Error(`invalid milliseconds: ${what}`);
		}

		return `${msec}ms`;
	}

	/*
		Returns the DOM property name represented by the passed CSS property name.
	*/
	function utilFromCssProperty(cssName) {
		if (!cssName.includes('-')) {
			switch (cssName) {
			case 'bgcolor': return 'backgroundColor';
			case 'float':   return 'cssFloat';
			default:        return cssName;
			}
		}

		// Strip the leading hyphen from the `-ms-` vendor prefix, so it stays lowercased.
		const normalized = cssName.slice(0, 4) === '-ms-' ? cssName.slice(1) : cssName;

		return normalized
			.split('-')
			.map((part, i) => i === 0 ? part : part.toUpperFirst())
			.join('');
	}

	/*
		Returns an object containing the component properties parsed from the passed URL.
	*/
	function utilParseUrl(url) {
		const el       = document.createElement('a');
		const queryObj = Object.create(null);

		// Let the `<a>` element parse the URL.
		el.href = url;

		// Populate the `queryObj` object with the query string attributes.
		if (el.search) {
			el.search
				.replace(/^\?/, '')
				.splitOrEmpty(/(?:&(?:amp;)?|;)/)
				.forEach(query => {
					const [key, value] = query.split('=');
					queryObj[key] = value;
				});
		}

		/*
			Caveats by browser:
				Edge and Internet Explorer (≥8) do not support authentication information
				within a URL at all and will throw a security exception on *any* property
				access if its included.

				Internet Explorer does not include the leading forward slash on `pathname`
				when required.

				Opera (Presto) strips the authentication information from `href` and does
				not supply `username` or `password`.

				Safari (circa. 5.1.x) does not supply `username` or `password` and peforms
				URI decoding on `pathname`.
		*/

		// Patch for IE not including the leading slash on `pathname` when required.
		const pathname = el.host && el.pathname[0] !== '/' ? `/${el.pathname}` : el.pathname;

		return {
			// The full URL that was originally parsed.
			href : el.href,

			// The request protocol, lowercased.
			protocol : el.protocol,

			// // The full authentication information.
			// auth : el.username || el.password // eslint-disable-line no-nested-ternary
			// 	? `${el.username}:${el.password}`
			// 	: typeof el.username === 'string' ? '' : undefined,
			//
			// // The username portion of the auth info.
			// username : el.username,
			//
			// // The password portion of the auth info.
			// password : el.password,

			// The full host information, including port number, lowercased.
			host : el.host,

			// The hostname portion of the host info, lowercased.
			hostname : el.hostname,

			// The port number portion of the host info.
			port : el.port,

			// The full path information, including query info.
			path : `${pathname}${el.search}`,

			// The pathname portion of the path info.
			pathname,

			// The query string portion of the path info, including the leading question mark.
			query  : el.search,
			search : el.search,

			// The attributes portion of the query string, parsed into an object.
			queries  : queryObj,
			searches : queryObj,

			// The fragment string, including the leading hash/pound sign.
			hash : el.hash
		};
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Type Functions.
		*/
		toEnum      : { value : utilToEnum },
		toStringTag : { value : utilToStringTag },
		isNumeric   : { value : utilIsNumeric },
		isBoolean   : { value : utilIsBoolean },

		/*
			String Encoding Functions.
		*/
		slugify      : { value : utilSlugify },
		escape       : { value : utilEscape },
		unescape     : { value : utilUnescape },
		charAndPosAt : { value : utilCharAndPosAt },

		/*
			Conversion Functions.
		*/
		fromCssTime     : { value : utilFromCssTime },
		toCssTime       : { value : utilToCssTime },
		fromCssProperty : { value : utilFromCssProperty },
		parseUrl        : { value : utilParseUrl },

		/*
			Time Functions.
		*/
		now : { value : utilNow },

		/*
			Legacy Aliases.
		*/
		random         : { value : Math.random },
		entityEncode   : { value : utilEscape },
		entityDecode   : { value : utilUnescape },
		evalExpression : { value : (...args) => Scripting.evalJavaScript(...args) }, // SEE: `markup/scripting.js`.
		evalStatements : { value : (...args) => Scripting.evalJavaScript(...args) }  // SEE: `markup/scripting.js`.
	}));
})();
