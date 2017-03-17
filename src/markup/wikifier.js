/***********************************************************************************************************************
 *
 * markup/wikifier.js
 *
 * Copyright © 2013–2017 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Config, Engine, Patterns, Scripting, State, Story, TempState, Util, convertBreaks
*/

/*
	TODO: The Wikifier, and associated code, could stand to receive a serious refactoring.
*/
/* eslint-disable max-len */
var Wikifier = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Wikifier call depth.
	let _callDepth = 0;


	/*******************************************************************************************************************
	 * Wikifier Class.
	 ******************************************************************************************************************/
	class Wikifier {
		constructor(destination, source, options) {
			if (Wikifier.Parser.Profile.isEmpty()) {
				Wikifier.Parser.Profile.compile();
			}

			Object.defineProperties(this, {
				// General Wikifier properties.
				source : {
					value : String(source)
				},

				options : {
					writable : true,
					value    : Object.assign({
						profile : 'all'
					}, options)
				},

				nextMatch : {
					writable : true,
					value    : 0
				},

				output : {
					writable : true,
					value    : null
				},

				// Macro parser ('macro') related properties.
				_rawArgs : {
					writable : true,
					value    : ''
				}
			});

			// No destination specified.  Create a fragment to act as the output buffer.
			if (destination == null) { // lazy equality for null
				this.output = document.createDocumentFragment();
			}

			// jQuery-wrapped destination.  Grab the first element.
			else if (destination.jquery) { // cannot use `hasOwnProperty()` here as `jquery` is from jQuery's prototype
				this.output = destination[0];
			}

			// Normal destination.
			else {
				this.output = destination;
			}

			/*
				Wikify the source into the output buffer element, possibly converting line
				breaks into paragraphs.

				NOTE: There's no catch clause here because this try/finally exists solely
				      to ensure that the call depth is properly restored in the event that
				      an uncaught exception is thrown during the call to `subWikify()`.
			*/
			try {
				++_callDepth;

				this.subWikify(this.output);

				// Limit line break conversion to non-recursive calls.
				if (_callDepth === 1 && Config.cleanupWikifierOutput) {
					convertBreaks(this.output);
				}
			}
			finally {
				--_callDepth;
			}
		}

		subWikify(output, terminator, options) {
			// Cache and temporarily replace the current output buffer and options.
			const oldOutput = this.output;
			let oldOptions;

			this.output = output;

			if (options != null && typeof options === 'object') { // lazy equality for null
				oldOptions = this.options;
				this.options = Object.assign({}, this.options, options);
			}

			const parsersProfile   = Wikifier.Parser.Profile.get(this.options.profile);
			const terminatorRegExp = terminator
				? new RegExp(`(?:${terminator})`, this.options.ignoreTerminatorCase ? 'gim' : 'gm')
				: null;
			let terminatorMatch;
			let parserMatch;

			do {
				// Prepare the RegExp match positions.
				parsersProfile.parserRegExp.lastIndex = this.nextMatch;

				if (terminatorRegExp) {
					terminatorRegExp.lastIndex = this.nextMatch;
				}

				// Get the first matches.
				parserMatch     = parsersProfile.parserRegExp.exec(this.source);
				terminatorMatch = terminatorRegExp ? terminatorRegExp.exec(this.source) : null;

				// Try for a terminator match, unless there's a closer parser match.
				if (terminatorMatch && (!parserMatch || terminatorMatch.index <= parserMatch.index)) {
					// Output any text before the match.
					if (terminatorMatch.index > this.nextMatch) {
						this.outputText(this.output, this.nextMatch, terminatorMatch.index);
					}

					// Set the match parameters.
					this.matchStart  = terminatorMatch.index;
					this.matchLength = terminatorMatch[0].length;
					this.matchText   = terminatorMatch[0];
					this.nextMatch   = terminatorRegExp.lastIndex;

					// Restore the original output buffer and options.
					this.output = oldOutput;

					if (oldOptions) {
						this.options = oldOptions;
					}

					// Exit.
					return;
				}

				// Try for a parser match.
				else if (parserMatch) {
					// Output any text before the match.
					if (parserMatch.index > this.nextMatch) {
						this.outputText(this.output, this.nextMatch, parserMatch.index);
					}

					// Set the match parameters.
					this.matchStart  = parserMatch.index;
					this.matchLength = parserMatch[0].length;
					this.matchText   = parserMatch[0];
					this.nextMatch   = parsersProfile.parserRegExp.lastIndex;

					// Figure out which parser matched.
					let matchingParser;

					for (let i = 1, iend = parserMatch.length; i < iend; ++i) {
						if (parserMatch[i]) {
							matchingParser = i - 1;
							break; // stop once we've found the matching parser
						}
					}

					// Call the parser.
					parsersProfile.parsers[matchingParser].handler(this);

					if (TempState.break != null) { // lazy equality for null
						break;
					}
				}
			} while (terminatorMatch || parserMatch);

			// Output any text after the last match.
			if (TempState.break == null) { // lazy equality for null
				if (this.nextMatch < this.source.length) {
					this.outputText(this.output, this.nextMatch, this.source.length);
					this.nextMatch = this.source.length;
				}
			}

			// In case of <<break>>/<<continue>>, remove the last <br>.
			else if (
				   this.output.lastChild
				&& this.output.lastChild.nodeType === Node.ELEMENT_NODE
				&& this.output.lastChild.nodeName.toUpperCase() === 'BR'
			) {
				jQuery(this.output.lastChild).remove();
			}

			// Restore the original output buffer and options.
			this.output = oldOutput;

			if (oldOptions) {
				this.options = oldOptions;
			}
		}

		outputText(destination, startPos, endPos) {
			jQuery(destination).append(document.createTextNode(this.source.substring(startPos, endPos)));
		}

		/*
			[DEPRECATED] Meant to be called by legacy macros, this returns the raw, unprocessed
			text given to the currently executing macro.
		*/
		rawArgs() {
			return this._rawArgs;
		}

		/*
			[DEPRECATED] Meant to be called by legacy macros, this returns the text given to
			the currently executing macro after doing TwineScript-to-JavaScript transformations.
		*/
		fullArgs() {
			return Scripting.parse(this.rawArgs());
		}

		/*
			Returns the value of the given story/temporary variable.
		*/
		static getValue(storyVar) {
			const varData = Wikifier.parseStoryVariable(storyVar);
			let retVal;

			if (varData !== null) {
				retVal = varData.store;

				const pNames = varData.names;

				for (let i = 0, iend = pNames.length; i < iend; ++i) {
					if (typeof retVal[pNames[i]] !== 'undefined') {
						retVal = retVal[pNames[i]];
					}
					else {
						retVal = undefined;
						break;
					}
				}
			}

			return retVal;
		}

		/*
			Sets the value of the given story/temporary variable.
		*/
		static setValue(storyVar, newValue) {
			const varData = Wikifier.parseStoryVariable(storyVar);

			if (varData !== null) {
				const pNames  = varData.names;
				const varName = pNames.pop();
				let baseObj = varData.store;

				for (let i = 0, iend = pNames.length; i < iend; ++i) {
					if (typeof baseObj[pNames[i]] !== 'undefined') {
						baseObj = baseObj[pNames[i]];
					}
					else {
						baseObj = undefined;
						break;
					}
				}

				if (baseObj !== undefined) {
					baseObj[varName] = newValue;
					return true;
				}
			}

			return false;
		}

		/*
			Returns the property name chain of the given story/temporary variable, which may be
			of arbitrary complexity.
		*/
		static parseStoryVariable(varText) {
			const retVal = {
				store : varText[0] === '$' ? State.variables : State.temporary,
				names : []
			};
			let text  = varText;
			let match;

			while ((match = Wikifier._parseVarRegExp.exec(text)) !== null) {
				// Remove full match from text.
				text = text.slice(match[0].length);

				// Base variable.
				if (match[1]) {
					retVal.names.push(match[1]);
				}

				// Dot property.
				else if (match[2]) {
					retVal.names.push(match[2]);
				}

				// Square-bracketed property (double quoted).
				else if (match[3]) {
					retVal.names.push(match[3]);
				}

				// Square-bracketed property (single quoted).
				else if (match[4]) {
					retVal.names.push(match[4]);
				}

				// Square-bracketed property (embedded variable).
				else if (match[5]) {
					retVal.names.push(Wikifier.getValue(match[5]));
				}

				// Square-bracketed property (numeric index).
				else if (match[6]) {
					retVal.names.push(Number(match[6]));
				}
			}

			return text === '' ? retVal : null;
		}

		/*
			Returns the output generated by wikifying the given text, throwing if there were errors.
		*/
		static wikifyEval(text) {
			const output = document.createDocumentFragment();

			new Wikifier(output, text);

			const errors = output.querySelector('.error');

			if (errors !== null) {
				throw new Error(errors.textContent.replace(/^(?:(?:Uncaught\s+)?Error:\s+)+/, ''));
			}

			return output;
		}

		/*
			Create and return an internal link.
		*/
		static createInternalLink(destination, passage, text, callback) {
			const $link = jQuery(document.createElement('a'));

			if (passage != null) { // lazy equality for null
				$link.attr('data-passage', passage);

				if (Story.has(passage)) {
					$link.addClass('link-internal');

					if (Config.addVisitedLinkClass && State.hasPlayed(passage)) {
						$link.addClass('link-visited');
					}
				}
				else {
					$link.addClass('link-broken');
				}

				$link.ariaClick({ one : true }, () => {
					if (typeof callback === 'function') {
						callback();
					}

					Engine.play(passage);
				});
			}

			if (text) {
				$link.append(document.createTextNode(text));
			}

			if (destination) {
				$link.appendTo(destination);
			}

			// For legacy-compatibility we must return the DOM node.
			return $link[0];
		}

		/*
			Create and return an external link.
		*/
		static createExternalLink(destination, url, text) {
			const $link = jQuery(document.createElement('a'))
				.attr('target', '_blank')
				.addClass('link-external')
				.text(text)
				.appendTo(destination);

			if (url != null) { // lazy equality for null
				$link.attr({
					href     : url,
					tabindex : 0 // for accessiblity
				});
			}

			// For legacy-compatibility we must return the DOM node.
			return $link[0];
		}

		/*
			Returns whether the given link source is external (probably).
		*/
		static isExternalLink(link) {
			if (Story.has(link)) {
				return false;
			}

			const urlRegExp = new RegExp(`^${Patterns.url}`, 'gim');
			return urlRegExp.test(link) || /[/.?#]/.test(link);
		}
	}


	/*******************************************************************************************************************
	 * Parser Static Object.
	 ******************************************************************************************************************/
	Object.defineProperty(Wikifier, 'Parser', {
		value : (() => {
			// Parser definition array.  Ordering matters, so this must be an ordered list.
			const _parsers = [];

			// Parser profiles object.
			let _profiles;


			/*
				Parser Functions.
			*/
			function parsersGetter() {
				return _parsers;
			}

			function parsersAdd(parser) {
				// Parser object sanity checks.
				if (typeof parser !== 'object') {
					throw new Error('Wikifier.Parser.add parser parameter must be an object');
				}

				if (!parser.hasOwnProperty('name')) {
					throw new Error('parser object missing required "name" property');
				}
				else if (typeof parser.name !== 'string') {
					throw new Error('parser object "name" property must be a string');
				}

				if (!parser.hasOwnProperty('match')) {
					throw new Error('parser object missing required "match" property');
				}
				else if (typeof parser.match !== 'string') {
					throw new Error('parser object "match" property must be a string');
				}

				if (!parser.hasOwnProperty('handler')) {
					throw new Error('parser object missing required "handler" property');
				}
				else if (typeof parser.handler !== 'function') {
					throw new Error('parser object "handler" property must be a function');
				}

				if (parser.hasOwnProperty('profiles') && !Array.isArray(parser.profiles)) {
					throw new Error('parser object "profiles" property must be an array');
				}

				// Check for an existing parser with the same name.
				if (parsersHas(parser.name)) {
					throw new Error(`cannot clobber existing parser "${parser.name}"`);
				}

				// Add the parser to the end of the array.
				_parsers.push(parser);
			}

			function parsersDelete(name) {
				const parser = _parsers.find(parser => parser.name === name);

				if (parser) {
					_parsers.delete(parser);
				}
			}

			function parsersIsEmpty() {
				return _parsers.length === 0;
			}

			function parsersHas(name) {
				return !!_parsers.find(parser => parser.name === name);
			}

			function parsersGet(name) {
				return _parsers.find(parser => parser.name === name) || null;
			}


			/*
				Parser Profile Functions.
			*/
			function profilesGetter() {
				return _profiles;
			}

			function profilesCompile() {
				if (DEBUG) { console.log('[Wikifier.Parser/profilesCompile()]'); }

				const all  = _parsers;
				const core = all.filter(parser => !Array.isArray(parser.profiles) || parser.profiles.includes('core'));

				_profiles = Object.freeze({
					all : {
						parsers      : all,
						parserRegExp : new RegExp(all.map(parser => `(${parser.match})`).join('|'), 'gm')
					},
					core : {
						parsers      : core,
						parserRegExp : new RegExp(core.map(parser => `(${parser.match})`).join('|'), 'gm')
					}
				});

				return _profiles;
			}

			function profilesIsEmpty() {
				return typeof _profiles !== 'object' || Object.keys(_profiles).length === 0;
			}

			function profilesGet(profile) {
				if (typeof _profiles !== 'object' || !_profiles.hasOwnProperty(profile)) {
					throw new Error(`nonexistent parser profile "${profile}"`);
				}

				return _profiles[profile];
			}

			function profilesHas(profile) {
				return typeof _profiles === 'object' && _profiles.hasOwnProperty(profile);
			}


			/*
				Exports.
			*/
			return Object.freeze(Object.defineProperties({}, {
				/*
					Parser Containers.
				*/
				parsers : { get : parsersGetter },

				/*
					Parser Functions.
				*/
				add     : { value : parsersAdd },
				delete  : { value : parsersDelete },
				isEmpty : { value : parsersIsEmpty },
				has     : { value : parsersHas },
				get     : { value : parsersGet },

				/*
					Parser Profile.
				*/
				Profile : {
					value : Object.freeze(Object.defineProperties({}, {
						/*
							Profiles Containers.
						*/
						profiles : { get : profilesGetter },

						/*
							Profiles Functions.
						*/
						compile : { value : profilesCompile },
						isEmpty : { value : profilesIsEmpty },
						has     : { value : profilesHas },
						get     : { value : profilesGet }
					}))
				}
			}));
		})()
	});


	/*******************************************************************************************************************
	 * Additional Static Properties.
	 ******************************************************************************************************************/
	Object.defineProperties(Wikifier, {
		_parseVarRegExp : {
			value : new RegExp(`^(?:${Patterns.variableSigil}(${Patterns.identifier})|\\.(${Patterns.identifier})|\\[(?:(?:"((?:\\\\.|[^"\\\\])+)")|(?:'((?:\\\\.|[^'\\\\])+)')|(${Patterns.variableSigil}${Patterns.identifierFirstChar}.*)|(\\d+))\\])`)
		},
		helpers : { value : {} },

		/*
			Legacy Aliases.
		*/
		parse          : { value : Scripting.parse },
		evalExpression : { value : Scripting.evalTwineScript }, // SEE: `markup/scripting.js`.
		evalStatements : { value : Scripting.evalTwineScript }, // SEE: `markup/scripting.js`.
		textPrimitives : { value : Patterns }                   // SEE: `markup/patterns.js`.
	});


	/*******************************************************************************************************************
	 * Helper Static Methods.
	 ******************************************************************************************************************/
	Object.defineProperties(Wikifier.helpers, {
		inlineCss : {
			value : (function () {
				const lookahead = new RegExp(Patterns.inlineCss, 'gm');

				function helperInlineCss(w) {
					const css = { classes : [], id : '', styles : {} };
					let matched;

					do {
						lookahead.lastIndex = w.nextMatch;

						const match = lookahead.exec(w.source);

						matched = match && match.index === w.nextMatch;

						if (matched) {
							if (match[1]) {
								css.styles[Util.fromCssProperty(match[1])] = match[2].trim();
							}
							else if (match[3]) {
								css.styles[Util.fromCssProperty(match[3])] = match[4].trim();
							}
							else if (match[5]) {
								css.classes = css.classes.concat(match[5].slice(1).split(/\./));
							}
							else if (match[6]) {
								css.id = match[6].slice(1).split(/#/).pop();
							}

							w.nextMatch = lookahead.lastIndex; // eslint-disable-line no-param-reassign
						}
					} while (matched);

					return css;
				}

				return helperInlineCss;
			})()
		},

		evalText : {
			value(text) {
				let result;

				try {
					result = Scripting.evalTwineScript(text);

					if (result == null || typeof result === 'function') { // use lazy equality for null
						result = text;
					}
					else {
						result = String(result);

						if (/\[(?:object(?:\s+[^\]]+)?|native\s+code)\]/.test(result)) {
							result = text;
						}
					}
				}
				catch (ex) {
					result = text;
				}

				return result;
			}
		},

		evalPassageId : {
			value(passage) {
				if (passage == null || Story.has(passage)) { // lazy equality for null; `0` is a valid name, so we cannot simply evaluate `passage`
					return passage;
				}

				return Wikifier.helpers.evalText(passage);
			}
		},

		hasBlockContext : {
			value(nodes) {
				const hasGCS = typeof window.getComputedStyle === 'function';

				for (let i = nodes.length - 1; i >= 0; --i) {
					const node = nodes[i];

					switch (node.nodeType) {
					case Node.ELEMENT_NODE:
						{
							const tagName = node.nodeName.toUpperCase();

							if (tagName === 'BR') {
								return true;
							}

							const styles = hasGCS ? window.getComputedStyle(node, null) : node.currentStyle;

							if (styles && styles.display) {
								if (styles.display === 'none') {
									continue;
								}

								return styles.display === 'block';
							}

							/*
								WebKit/Blink-based browsers do not attach any computed style
								information to elements until they're inserted into the DOM
								(and probably visible), not even the default browser styles
								and any user styles.  So, we make an assumption based on the
								element.
							*/
							switch (tagName) {
							case 'ADDRESS':
							case 'ARTICLE':
							case 'ASIDE':
							case 'BLOCKQUOTE':
							case 'CENTER':
							case 'DIV':
							case 'DL':
							case 'FIGURE':
							case 'FOOTER':
							case 'FORM':
							case 'H1':
							case 'H2':
							case 'H3':
							case 'H4':
							case 'H5':
							case 'H6':
							case 'HEADER':
							case 'HR':
							case 'MAIN':
							case 'NAV':
							case 'OL':
							case 'P':
							case 'PRE':
							case 'SECTION':
							case 'TABLE':
							case 'UL':
								return true;
							}
						}

						return false;

					case Node.COMMENT_NODE:
						continue;

					default:
						return false;
					}
				}

				return true;
			}
		},

		createShadowSetterCallback : {
			value : (function () {
				let macroParser = null;

				function cacheMacroParser() {
					if (!macroParser) {
						macroParser = Wikifier.Parser.get('macro');

						if (!macroParser) {
							throw new Error('cannot find "macro" parser');
						}
					}

					return macroParser;
				}

				function getMacroContextShadowView() {
					const macro = macroParser || cacheMacroParser();
					const view  = new Set();

					for (let context = macro.context; context !== null; context = context.parent) {
						if (context._shadows) {
							context._shadows.forEach(name => view.add(name));
						}
					}

					return [...view];
				}

				function helperCreateShadowSetterCallback(code) {
					const shadowStore = {};

					getMacroContextShadowView().forEach(varName => {
						const varKey = varName.slice(1);
						const store  = varName[0] === '$' ? State.variables : State.temporary;
						shadowStore[varName] = store[varKey];
					});

					return function () {
						const shadowNames = Object.keys(shadowStore);
						const valueCache  = shadowNames.length > 0 ? {} : null;

						/*
							There's no catch clause because this try/finally is here simply to ensure that
							proper cleanup is done in the event that an exception is thrown during the
							evaluation.
						*/
						try {
							/*
								Cache the existing values of the variables to be shadowed and assign the
								shadow values.
							*/
							shadowNames.forEach(varName => {
								const varKey = varName.slice(1);
								const store  = varName[0] === '$' ? State.variables : State.temporary;

								if (store.hasOwnProperty(varKey)) {
									valueCache[varKey] = store[varKey];
								}

								store[varKey] = shadowStore[varName];
							});

							// Evaluate the JavaScript.
							return Scripting.evalJavaScript(code);
						}
						finally {
							// Revert the variable shadowing.
							shadowNames.forEach(varName => {
								const varKey = varName.slice(1);
								const store  = varName[0] === '$' ? State.variables : State.temporary;

								/*
									Update the shadow store with the variable's current value, in case it
									was modified during the callback.
								*/
								shadowStore[varName] = store[varKey];

								if (valueCache.hasOwnProperty(varKey)) {
									store[varKey] = valueCache[varKey];
								}
								else {
									delete store[varKey];
								}
							});
						}
					};
				}

				return helperCreateShadowSetterCallback;
			})()
		},

		parseSquareBracketedMarkup : {
			/* eslint-disable no-use-before-define, no-labels */
			value(w) {
				function next() {
					if (pos >= w.source.length) {
						return EOF;
					}

					return w.source[pos++];
				}

				function peek() {
					if (pos >= w.source.length) {
						return EOF;
					}

					return w.source[pos];
				}

				function peekAhead(count) {
					if (count < 1 || pos + count >= w.source.length) {
						return EOF;
					}

					return w.source[pos + count];
				}

				function error(/* variadic: fmt [, … ] */) {
					return {
						error : String.format(...arguments),
						pos
					};
				}

				function ignore() {
					start = pos;
				}

				function emit(type) {
					const text = w.source.slice(start, pos).trim();

					if (text === '') {
						throw new Error(`malformed wiki ${isLink ? 'link' : 'image'}, empty ${type} component`);
					}

					if (type === 'link' && text[0] === '~') {
						item.forceInternal = true;
						item.link = text.slice(1);
					}
					else {
						item[type] = text;
					}

					start = pos;
				}

				function slurpQuote(endQuote) {
					++pos;
					loop: for (;;) {
						switch (peek()) {
						case '\\':
							{
								++pos;
								const ch = peek();

								if (ch !== EOF && ch !== '\n') {
									break;
								}
							}
							/* falls through */

						case EOF:
						case '\n':
							return EOF;

						case endQuote:
							break loop;
						}

						++pos;
					}

					return pos;
				}

				const EOF  = -1; // end of file (string, really)
				const item = {}; // scanned item object
				let start  = w.matchStart; // start position of a component
				let pos    = start + 1;    // current position in w.source
				let depth;                 // current square bracket nesting depth
				let cid;                   // current component ID
				let isLink;                // markup is a link, else image
				let ch;

				// [[text|~link][setter]]
				// [<>img[title|source][~link][setter]]

				// Scan left delimiter.
				ch = peek();

				if (ch === '[') {
					// Link.
					isLink = item.isLink = true;
				}
				else {
					// Image.
					isLink = false;

					switch (ch) {
					case '<':
						item.align = 'left';
						++pos;
						break;

					case '>':
						item.align = 'right';
						++pos;
						break;
					}

					if (!/^[Ii][Mm][Gg]$/.test(w.source.slice(pos, pos + 3))) {
						return error('malformed square-bracketed wiki markup');
					}

					pos += 3;
					item.isImage = true;
				}

				// Scan for sections.
				if (next() !== '[') {
					return error('malformed wiki {0}', isLink ? 'link' : 'image');
				}

				depth = 1;
				cid = 0; // 0=title, 1=link(link)|source(image), 2=setter(link)|link(image), 3=setter(image)
				ignore();

				try {
					loop: for (;;) {
						switch ((ch = peek())) { // eslint-disable-line no-extra-parens
						case EOF:
						case '\n':
							return error('unterminated wiki {0}', isLink ? 'link' : 'image');

						case '"':
							/*
								This is not entirely reliable within the non-setter component sections (i.e. the
								sections which allow raw strings), since it's possible, however unlikely, for a raw
								string to contain unpaired double quotes.  The likelihood is low enough, however,
								that I'm deeming the risk acceptable, for now at least.
							*/
							if (slurpQuote(ch) === EOF) {
								return error('unterminated double quoted string in wiki {0}', isLink ? 'link' : 'image');
							}
							break;

						case "'":
							/*
								Disallow the use of single quotes as delimiters for quoted strings within all but
								the setter component section, since it's entirely possible for raw strings to contain
								unpaired single quotes.
							*/
							if (cid === 4 || cid === 3 && isLink) {
								if (slurpQuote(ch) === EOF) {
									return error('unterminated single quoted string in wiki {0}', isLink ? 'link' : 'image');
								}
							}
							break;

						case '|': // core section pipe ('|') separator
							if (cid === 0) {
								emit(isLink ? 'text' : 'title');
								++start;
								cid = 1;
							}
							break;

						case '-': // possible core section right arrow ('->') separator (Twine 2 extension)
							if (cid === 0 && peekAhead(1) === '>') {
								emit(isLink ? 'text' : 'title');
								++pos;
								start += 2;
								cid = 1;
							}
							break;

						case '<': // possible core section left arrow ('<-') separator (Twine 2 extension)
							if (cid === 0 && peekAhead(1) === '-') {
								emit(isLink ? 'link' : 'source');
								++pos;
								start += 2;
								cid = 2;
							}
							break;

						case '[':
							if (cid === -1) {
								return error("unexpected left square bracket '['");
							}

							++depth;

							if (depth === 1) {
								ignore();
								++start;
							}
							break;

						case ']':
							--depth;

							if (depth === 0) {
								switch (cid) {
								case 0: // core section (nothing emitted yet)
								case 1: // core section (already emitted link-text|image-title)
									emit(isLink ? 'link' : 'source');
									cid = 3;
									break;

								case 2: // core section (already emitted link-link|image-source)
									emit(isLink ? 'text' : 'title');
									cid = 3;
									break;

								case 3: // link-setter|image-link section
									if (isLink) {
										emit('setter');
										cid = -1;
									}
									else {
										emit('link');
										cid = 4;
									}
									break;

								case 4: // image-setter section
									emit('setter');
									cid = -1;
									break;
								}

								++pos;

								if (peek() === ']') {
									++pos;
									break loop;
								}

								--pos;
							}
							break;
						}

						++pos;
					}
				}
				catch (ex) {
					return error(ex.message);
				}

				item.pos = pos;

				return item;
			}
			/* eslint-enable no-use-before-define, no-labels */
		}
	});


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Wikifier;
})();
/* eslint-enable max-len */
