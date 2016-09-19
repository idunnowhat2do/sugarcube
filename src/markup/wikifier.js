/***********************************************************************************************************************
 *
 * markup/wikifier.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 ***********************************************************************************************************************
 *
 * Portions of this code are based on:
 * ____
 *
 * TiddlyWiki 1.2.39 by Jeremy Ruston, (jeremy [at] osmosoft [dot] com)
 *
 * Published under a BSD open source license
 *
 * Copyright (c) Osmosoft Limited 2005
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list
 * of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice, this
 * list of conditions and the following disclaimer in the documentation and/or
 * other materials provided with the distribution.
 *
 * Neither the name of the Osmosoft Limited nor the names of its contributors may
 * be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 **********************************************************************************************************************/
/*
	global Config, DebugView, Engine, Macro, MacroContext, Patterns, Scripting, State, Story, TempState, TempVariables,
	       Util, toStringOrDefault, throwError
*/
/* eslint "no-param-reassign": [ 2, { "props" : false } ] */

/*
	TODO: The Wikifier, and associated code, could stand to receive a serious refactoring.
*/
/* eslint-disable max-len */
var Wikifier = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	let
		// The Wikifier formatter object cache.
		_formatterCache;


	/*******************************************************************************************************************
	 * Wikifier Class.
	 ******************************************************************************************************************/
	class Wikifier {
		constructor(destination, source) {
			Object.defineProperties(this, {
				// General Wikifier properties.
				formatter : {
					value : _formatterCache || Wikifier.compileFormatters()
				},

				source : {
					value : String(source)
				},

				nextMatch : {
					writable : true,
					value    : 0
				},

				output : {
					writable : true,
					value    : null
				},

				// Formatter-related properties.
				_rawArgs : {
					writable : true,
					value    : ''
				},

				_nobr : {
					writable : true,
					value    : []
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

			// Wikify the source into the output buffer element.
			this.subWikify(this.output);
		}

		subWikify(output, terminator, terminatorIgnoreCase) {
			// Cache and temporarily replace the current output buffer.
			const oldOutput = this.output;
			this.output = output;

			const
				terminatorRegExp = terminator ? new RegExp(`(?:${terminator})`, terminatorIgnoreCase ? 'gim' : 'gm') : null;
			let
				terminatorMatch,
				formatterMatch;

			do {
				// Prepare the RegExp match positions.
				this.formatter.formatterRegExp.lastIndex = this.nextMatch;

				if (terminatorRegExp) {
					terminatorRegExp.lastIndex = this.nextMatch;
				}

				// Get the first matches.
				formatterMatch  = this.formatter.formatterRegExp.exec(this.source);
				terminatorMatch = terminatorRegExp ? terminatorRegExp.exec(this.source) : null;

				// Check for a terminator & formatter match.
				if (terminatorMatch && (!formatterMatch || terminatorMatch.index <= formatterMatch.index)) {
					// Output any text before the match.
					if (terminatorMatch.index > this.nextMatch) {
						this.outputText(this.output, this.nextMatch, terminatorMatch.index);
					}

					// Set the match parameters.
					this.matchStart  = terminatorMatch.index;
					this.matchLength = terminatorMatch[0].length;
					this.matchText   = terminatorMatch[0];
					this.nextMatch   = terminatorRegExp.lastIndex;

					// Restore the output buffer and exit.
					this.output = oldOutput;
					return;
				}
				else if (formatterMatch) {
					// Output any text before the match.
					if (formatterMatch.index > this.nextMatch) {
						this.outputText(this.output, this.nextMatch, formatterMatch.index);
					}

					// Set the match parameters.
					this.matchStart  = formatterMatch.index;
					this.matchLength = formatterMatch[0].length;
					this.matchText   = formatterMatch[0];
					this.nextMatch   = this.formatter.formatterRegExp.lastIndex;

					// Figure out which formatter matched.
					let matchingFormatter;

					for (let i = 1, iend = formatterMatch.length; i < iend; ++i) {
						if (formatterMatch[i]) {
							matchingFormatter = i - 1;
							break; // stop once we've found the matching formatter
						}
					}

					// Call the formatter.
					this.formatter.formatters[matchingFormatter].handler(this);

					if (TempState.break != null) { // lazy equality for null
						break;
					}
				}
			} while (terminatorMatch || formatterMatch);

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

			// Restore the output buffer.
			this.output = oldOutput;
		}

		outputText(destination, startPos, endPos) {
			jQuery(destination).append(document.createTextNode(this.source.substring(startPos, endPos)));
		}

		/*
			Meant to be called by macros, this returns the raw, unprocessed text given to the
			currently executing macro.
		*/
		rawArgs() {
			return this._rawArgs;
		}

		/*
			Meant to be called by macros, this returns the text given to the currently executing
			macro after doing TwineScript-to-JavaScript transformations.
		*/
		fullArgs() {
			return Scripting.parse(this.rawArgs());
		}

		/*
			Returns a compiled Wikifier formatter object.
		*/
		static compileFormatters() {
			if (DEBUG) { console.log('[Wikifier.compileFormatters]'); }

			const formatters = Wikifier.formatters;
			_formatterCache = {
				formatters,
				formatterRegExp : new RegExp(formatters.map(formatter => `(${formatter.match})`).join('|'), 'gm')
			};
			return _formatterCache;
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
				const
					pNames  = varData.names,
					varName = pNames.pop();
				let
					baseObj = varData.store;

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
			const
				retVal = {
					store : varText[0] === '$' ? State.variables : TempVariables,
					names : []
				};
			let
				text  = varText,
				match;

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
			return urlRegExp.test(link) || /[\/\.\?#]/.test(link);
		}
	}


	/*******************************************************************************************************************
	 * Additional Static Properties.
	 ******************************************************************************************************************/
	Object.defineProperties(Wikifier, {
		_parseVarRegExp : {
			value : new RegExp([
				'^(?:',
				Patterns.variableSigil,
				'(',
				Patterns.identifier,
				')|\\.(',
				Patterns.identifier,
				')|\\[(?:(?:"((?:\\\\.|[^"\\\\])+)")|(?:\'((?:\\\\.|[^\'\\\\])+)\')|(',
				Patterns.variableSigil,
				Patterns.identifierFirstChar,
				'.*)|(\\d+))\\])'
			].join(''))
		},
		helpers : { value : {} },

		/*
			Legacy Aliases.
		*/
		parse          : { value : Scripting.parse },
		evalExpression : { value : Scripting.evalTwineScript }, // See: `markup/scripting.js`.
		evalStatements : { value : Scripting.evalTwineScript }, // See: `markup/scripting.js`.
		textPrimitives : { value : Patterns }                   // See: `markup/patterns.js`.
	});


	/*******************************************************************************************************************
	 * Helper Static Methods.
	 ******************************************************************************************************************/
	Object.defineProperties(Wikifier.helpers, {
		/*
		charFormat : {
			value(w) {
				w.subWikify(
					jQuery(document.createElement(this.element)).appendTo(w.output).get(0),
					this.terminator
				);
			}
		},
		*/

		_inlineCssLookahead : {
			value : new RegExp(Patterns.inlineCss, 'gm')
		},
		inlineCss : {
			value(w) {
				const
					css       = { classes : [], id : '', styles : {} },
					lookahead = this._inlineCssLookahead;
				let
					matched;

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

						w.nextMatch = lookahead.lastIndex;
					}
				} while (matched);

				return css;
			}
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

				const
					EOF  = -1, // end of file (string, really)
					item = {}; // scanned item object
				let
					start  = w.matchStart, // start position of a component
					pos    = start + 1,    // current position in w.source
					depth,                 // current square bracket nesting depth
					cid,                   // current component ID
					isLink,                // markup is a link, else image
					ch;

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
	 * Formatters.
	 ******************************************************************************************************************/
	Object.defineProperty(Wikifier, 'formatters', {
		value : [
			{
				name        : 'macro',
				match       : '<<',
				lookahead   : /<<(\/?[A-Za-z][^>\s]*|[=-])(?:\s*)((?:(?:"(?:\\.|[^"\\])*")|(?:'(?:\\.|[^'\\])*')|(?:\[(?:[<>]?[Ii][Mm][Gg])?\[[^\r\n]*?\]\]+)|[^>]|(?:>(?!>)))*)>>/gm,
				argsPattern : [
					'(``)',                                             // 1=Empty backticks
					'`((?:\\\\.|[^`\\\\])+)`',                          // 2=Backticked, non-empty
					'(""|\'\')',                                        // 3=Empty quotes
					'("(?:\\\\.|[^"\\\\])+")',                          // 4=Double quoted, non-empty
					"('(?:\\\\.|[^'\\\\])+')",                          // 5=Single quoted, non-empty
					'(\\[(?:[<>]?[Ii][Mm][Gg])?\\[[^\\r\\n]*?\\]\\]+)', // 6=Double square-bracketed
					'([^`"\'\\s]+)',                                    // 7=Barewords
					'(`|"|\')'                                          // 8=Unterminated backticks and quotes
				].join('|'),
				working : { source : '', name : '', arguments : '', index : 0 }, // the working parse object
				context : null, // last execution context object (top-level macros, hierarchically, have a null context)

				handler(w) {
					const matchStart = this.lookahead.lastIndex = w.matchStart;

					if (this.parseTag(w)) {
						/*
							If `parseBody()` is called below, it will modify the current working
							values, so we must cache them now.
						*/
						const
							nextMatch = w.nextMatch,
							source    = this.working.source,
							name      = this.working.name,
							rawArgs   = this.working.arguments;
						let
							macro;

						try {
							macro = Macro.get(name);

							if (macro) {
								let payload = null;

								if (macro.hasOwnProperty('tags')) {
									payload = this.parseBody(w, macro);

									if (!payload) {
										w.nextMatch = nextMatch; // we must reset `w.nextMatch` here, as `parseBody()` modifies it
										return throwError(w.output, `cannot find a closing tag for macro <<${name}>>`,
											`${w.source.slice(matchStart, w.nextMatch)}\u2026`);
									}
								}

								if (typeof macro.handler === 'function') {
									const args = !payload
										? this.createArgs(
											rawArgs,
											   macro.hasOwnProperty('skipArgs') && !!macro.skipArgs
											|| macro.hasOwnProperty('skipArg0') && !!macro.skipArg0
										)
										: payload[0].args;

									/*
										New-style macros.
									*/
									if (macro.hasOwnProperty('_MACRO_API')) {
										/*
											Add the macro's execution context to the context chain.
										*/
										this.context = new MacroContext({
											parent : this.context,
											macro,
											name,
											args,
											payload,
											parser : w,
											source
										});

										/*
											Call the handler.

											NOTE: There's no catch clause here because this try/finally exists simply
											      to ensure that the execution context is properly restored in the
											      event that an uncaught exception is thrown during the handler call.
										*/
										try {
											macro.handler.call(this.context);
										}
										finally {
											this.context = this.context.parent;
										}
									}

									/*
										Old-style macros.
									*/
									else {
										const prevRawArgs = w._rawArgs;
										w._rawArgs = rawArgs; // cache the raw arguments for use by `Wikifier.rawArgs()` & `Wikifier.fullArgs()`
										macro.handler(w.output, name, args, w, payload);
										w._rawArgs = prevRawArgs;
									}
								}
								else {
									return throwError(
										w.output,
										`macro <<${name}>> handler function ${macro.hasOwnProperty('handler') ? 'is not a function' : 'does not exist'}`,
										w.source.slice(matchStart, w.nextMatch)
									);
								}
							}
							else if (Macro.tags.has(name)) {
								const tags = Macro.tags.get(name);
								return throwError(
									w.output,
									`child tag <<${name}>> was found outside of a call to its parent macro${tags.length === 1 ? '' : 's'} <<${tags.join('>>, <<')}>>`,
									w.source.slice(matchStart, w.nextMatch)
								  );
							}
							else {
								return throwError(w.output, `macro <<${name}>> does not exist`, w.source.slice(matchStart, w.nextMatch));
							}
						}
						catch (ex) {
							return throwError(
								w.output,
								`cannot execute ${macro && macro.isWidget ? 'widget' : 'macro'} <<${name}>>: ${ex.message}`,
								w.source.slice(matchStart, w.nextMatch)
							);
						}
						finally {
							this.working.source    = '';
							this.working.name      = '';
							this.working.arguments = '';
							this.working.index     = 0;
						}
					}
					else {
						w.outputText(w.output, w.matchStart, w.nextMatch);
					}
				},

				parseTag(w) {
					const match = this.lookahead.exec(w.source);

					if (match && match.index === w.matchStart && match[1]) {
						w.nextMatch = this.lookahead.lastIndex;

						this.working.source    = w.source.slice(match.index, this.lookahead.lastIndex);
						this.working.name      = match[1];
						this.working.arguments = match[2];
						this.working.index     = match.index;

						return true;
					}

					return false;
				},

				parseBody(w, macro) {
					const
						openTag      = this.working.name,
						closeTag     = `/${openTag}`,
						closeAlt     = `end${openTag}`,
						bodyTags     = Array.isArray(macro.tags) ? macro.tags : false,
						payload      = [],
						skipArgs     = macro.hasOwnProperty('skipArgs') && macro.skipArgs,
						skipArg0     = macro.hasOwnProperty('skipArg0') && macro.skipArg0;
					let
						end          = -1,
						opened       = 1,
						curSource    = this.working.source,
						curTag       = this.working.name,
						curArgument  = this.working.arguments,
						contentStart = w.nextMatch;

					while ((w.matchStart = w.source.indexOf(this.match, w.nextMatch)) !== -1) {
						if (!this.parseTag(w)) {
							this.lookahead.lastIndex = w.nextMatch = w.matchStart + this.match.length;
							continue;
						}

						const
							tagSource = this.working.source,
							tagName   = this.working.name,
							tagArgs   = this.working.arguments,
							tagBegin  = this.working.index,
							tagEnd    = w.nextMatch;

						switch (tagName) {
						case openTag:
							++opened;
							break;

						case closeAlt:
						case closeTag:
							--opened;
							break;

						default:
							if (opened === 1 && bodyTags) {
								for (let i = 0, iend = bodyTags.length; i < iend; ++i) {
									if (tagName === bodyTags[i]) {
										payload.push({
											source    : curSource,
											name      : curTag,
											arguments : curArgument,
											args      : this.createArgs(
												curArgument,
												skipArgs || payload.length === 0 && skipArg0
											),
											contents : w.source.slice(contentStart, tagBegin)
										});
										curSource    = tagSource;
										curTag       = tagName;
										curArgument  = tagArgs;
										contentStart = tagEnd;
									}
								}
							}
							break;
						}

						if (opened === 0) {
							payload.push({
								source    : curSource,
								name      : curTag,
								arguments : curArgument,
								args      : this.createArgs(
									curArgument,
									skipArgs || payload.length === 0 && skipArg0
								),
								contents : w.source.slice(contentStart, tagBegin)
							});
							end = tagEnd;
							break;
						}
					}

					if (end !== -1) {
						w.nextMatch = end;
						return payload;
					}

					return null;
				},

				createArgs(rawArgsString, skipArgs) {
					const args = skipArgs ? [] : this.parseArgs(rawArgsString);

					// Extend the args array with the raw and full argument strings.
					Object.defineProperties(args, {
						raw : {
							value : rawArgsString
						},
						full : {
							value : Scripting.parse(rawArgsString)
						}
					});

					return args;
				},

				parseArgs(rawArgsString) {
					/*
						`this.argsPattern` capture groups:
							1=Empty backticks
							2=Backticked, non-empty
							3=Empty quotes
							4=Double quoted, non-empty
							5=Single quoted, non-empty
							6=Double square-bracketed
							7=Barewords
							8=Unterminated backticks and quotes
					*/
					const
						argsRe  = new RegExp(this.argsPattern, 'gm'),
						args    = [],
						varTest = new RegExp(`^${Patterns.variable}`);
					let
						match;

					while ((match = argsRe.exec(rawArgsString)) !== null) {
						let arg;

						// Empty backticks.
						if (match[1]) {
							arg = undefined;
						}

						// Backticked, non-empty.
						else if (match[2]) {
							arg = match[2]; // the pattern excludes the backticks, so this is just the expression

							// Evaluate the expression.
							try {
								arg = Scripting.evalTwineScript(arg);
							}
							catch (ex) {
								throw new Error(`unable to parse macro argument "${arg}": ${ex.message}`);
							}
						}

						// Empty quotes.
						else if (match[3]) {
							arg = '';
						}

						// Double quoted, non-empty.
						else if (match[4]) {
							arg = match[4];

							// Evaluate the string to handle escaped characters.
							try {
								arg = Scripting.evalJavaScript(arg);
							}
							catch (ex) {
								throw new Error(`unable to parse macro argument '${arg}': ${ex.message}`);
							}
						}

						// Single quoted, non-empty.
						else if (match[5]) {
							arg = match[5];

							// Evaluate the string to handle escaped characters.
							try {
								arg = Scripting.evalJavaScript(arg);
							}
							catch (ex) {
								throw new Error(`unable to parse macro argument "${arg}": ${ex.message}`);
							}
						}

						// Double square-bracketed.
						else if (match[6]) {
							arg = match[6];

							const markup = Wikifier.helpers.parseSquareBracketedMarkup({
								source     : arg,
								matchStart : 0
							});

							if (markup.hasOwnProperty('error')) {
								throw new Error(`unable to parse macro argument "${arg}": ${markup.error}`);
							}

							if (markup.pos < arg.length) {
								throw new Error(`unable to parse macro argument "${arg}": unexpected character(s) "${arg.slice(markup.pos)}" (pos: ${markup.pos})`);
							}

							// Convert to a link or image object.
							if (markup.isLink) {
								// .isLink, [.text], [.forceInternal], .link, [.setter]
								arg = { isLink : true };
								arg.count    = markup.hasOwnProperty('text') ? 2 : 1;
								arg.link     = Wikifier.helpers.evalPassageId(markup.link);
								arg.text     = markup.hasOwnProperty('text') ? Wikifier.helpers.evalText(markup.text) : arg.link;
								arg.external = !markup.forceInternal && Wikifier.isExternalLink(arg.link);
								arg.setFn    = markup.hasOwnProperty('setter')
									? (ex => () => Scripting.evalJavaScript(ex))(Scripting.parse(markup.setter))
									: null;
							}
							else if (markup.isImage) {
								// .isImage, [.align], [.title], .source, [.forceInternal], [.link], [.setter]
								arg = (source => {
									const imgObj = {
										source,
										isImage : true
									};

									// Check for Twine 1.4 Base64 image passage transclusion.
									if (source.slice(0, 5) !== 'data:' && Story.has(source)) {
										const passage = Story.get(source);

										if (passage.tags.includes('Twine.image')) {
											imgObj.source  = passage.text;
											imgObj.passage = passage.title;
										}
									}

									return imgObj;
								})(markup.source);

								if (markup.hasOwnProperty('align')) {
									arg.align = markup.align;
								}

								if (markup.hasOwnProperty('title')) {
									arg.title = Wikifier.helpers.evalText(markup.title);
								}

								if (markup.hasOwnProperty('link')) {
									arg.link     = Wikifier.helpers.evalPassageId(markup.link);
									arg.external = !markup.forceInternal && Wikifier.isExternalLink(arg.link);
								}

								arg.setFn = markup.hasOwnProperty('setter')
									? (ex => () => Scripting.evalJavaScript(ex))(Scripting.parse(markup.setter))
									: null;
							}
						}

						// Barewords.
						else if (match[7]) {
							arg = match[7];

							// A variable, so substitute its value.
							if (varTest.test(arg)) {
								arg = Wikifier.getValue(arg);
							}

							// Property access on the settings or setup objects, so try to evaluate it.
							else if (/^(?:settings|setup)[\.\[]/.test(arg)) {
								try {
									arg = Scripting.evalTwineScript(arg);
								}
								catch (ex) {
									throw new Error(`unable to parse macro argument "${arg}": ${ex.message}`);
								}
							}

							// Null literal, so convert it into null.
							else if (arg === 'null') {
								arg = null;
							}

							// Undefined literal, so convert it into undefined.
							else if (arg === 'undefined') {
								arg = undefined;
							}

							// Boolean true literal, so convert it into boolean true.
							else if (arg === 'true') {
								arg = true;
							}

							// Boolean false literal, so convert it into boolean false.
							else if (arg === 'false') {
								arg = false;
							}

							// Attempt to convert it into a number, in case it's a numeric literal.
							else {
								const argAsNum = Number(arg);

								if (!Number.isNaN(argAsNum)) {
									arg = argAsNum;
								}
							}
						}

						// Unterminated backticks and quotes.
						else if (match[8]) {
							let what;

							switch (match[8]) {
							case '`':
								what = 'backtick expression';
								break;

							case '"':
								what = 'double quoted string';
								break;

							case "'":
								what = 'single quoted string';
								break;
							}

							throw new Error(`unterminated ${what} in macro argument string`);
						}

						args.push(arg);
					}

					return args;
				}
			},

			{
				name  : 'prettyLink',
				match : '\\[\\[[^[]',

				handler(w) {
					const markup = Wikifier.helpers.parseSquareBracketedMarkup(w);

					if (markup.hasOwnProperty('error')) {
						w.outputText(w.output, w.matchStart, w.nextMatch);
						return;
					}

					w.nextMatch = markup.pos;

					// text=(text), forceInternal=(~), link=link, setter=(setter)
					const
						link  = Wikifier.helpers.evalPassageId(markup.link),
						text  = markup.hasOwnProperty('text') ? Wikifier.helpers.evalText(markup.text) : link,
						setFn = markup.hasOwnProperty('setter')
							? (ex => () => Scripting.evalJavaScript(ex))(Scripting.parse(markup.setter))
							: null;

					// Debug view setup.
					const output = (Config.debug
						? new DebugView(w.output, 'wiki-link', '[[link]]', w.source.slice(w.matchStart, w.nextMatch))
						: w
					).output;

					if (markup.forceInternal || !Wikifier.isExternalLink(link)) {
						Wikifier.createInternalLink(output, link, text, setFn);
					}
					else {
						Wikifier.createExternalLink(output, link, text);
					}
				}
			},

			{
				name  : 'urlLink',
				match : Patterns.url,

				handler(w) {
					w.outputText(Wikifier.createExternalLink(w.output, w.matchText), w.matchStart, w.nextMatch);
				}
			},

			{
				name  : 'image',
				match : '\\[[<>]?[Ii][Mm][Gg]\\[',

				handler(w) {
					const markup = Wikifier.helpers.parseSquareBracketedMarkup(w);

					if (markup.hasOwnProperty('error')) {
						w.outputText(w.output, w.matchStart, w.nextMatch);
						return;
					}

					w.nextMatch = markup.pos;

					// Debug view setup.
					let	debugView;

					if (Config.debug) {
						debugView = new DebugView(
							w.output,
							'wiki-image',
							markup.hasOwnProperty('link') ? '[img[][link]]' : '[img[]]',
							w.source.slice(w.matchStart, w.nextMatch)
						);
						debugView.modes({ block : true });
					}

					// align=(left|right), title=(title), source=source, forceInternal=(~), link=(link), setter=(setter)
					const
						setFn = markup.hasOwnProperty('setter')
							? (ex => () => Scripting.evalJavaScript(ex))(Scripting.parse(markup.setter))
							: null;
					let
						el     = (Config.debug ? debugView : w).output,
						source;

					if (markup.hasOwnProperty('link')) {
						const link = Wikifier.helpers.evalPassageId(markup.link);

						if (markup.forceInternal || !Wikifier.isExternalLink(link)) {
							el = Wikifier.createInternalLink(el, link, null, setFn);
						}
						else {
							el = Wikifier.createExternalLink(el, link);
						}

						el.classList.add('link-image');
					}

					el = jQuery(document.createElement('img'))
						.appendTo(el)
						.get(0);
					source = Wikifier.helpers.evalPassageId(markup.source);

					// Check for image passage transclusion.
					if (source.slice(0, 5) !== 'data:' && Story.has(source)) {
						const passage = Story.get(source);

						if (passage.tags.includes('Twine.image')) {
							el.setAttribute('data-passage', passage.title);
							source = passage.text;
						}
					}

					el.src = source;

					if (markup.hasOwnProperty('title')) {
						el.title = Wikifier.helpers.evalText(markup.title);
					}

					if (markup.hasOwnProperty('align')) {
						el.align = markup.align;
					}
				}
			},

			{
				name      : 'monospacedByLine',
				match     : '^\\{\\{\\{\\n',
				lookahead : /^\{\{\{\n((?:^[^\n]*\n)+?)(^\}\}\}$\n?)/gm,

				handler(w) {
					this.lookahead.lastIndex = w.matchStart;

					const match = this.lookahead.exec(w.source);

					if (match && match.index === w.matchStart) {
						jQuery(document.createElement('pre'))
							.text(match[1])
							.appendTo(w.output);
						w.nextMatch = this.lookahead.lastIndex;
					}
				}
			},

			{
				name  : 'formatByChar',
				match : "''|//|__|\\^\\^|~~|==|\\{\\{\\{",

				handler(w) {
					switch (w.matchText) {
					case "''":
						w.subWikify(jQuery(document.createElement('strong')).appendTo(w.output).get(0), "''");
						break;

					case '//':
						w.subWikify(jQuery(document.createElement('em')).appendTo(w.output).get(0), '//');
						break;

					case '__':
						w.subWikify(jQuery(document.createElement('u')).appendTo(w.output).get(0), '__');
						break;

					case '^^':
						w.subWikify(jQuery(document.createElement('sup')).appendTo(w.output).get(0), '\\^\\^');
						break;

					case '~~':
						w.subWikify(jQuery(document.createElement('sub')).appendTo(w.output).get(0), '~~');
						break;

					case '==':
						w.subWikify(jQuery(document.createElement('s')).appendTo(w.output).get(0), '==');
						break;

					case '{{{':
						{
							const lookahead = /\{\{\{((?:.|\n)*?)\}\}\}/gm;

							lookahead.lastIndex = w.matchStart;

							const match = lookahead.exec(w.source);

							if (match && match.index === w.matchStart) {
								jQuery(document.createElement('code'))
									.text(match[1])
									.appendTo(w.output);
								w.nextMatch = lookahead.lastIndex;
							}
						}
						break;
					}
				}
			},

			{
				name        : 'customStyle',
				match       : '@@',
				terminator  : '@@',
				blockRegExp : /\s*\n/gm,

				handler(w) {
					const css = Wikifier.helpers.inlineCss(w);

					this.blockRegExp.lastIndex = w.nextMatch; // must follow the call to `inlineCss()`

					const
						blockMatch = this.blockRegExp.exec(w.source),
						blockLevel = blockMatch && blockMatch.index === w.nextMatch,
						$el        = jQuery(document.createElement(blockLevel ? 'div' : 'span'))
							.appendTo(w.output);

					if (css.classes.length === 0 && css.id === '' && Object.keys(css.styles).length === 0) {
						$el.addClass('marked');
					}
					else {
						css.classes.forEach(className => $el.addClass(className));

						if (css.id !== '') {
							$el.attr('id', css.id);
						}

						$el.css(css.styles);
					}

					if (blockLevel) {
						// Skip the leading and, if it exists, trailing newlines.
						w.nextMatch += blockMatch[0].length;
						w.subWikify($el[0], `\\n?${this.terminator}`);
					}
					else {
						w.subWikify($el[0], this.terminator);
					}
				}
			},

			{
				name      : 'verbatimText',
				match     : '"{3}|<nowiki>',
				lookahead : /(?:"{3}((?:.|\n)*?)"{3})|(?:<nowiki>((?:.|\n)*?)<\/nowiki>)/gm,

				handler(w) {
					this.lookahead.lastIndex = w.matchStart;

					const match = this.lookahead.exec(w.source);

					if (match && match.index === w.matchStart) {
						jQuery(document.createElement('span'))
							.addClass('verbatim')
							.text(match[1] || match[2])
							.appendTo(w.output);
						w.nextMatch = this.lookahead.lastIndex;
					}
				}
			},

			{
				name  : 'rule',
				match : '^----+$\\n?|<hr\\s*/?>\\n?',

				handler(w) {
					jQuery(document.createElement('hr')).appendTo(w.output);
				}
			},

			{
				name  : 'emdash',
				match : '--',

				handler(w) {
					jQuery(document.createTextNode('\u2014')).appendTo(w.output);
				}
			},

			{
				name  : 'doubleDollarSign',
				match : '\\${2}', // eslint-disable-line no-template-curly-in-string

				handler(w) {
					jQuery(document.createTextNode('$')).appendTo(w.output);
				}
			},

			{
				name  : 'nakedVariable',
				match : [
					Patterns.variable,
					'(?:(?:\\.',
					Patterns.identifier,
					')|(?:\\[\\d+\\])|(?:\\["(?:\\\\.|[^"\\\\])+"\\])|(?:\\[\'(?:\\\\.|[^\'\\\\])+\'\\])|(?:\\[',
					Patterns.variable,
					'\\]))*'
				].join(''),

				handler(w) {
					const result = toStringOrDefault(Wikifier.getValue(w.matchText), null);

					if (result === null) {
						jQuery(document.createTextNode(w.matchText)).appendTo(w.output);
					}
					else {
						new Wikifier(
							(Config.debug
								? new DebugView(w.output, 'variable', w.matchText, w.matchText) // Debug view setup.
								: w
							).output,
							result
						);
					}
				}
			},

			{
				name       : 'heading',
				match      : '^!{1,6}',
				terminator : '\\n',

				handler(w) {
					const isHeading = (nodes => {
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
					})(w.output.childNodes);

					if (isHeading) {
						w.subWikify(
							jQuery(document.createElement(`h${w.matchLength}`)).appendTo(w.output).get(0),
							this.terminator
						);
					}
					else {
						jQuery(w.output).append(document.createTextNode(w.matchText));
					}
				}
			},

			{
				name           : 'table',
				match          : '^\\|(?:[^\\n]*)\\|(?:[fhck]?)$',
				lookahead      : /^\|([^\n]*)\|([fhck]?)$/gm,
				rowTerminator  : '\\|(?:[cfhk]?)$\\n?',
				cellPattern    : '(?:\\|([^\\n\\|]*)\\|)|(\\|[cfhk]?$\\n?)',
				cellTerminator : '(?:\\u0020*)\\|',
				rowTypes       : { c : 'caption', f : 'tfoot', h : 'thead', '' : 'tbody' }, // eslint-disable-line id-length

				handler(w) {
					const
						table       = jQuery(document.createElement('table')).appendTo(w.output).get(0),
						prevColumns = [];
					let
						curRowType    = null,
						$rowContainer = null,
						rowCount      = 0,
						matched;

					w.nextMatch = w.matchStart;

					do {
						this.lookahead.lastIndex = w.nextMatch;

						const match = this.lookahead.exec(w.source);

						matched = match && match.index === w.nextMatch;

						if (matched) {
							const nextRowType = match[2];

							if (nextRowType === 'k') {
								table.className = match[1];
								w.nextMatch += match[0].length + 1;
							}
							else {
								if (nextRowType !== curRowType) {
									curRowType = nextRowType;
									$rowContainer = jQuery(document.createElement(this.rowTypes[nextRowType]))
										.appendTo(table);
								}

								if (curRowType === 'c') {
									$rowContainer.css('caption-side', rowCount === 0 ? 'top' : 'bottom');
									w.nextMatch += 1;
									w.subWikify($rowContainer[0], this.rowTerminator);
								}
								else {
									this.rowHandler(
										w,
										jQuery(document.createElement('tr'))
											.appendTo($rowContainer)
											.get(0),
										prevColumns
									);
								}

								++rowCount;
							}
						}
					} while (matched);
				},

				rowHandler(w, rowEl, prevColumns) {
					const
						cellRegExp = new RegExp(this.cellPattern, 'gm');
					let
						col         = 0,
						curColCount = 1,
						matched;

					do {
						cellRegExp.lastIndex = w.nextMatch;

						const cellMatch = cellRegExp.exec(w.source);

						matched = cellMatch && cellMatch.index === w.nextMatch;

						if (matched) {
							if (cellMatch[1] === '~') {
								const last = prevColumns[col];

								if (last) {
									++last.rowCount;
									last.$element
										.attr('rowspan', last.rowCount)
										.css('vertical-align', 'middle');
								}

								w.nextMatch = cellMatch.index + cellMatch[0].length - 1;
							}
							else if (cellMatch[1] === '>') {
								++curColCount;
								w.nextMatch = cellMatch.index + cellMatch[0].length - 1;
							}
							else if (cellMatch[2]) {
								w.nextMatch = cellMatch.index + cellMatch[0].length;
								break;
							}
							else {
								++w.nextMatch;

								const
									css = Wikifier.helpers.inlineCss(w);
								let
									spaceLeft  = false,
									spaceRight = false,
									$cell;

								while (w.source.substr(w.nextMatch, 1) === ' ') {
									spaceLeft = true;
									++w.nextMatch;
								}

								if (w.source.substr(w.nextMatch, 1) === '!') {
									$cell = jQuery(document.createElement('th')).appendTo(rowEl);
									++w.nextMatch;
								}
								else {
									$cell = jQuery(document.createElement('td')).appendTo(rowEl);
								}

								prevColumns[col] = {
									rowCount : 1,
									$element : $cell
								};

								if (curColCount > 1) {
									$cell.attr('colspan', curColCount);
									curColCount = 1;
								}

								w.subWikify($cell[0], this.cellTerminator);

								if (w.matchText.substr(w.matchText.length - 2, 1) === ' ') {
									spaceRight = true;
								}

								css.classes.forEach(className => $cell.addClass(className));

								if (css.id !== '') {
									$cell.attr('id', css.id);
								}

								if (spaceLeft && spaceRight) {
									css.styles['text-align'] = 'center';
								}
								else if (spaceLeft) {
									css.styles['text-align'] = 'right';
								}
								else if (spaceRight) {
									css.styles['text-align'] = 'left';
								}

								$cell.css(css.styles);

								w.nextMatch = w.nextMatch - 1;
							}

							++col;
						}
					} while (matched);
				}
			},

			{
				name       : 'list',
				match      : '^(?:(?:\\*+)|(?:#+))',
				lookahead  : /^(?:(\*+)|(#+))/gm,
				terminator : '\\n',

				handler(w) {
					w.nextMatch = w.matchStart;

					const
						destStack = [w.output];
					let
						curType  = null,
						curLevel = 0,
						matched,
						i;

					do {
						this.lookahead.lastIndex = w.nextMatch;

						const match = this.lookahead.exec(w.source);

						matched = match && match.index === w.nextMatch;

						if (matched) {
							const
								newType  = match[2] ? 'ol' : 'ul',
								newLevel = match[0].length;

							w.nextMatch += match[0].length;

							if (newLevel > curLevel) {
								for (i = curLevel; i < newLevel; ++i) {
									destStack.push(
										jQuery(document.createElement(newType))
											.appendTo(destStack[destStack.length - 1])
											.get(0)
									);
								}
							}
							else if (newLevel < curLevel) {
								for (i = curLevel; i > newLevel; --i) {
									destStack.pop();
								}
							}
							else if (newLevel === curLevel && newType !== curType) {
								destStack.pop();
								destStack.push(
									jQuery(document.createElement(newType))
										.appendTo(destStack[destStack.length - 1])
										.get(0)
								);
							}

							curLevel = newLevel;
							curType = newType;
							w.subWikify(
								jQuery(document.createElement('li'))
									.appendTo(destStack[destStack.length - 1])
									.get(0),
								this.terminator
							);
						}
					} while (matched);
				}
			},

			{
				name       : 'quoteByBlock',
				match      : '^<<<\\n',
				terminator : '^<<<\\n',

				handler(w) {
					w.subWikify(
						jQuery(document.createElement('blockquote'))
							.appendTo(w.output)
							.get(0),
						this.terminator
					);
				}
			},

			{
				name       : 'quoteByLine',
				match      : '^>+',
				lookahead  : /^>+/gm,
				terminator : '\\n',
				element    : 'blockquote',

				handler(w) {
					const
						destStack = [w.output];
					let
						curLevel = 0,
						newLevel = w.matchLength,
						matched,
						i;

					do {
						if (newLevel > curLevel) {
							for (i = curLevel; i < newLevel; ++i) {
								destStack.push(
									jQuery(document.createElement(this.element))
										.appendTo(destStack[destStack.length - 1])
										.get(0)
								);
							}
						}
						else {
							if (newLevel < curLevel) {
								for (i = curLevel; i > newLevel; --i) {
									destStack.pop();
								}
							}
						}

						curLevel = newLevel;
						w.subWikify(destStack[destStack.length - 1], this.terminator);
						jQuery(document.createElement('br')).appendTo(destStack[destStack.length - 1]);

						this.lookahead.lastIndex = w.nextMatch;

						const match = this.lookahead.exec(w.source);

						matched = match && match.index === w.nextMatch;

						if (matched) {
							newLevel = match[0].length;
							w.nextMatch += match[0].length;
						}
					} while (matched);
				}
			},

			{
				name      : 'html',
				match     : '<[Hh][Tt][Mm][Ll]>',
				lookahead : /<[Hh][Tt][Mm][Ll]>((?:.|\n)*?)<\/[Hh][Tt][Mm][Ll]>/gm,

				handler(w) {
					this.lookahead.lastIndex = w.matchStart;

					const match = this.lookahead.exec(w.source);

					if (match && match.index === w.matchStart) {
						w.nextMatch = this.lookahead.lastIndex;

						jQuery(document.createDocumentFragment())
							.append(match[1])
							.appendTo(w.output);
					}
				}
			},

			{
				name      : 'commentByBlock',
				match     : '(?:/(?:%|\\*))|(?:<!--)',
				lookahead : /(?:\/(%|\*)(?:(?:.|\n)*?)\1\/)|(?:<!--(?:(?:.|\n)*?)-->)/gm,

				handler(w) {
					this.lookahead.lastIndex = w.matchStart;

					const match = this.lookahead.exec(w.source);

					if (match && match.index === w.matchStart) {
						w.nextMatch = this.lookahead.lastIndex;
					}
				}
			},

			{
				name : 'lineContinuation',

				// NOTE: The end-of-line patter must come first.
				match : `\\\\${Patterns.space}*?(?:\\n|$)|(?:^|\\n)${Patterns.space}*?\\\\`,

				handler(w) {
					w.nextMatch = w.matchStart + w.matchLength;
				}
			},

			{
				name  : 'lineBreak',
				match : '\\n|<br\\s*/?>',

				handler(w) {
					if (w._nobr.length === 0 || !w._nobr[0]) {
						jQuery(document.createElement('br')).appendTo(w.output);
					}
				}
			},

			{
				name  : 'htmlCharacterReference',
				match : '(?:(?:&#?[0-9A-Za-z]{2,8};|.)(?:&#?(?:x0*(?:3[0-6][0-9A-Fa-f]|1D[C-Fc-f][0-9A-Fa-f]|20[D-Fd-f][0-9A-Fa-f]|FE2[0-9A-Fa-f])|0*(?:76[89]|7[7-9][0-9]|8[0-7][0-9]|761[6-9]|76[2-7][0-9]|84[0-3][0-9]|844[0-7]|6505[6-9]|6506[0-9]|6507[0-1]));)+|&#?[0-9A-Za-z]{2,8};)',

				handler(w) {
					jQuery(document.createDocumentFragment())
						.append(w.matchText)
						.appendTo(w.output);
				}
			},

			{
				/*
					NOTE: This formatter MUST come after any formatter which handles HTML tag-like
					      constructs (e.g. html & rawText).
				*/
				name         : 'htmlTag',
				match        : '<\\w+(?:\\s+[^\\u0000-\\u001F\\u007F-\\u009F\\s"\'>\\/=]+(?:\\s*=\\s*(?:"[^"]*?"|\'[^\']*?\'|[^\\s"\'=<>`]+))?)*\\s*\\/?>',
				tagPattern   : '<(\\w+)',
				voidElements : ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr'],
				nobrElements : ['colgroup', 'datalist', 'dl', 'figure', 'ol', 'optgroup', 'select', 'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul'],

				handler(w) {
					const
						tagMatch = new RegExp(this.tagPattern).exec(w.matchText),
						tag      = tagMatch && tagMatch[1],
						tagName  = tag && tag.toLowerCase();

					if (tagName) {
						const
							isVoid = this.voidElements.includes(tagName),
							isNobr = this.nobrElements.includes(tagName);
						let
							terminator,
							terminatorMatch;

						if (!isVoid) {
							terminator = `<\\/${tagName}\\s*>`;

							const terminatorRegExp = new RegExp(terminator, 'gim'); // ignore case during match

							terminatorRegExp.lastIndex = w.matchStart;
							terminatorMatch = terminatorRegExp.exec(w.source);
						}

						if (isVoid || terminatorMatch) {
							let
								output    = w.output,
								el        = document.createElement(w.output.tagName),
								debugView;

							el.innerHTML = w.matchText;

							while (el.firstChild) {
								el = el.firstChild;
							}

							if (el.hasAttribute('data-passage')) {
								this.processDataAttributes(el);

								// Debug view setup.
								if (Config.debug) {
									debugView = new DebugView(
										w.output,
										`html-${tagName}`,
										tagName,
										w.matchText
									);
									debugView.modes({
										block   : tagName === 'img',
										nonvoid : terminatorMatch
									});
									output = debugView.output;
								}
							}

							if (terminatorMatch) {
								if (isNobr) {
									w._nobr.unshift(true);
								}
								else if (w._nobr.length > 0) {
									w._nobr.unshift(false);
								}

								try {
									w.subWikify(el, terminator, true); // ignore case during match

									/*
										Debug view modification.  If the current element has any debug
										view descendants who have "block" mode set, then set its debug
										view to the same.  It just makes things look a bit nicer.
									*/
									if (debugView && jQuery(el).find('.debug.block').length > 0) {
										debugView.modes({ block : true });
									}
								}
								finally {
									if (w._nobr.length > 0) {
										w._nobr.shift();
									}
								}
							}

							output.appendChild(el);
						}
						else {
							throwError(w.output, `HTML tag "${tag}" is not closed`, `${w.matchText}\u2026`);
						}
					}
				},

				processDataAttributes(el) {
					let passage = el.getAttribute('data-passage');

					if (passage == null) { // lazy equality for null
						return;
					}

					const evaluated = Wikifier.helpers.evalPassageId(passage);

					if (evaluated !== passage) {
						passage = evaluated;
						el.setAttribute('data-passage', evaluated);
					}

					if (passage !== '') {
						if (el.tagName.toUpperCase() === 'IMG') {
							// Handle image passage transclusion.
							if (passage.slice(0, 5) !== 'data:' && Story.has(passage)) {
								passage = Story.get(passage);
								if (passage.tags.includes('Twine.image')) {
									el.src = passage.text.trim();
								}
							}
						}
						else {
							let
								setter = el.getAttribute('data-setter'),
								setFn;

							if (setter != null) { // lazy equality for null
								setter = String(setter).trim();

								if (setter !== '') {
									setFn = (ex => () => Scripting.evalJavaScript(ex))(Scripting.parse(setter));
								}
							}

							if (Story.has(passage)) {
								el.classList.add('link-internal');

								if (Config.addVisitedLinkClass && State.hasPlayed(passage)) {
									el.classList.add('link-visited');
								}
							}
							else {
								el.classList.add('link-broken');
							}

							jQuery(el).ariaClick({ one : true }, function () {
								if (typeof setFn === 'function') {
									setFn.call(this);
								}

								Engine.play(passage);
							});
						}
					}
				}
			}
		]
	}); // End formatters


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Wikifier;
})();
/* eslint-enable max-len */
