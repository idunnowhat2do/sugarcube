/***********************************************************************************************************************
 *
 * markup/patterns.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	TODO: Move all markup patterns into here.
*/

var Patterns = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const
		// Some versions of Safari do not handle Unicode properly.
		_unicodeOk = /[\u0150\u0170]/g.test('\u0150');


	/*******************************************************************************************************************
	 * Patterns.
	 ******************************************************************************************************************/
	const
		// whitespace patterns.
		space = '[\\s\\u00A0\\u2028\\u2029]', // Unicode space-character escapes required for IE < 11 (maybe < 10?)

		// Character patterns.
		// FIXME: Should we include surrogate pairs ('\\uD800-\\uDFFF') within `anyLetter`?
		anyLetter       = `[0-9A-Z_a-z\\-\\u00C0-\\u00D6\\u00D8-\\u00DE\\u00DF-\\u00F6\\u00F8-\\u00FF${_unicodeOk ? '\\u0150\\u0170\\u0151\\u0171' /* Surrogates? */ : ''}]`,
		anyLetterStrict = anyLetter.replace('\\-', ''), // anyLetter sans hyphens

		/*
			Identifier patterns.

			These are kludges.  Since JavaScript's RegExp syntax isn't fully Unicode-enabled,
			not supporting Unicode character classes, the correct regular expression to match
			a valid identifier (within the scope of our needs) would be on the order of 11 kB.
			That being the case, for the time being, we restrict valid TwineScript identifiers
			to US-ASCII.

			FIXME: Fix this to, at least, approximate the correct range.
		*/
		identifierFirstChar = '[$A-Z_a-z]',
		identifier          = `${identifierFirstChar}[$0-9A-Z_a-z]*`,

		// Variable patterns.
		variableSigil = '[$_]',
		variable      = variableSigil + identifier,

		// Inline CSS pattern.
		_twStyle   = `(${anyLetter}+)\\(([^\\)\\|\\n]+)\\):`, // [1,2]=style(value):
		_cssStyle  = `(${anyLetter}+):([^;\\|\\n]+);`,        // [3,4]=style:value;
		_className = `((?:\\.${anyLetter}+)+);`,              // [5]  =.className;
		_idName    = `((?:#${anyLetter}+)+);`,                // [6]  =#id;
		inlineCss  = `${_twStyle}|${_cssStyle}|${_className}|${_idName}`,

		// URL pattern.
		/*
			TODO: The end of this pattern `(?:/|\\b)` should be unnecessary, so comment it
			      out for now and, if no one complains, remove it later.

			url = '(?:file|https?|mailto|ftp|javascript|irc|news|data):[^\\s\'"]+(?:/|\\b)';
		*/
		url = '(?:file|https?|mailto|ftp|javascript|irc|news|data):[^\\s\'"]+';


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze({
		space,
		anyLetter,
		anyLetterStrict,
		identifierFirstChar,
		identifier,
		variableSigil,
		variable,
		inlineCss,
		url
	});
})();
