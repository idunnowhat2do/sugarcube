/***********************************************************************************************************************
 *
 * wikifier.js
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
	global DebugView, Macro, MacroContext, State, Story, Util, config, evalJavaScript, evalTwineScript, insertElement,
	       insertText, macros, printableStringOrDefault, removeChildren, removeElement, temp, throwError
*/

/*
	TODO: The Wikifier, and associated code, could stand to receive a serious refactoring.
*/
/* eslint-disable max-len */
var Wikifier = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	var
		_formatterCache, // the Wikifier formatter object cache
		_unicodeOk      = /[\u0150\u0170]/g.test("\u0150"); // some versions of Safari do not handle Unicode properly


	/*******************************************************************************************************************
	 * Constructor
	 ******************************************************************************************************************/
	function Wikifier(place, source) {
		// General Wikifier properties.
		this.formatter = _formatterCache || Wikifier.compileFormatters();
		this.output    = place != null ? place : document.createDocumentFragment(); // lazy equality for null
		this.source    = source;
		this.nextMatch = 0;

		// Formatter-related properties.
		this._rawArgs  = "";
		this._nobr     = [];

		// Wikify the source into the output buffer element.
		this.subWikify(this.output);

		// Remove the temp output buffer element; unnecessary, as the browser will eventually
		// GC the element, however, it's better to clean up after ourselves and not generate
		// garbage in the first place.
		if (place == null && typeof this.output.remove === "function") { // lazy equality for null
			this.output.remove();
		}
	}


	/*******************************************************************************************************************
	 * Prototype Methods
	 ******************************************************************************************************************/
	Object.defineProperties(Wikifier.prototype, {
		subWikify : {
			value : function (output, terminator, terminatorIgnoreCase) {
				// Temporarily replace the output buffer.
				var oldOutput = this.output;
				this.output = output;

				var	terminatorRegExp = terminator ? new RegExp("(?:" + terminator + ")", terminatorIgnoreCase ? "gim" : "gm") : null,
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
					if (terminatorMatch && (!formatterMatch || terminatorMatch.index <= formatterMatch.index)) { // terminator match
						// Output any text before the match.
						if (terminatorMatch.index > this.nextMatch) {
							this.outputText(this.output, this.nextMatch, terminatorMatch.index);
						}

						// Set the match parameters.
						this.matchStart  = terminatorMatch.index;
						this.matchLength = terminatorMatch[0].length;
						this.matchText   = terminatorMatch[0];
						this.nextMatch   = terminatorRegExp.lastIndex;

						// Restore the output pointer and exit.
						this.output = oldOutput;
						return;
					} else if (formatterMatch) { // formatter match
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
						var matchingFormatter = -1;
						for (var i = 1; i < formatterMatch.length; ++i) {
							if (formatterMatch[i]) {
								matchingFormatter = i - 1;
								break; // stop once we've found the matching formatter
							}
						}

						// Call the formatter.
						if (matchingFormatter !== -1) {
							this.formatter.formatters[matchingFormatter].handler(this);
							if (temp.state.break != null) { break; } // lazy equality for null
						}
					}
				} while (terminatorMatch || formatterMatch);

				if (temp.state.break == null) { // lazy equality for null
					// Output any text after the last match.
					if (this.nextMatch < this.source.length) {
						this.outputText(this.output, this.nextMatch, this.source.length);
						this.nextMatch = this.source.length;
					}
				} else if (
					   this.output.lastChild
					&& this.output.lastChild.nodeType === Node.ELEMENT_NODE
					&& this.output.lastChild.nodeName.toUpperCase() === "BR"
				) {
					// In case of <<break>>/<<continue>>, remove the last <br>.
					removeElement(this.output.lastChild);
				}

				// Restore the output buffer.
				this.output = oldOutput;
			}
		},

		outputText : {
			value : function (place, startPos, endPos) {
				insertText(place, this.source.substring(startPos, endPos));
			}
		},

		/*
			Meant to be called by macros, this returns the raw, unprocessed, text given to the
			currently executing macro.  Unlike TiddlyWiki's default mechanism, this does not
			attempt to split up the arguments into an array.
		*/
		rawArgs : {
			value : function () {
				return this._rawArgs;
			}
		},

		/*
			Meant to be called by macros, this returns the text given to the currently executing
			macro after doing TwineScript-to-JavaScript transformations.
		*/
		fullArgs : {
			value : function () {
				return Wikifier.parse(this.rawArgs());
			}
		}
	});


	/*******************************************************************************************************************
	 * Static Methods
	 ******************************************************************************************************************/
	Object.defineProperties(Wikifier, {
		/*
			Returns a compiled Wikifier formatter object.
		*/
		compileFormatters : {
			value : function () {
				if (DEBUG) { console.log("[Wikifier.compileFormatters]"); }
				var	formatters = Wikifier.formatters,
					patterns   = [];
				for (var i = 0, iend = formatters.length; i < iend; ++i) {
					patterns.push("(" + formatters[i].match + ")");
				}
				_formatterCache = {
					"formatters"      : formatters,
					"formatterRegExp" : new RegExp(patterns.join("|"), "gm")
				};
				return _formatterCache;
			}
		},

		/*
			Returns the given string after converting all TwineScript syntactical sugars to
			their native JavaScript counterparts.
		*/
		parse : {
			value : function (code) {
				// Groups: 1=Double quoted | 2=Single quoted | 3=Empty quotes | 4=Operator delimiters | 5=Barewords
				var	re      = new RegExp("(?:(?:\"((?:(?:\\\\\")|[^\"])+)\")|(?:'((?:(?:\\\\\')|[^'])+)')|((?:\"\")|(?:''))|([=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}]+)|([^\"'=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}\\s]+))", "g"),
					match,
					varTest = new RegExp("^" + Wikifier.textPrimitives.variable),
					map     = {
						// Story $variable sigil-prefix.
						"$"     : "State.variables.",
						// Temporary _variable sigil-prefix.
						"_"     : "temp.variables.",
						// Assignment operators.
						"to"    : "=",
						// Equality operators.
						"eq"    : "==",
						"neq"   : "!=",
						"is"    : "===",
						"isnot" : "!==",
						// Relational operators.
						"gt"    : ">",
						"gte"   : ">=",
						"lt"    : "<",
						"lte"   : "<=",
						// Logical operators.
						"and"   : "&&",
						"or"    : "||",
						// Unary operators.
						"not"   : "!",
						"def"   : '"undefined" !== typeof',
						"ndef"  : '"undefined" === typeof'
					};

				while ((match = re.exec(code)) !== null) {
					// no-op: Double quoted | Single quoted | Empty quotes | Operator delimiters

					/*
						Barewords.
					*/
					if (match[5]) {
						var token = match[5];

						/*
							If the token is simply a dollar-sign or underscore, then it's either
							just the raw character or, probably, a function alias, so skip it.
						*/
						if (token === "$" || token === "_") {
							continue;
						}

						/*
							If the token is a story $variable or temporary _variable, reset it
							to just its sigil—for later mapping.
						*/
						else if (varTest.test(token)) {
							token = token[0];
						}

						/*
							If the token is `is`, check to see if it's followed by `not`, if so,
							convert them into the `isnot` operator.

							n.b. This is a safety feature, since `$a is not $b` probably sounds
							     reasonable to most users.
						*/
						else if (token === "is") {
							var	start = re.lastIndex,
								part  = code.slice(start);
							if (/^\s+not\b/.test(part)) {
								code = code.splice(start, part.search(/\S/));
								token = "isnot";
							}
						}

						/*
							If the finalized token has a mapping, replace it within the code
							string with its counterpart.

							n.b. We must use `map.hasOwnProperty(token)` here, rather than simply
							     using something like `map[token]`, otherwise tokens which match
							     properties from the prototype chain will cause shenanigans.
						*/
						if (map.hasOwnProperty(token)) {
							code = code.splice(
								match.index,  // starting index
								token.length, // replace how many
								map[token]    // replacement string
							);
							re.lastIndex += map[token].length - token.length;
						}
					}
				}
				return code;
			}
		},

		/*
			Returns the value of the given story/temporary variable.
		*/
		getValue : {
			value : function (storyVar) {
				var	varData = Wikifier.parseStoryVariable(storyVar),
					retVal;

				if (varData !== null) {
					retVal = varData.store;
					var pNames = varData.names;
					for (var i = 0, iend = pNames.length; i < iend; ++i) {
						if (typeof retVal[pNames[i]] !== "undefined") {
							retVal = retVal[pNames[i]];
						} else {
							retVal = undefined;
							break;
						}
					}
				}
				return retVal;
			}
		},

		/*
			Sets the value of the given story/temporary variable.
		*/
		setValue : {
			value : function (storyVar, newValue) {
				var varData = Wikifier.parseStoryVariable(storyVar);

				if (varData !== null) {
					var	baseObj = varData.store,
						pNames  = varData.names,
						varName = pNames.pop();
					for (var i = 0, iend = pNames.length; i < iend; ++i) {
						if (typeof baseObj[pNames[i]] !== "undefined") {
							baseObj = baseObj[pNames[i]];
						} else {
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
		},

		/*
			Returns the property name chain of the given story/temporary variable, which may be
			of arbitrary complexity.
		*/
		parseStoryVariable : {
			value : function (varText) {
				var	re     = new RegExp(
						  "^(?:"
						+ Wikifier.textPrimitives.variableSigil
						+ "("
						+ Wikifier.textPrimitives.identifier
						+ ")|\\.("
						+ Wikifier.textPrimitives.identifier
						+ ")|\\[(?:(?:\"((?:\\\\.|[^\"\\\\])+)\")|(?:'((?:\\\\.|[^'\\\\])+)')|("
						+ Wikifier.textPrimitives.variableSigil
						+ Wikifier.textPrimitives.identifierFirstChar
						+ ".*)|(\\d+))\\])"
					),
					match,
					retVal = {
						store : varText[0] === "$" ? State.variables : temp.variables,
						names : []
					};

				while ((match = re.exec(varText)) !== null) {
					// Remove full match from varText.
					varText = varText.slice(match[0].length);

					if (match[1]) {
						// Base variable.
						retVal.names.push(match[1]);
					} else if (match[2]) {
						// Dot property.
						retVal.names.push(match[2]);
					} else if (match[3]) {
						// Square-bracketed property (double quoted).
						retVal.names.push(match[3]);
					} else if (match[4]) {
						// Square-bracketed property (single quoted).
						retVal.names.push(match[4]);
					} else if (match[5]) {
						// Square-bracketed property (embedded variable).
						retVal.names.push(Wikifier.getValue(match[5]));
					} else if (match[6]) {
						// Square-bracketed property (numeric index).
						retVal.names.push(Number(match[6]));
					}
				}
				return varText === "" ? retVal : null;
			}
		},

		/*
			Returns the output generated by wikifying the given text, throwing if there were errors.
		*/
		wikifyEval : {
			value : function (text) {
				var output = document.createDocumentFragment();
				new Wikifier(output, text);

				var errors = output.querySelector(".error");
				if (errors !== null) {
					throw new Error(errors.textContent.replace(/^(?:(?:Uncaught\s+)?Error:\s+)+/, ""));
				}

				return output;
			}
		},

		/*
			Create and return an internal link.
		*/
		createInternalLink : {
			value : function (place, passage, text, callback) {
				var el = document.createElement("a");
				if (passage != null) { // lazy equality for null
					el.setAttribute("data-passage", passage);
					if (Story.has(passage)) {
						el.classList.add("link-internal");
						if (config.addVisitedLinkClass && State.has(passage)) {
							el.classList.add("link-visited");
						}
					} else {
						el.classList.add("link-broken");
					}
					jQuery(el).ariaClick({ one : true }, function () {
						if (typeof callback === "function") {
							callback();
						}
						State.play(passage);
					});
				}
				if (text) {
					insertText(el, text);
				}
				if (place) {
					place.appendChild(el);
				}
				return el;
			}
		},

		/*
			Create and return an external link.
		*/
		createExternalLink : {
			value : function (place, url, text) {
				var el = insertElement(place, "a", null, "link-external", text);
				el.target = "_blank";
				if (url != null) { // lazy equality for null
					el.href = url;
					el.setAttribute("tabindex", 0); // for accessiblity
				}
				return el;
			}
		},

		/*
			Returns whether the given link source is external (probably).
		*/
		isExternalLink : {
			value : function (link) {
				if (Story.has(link)) {
					return false;
				}

				var urlRegExp = new RegExp("^" + Wikifier.textPrimitives.url, "gim");
				return urlRegExp.test(link) || /[\.\/\\#]/.test(link);
			}
		},

		/*
			Legacy Aliases.
		*/
		evalExpression : { value : evalTwineScript }, // External (see: utility/helperfunctions.js).
		evalStatements : { value : evalTwineScript }  // External (see: utility/helperfunctions.js).
	});


	/*******************************************************************************************************************
	 * Text Primitives (Regular Expression Patterns)
	 ******************************************************************************************************************/
	Object.defineProperty(Wikifier, "textPrimitives", { value : {} });

	/*
		Character patterns.
	*/
	Object.defineProperty(Wikifier.textPrimitives, "anyLetter", {
		value : "[0-9A-Z_a-z\\-\\u00C0-\\u00D6\\u00D8-\\u00DE\\u00DF-\\u00F6\\u00F8-\\u00FF" + (
			_unicodeOk ? "\\u0150\\u0170\\u0151\\u0171" /* Include surrogate pairs: "\\uD800-\\uDFFF" ? */ : ""
		) + "]"
	});

	/*
		Identifier patterns.

		n.b. These are kludges.  Since JavaScript's RegExp syntax isn't fully Unicode-enabled,
		     not supporting Unicode character classes, the correct regular expression to match
		     a valid identifier (within the scope of our needs) would be on the order of 11 kB.
		     That being the case, for the time being, we restrict valid TwineScript identifiers
		     to US-ASCII.
	*/
	Object.defineProperty(Wikifier.textPrimitives, "identifierFirstChar", {
		value : "[$A-Z_a-z]"
	});
	Object.defineProperty(Wikifier.textPrimitives, "identifier", {
		value : Wikifier.textPrimitives.identifierFirstChar + "[$0-9A-Z_a-z]*"
	});

	/*
		Variable patterns.
	*/
	Object.defineProperty(Wikifier.textPrimitives, "variableSigil", {
		value : "[$_]"
	});
	Object.defineProperty(Wikifier.textPrimitives, "variable", {
		value : Wikifier.textPrimitives.variableSigil + Wikifier.textPrimitives.identifier
	});

	/*
		Inline CSS pattern.
	*/
	Object.defineProperty(Wikifier.textPrimitives, "inlineCSS", {
		value : [
			"(?:(" + Wikifier.textPrimitives.anyLetter + "+)\\(([^\\)\\|\\n]+)\\):)", // [1,2]=style(value):
			"(?:(" + Wikifier.textPrimitives.anyLetter + "+):([^;\\|\\n]+);)",        // [3,4]=style:value;
			"(?:((?:\\." + Wikifier.textPrimitives.anyLetter + "+)+);)",              // [5]  =.className;
			"(?:((?:#" + Wikifier.textPrimitives.anyLetter + "+)+);)"                 // [6]  =#id;
		].join("|")
	});

	/*
		URL pattern.
	*/
	Object.defineProperty(Wikifier.textPrimitives, "url", {
		value : "(?:file|https?|mailto|ftp|javascript|irc|news|data):[^\\s'\"]+(?:/|\\b)"
	});


	/*******************************************************************************************************************
	 * Helper Static Methods
	 ******************************************************************************************************************/
	Object.defineProperty(Wikifier, "helpers", { value : {} });

	Object.defineProperties(Wikifier.helpers, {
		charFormat : {
			value : function (w) {
				w.subWikify(insertElement(w.output, this.element), this.terminator);
			}
		},

		inlineCSS : {
			value : function (w) {
				var	css             = { styles : [], classes : [], id : "" },
					lookaheadRegExp = new RegExp(Wikifier.textPrimitives.inlineCSS, "gm"),
					matched;
				do {
					lookaheadRegExp.lastIndex = w.nextMatch;
					var	lookaheadMatch = lookaheadRegExp.exec(w.source);
					matched = lookaheadMatch && lookaheadMatch.index === w.nextMatch;
					if (matched) {
						if (lookaheadMatch[1]) {
							css.styles.push({
								style : Wikifier.helpers.cssToDOMName(lookaheadMatch[1]),
								value : lookaheadMatch[2].trim()
							});
						} else if (lookaheadMatch[3]) {
							css.styles.push({
								style : Wikifier.helpers.cssToDOMName(lookaheadMatch[3]),
								value : lookaheadMatch[4].trim()
							});
						} else if (lookaheadMatch[5]) {
							css.classes = css.classes.concat(lookaheadMatch[5].slice(1).split(/\./));
						} else if (lookaheadMatch[6]) {
							css.id = lookaheadMatch[6].slice(1).split(/#/).pop();
						}
						w.nextMatch = lookaheadRegExp.lastIndex;
					}
				} while (matched);
				return css;
			}
		},

		cssToDOMName : {
			value : function (name) {
				// Returns a DOM property name for a CSS property, parsed from the string.
				if (!name.contains("-")) {
					switch (name) {
					case "bgcolor": name = "backgroundColor"; break;
					case "float":   name = "cssFloat"; break;
					}
					return name;
				}
				var parts = name.split("-");
				for (var i = 1; i < parts.length; ++i) {
					parts[i] = parts[i].slice(0, 1).toUpperCase() + parts[i].slice(1);
				}
				return parts.join("");
			}
		},

		evalText : {
			value : function (text) {
				var result;
				try {
					result = evalTwineScript(text);
					if (result == null || typeof result === "function") { // use lazy equality for null
						result = text;
					} else {
						result = String(result);
						if (/\[(?:object(?:\s+[^\]]+)?|native\s+code)\]/.test(result)) {
							result = text;
						}
					}
				} catch (e) {
					result = text;
				}
				return result;
			}
		},

		evalPassageId : {
			value : function (passage) {
				if (passage != null && !Story.has(passage)) { // lazy equality for null; `0` is a valid name, so we cannot simply evaluate `passage`
					passage = Wikifier.helpers.evalText(passage);
				}
				return passage;
			}
		},

		parseSquareBracketedMarkup : {
			/* eslint-disable no-use-before-define, no-labels */
			value : function (w) {
				var	next = function () {
						if (pos >= w.source.length) {
							return EOF;
						}
						return w.source[pos++];
					},
					peek = function () {
						if (pos >= w.source.length) {
							return EOF;
						}
						return w.source[pos];
					},
					peekAhead = function (count) {
						if (count < 1 || pos + count >= w.source.length) {
							return EOF;
						}
						return w.source[pos + count];
					},
					error = function (/* variadic: fmt [, … ] */) {
						return {
							error : String.format.apply(null, arguments),
							pos   : pos
						};
					},
					ignore = function () {
						start = pos;
					},
					emit = function (type) {
						var text = w.source.slice(start, pos).trim();
						if (text === "") {
							throw new Error("malformed wiki " + (isLink ? "link" : "image") + ", empty " + type + " component");
						}
						if (type === "link" && text[0] === '~') {
							item.forceInternal = true;
							item.link = text.slice(1);
						} else {
							item[type] = text;
						}
						start = pos;
					},
					slurpQuote = function (endQuote) {
						++pos;
						loop: for (;;) {
							switch (peek()) {
							case '\\':
								++pos;
								var c = peek(); // eslint-disable-line no-shadow
								if (c !== EOF && c !== '\n') {
									break;
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
					},
					EOF    = -1,           // end of file (string, really)
					item   = {},           // scanned item object
					start  = w.matchStart, // start position of a component
					pos    = start + 1,    // current position in w.source
					depth,                 // current square bracket nesting depth
					cid,                   // current component ID
					isLink,                // markup is a link, else image
					c;

				// [[text|~link][setter]]
				// [<>img[title|source][~link][setter]]

				// Scan left delimiter.
				c = peek();
				if (c === '[') {
					// Link.
					isLink = item.isLink = true;
				} else {
					// Image.
					isLink = false;
					switch (c) {
					case '<':
						item.align = "left";
						++pos;
						break;
					case '>':
						item.align = "right";
						++pos;
						break;
					}
					if (!/^[Ii][Mm][Gg]$/.test(w.source.slice(pos, pos + 3))) {
						return error("malformed square-bracketed wiki markup");
					}
					pos += 3;
					item.isImage = true;
				}

				// Scan for sections.
				if (next() !== '[') {
					return error("malformed wiki {0}", isLink ? "link" : "image");
				}
				depth = 1;
				cid = 0; // 0=title, 1=link(link)|source(image), 2=setter(link)|link(image), 3=setter(image)
				ignore();
				try {
					loop: for (;;) {
						switch ((c = peek())) { // eslint-disable-line no-extra-parens
						case EOF:
						case '\n':
							return error("unterminated wiki {0}", isLink ? "link" : "image");
						case '"':
							/*
								This is not entirely reliable within the non-setter component sections (i.e. the
								sections which allow raw strings), since it's possible, however unlikely, for a raw
								string to contain unpaired double quotes.  The likelihood is low enough, however,
								that I'm deeming the risk acceptable, for now at least.
							*/
							if (slurpQuote(c) === EOF) {
								return error("unterminated double quoted string in wiki {0}", isLink ? "link" : "image");
							}
							break;
						case "'":
							/*
								Disallow the use of single quotes as delimiters for quoted strings within all but
								the setter component section, since it's entirely possible for raw strings to contain
								unpaired single quotes.
							*/
							if (cid === 4 || cid === 3 && isLink) {
								if (slurpQuote(c) === EOF) {
									return error("unterminated single quoted string in wiki {0}", isLink ? "link" : "image");
								}
							}
							break;
						case '|': // core section pipe ('|') separator
							if (cid === 0) {
								emit(isLink ? "text" : "title");
								++start;
								cid = 1;
							}
							break;
						case '-': // possible core section right arrow ("->") separator (Twine 2 extension)
							if (cid === 0 && peekAhead(1) === '>') {
								emit(isLink ? "text" : "title");
								++pos;
								start += 2;
								cid = 1;
							}
							break;
						case '<': // possible core section left arrow ("<-") separator (Twine 2 extension)
							if (cid === 0 && peekAhead(1) === '-') {
								emit(isLink ? "link" : "source");
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
									emit(isLink ? "link" : "source");
									cid = 3;
									break;
								case 2: // core section (already emitted link-link|image-source)
									emit(isLink ? "text" : "title");
									cid = 3;
									break;
								case 3: // link-setter|image-link section
									if (isLink) {
										emit("setter");
										cid = -1;
									} else {
										emit("link");
										cid = 4;
									}
									break;
								case 4: // image-setter section
									emit("setter");
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
				} catch (e) {
					return error(e.message);
				}
				item.pos = pos;

				return item;
			}
			/* eslint-enable no-use-before-define, no-labels */
		}
	});


	/*******************************************************************************************************************
	 * Wiki Formatters
	 ******************************************************************************************************************/
	Object.defineProperty(Wikifier, "formatters", {
		value : [
			{
				name            : "macro",
				match           : "<<",
				lookaheadRegExp : /<<(\/?[A-Za-z][^>\s]*|[=-])(?:\s*)((?:(?:\"(?:\\.|[^\"\\])*\")|(?:\'(?:\\.|[^\'\\])*\')|(?:\[(?:[<>]?[Ii][Mm][Gg])?\[[^\r\n]*?\]\]+)|[^>]|(?:>(?!>)))*)>>/gm,
				argsPattern     : "(?:" + [
					'("(?:\\\\.|[^"\\\\])+")',                          // 1=Double quoted
					"('(?:\\\\.|[^'\\\\])+')",                          // 2=Single quoted
					"(\"\"|'')",                                        // 3=Empty quotes
					"(\\[(?:[<>]?[Ii][Mm][Gg])?\\[[^\\r\\n]*?\\]\\]+)", // 4=Double square-bracketed
					"([^\"'`\\s]\\S*)"                                  // 5=Barewords
				].join("|") + ")",
				working : { source : "", name : "", handler : "", arguments : "", index : 0 }, // the working parse object
				context : null, // last execution context object (top-level macros, hierarchically, have a null context)
				handler : function (w) {
					var matchStart = this.lookaheadRegExp.lastIndex = w.matchStart;
					if (this.parseTag(w)) {
						/*
							If `parseBody()` is called below, it will modify the current working
							values, so we must cache them now.
						*/
						var	nextMatch = w.nextMatch,
							source    = this.working.source,
							name      = this.working.name,
							handler   = this.working.handler,
							rawArgs   = this.working.arguments;

						try {
							var macro = Macro.get(name);
							if (macro) {
								var payload = null;
								if (macro.hasOwnProperty("tags")) {
									payload = this.parseBody(w, macro);
									if (!payload) {
										w.nextMatch = nextMatch; // we must reset `w.nextMatch` here, as `parseBody()` modifies it
										return throwError(w.output, "cannot find a closing tag for macro <<" + name + ">>",
											w.source.slice(matchStart, w.nextMatch) + "\u2026");
									}
								}
								if (typeof macro[handler] === "function") {
									var args = this.createArgs(rawArgs, macro.hasOwnProperty("skipArgs") && !!macro.skipArgs);

									/*
										New-style macros.
									*/
									if (macro.hasOwnProperty("_MACRO_API")) {
										/*
											Add the macro's execution context to the context chain.
										*/
										this.context = new MacroContext({
											parent  : this.context,
											macro   : macro,
											name    : name,
											args    : args,
											payload : payload,
											parser  : w,
											source  : source
										});

										/*
											Call the handler.

											n.b. There's no catch clause here because this try/finally exists simply
											     to ensure that the execution context is properly restored in the event
											     that an uncaught exception is thrown during the handler call.
										*/
										try {
											macro[handler].call(this.context);
										} finally {
											this.context = this.context.parent;
										}
									}

									/*
										Old-style macros.
									*/
									else {
										var prevRawArgs = w._rawArgs;
										w._rawArgs = rawArgs; // cache the raw arguments for use by `Wikifier.rawArgs()` & `Wikifier.fullArgs()`
										macro[handler](w.output, name, args, w, payload);
										w._rawArgs = prevRawArgs;
									}
								} else {
									return throwError(w.output, "macro <<" + name + '>> handler function "' + handler + '" '
										+ (macro.hasOwnProperty(handler) ? "is not a function" : "does not exist"), w.source.slice(matchStart, w.nextMatch));
								}
							} else if (Macro.tags.has(name)) {
								var tags = Macro.tags.get(name);
								return throwError(w.output, "child tag <<" + name + ">> was found outside of a call to its parent macro"
									+ (tags.length === 1 ? '' : 's') + " <<" + tags.join(">>, <<") + ">>",
									  w.source.slice(matchStart, w.nextMatch));
							} else {
								return throwError(w.output, "macro <<" + name + ">> does not exist", w.source.slice(matchStart, w.nextMatch));
							}
						} catch (e) {
							return throwError(w.output, "cannot execute " + (macro && macro.isWidget ? "widget" : "macro") + " <<" + name + ">>: " + e.message,
								w.source.slice(matchStart, w.nextMatch));
						} finally {
							this.working.source    = "";
							this.working.name      = "";
							this.working.handler   = "";
							this.working.arguments = "";
							this.working.index     = 0;
						}
					} else {
						w.outputText(w.output, w.matchStart, w.nextMatch);
					}
				},
				parseTag : function (w) {
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart && lookaheadMatch[1]) {
						w.nextMatch = this.lookaheadRegExp.lastIndex;
						this.working.source = w.source.slice(lookaheadMatch.index, this.lookaheadRegExp.lastIndex);
						var fnSigil = lookaheadMatch[1].indexOf("::");
						if (fnSigil !== -1) {
							this.working.name = lookaheadMatch[1].slice(0, fnSigil);
							this.working.handler = lookaheadMatch[1].slice(fnSigil + 2);
						} else {
							this.working.name = lookaheadMatch[1];
							this.working.handler = "handler";
						}
						this.working.arguments = lookaheadMatch[2];
						this.working.index = lookaheadMatch.index;

						return true;
					}
					return false;
				},
				parseBody : function (w, macro) {
					var	openTag      = this.working.name,
						closeTag     = "/" + openTag,
						closeAlt     = "end" + openTag,
						bodyTags     = Array.isArray(macro.tags) ? macro.tags : false,
						end          = -1,
						opened       = 1,
						curSource    = this.working.source,
						curTag       = this.working.name,
						curArgument  = this.working.arguments,
						contentStart = w.nextMatch,
						payload      = [],
						skipArgs     = macro.hasOwnProperty("skipArgs") && !!macro.skipArgs;

					while ((w.matchStart = w.source.indexOf(this.match, w.nextMatch)) !== -1) {
						if (!this.parseTag(w)) {
							this.lookaheadRegExp.lastIndex = w.nextMatch = w.matchStart + this.match.length;
							continue;
						}

						var	tagSource = this.working.source,
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
								for (var i = 0, iend = bodyTags.length; i < iend; ++i) {
									if (tagName === bodyTags[i]) {
										payload.push({
											source    : curSource,
											name      : curTag,
											arguments : curArgument,
											args      : this.createArgs(curArgument, skipArgs),
											contents  : w.source.slice(contentStart, tagBegin)
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
								args      : this.createArgs(curArgument, skipArgs),
								contents  : w.source.slice(contentStart, tagBegin)
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
				createArgs : function (rawArgsString, skipArgs) {
					var args = !skipArgs ? this.parseArgs(rawArgsString) : [];

					// Extend the args array with the raw and full argument strings.
					Object.defineProperties(args, {
						raw : {
							value : rawArgsString
						},
						full : {
							value : Wikifier.parse(rawArgsString)
						}
					});

					return args;
				},
				parseArgs : function (rawArgsString) {
					// Groups: 1=Double quoted | 2=Single quoted | 3=Empty quotes | 4=Double square-bracketed | 5=Barewords
					var	re      = new RegExp(this.argsPattern, "gm"),
						match,
						args    = [],
						varTest = new RegExp("^" + Wikifier.textPrimitives.variable);

					while ((match = re.exec(rawArgsString)) !== null) {
						var arg;

						// Double quoted.
						if (match[1]) {
							arg = match[1];

							// Evaluate the string to handle escaped characters.
							try {
								arg = evalJavaScript(arg);
							} catch (e) {
								throw new Error("unable to parse macro argument '" + arg + "': " + e.message);
							}
						}

						// Single quoted.
						else if (match[2]) {
							arg = match[2];

							// Evaluate the string to handle escaped characters.
							try {
								arg = evalJavaScript(arg);
							} catch (e) {
								throw new Error('unable to parse macro argument "' + arg + '": ' + e.message);
							}
						}

						// Empty quotes.
						else if (match[3]) {
							arg = "";
						}

						// Double square-bracketed.
						else if (match[4]) {
							arg = match[4];

							var markup = Wikifier.helpers.parseSquareBracketedMarkup({
									source     : arg,
									matchStart : 0
								});
							if (markup.hasOwnProperty("error")) {
								throw new Error('unable to parse macro argument "' + arg + '": ' + markup.error);
							}
							if (markup.pos < arg.length) {
								throw new Error('unable to parse macro argument "' + arg + '": unexpected character(s) "'
									+ arg.slice(markup.pos) + '" (pos: ' + markup.pos + ')');
							}

							// Convert to a link or image object.
							if (markup.isLink) {
								// .isLink, [.text], [.forceInternal], .link, [.setter]
								arg = { isLink : true };
								arg.count    = markup.hasOwnProperty("text") ? 2 : 1;
								arg.link     = Wikifier.helpers.evalPassageId(markup.link);
								arg.text     = markup.hasOwnProperty("text") ? Wikifier.helpers.evalText(markup.text) : arg.link;
								arg.external = !markup.forceInternal && Wikifier.isExternalLink(arg.link);
								arg.setFn    = markup.hasOwnProperty("setter")
									? (function (ex) { return function () { evalTwineScript(ex); }; })(markup.setter)
									: null;
							} else if (markup.isImage) {
								// .isImage, [.align], [.title], .source, [.forceInternal], [.link], [.setter]
								arg = (function (source) {
									var imgObj = {
											isImage : true,
											source  : source
										};
									// Check for Twine 1.4 Base64 image passage transclusion.
									if (source.slice(0, 5) !== "data:" && Story.has(source)) {
										var passage = Story.get(source);
										if (passage.tags.contains("Twine.image")) {
											imgObj.source  = passage.text;
											imgObj.passage = passage.title;
										}
									}
									return imgObj;
								})(markup.source);
								if (markup.hasOwnProperty("align")) {
									arg.align = markup.align;
								}
								if (markup.hasOwnProperty("title")) {
									arg.title = Wikifier.helpers.evalText(markup.title);
								}
								if (markup.hasOwnProperty("link")) {
									arg.link     = Wikifier.helpers.evalPassageId(markup.link);
									arg.external = !markup.forceInternal && Wikifier.isExternalLink(arg.link);
								}
								arg.setFn = markup.hasOwnProperty("setter")
									? (function (ex) { return function () { evalTwineScript(ex); }; })(markup.setter)
									: null;
							}
						}

						// Barewords.
						else if (match[5]) {
							arg = match[5];

							if (varTest.test(arg)) {
								// variable, so substitute its value.
								arg = Wikifier.getValue(arg);
							} else if (/^(?:settings|setup)[\.\[]/.test(arg)) {
								// Settings or setup object, so try to evaluate it.
								try {
									arg = evalTwineScript(arg);
								} catch (e) {
									throw new Error('unable to parse macro argument "' + arg + '": ' + e.message);
								}
							} else if (/^(?:\{.*\}|\[.*\])$/.test(arg)) {
								// Object or Array literal, so try to evaluate it.
								//   n.b. Authors really shouldn't be passing object/array literals as arguments.  If they want to
								//        pass a complex type, then store it in a variable and pass that instead.
								try {
									// The parens are to protect object literals from being confused with block statements.
									arg = evalTwineScript("(" + arg + ")");
								} catch (e) {
									throw new Error('unable to parse macro argument "' + arg + '": ' + e.message);
								}
							} else if (arg === "null") {
								// Null literal, so convert it into null.
								arg = null;
							} else if (arg === "undefined") {
								// Undefined literal, so convert it into undefined.
								arg = undefined;
							} else if (arg === "true") {
								// Boolean true literal, so convert it into boolean true.
								arg = true;
							} else if (arg === "false") {
								// Boolean false literal, so convert it into boolean false.
								arg = false;
							} else if (!isNaN(parseFloat(arg)) && isFinite(arg)) {
								// Numeric literal, so convert it into a number.
								//   n.b. Octal literals are not handled correctly by Number() (e.g. Number("077") yields 77, not 63).
								//        We could use eval("077") instead, which does correctly yield 63, however, it's probably far
								//        more likely that the average Twine/Twee author would expect "077" to yield 77 rather than 63.
								//        So, we cater to author expectation and use Number().
								arg = Number(arg);
							}
						}

						args.push(arg);
					}

					return args;
				}
			},

			{
				name    : "prettyLink",
				match   : "\\[\\[[^[]",
				handler : function (w) {
					var markup = Wikifier.helpers.parseSquareBracketedMarkup(w);
					if (markup.hasOwnProperty("error")) {
						w.outputText(w.output, w.matchStart, w.nextMatch);
						return;
					}

					w.nextMatch = markup.pos;

					// text=(text), forceInternal=(~), link=link, setter=(setter)
					var	link  = Wikifier.helpers.evalPassageId(markup.link),
						text  = markup.hasOwnProperty("text") ? Wikifier.helpers.evalText(markup.text) : link,
						setFn = markup.hasOwnProperty("setter")
							? (function (ex) { return function () { evalTwineScript(ex); }; })(markup.setter)
							: null;

					// Debug view setup.
					var	output = (config.debug
							? new DebugView(w.output, "wiki-link", "[[link]]", w.source.slice(w.matchStart, w.nextMatch))
							: w
						).output;

					if (markup.forceInternal || !Wikifier.isExternalLink(link)) {
						Wikifier.createInternalLink(output, link, text, setFn);
					} else {
						Wikifier.createExternalLink(output, link, text);
					}
				}
			},

			{
				name    : "urlLink",
				match   : Wikifier.textPrimitives.url,
				handler : function (w) {
					w.outputText(Wikifier.createExternalLink(w.output, w.matchText), w.matchStart, w.nextMatch);
				}
			},

			{
				name    : "image",
				match   : "\\[[<>]?[Ii][Mm][Gg]\\[",
				handler : function (w) {
					var markup = Wikifier.helpers.parseSquareBracketedMarkup(w);
					if (markup.hasOwnProperty("error")) {
						w.outputText(w.output, w.matchStart, w.nextMatch);
						return;
					}

					w.nextMatch = markup.pos;

					// Debug view setup.
					var	debugView;
					if (config.debug) {
						debugView = new DebugView(
							w.output,
							"wiki-image",
							markup.hasOwnProperty("link") ? "[img[][link]]" : "[img[]]",
							w.source.slice(w.matchStart, w.nextMatch)
						);
						debugView.modes({ block : true });
					}

					// align=(left|right), title=(title), source=source, forceInternal=(~), link=(link), setter=(setter)
					var	el     = (config.debug ? debugView : w).output,
						setFn  = markup.hasOwnProperty("setter")
							? (function (ex) { return function () { evalTwineScript(ex); }; })(markup.setter)
							: null,
						source;
					if (markup.hasOwnProperty("link")) {
						var link = Wikifier.helpers.evalPassageId(markup.link);
						if (markup.forceInternal || !Wikifier.isExternalLink(link)) {
							el = Wikifier.createInternalLink(el, link, null, setFn);
						} else {
							el = Wikifier.createExternalLink(el, link);
						}
						el.classList.add("link-image");
					}
					el = insertElement(el, "img");
					source = Wikifier.helpers.evalPassageId(markup.source);
					// Check for image passage transclusion.
					if (source.slice(0, 5) !== "data:" && Story.has(source)) {
						var passage = Story.get(source);
						if (passage.tags.contains("Twine.image")) {
							el.setAttribute("data-passage", passage.title);
							source = passage.text;
						}
					}
					el.src = source;
					if (markup.hasOwnProperty("title")) {
						el.title = Wikifier.helpers.evalText(markup.title);
					}
					if (markup.hasOwnProperty("align")) {
						el.align = markup.align;
					}
				}
			},

			{
				name    : "formatByChar",
				match   : "''|//|__|\\^\\^|~~|==|\\{\\{\\{",
				handler : function (w) {
					switch (w.matchText) {
					case "''":
						w.subWikify(insertElement(w.output, "strong"), "''");
						break;
					case "//":
						w.subWikify(insertElement(w.output, "em"), "//");
						break;
					case "__":
						w.subWikify(insertElement(w.output, "u"), "__");
						break;
					case "^^":
						w.subWikify(insertElement(w.output, "sup"), "\\^\\^");
						break;
					case "~~":
						w.subWikify(insertElement(w.output, "sub"), "~~");
						break;
					case "==":
						w.subWikify(insertElement(w.output, "s"), "==");
						break;
					case "{{{":
						var lookaheadRegExp = /\{\{\{((?:.|\n)*?)\}\}\}/gm;
						lookaheadRegExp.lastIndex = w.matchStart;
						var lookaheadMatch = lookaheadRegExp.exec(w.source);
						if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
							insertElement(w.output, "code", null, null, lookaheadMatch[1]);
							w.nextMatch = lookaheadRegExp.lastIndex;
						}
						break;
					}
				}
			},

			{
				name      : "monospacedByLine",
				match     : "^\\{\\{\\{\\n",
				lookahead : "^\\{\\{\\{\\n((?:^[^\\n]*\\n)+?)(^\\}\\}\\}$\\n?)",
				handler   : function (w) {
					var lookaheadRegExp = new RegExp(this.lookahead, "gm");
					lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						insertElement(w.output, "pre", null, null, lookaheadMatch[1]);
						w.nextMatch = lookaheadRegExp.lastIndex;
					}
				}
			},

			{
				name        : "customStyle",
				match       : "@@",
				terminator  : "@@",
				blockRegExp : /\s*\n/gm,
				handler     : function (w) {
					var	css = Wikifier.helpers.inlineCSS(w);
					this.blockRegExp.lastIndex = w.nextMatch; // must follow the call to .inlineCSS()
					var	blockMatch = this.blockRegExp.exec(w.source),
						blockLevel = blockMatch && blockMatch.index === w.nextMatch,
						el         = insertElement(w.output, blockLevel ? "div" : "span");
					if (css.styles.length === 0 && css.classes.length === 0 && css.id === "") {
						el.className = "marked";
					} else {
						for (var i = 0; i < css.styles.length; ++i) {
							el.style[css.styles[i].style] = css.styles[i].value;
						}
						for (var i = 0; i < css.classes.length; ++i) { // eslint-disable-line no-redeclare
							el.classList.add(css.classes[i]);
						}
						if (css.id !== "") {
							el.id = css.id;
						}
					}
					if (blockLevel) {
						// Skip the leading and, if it exists, trailing newlines.
						w.nextMatch += blockMatch[0].length;
						w.subWikify(el, "\\n?" + this.terminator);
					} else {
						w.subWikify(el, this.terminator);
					}
				}
			},

			{
				name            : "rawText",
				match           : "\"{3}|<nowiki>",
				lookaheadRegExp : /(?:\"{3}|<nowiki>)((?:.|\n)*?)(?:\"{3}|<\/nowiki>)/gm,
				handler         : function (w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						insertElement(w.output, "span", null, null, lookaheadMatch[1]);
						w.nextMatch = this.lookaheadRegExp.lastIndex;
					}
				}
			},

			{
				name    : "rule",
				match   : "^----+$\\n?|<hr ?/?>\\n?",
				handler : function (w) {
					insertElement(w.output, "hr");
				}
			},

			{
				name    : "emdash",
				match   : "--",
				handler : function (w) {
					insertText(w.output, "\u2014");
				}
			},

			{
				name    : "doubleDollarSign",
				match   : "\\${2}",
				handler : function (w) {
					insertText(w.output, "$");
				}
			},

			{
				name  : "nakedVariable",
				match : Wikifier.textPrimitives.variable
					+ "(?:(?:\\."
					+ Wikifier.textPrimitives.identifier
					+ ")|(?:\\[\\d+\\])|(?:\\[\"(?:\\\\.|[^\"\\\\])+\"\\])|(?:\\['(?:\\\\.|[^'\\\\])+'\\])|(?:\\["
					+ Wikifier.textPrimitives.variable
					+ "\\]))*",
				handler : function (w) {
					var	result = printableStringOrDefault(Wikifier.getValue(w.matchText), null);
					if (result === null) {
						insertText(w.output, w.matchText);
					} else {
						new Wikifier(
							(config.debug
								? new DebugView(w.output, "variable", w.matchText, w.matchText) // Debug view setup.
								: w
							).output,
							result
						);
					}
				}
			},

			{
				name       : "heading",
				match      : "^!{1,6}",
				terminator : "\\n",
				handler    : function (w) {
					var isHeading = (function (nodes) {
							var hasGCS = typeof window.getComputedStyle === "function";
							for (var i = nodes.length - 1; i >= 0; --i) {
								var node = nodes[i];
								switch (node.nodeType) {
								case Node.ELEMENT_NODE:
									var tagName = node.nodeName.toUpperCase();
									if (tagName === "BR") {
										return true;
									}
									var styles = hasGCS ? window.getComputedStyle(node, null) : node.currentStyle;
									if (styles && styles.display) {
										if (styles.display === "none") {
											continue;
										}
										return styles.display === "block";
									}
									/*
										WebKit/Blink-based browsers do not attach any computed style
										information to elements until they're inserted into the DOM
										(and probably visible), not even the default browser styles
										and any user styles.  So, we make an assumption based on the
										element.
									*/
									switch (tagName) {
									case "ADDRESS":
									case "ARTICLE":
									case "ASIDE":
									case "BLOCKQUOTE":
									case "CENTER":
									case "DIV":
									case "DL":
									case "FIGURE":
									case "FOOTER":
									case "FORM":
									case "H1":
									case "H2":
									case "H3":
									case "H4":
									case "H5":
									case "H6":
									case "HEADER":
									case "HR":
									case "MAIN":
									case "NAV":
									case "OL":
									case "P":
									case "PRE":
									case "SECTION":
									case "TABLE":
									case "UL":
										return true;
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
						w.subWikify(insertElement(w.output, "h" + w.matchLength), this.terminator);
					} else {
						insertText(w.output, w.matchText);
					}
				}
			},

			{
				name           : "table",
				match          : "^\\|(?:[^\\n]*)\\|(?:[fhck]?)$",
				lookahead      : "^\\|([^\\n]*)\\|([fhck]?)$",
				rowTerminator  : "\\|(?:[fhck]?)$\\n?",
				cellPattern    : "(?:\\|([^\\n\\|]*)\\|)|(\\|[fhck]?$\\n?)",
				cellTerminator : "(?:\\x20*)\\|",
				rowTypes       : { "c" : "caption", "h" : "thead", "" : "tbody", "f" : "tfoot" },
				handler        : function (w) {
					var	table           = insertElement(w.output, "table"),
						lookaheadRegExp = new RegExp(this.lookahead, "gm"),
						curRowType      = null,
						nextRowType,
						rowContainer,
						rowElement,
						prevColumns     = [],
						rowCount        = 0,
						matched;
					w.nextMatch = w.matchStart;
					do {
						lookaheadRegExp.lastIndex = w.nextMatch;
						var	lookaheadMatch = lookaheadRegExp.exec(w.source);
						matched = lookaheadMatch && lookaheadMatch.index === w.nextMatch;
						if (matched) {
							nextRowType = lookaheadMatch[2];
							if (nextRowType === "k") {
								table.className = lookaheadMatch[1];
								w.nextMatch += lookaheadMatch[0].length + 1;
							} else {
								if (nextRowType !== curRowType) {
									rowContainer = insertElement(table, this.rowTypes[nextRowType]);
								}
								curRowType = nextRowType;
								if (curRowType === "c") {
									if (rowCount === 0) {
										rowContainer.setAttribute("align", "top");
									} else {
										rowContainer.setAttribute("align", "bottom");
									}
									w.nextMatch = w.nextMatch + 1;
									w.subWikify(rowContainer, this.rowTerminator);
								} else {
									rowElement = insertElement(rowContainer, "tr");
									this.rowHandler(w, rowElement, prevColumns);
								}
								++rowCount;
							}
						}
					} while (matched);
				},
				rowHandler : function (w, e, prevColumns) {
					var	col          = 0,
						curColCount  = 1,
						cellRegExp   = new RegExp(this.cellPattern, "gm"),
						matched;
					do {
						cellRegExp.lastIndex = w.nextMatch;
						var	cellMatch = cellRegExp.exec(w.source);
						matched = cellMatch && cellMatch.index === w.nextMatch;
						if (matched) {
							if (cellMatch[1] === "~") {
								var last = prevColumns[col];
								if (last) {
									++last.rowCount;
									last.element.setAttribute("rowSpan", last.rowCount);
									last.element.setAttribute("rowspan", last.rowCount);
									last.element.valign = "center";
								}
								w.nextMatch = cellMatch.index + cellMatch[0].length - 1;
							} else if (cellMatch[1] === ">") {
								++curColCount;
								w.nextMatch = cellMatch.index + cellMatch[0].length - 1;
							} else if (cellMatch[2]) {
								w.nextMatch = cellMatch.index + cellMatch[0].length;
								break;
							} else {
								var	spaceLeft  = false,
									spaceRight = false,
									cell;
								++w.nextMatch;
								var css = Wikifier.helpers.inlineCSS(w);
								while (w.source.substr(w.nextMatch, 1) === " ") {
									spaceLeft = true;
									++w.nextMatch;
								}
								if (w.source.substr(w.nextMatch, 1) === "!") {
									cell = insertElement(e, "th");
									++w.nextMatch;
								} else {
									cell = insertElement(e, "td");
								}
								prevColumns[col] = { rowCount : 1, element : cell };
								/* UNUSED?
								var	lastColCount   = 1,
									lastColElement = cell;
								*/
								if (curColCount > 1) {
									cell.setAttribute("colSpan", curColCount);
									cell.setAttribute("colspan", curColCount);
									curColCount = 1;
								}
								for (var i = 0; i < css.styles.length; ++i) {
									cell.style[css.styles[i].style] = css.styles[i].value;
								}
								for (var i = 0; i < css.classes.length; ++i) { // eslint-disable-line no-redeclare
									cell.classList.add(css.classes[i]);
								}
								if (css.id !== "") {
									cell.id = css.id;
								}
								w.subWikify(cell, this.cellTerminator);
								if (w.matchText.substr(w.matchText.length - 2, 1) === " ") {
									spaceRight = true;
								}
								if (spaceLeft && spaceRight) {
									cell.align = "center";
								} else if (spaceLeft) {
									cell.align = "right";
								} else if (spaceRight) {
									cell.align = "left";
								}
								w.nextMatch = w.nextMatch - 1;
							}
							++col;
						}
					} while (matched);
				}
			},

			{
				name         : "list",
				match        : "^(?:(?:\\*+)|(?:#+))",
				lookahead    : "^(?:(\\*+)|(#+))",
				terminator   : "\\n",
				outerElement : "ul",
				itemElement  : "li",
				handler      : function (w) {
					w.nextMatch = w.matchStart;
					var	lookaheadRegExp = new RegExp(this.lookahead, "gm"),
						placeStack      = [w.output],
						curType         = null,
						newType,
						curLevel        = 0,
						newLevel,
						matched,
						i;
					do {
						lookaheadRegExp.lastIndex = w.nextMatch;
						var	lookaheadMatch = lookaheadRegExp.exec(w.source);
						matched = lookaheadMatch && lookaheadMatch.index === w.nextMatch;
						if (matched) {
							if (lookaheadMatch[2]) {
								newType = "ol";
							} else {
								newType = "ul";
							}
							newLevel = lookaheadMatch[0].length;
							w.nextMatch += lookaheadMatch[0].length;
							if (newLevel > curLevel) {
								for (i = curLevel; i < newLevel; ++i) {
									placeStack.push(insertElement(placeStack[placeStack.length - 1], newType));
								}
							} else if (newLevel < curLevel) {
								for (i = curLevel; i > newLevel; --i) {
									placeStack.pop();
								}
							} else if (newLevel === curLevel && newType !== curType) {
								placeStack.pop();
								placeStack.push(insertElement(placeStack[placeStack.length - 1], newType));
							}
							curLevel = newLevel;
							curType = newType;
							w.subWikify(insertElement(placeStack[placeStack.length - 1], "li"), this.terminator);
						}
					} while (matched);
				}
			},

			{
				name       : "quoteByBlock",
				match      : "^<<<\\n",
				terminator : "^<<<\\n",
				handler    : function (w) {
					w.subWikify(insertElement(w.output, "blockquote"), this.terminator);
				}
			},

			{
				name       : "quoteByLine",
				match      : "^>+",
				terminator : "\\n",
				element    : "blockquote",
				handler    : function (w) {
					var	lookaheadRegExp = new RegExp(this.match, "gm"),
						placeStack      = [w.output],
						curLevel        = 0,
						newLevel        = w.matchLength,
						matched,
						i;
					do {
						if (newLevel > curLevel) {
							for (i = curLevel; i < newLevel; ++i) {
								placeStack.push(insertElement(placeStack[placeStack.length - 1], this.element));
							}
						} else {
							if (newLevel < curLevel) {
								for (i = curLevel; i > newLevel; --i) {
									placeStack.pop();
								}
							}
						}
						curLevel = newLevel;
						w.subWikify(placeStack[placeStack.length - 1], this.terminator);
						insertElement(placeStack[placeStack.length - 1], "br");
						lookaheadRegExp.lastIndex = w.nextMatch;
						var	lookaheadMatch = lookaheadRegExp.exec(w.source);
						matched = lookaheadMatch && lookaheadMatch.index === w.nextMatch;
						if (matched) {
							newLevel = lookaheadMatch[0].length;
							w.nextMatch += lookaheadMatch[0].length;
						}
					} while (matched);
				}
			},

			{
				name            : "html",
				match           : "<[Hh][Tt][Mm][Ll]>",
				lookaheadRegExp : /<[Hh][Tt][Mm][Ll]>((?:.|\n)*?)<\/[Hh][Tt][Mm][Ll]>/gm,
				handler         : function (w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						w.nextMatch = this.lookaheadRegExp.lastIndex;
						var	frag = document.createDocumentFragment(),
							temp = document.createElement("div");
						temp.innerHTML = lookaheadMatch[1];
						while (temp.firstChild) {
							frag.appendChild(temp.firstChild);
						}
						w.output.appendChild(frag);
					}
				}
			},

			{
				name            : "commentByBlock",
				match           : "/(?:%|\\*)",
				lookaheadRegExp : /\/(%|\*)((?:.|\n)*?)\1\//gm,
				handler         : function (w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						w.nextMatch = this.lookaheadRegExp.lastIndex;
					}
				}
			},

			{
				name            : "htmlCommentByBlock",
				match           : "<!--",
				lookaheadRegExp : /<!--((?:.|\\n)*?)-->/gm,
				handler         : function (w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						w.output.appendChild(document.createComment(lookaheadMatch[1]));
						w.nextMatch = this.lookaheadRegExp.lastIndex;
					}
				}
			},

			{
				name    : "lineContinuation",
				match   : "\\\\[\\s\\u00a0\\u2028\\u2029]*?(?:\\n|$)", // Unicode space-character escapes required for IE < 11 (maybe < 10?)
				handler : function (w) {
					w.nextMatch = w.matchStart + w.matchLength;
				}
			},

			{
				name    : "lineBreak",
				match   : "\\n|<br ?/?>",
				handler : function (w) {
					if (w._nobr.length === 0 || !w._nobr[0]) {
						insertElement(w.output, "br");
					}
				}
			},

			{
				name    : "htmlCharacterReference",
				match   : "(?:(?:&#?[a-zA-Z0-9]{2,8};|.)(?:&#?(?:x0*(?:3[0-6][0-9a-fA-F]|1D[c-fC-F][0-9a-fA-F]|20[d-fD-F][0-9a-fA-F]|FE2[0-9a-fA-F])|0*(?:76[89]|7[7-9][0-9]|8[0-7][0-9]|761[6-9]|76[2-7][0-9]|84[0-3][0-9]|844[0-7]|6505[6-9]|6506[0-9]|6507[0-1]));)+|&#?[a-zA-Z0-9]{2,8};)",
				handler : function (w) {
					var el = document.createElement("span");
					el.innerHTML = w.matchText;
					insertText(w.output, el.textContent);
					if (typeof el.remove === "function") {
						el.remove();
					}
				}
			},

			{   // This formatter MUST come after any formatter which handles HTML tag-like constructs (e.g. html & rawText).
				name         : "htmlTag",
				match        : "<\\w+(?:\\s+[^\\u0000-\\u001F\\u007F-\\u009F\\s\"'>\\/=]+(?:\\s*=\\s*(?:\"[^\"]*?\"|'[^']*?'|[^\\s\"'=<>`]+))?)*\\s*\\/?>",
				tagPattern   : "<(\\w+)",
				voidElements : [ "area", "base", "br", "col", "embed", "hr", "img", "input", "keygen", "link", "menuitem", "meta", "param", "source", "track", "wbr" ],
				nobrElements : [ "colgroup", "datalist", "dl", "figure", "ol", "optgroup", "select", "table", "tbody", "tfoot", "thead", "tr", "ul" ],
				handler      : function (w) {
					var	tagMatch = new RegExp(this.tagPattern).exec(w.matchText),
						tag      = tagMatch && tagMatch[1],
						tagName  = tag && tag.toLowerCase();

					if (tagName) {
						var	isVoid = this.voidElements.contains(tagName),
							isNobr = this.nobrElements.contains(tagName),
							terminator,
							terminatorRegExp,
							terminatorMatch;

						if (!isVoid) {
							terminator = "<\\/" + tagName + "\\s*>";
							terminatorRegExp = new RegExp(terminator, "gim"); // ignore case during match
							terminatorRegExp.lastIndex = w.matchStart;
							terminatorMatch = terminatorRegExp.exec(w.source);
						}
						if (isVoid || terminatorMatch) {
							var	debugView,
								output    = w.output,
								el        = document.createElement(w.output.tagName);
							el.innerHTML = w.matchText;
							while (el.firstChild) {
								el = el.firstChild;
							}

							if (el.hasAttribute("data-passage")) {
								this.processDataAttributes(el);

								// Debug view setup.
								if (config.debug) {
									debugView = new DebugView(
										w.output,
										"html-" + tagName,
										tagName,
										w.matchText
									);
									debugView.modes({
										block   : tagName === "img",
										nonvoid : terminatorMatch
									});
									output = debugView.output;
								}
							}

							if (terminatorMatch) {
								if (isNobr) {
									w._nobr.unshift(true);
								} else if (w._nobr.length !== 0) {
									w._nobr.unshift(false);
								}
								try {
									w.subWikify(el, terminator, true); // ignore case during match

									/*
										Debug view setup.  If the current element has any debug view
										children which have "block" mode set, then set its debug view
										to the same.  Just makes things look a bit nicer.

										We don't bother checking if the current debug view has "block"
										mode set as only `<img>` elements could have that set at this
										point and, as void elements, they cannot enter here.
									*/
									if (config.debug && jQuery(".debug.block", el).length > 0) {
										debugView.modes({ block : true });
									}
								} finally {
									if (w._nobr.length !== 0) {
										w._nobr.shift();
									}
								}
							}
							output.appendChild(el);
						} else {
							throwError(w.output, 'HTML tag "' + tag + '" is not closed', w.matchText + "\u2026");
						}
					}
				},
				processDataAttributes : function (el) {
					var passage = el.getAttribute("data-passage");
					if (passage == null) { return; } // lazy equality for null

					passage = (typeof passage !== "string" ? String(passage) : passage).trim();
					var evaluated = Wikifier.helpers.evalPassageId(passage);
					if (evaluated !== passage) {
						passage = evaluated;
						el.setAttribute("data-passage", evaluated);
					}
					if (passage !== "") {
						if (el.tagName.toUpperCase() === "IMG") {
							var source;
							// Handle image passage transclusion.
							if (passage.slice(0, 5) !== "data:" && Story.has(passage)) {
								passage = Story.get(passage);
								if (passage.tags.contains("Twine.image")) {
									source = passage.text;
								}
							}
							el.src = source;
						} else {
							var	setter   = el.getAttribute("data-setter"),
								callback;
							if (setter != null) { // lazy equality for null
								setter = (typeof setter !== "string" ? String(setter) : setter).trim();
								if (setter !== "") {
									callback = (function (ex) { return function () { evalTwineScript(ex); }; })(setter);
								}
							}
							if (Story.has(passage)) {
								el.classList.add("link-internal");
								if (config.addVisitedLinkClass && State.has(passage)) {
									el.classList.add("link-visited");
								}
							} else {
								el.classList.add("link-broken");
							}
							jQuery(el).ariaClick({ one : true }, function () {
								if (typeof callback === "function") {
									callback.call(this);
								}
								State.play(passage);
							});
						}
					}
				}
			}
		]
	}); // End formatters


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Wikifier; // export the constructor

})();
/* eslint-enable max-len */

