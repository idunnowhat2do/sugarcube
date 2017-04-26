/***********************************************************************************************************************

	markup/patterns.js

	Copyright © 2013–2017 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	TODO: Move all markup patterns into here.
*/

var Patterns = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Some versions of Safari do not handle Unicode properly.
	const _unicodeOk = /[\u0150\u0170]/g.test('\u0150');


	/*******************************************************************************************************************
		Patterns.
	*******************************************************************************************************************/
	/*
		Whitespace patterns.

		Space class:
			\s === [\u0020\f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
		Space class, sans line terminators:
			[\u0020\f\t\v\u00a0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]
		Line Terminator class:
			[\n\r\u2028\u2029]
	*/
	const space = (() => {
		/*
			Some browsers still supported by SugarCube have faulty space classes (`\s`).
			We check for that lossage here and, if necessary, build our own space class
			from the component pieces.
		*/
		const reSpaceMap = new Map([
			['\u0020', '\\u0020'],
			['\f', '\\f'],
			['\n', '\\n'],
			['\r', '\\r'],
			['\t', '\\t'],
			['\v', '\\v'],
			['\u00a0', '\\u00a0'],
			['\u1680', '\\u1680'],
			['\u180e', '\\u180e'],
			['\u2000', '\\u2000'],
			['\u2001', '\\u2001'],
			['\u2002', '\\u2002'],
			['\u2003', '\\u2003'],
			['\u2004', '\\u2004'],
			['\u2005', '\\u2005'],
			['\u2006', '\\u2006'],
			['\u2007', '\\u2007'],
			['\u2008', '\\u2008'],
			['\u2009', '\\u2009'],
			['\u200a', '\\u200a'],
			['\u2028', '\\u2028'],
			['\u2029', '\\u2029'],
			['\u202f', '\\u202f'],
			['\u205f', '\\u205f'],
			['\u3000', '\\u3000'],
			['\ufeff', '\\ufeff']
		]);
		const spaceRe = /\s/;
		let missing = '';

		reSpaceMap.forEach((pat, char) => {
			if (!spaceRe.test(char)) {
				missing += pat;
			}
		});

		return missing ? `[\\s${missing}]` : '\\s';
	})();
	const spaceNoTerminator = '[\\u0020\\f\\t\\v\\u00a0\\u1680\\u180e\\u2000-\\u200a\\u202f\\u205f\\u3000\\ufeff]';
	const lineTerminator    = '[\\n\\r\\u2028\\u2029]';

	// Character patterns.
	// FIXME: Should we include surrogate pairs ('\\uD800-\\uDFFF') within `anyLetter`?
	const anyLetter       = `[0-9A-Z_a-z\\-\\u00C0-\\u00D6\\u00D8-\\u00DE\\u00DF-\\u00F6\\u00F8-\\u00FF${_unicodeOk ? '\\u0150\\u0170\\u0151\\u0171' /* Surrogates? */ : ''}]`;
	const anyLetterStrict = anyLetter.replace('\\-', ''); // anyLetter sans hyphens

	/*
		Identifier patterns.

		These are kludges.  Since JavaScript's RegExp syntax isn't fully Unicode-enabled,
		not supporting Unicode character classes, the correct regular expression to match
		a valid identifier (within the scope of our needs) would be on the order of 11 kB.
		That being the case, for the time being, we restrict valid TwineScript identifiers
		to US-ASCII.

		FIXME: Fix this to, at least, approximate the correct range.
	*/
	const identifierFirstChar = '[$A-Z_a-z]';
	const identifier          = `${identifierFirstChar}[$0-9A-Z_a-z]*`;

	// Variable patterns.
	const variableSigil = '[$_]';
	const variable      = variableSigil + identifier;

	// Macro name pattern.
	const macroName = '[A-Za-z][\\w-]*|[=-]';

	// Inline CSS pattern.
	const _twStyle   = `(${anyLetter}+)\\(([^\\)\\|\\n]+)\\):`; // [1,2]=style(value):
	const _cssStyle  = `(${anyLetter}+):([^;\\|\\n]+);`;        // [3,4]=style:value;
	const _className = `((?:\\.${anyLetter}+)+);`;              // [5]  =.className;
	const _idName    = `((?:#${anyLetter}+)+);`;                // [6]  =#id;
	const inlineCss  = `${_twStyle}|${_cssStyle}|${_className}|${_idName}`;

	// URL pattern.
	/*
		TODO: The end of this pattern `(?:/|\\b)` should be unnecessary, so comment it
		      out for now and, if no one complains, remove it later.

		const url = '(?:file|https?|mailto|ftp|javascript|irc|news|data):[^\\s\'"]+(?:/|\\b)';
	*/
	const url = '(?:file|https?|mailto|ftp|javascript|irc|news|data):[^\\s\'"]+';


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze({
		space,
		spaceNoTerminator,
		lineTerminator,
		anyLetter,
		anyLetterStrict,
		identifierFirstChar,
		identifier,
		variableSigil,
		variable,
		macroName,
		inlineCss,
		url
	});
})();
