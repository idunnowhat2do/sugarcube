/***********************************************************************************************************************
 *
 * wikifier.js
 *
 * Copyright © 2013–2014 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
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

var Wikifier = (function () {

	var
		_formatterCache, // the Wikifier formatter object cache
		_formatterImage, // the Wikifier image formatter object
		_unicodeOK      = /[\u0150\u0170]/g.test("\u0150"); // some versions of Safari do not handle Unicode properly


	/*******************************************************************************************************************
	 * Constructor
	 ******************************************************************************************************************/
	function Wikifier(place, source) {
		// general Wikifier properties
		this.formatter = _formatterCache || Wikifier.compileFormatters();
		this.output    = (place != null) ? place : document.createElement("div"); // use lazy equality on null check
		this.source    = source;
		this.nextMatch = 0;

		// formatter-related properties
		this._rawArgs  = "";
		this._nobr     = [];

		// wikify the source into the output buffer element
		this.subWikify(this.output);

		// remove the temp output buffer element; unnecessary, as the browser will eventually GC the element,
		// however, it's better to clean up after ourselves and not generate garbage in the first place
		if (place == null && typeof this.output.remove === "function") { // use lazy equality on null check
			this.output.remove();
		}
	}


	/*******************************************************************************************************************
	 * Prototype Methods
	 ******************************************************************************************************************/
	Object.defineProperties(Wikifier.prototype, {
		subWikify : {
			value : function (output, terminator, terminatorIgnoreCase) {
				// Temporarily replace the output pointer
				var oldOutput = this.output;
				this.output = output;

				var	terminatorRegExp = terminator ? new RegExp("(" + terminator + ")", terminatorIgnoreCase ? "gim" : "gm") : null,
					terminatorMatch,
					formatterMatch;
				do {
					// Prepare the RegExp match positions
					this.formatter.formatterRegExp.lastIndex = this.nextMatch;
					if (terminatorRegExp) {
						terminatorRegExp.lastIndex = this.nextMatch;
					}

					// Get the first matches
					formatterMatch  = this.formatter.formatterRegExp.exec(this.source);
					terminatorMatch = terminatorRegExp ? terminatorRegExp.exec(this.source) : null;

					// Check for a terminator & formatter match
					if (terminatorMatch && (!formatterMatch || terminatorMatch.index <= formatterMatch.index)) { // terminator match
						// Output any text before the match
						if (terminatorMatch.index > this.nextMatch) {
							this.outputText(this.output, this.nextMatch, terminatorMatch.index);
						}

						// Set the match parameters
						this.matchStart  = terminatorMatch.index;
						this.matchLength = terminatorMatch[1].length;
						this.matchText   = terminatorMatch[1];
						this.nextMatch   = terminatorMatch.index + terminatorMatch[1].length;

						// Restore the output pointer and exit
						this.output = oldOutput;
						return;
					} else if (formatterMatch) { // formatter match
						// Output any text before the match
						if (formatterMatch.index > this.nextMatch) {
							this.outputText(this.output, this.nextMatch, formatterMatch.index);
						}

						// Set the match parameters
						this.matchStart  = formatterMatch.index;
						this.matchLength = formatterMatch[0].length;
						this.matchText   = formatterMatch[0];
						this.nextMatch   = this.formatter.formatterRegExp.lastIndex;

						// Figure out which formatter matched
						var matchingFormatter = -1;
						for (var i = 1; i < formatterMatch.length; i++) {
							if (formatterMatch[i]) {
								matchingFormatter = i - 1;
								break; // stop once we've found the matching formatter
							}
						}

						// Call the formatter
						if (matchingFormatter !== -1) {
							this.formatter.formatters[matchingFormatter].handler(this);
							if (runtime.temp.break != null) { break; } // use lazy equality
						}
					}
				} while (terminatorMatch || formatterMatch);

				if (runtime.temp.break == null) { // use lazy equality
					// Output any text after the last match
					if (this.nextMatch < this.source.length) {
						this.outputText(this.output, this.nextMatch, this.source.length);
						this.nextMatch = this.source.length;
					}
				} else if (
					   this.output.lastChild
					&& this.output.lastChild.nodeType === 1 /* Element node */
					&& this.output.lastChild.nodeName.toUpperCase() === "BR"
				) {
					// In case of <<break>>/<<continue>>, remove the last <br>
					removeElement(this.output.lastChild);
				}

				// Restore the output pointer
				this.output = oldOutput;
			}
		},

		outputText : {
			value : function (place, startPos, endPos) {
				insertText(place, this.source.substring(startPos, endPos));
			}
		},

		/**
		 * Meant to be called by macros, this returns the raw, unprocessed, text passed to the currently executing macro.
		 * Unlike TiddlyWiki's default mechanism, this does not attempt to split up the arguments into an array.
		 */
		rawArgs : {
			value : function () {
				return this._rawArgs;
			}
		},

		/**
		 * Meant to be called by macros, this returns the text passed to the currently executing macro after doing some
		 * magic with certain Twine/Twee operators (like: eq, gt, and $variable).
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
		/**
		 * Returns a compiled Wikifier formatter object
		 */
		compileFormatters : {
			value : function () {
				if (DEBUG) { console.log("[Wikifier.compileFormatters]"); }
				var	formatters = Wikifier.formatters,
					patterns   = [];
				for (var i = 0, iend = formatters.length; i < iend; i++) {
					patterns.push("(" + formatters[i].match + ")");
				}
				return _formatterCache = {
					"formatters"      : formatters,
					"formatterRegExp" : new RegExp(patterns.join("|"), "gm")
				};
			}
		},

		/**
		 * Returns the passed string with all Twine/Twee operators converted to their JavaScript counterparts
		 */
		parse : {
			value : function (expression) {
				// Double quoted | Single quoted | Empty quotes | Operator delimiters | Barewords & Sigil
				var	re    = new RegExp("(?:(?:\"((?:(?:\\\\\")|[^\"])+)\")|(?:'((?:(?:\\\\\')|[^'])+)')|((?:\"\")|(?:''))|([=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}]+)|([^\"'=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}\\s]+))", "g"),
					match,
					map   = {
						// $variable mapping
						"$"     : "state.active.variables.",
						// assignment operators
						"to"    : "=",
						// equality operators
						"eq"    : "==",
						"neq"   : "!=",
						"is"    : "===",
						"isnot" : "!==",
						"isNot" : "!==", // allow the Harlowe spelling for compatibility
						// relational operators
						"gt"    : ">",
						"gte"   : ">=",
						"lt"    : "<",
						"lte"   : "<=",
						// logical operators
						"and"   : "&&",
						"or"    : "||",
						// unary operators
						"not"   : "!",
						"def"   : '"undefined" !== typeof',
						"ndef"  : '"undefined" === typeof'
					};

				while ((match = re.exec(expression)) !== null) {
					// noop: Double quoted | Single quoted | Empty quote | Operator delimiters

					// Barewords & Sigil
					if (match[5]) {
						var token = match[5];

						// special cases
						if (token === "$") {
							// if the token is "$", then it's either a naked dollar-sign or a function alias, so skip over it
							continue;
						} else if (token[0] === "$") {
							// if the token starts with a "$", then it's a $variable, so just replace the sigil ("$")
							token = "$";
						} else if (token === "is") {
							// if the token is "is", check to see if it's followed by "not", if so, convert them into the
							// "isnot" operator; this is a safety feature, since "$a is not $b" probably sounds reasonable
							// to most users
							var	start = match.index + token.length,
								part  = expression.slice(start);
							if (/^\s+not\b/.test(part)) {
								expression = expression.splice(start, part.search(/\S/));
								token = "isnot";
							}
						}

						// n.b. do not simply use "map[token]" here, otherwise tokens which match
						//      intrinsic object properties will break the world (e.g. "toString")
						if (map.hasOwnProperty(token)) {
							expression = expression.splice(
								match.index,  // starting index
								token.length, // replace how many
								map[token]    // replacement string
							);
							re.lastIndex += map[token].length - token.length;
						}
					}
				}
				return expression;
			}
		},

		/**
		 * Returns the value of the passed story $variable
		 */
		getValue : {
			value : function (storyVar) {
				var	pNames = Wikifier.parseStoryVariable(storyVar),
					retVal = undefined;

				if (pNames.length !== 0) {
					retVal = state.active.variables;
					for (var i = 0, iend = pNames.length; i < iend; i++) {
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

		/**
		 * Sets the value of the passed story $variable
		 */
		setValue : {
			value : function (storyVar, newValue) {
				var pNames = Wikifier.parseStoryVariable(storyVar);

				if (pNames.length !== 0) {
					var	baseObj = state.active.variables,
						varName = pNames.pop();
					for (var i = 0, iend = pNames.length; i < iend; i++) {
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

		/**
		 * Returns the property name chain of the passed story $variable, which may be of arbitrary complexity
		 */
		parseStoryVariable : {
			value : function (varText) {
				var	re     = /^(?:\$(\w+)|\.(\w+)|\[(?:(?:\"((?:\\.|[^\"\\])+)\")|(?:\'((?:\\.|[^\'\\])+)\')|(\$\w.*)|(\d+))\])/,
					match,
					pNames = [];

				while ((match = re.exec(varText)) !== null) {
					// Remove full match from varText
					varText = varText.slice(match[0].length);

					if (match[1]) {
						// Base variable
						pNames.push(match[1]);
					} else if (match[2]) {
						// Dot property
						pNames.push(match[2]);
					} else if (match[3]) {
						// Square-bracketed property (double quoted)
						pNames.push(match[3]);
					} else if (match[4]) {
						// Square-bracketed property (single quoted)
						pNames.push(match[4]);
					} else if (match[5]) {
						// Square-bracketed property (embedded $variable)
						pNames.push(Wikifier.getValue(match[5]));
					} else if (match[6]) {
						// Square-bracketed property (numeric index)
						pNames.push(Number(match[6]));
					}
				}
				return (varText === "") ? pNames : [];
			}
		},

		/**
		 * Evaluate the passed Twine expression and return the result, throwing if there were errors
		 */
		evalExpression : {
			value : function (expression) {
				return Util.evalExpression(Wikifier.parse(expression));
			}
		},

		/**
		 * Evaluate the passed Twine statements and return the result, throwing if there were errors
		 */
		evalStatements : {
			value : function (statements) {
				return Util.evalStatements(Wikifier.parse(statements));
			}
		},

		/**
		 * Wikify the passed text and discard the output, throwing if there were errors
		 */
		wikifyEval : {
			value : function (text) {
				var errTrap = document.createDocumentFragment();
				try {
					new Wikifier(errTrap, text);
					while (errTrap.hasChildNodes()) {
						var fc = errTrap.firstChild;
						if (fc.classList && fc.classList.contains("error")) {
							throw new Error(fc.textContent);
						}
						errTrap.removeChild(fc);
					}
				} catch (e) {
					throw new Error(e.message.replace(/^Error:\s+/, ""));
				} finally {
					// probably unnecessary, but let's be tidy
					removeChildren(errTrap); // remove any remaining children
				}
			}
		},

		/**
		 * Create and return an internal link
		 */
		createInternalLink : {
			value : function (place, passage, text, callback) {
				var el = document.createElement("a");
				if (passage != null) { // use lazy equality; 0 is a valid ID and name, so we cannot simply evaluate passage
					el.setAttribute("data-passage", passage);
					if (tale.has(passage)) {
						el.classList.add("link-internal");
						if (config.addVisitedLinkClass && state.has(passage)) {
							el.classList.add("link-visited");
						}
					} else {
						el.classList.add("link-broken");
					}
					jQuery(el).click(function () {
						if (typeof callback === "function") {
							callback();
						}
						state.display(passage, el);
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

		/**
		 * Create and return an external link
		 */
		createExternalLink : {
			value : function (place, url, text) {
				var el = insertElement(place, "a", null, "link-external", text);
				el.target = "_blank";
				if (url != null) { // use lazy equality
					el.href = url;
				}
				return el;
			}
		},

		/**
		 * Returns whether the given link source is external (probably)
		 */
		isExternalLink : {
			value : function (link) {
				if (tale.has(link)) {
					return false;
				}

				var urlRegExp = new RegExp("^" + Wikifier.textPrimitives.url, "gim");
				return (urlRegExp.test(link) || /[\.\/\\#]/.test(link));
			}
		}
	});


	/*******************************************************************************************************************
	 * Text Primitives (Regular Expressions)
	 ******************************************************************************************************************/
	Object.defineProperty(Wikifier, "textPrimitives", { value : {} });

	// tier-1 primitives
	Object.defineProperties(Wikifier.textPrimitives, {
		anyLetter : {
			value : _unicodeOK
				? "[A-Za-z0-9_\\-\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]"
				: "[A-Za-z0-9_\\-\u00c0-\u00de\u00df-\u00ff]"
		},

		url : {
			value : "(?:file|https?|mailto|ftp|javascript|irc|news|data):[^\\s'\"]+(?:/|\\b)"
		},

		link : {
			// 1=(text), 2=(~), 3=link, 4=(set)
			value : "\\[\\[\\s*(?:(.+?)\\s*\\|\\s*)?(~)?(.+?)\\s*\\](?:\\[\\s*(.+?)\\s*\\])?\\]"
		},

		image : {
			// 1=(left), 2=(right), 3=(title), 4=source, 5=(~), 6=(link), 7=(set)
			value : "\\[([<]?)([>]?)[Ii][Mm][Gg]\\[\\s*(?:(.+?)\\s*\\|\\s*)?([^\\|]+?)\\s*\\](?:\\[\\s*(~)?(.+?)\\s*\\])?(?:\\[\\s*(.+?)\\s*\\])?\\]"
		},

		macroArg : {
			value : "(?:" + [
					'("(?:(?:\\\\")|[^"])+")',         // 1=double quoted
					"('(?:(?:\\\\')|[^'])+')",         // 2=single quoted
					"((?:\"\")|(?:''))",               // 3=empty quotes
					"(?:(\\[\\[(?:\\s|\\S)*?\\]\\]))", // 4=double square-bracketed
					"([^\"'`\\s]\\S*)"                 // 5=barewords
				].join("|") + ")"
		}
	});

	// tier-2 primitives
	Object.defineProperties(Wikifier.textPrimitives, {
		inlineCSS : {
			value : [
					"(?:(" + Wikifier.textPrimitives.anyLetter + "+)\\(([^\\)\\|\\n]+)\\):)", // [1,2]=style(value):
					"(?:(" + Wikifier.textPrimitives.anyLetter + "+):([^;\\|\\n]+);)",        // [3,4]=style:value;
					"(?:((?:\\." + Wikifier.textPrimitives.anyLetter + "+)+);)"               // [5]  =.className;  (Twine 1.4 extension)
				].join("|")
		}
	});


	/*******************************************************************************************************************
	 * Helper Functions
	 ******************************************************************************************************************/
	Object.defineProperty(Wikifier, "helpers", { value : {} });

	Object.defineProperties(Wikifier.helpers, {
		charFormat : {
			value : function (w) {
				var b = insertElement(w.output, this.element);
				w.subWikify(b, this.terminator);
			}
		},

		inlineCSS : {
			value : function (w) {
				var	css             = { styles : [], classes : [] },
					lookaheadRegExp = new RegExp(Wikifier.textPrimitives.inlineCSS, "gm");
				do {
					lookaheadRegExp.lastIndex = w.nextMatch;
					var	lookaheadMatch = lookaheadRegExp.exec(w.source),
						gotMatch = (lookaheadMatch && lookaheadMatch.index == w.nextMatch);
					if (gotMatch) {
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
						}
						w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
					}
				} while (gotMatch);
				return css;
			}
		},

		cssToDOMName : {
			value : function (name) {
				// Returns a DOM property name for a CSS property, parsed from the string
				if (!name.contains("-")) {
					switch (name) {
					case "bgcolor": name = "backgroundColor"; break;
					case "float":   name = "cssFloat"; break;
					}
					return name;
				}
				var parts = name.split("-");
				for (var i = 1; i < parts.length; i++) {
					parts[i] = parts[i].slice(0, 1).toUpperCase() + parts[i].slice(1);
				}
				return parts.join("");
			}
		},

		evalExpression : {
			value : function (text) {
				var	badResultRe = /\[(?:object(?:\s+[^\]]+)?|native\s+code)\]/,
					result;
				try {
					result = Wikifier.evalExpression(text);
					if (badResultRe.test(result)) {
						result = text;
					}
				} catch (e) {
					result = text;
				}
				return result;
			}
		},

		evalPassageId : {
			value : function (passage) {
				if (passage != null && !tale.has(passage)) { // use lazy equality; 0 is a valid ID and name, so we cannot simply evaluate passage
					passage = Wikifier.helpers.evalExpression(passage);
				}
				return passage;
			}
		}
	});


	/*******************************************************************************************************************
	 * Wiki Formatters
	 ******************************************************************************************************************/
	Object.defineProperty(Wikifier, "formatters", {
		value : [
			{
				name: "table",
				match: "^\\|(?:[^\\n]*)\\|(?:[fhck]?)$",
				lookahead: "^\\|([^\\n]*)\\|([fhck]?)$",
				rowTerminator: "\\|(?:[fhck]?)$\\n?",
				cellPattern: "(?:\\|([^\\n\\|]*)\\|)|(\\|[fhck]?$\\n?)",
				cellTerminator: "(?:\\x20*)\\|",
				rowTypes: { "c": "caption", "h": "thead", "": "tbody", "f": "tfoot" },
				handler: function (w) {
					var	table           = insertElement(w.output, "table"),
						lookaheadRegExp = new RegExp(this.lookahead, "gm"),
						curRowType      = null,
						nextRowType,
						rowContainer,
						rowElement,
						prevColumns     = [],
						rowCount        = 0;
					w.nextMatch = w.matchStart;
					do {
						lookaheadRegExp.lastIndex = w.nextMatch;
						var	lookaheadMatch = lookaheadRegExp.exec(w.source),
							matched        = lookaheadMatch && lookaheadMatch.index === w.nextMatch;
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
								rowCount++;
							}
						}
					} while (matched);
				},
				rowHandler: function (w, e, prevColumns) {
					var	col          = 0,
						curColCount  = 1,
						cellRegExp   = new RegExp(this.cellPattern, "gm");
					do {
						cellRegExp.lastIndex = w.nextMatch;
						var	cellMatch = cellRegExp.exec(w.source),
							matched   = cellMatch && cellMatch.index === w.nextMatch;
						if (matched) {
							if (cellMatch[1] === "~") {
								var last = prevColumns[col];
								if (last) {
									last.rowCount++;
									last.element.setAttribute("rowSpan", last.rowCount);
									last.element.setAttribute("rowspan", last.rowCount);
									last.element.valign = "center";
								}
								w.nextMatch = cellMatch.index + cellMatch[0].length-1;
							} else if (cellMatch[1] === ">") {
								curColCount++;
								w.nextMatch = cellMatch.index + cellMatch[0].length-1;
							} else if (cellMatch[2]) {
								w.nextMatch = cellMatch.index + cellMatch[0].length;
								break;
							} else {
								var	spaceLeft  = false,
									spaceRight = false,
									cell;
								w.nextMatch++;
								var css = Wikifier.helpers.inlineCSS(w);
								while (w.source.substr(w.nextMatch, 1) === " ") {
									spaceLeft = true;
									w.nextMatch++;
								}
								if (w.source.substr(w.nextMatch, 1) === "!") {
									cell = insertElement(e, "th");
									w.nextMatch++;
								} else {
									cell = insertElement(e, "td");
								}
								prevColumns[col] = { rowCount: 1, element: cell };
								var	lastColCount   = 1,
									lastColElement = cell;
								if (curColCount > 1) {
									cell.setAttribute("colSpan", curColCount);
									cell.setAttribute("colspan", curColCount);
									curColCount = 1;
								}
								for (var i = 0; i < css.styles.length; i++) {
									cell.style[css.styles[i].style] = css.styles[i].value;
								}
								for (var i = 0; i < css.classes.length; i++) {
									cell.classList.add(css.classes[i]);
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
							col++;
						}
					} while (matched);
				}
			},

			{
				name: "heading",
				match: "^!{1,6}",
				terminator: "\\n",
				handler: function (w) {
					w.subWikify(insertElement(w.output, "h" + w.matchLength), this.terminator);
				}
			},

			{
				name: "list",
				match: "^(?:(?:\\*+)|(?:#+))",
				lookahead: "^(?:(\\*+)|(#+))",
				terminator: "\\n",
				outerElement: "ul",
				itemElement: "li",
				handler: function (w) {
					var lookaheadRegExp = new RegExp(this.lookahead, "gm");
					w.nextMatch = w.matchStart;
					var	placeStack = [w.output],
						curType    = null,
						newType,
						curLevel   = 0,
						newLevel,
						i;
					do {
						lookaheadRegExp.lastIndex = w.nextMatch;
						var lookaheadMatch = lookaheadRegExp.exec(w.source);
						var matched = lookaheadMatch && lookaheadMatch.index == w.nextMatch;
						if (matched) {
							if (lookaheadMatch[2]) {
								newType = "ol";
							} else {
								newType = "ul";
							}
							newLevel = lookaheadMatch[0].length;
							w.nextMatch += lookaheadMatch[0].length;
							if (newLevel > curLevel) {
								for (i = curLevel; i < newLevel; i++) {
									placeStack.push(insertElement(placeStack[placeStack.length - 1], newType));
								}
							} else if (newLevel < curLevel) {
								for (i = curLevel; i > newLevel; i--) {
									placeStack.pop();
								}
							} else if (newLevel == curLevel && newType != curType) {
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
				name: "quoteByBlock",
				match: "^<<<\\n",
				terminator: "^<<<\\n",
				handler: function (w) {
					w.subWikify(insertElement(w.output, "blockquote"), this.terminator);
				}
			},

			{
				name: "quoteByLine",
				match: "^>+",
				terminator: "\\n",
				element: "blockquote",
				handler: function (w) {
					var	lookaheadRegExp = new RegExp(this.match, "gm"),
						placeStack      = [w.output],
						curLevel        = 0,
						newLevel        = w.matchLength,
						i;
					do {
						if (newLevel > curLevel) {
							for (i = curLevel; i < newLevel; i++) {
								placeStack.push(insertElement(placeStack[placeStack.length - 1], this.element));
							}
						} else {
							if (newLevel < curLevel) {
								for (i = curLevel; i > newLevel; i--) {
									placeStack.pop();
								}
							}
						}
						curLevel = newLevel;
						w.subWikify(placeStack[placeStack.length - 1], this.terminator);
						insertElement(placeStack[placeStack.length - 1], "br");
						lookaheadRegExp.lastIndex = w.nextMatch;
						var	lookaheadMatch = lookaheadRegExp.exec(w.source),
							matched        = (lookaheadMatch && lookaheadMatch.index == w.nextMatch);
						if (matched) {
							newLevel = lookaheadMatch[0].length;
							w.nextMatch += lookaheadMatch[0].length;
						}
					} while (matched);
				}
			},

			{
				name: "rule",
				match: "^----+$\\n?|<hr ?/?>\\n?",
				handler: function (w) {
					insertElement(w.output, "hr");
				}
			},

			{
				name: "monospacedByLine",
				match: "^\\{\\{\\{\\n",
				lookahead: "^\\{\\{\\{\\n((?:^[^\\n]*\\n)+?)(^\\}\\}\\}$\\n?)",
				handler: function (w) {
					var lookaheadRegExp = new RegExp(this.lookahead, "gm");
					lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						insertElement(w.output, "pre", null, null, lookaheadMatch[1]);
						w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
					}
				}
			},

			{
				name: "prettyLink",
				match: "\\[\\[",
				lookaheadRegExp: /(\[\[(?:\s|\S)*?\]\])/gm,
				handler: function (w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						var	re    = new RegExp("^" + Wikifier.textPrimitives.link + "$"),
							match = re.exec(lookaheadMatch[0]);
						if (match !== null) {
							// 1=(text), 2=(~), 3=link, 4=(set)
							w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;

							var	link  = Wikifier.helpers.evalPassageId(match[3]),
								text  = match[1] ? Wikifier.helpers.evalExpression(match[1]) : link,
								setFn = match[4]
									? (function (ex) { return function () { Wikifier.evalStatements(ex); }; }(Wikifier.parse(match[4])))
									: null;
							if (!match[2] && Wikifier.isExternalLink(link)) {
								Wikifier.createExternalLink(w.output, link, text)
							} else {
								Wikifier.createInternalLink(w.output, link, text, setFn);
							}
						}
					}
				}
			},

			{
				name: "urlLink",
				match: Wikifier.textPrimitives.url,
				handler: function (w) {
					w.outputText(Wikifier.createExternalLink(w.output, w.matchText), w.matchStart, w.nextMatch);
				}
			},

			(_formatterImage = {
				name: "image",
				match: "\\[[<>]?[Ii][Mm][Gg]\\[",
				lookaheadRegExp: /(\[[<>]?[Ii][Mm][Gg]\[(?:\s|\S)*?\]\])/gm,
				handler: function (w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						var	re    = new RegExp("^" + Wikifier.textPrimitives.image + "$"),
							match = re.exec(lookaheadMatch[0]);
						if (match !== null) {
							// 1=(left), 2=(right), 3=(title), 4=source, 5=(~), 6=(link), 7=(set)
							w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;

							var	el     = w.output,
								setFn  = match[7]
									? (function (ex) { return function () { Wikifier.evalStatements(ex); }; }(Wikifier.parse(match[7])))
									: null,
								source;
							if (match[6]) {
								var link = Wikifier.helpers.evalPassageId(match[6]);
								if (!match[5] && Wikifier.isExternalLink(link)) {
									el = Wikifier.createExternalLink(el, link);
								} else {
									el = Wikifier.createInternalLink(el, link, null, setFn);
								}
								el.classList.add("link-image");
							}
							el = insertElement(el, "img");
							source = Wikifier.helpers.evalPassageId(match[4]);
							// check for Twine 1.4 Base64 image passage transclusion
							if (source.slice(0, 5) !== "data:" && tale.has(source)) {
								var passage = tale.get(source);
								if (passage.tags.contains("Twine.image")) {
									el.setAttribute("data-passage", passage.title);
									source = passage.text;
								}
							}
							el.src = source;
							if (match[3]) {
								el.title = Wikifier.helpers.evalExpression(match[3]);
							}
							if (match[1]) {
								el.align = "left";
							} else if (match[2]) {
								el.align = "right";
							}
						}
					}
				}
			}),

			{
				name: "macro",
				match: "<<",
				lookaheadRegExp: /<<([^>\s]+)(?:\s*)((?:(?:\"(?:\\.|[^\"\\])*\")|(?:\'(?:\\.|[^\'\\])*\')|[^>]|(?:>(?!>)))*)>>/gm,
				working: { name: "", handler: "", arguments: "", index: 0 }, // the working parse object
				context: null, // last execution context object (top-level macros, hierarchically, have a null context)
				handler: function (w) {
					var matchStart = this.lookaheadRegExp.lastIndex = w.matchStart;
					if (this.parseTag(w)) {
						// if parseBody() is called below, it will change the current working
						// values, so we must cache them now
						var	nextMatch = w.nextMatch,
							name      = this.working.name,
							handler   = this.working.handler,
							rawArgs   = this.working.arguments;
						try {
							var macro = macros.get(name);
							if (macro) {
								var payload = null;
								if (macro.hasOwnProperty("tags")) {
									payload = this.parseBody(w, macro.tags);
									if (!payload) {
										w.nextMatch = nextMatch; // parseBody() changes this during processing, so we reset it here
										return throwError(w.output, "cannot find a closing tag for macro <<" + name + ">>",
											w.source.slice(matchStart, w.nextMatch) + "\u2026");
									}
								}
								if (typeof macro[handler] === "function") {
									var args = (!macro.hasOwnProperty("skipArgs") || !macro["skipArgs"]) ? this.parseArgs(rawArgs) : [];

									// new-style macros
									if (macro.hasOwnProperty("_USE_MACROS_API")) {
										// call the handler, modifying the execution context chain appropriately
										//   n.b. there's no catch clause because this try/finally is here simply to ensure that
										//        the execution context is properly restored in the event that an uncaught exception
										//        is thrown during the handler call
										try {
											this.context = new MacrosContext(
												this.context,
												macro,
												name,
												rawArgs,
												args,
												payload,
												w,
												w.source.slice(matchStart, w.nextMatch)
											);
											macro[handler].call(this.context);
										} finally {
											this.context = this.context.parent;
										}
									}
									// old-style macros
									else {
										var prevRawArgs = w._rawArgs;
										w._rawArgs = rawArgs; // cache the raw arguments for use by Wikifier.rawArgs() & Wikifier.fullArgs()
										macro[handler](w.output, name, args, w, payload);
										w._rawArgs = prevRawArgs;
									}
								} else {
									return throwError(w.output, "macro <<" + name + '>> handler function "' + handler + '" '
										+ (macro.hasOwnProperty(handler) ? "is not a function" : "does not exist"), w.source.slice(matchStart, w.nextMatch));
								}
							} else if (macros.tags.hasOwnProperty(name)) {
								return throwError(w.output, "child tag <<" + name + ">> was found outside of a call to its parent macro"
									+ (macros.tags[name].length === 1 ? '' : 's') + " <<" + macros.tags[name].join(">>, <<") + ">>",
									  w.source.slice(matchStart, w.nextMatch));
							} else {
								return throwError(w.output, "macro <<" + name + ">> does not exist", w.source.slice(matchStart, w.nextMatch));
							}
						} catch (e) {
							return throwError(w.output, "cannot execute " + ((macro && macro.isWidget) ? "widget" : "macro") + " <<" + name + ">>: " + e.message,
								w.source.slice(matchStart, w.nextMatch));
						} finally {
							this.working.name      = "";
							this.working.handler   = "";
							this.working.arguments = "";
							this.working.index     = 0;
						}
					}
				},
				parseTag: function (w) {
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart && lookaheadMatch[1]) {
						w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
						this.lookaheadRegExp.lastIndex = w.nextMatch;

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
				parseBody: function (w, tags) {
					var	openTag      = this.working.name,
						closeTag     = "/" + openTag,
						closeAlt     = "end" + openTag,
						bodyTags     = Array.isArray(tags) ? tags : false,
						end          = -1,
						opened       = 1,
						curTag       = this.working.name,
						curArgument  = this.working.arguments,
						contentStart = w.nextMatch,
						payload      = [];

					while (
						   (w.matchStart = w.source.indexOf("<<", w.nextMatch)) !== -1
						&& this.parseTag(w)
					) {
						var	tagName  = this.working.name,
							tagArgs  = this.working.arguments,
							tagBegin = this.working.index,
							tagEnd   = w.nextMatch;

						switch (tagName) {
						case openTag:
							opened++;
							break;

						case closeAlt:
							/* FALL-THROUGH */
						case closeTag:
							opened--;
							break;

						default:
							if (opened === 1 && bodyTags) {
								for (var i = 0, iend = bodyTags.length; i < iend; i++) {
									if (tagName === bodyTags[i]) {
										payload.push({
											name      : curTag,
											arguments : curArgument,
											contents  : w.source.slice(contentStart, tagBegin)
										});
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
								name      : curTag,
								arguments : curArgument,
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
				parseArgs: function (str) {
					// Groups: 1=double quoted | 2=single quoted | 3=empty quotes | 4=double square-bracketed | 5=barewords
					var	re    = new RegExp(Wikifier.textPrimitives.macroArg, "gm"),
						match,
						args  = [];

					while ((match = re.exec(str)) !== null) {
						var arg;

						if (match[1]) {
							// Double quoted
							arg = match[1];

							// Evaluate the string to handle escaped characters
							try {
								arg = Util.evalExpression(arg);
							} catch (e) {
								throw new Error("unable to parse macro argument '" + arg + "': " + e.message);
							}
						} else if (match[2]) {
							// Single quoted
							arg = match[2];

							// Evaluate the string to handle escaped characters
							try {
								arg = Util.evalExpression(arg);
							} catch (e) {
								throw new Error('unable to parse macro argument "' + arg + '": ' + e.message);
							}
						} else if (match[3]) {
							// Empty quotes
							arg = "";
						} else if (match[4]) {
							// Double square-bracketed
							arg = match[4];

							// Convert to an object
							var	linkRe    = new RegExp(Wikifier.textPrimitives.link),
								linkMatch = linkRe.exec(arg),
								linkObj   = {};
							if (linkMatch !== null) {
								// 1=(text), 2=(~), 3=link, 4=(set)
								linkObj.count      = linkMatch[1] ? 2 : 1;
								linkObj.link       = Wikifier.helpers.evalPassageId(linkMatch[3]);
								linkObj.text       = linkMatch[1] ? Wikifier.helpers.evalExpression(linkMatch[1]) : linkObj.link;
								linkObj.isExternal = !linkMatch[2] && Wikifier.isExternalLink(linkObj.link);
								linkObj.setFn      = linkMatch[4]
									? (function (ex) { return function () { Wikifier.evalStatements(ex); }; }(Wikifier.parse(linkMatch[4])))
									: null;
								arg = linkObj;
							}
						} else if (match[5]) {
							// Barewords
							arg = match[5];

							if (/^\$\w+/.test(arg)) {
								// $variable, so substitute its value
								arg = Wikifier.getValue(arg);
							} else if (/^(?:options|setup)[\.\[]/.test(arg)) {
								// options or setup object, so try to evaluate it
								try {
									arg = Wikifier.evalExpression(arg);
								} catch (e) {
									throw new Error('unable to parse macro argument "' + arg + '": ' + e.message);
								}
							} else if (/^(?:\{.*\}|\[.*\])$/.test(arg)) {
								// Object or Array literal, so try to evaluate it
								//   n.b. Authors really shouldn't be passing object/array literals as arguments.  If they want to
								//        pass a complex type, then store it in a variable and pass that instead.
								try {
									arg = Wikifier.evalExpression(arg);
								} catch (e) {
									throw new Error('unable to parse macro argument "' + arg + '": ' + e.message);
								}
							} else if (arg === "null") {
								// Null literal, so convert it into null
								arg = null;
							} else if (arg === "undefined") {
								// Undefined literal, so convert it into undefined
								arg = undefined;
							} else if (arg === "true") {
								// Boolean true literal, so convert it into boolean true
								arg = true;
							} else if (arg === "false") {
								// Boolean false literal, so convert it into boolean false
								arg = false;
							} else if (!isNaN(parseFloat(arg)) && isFinite(arg)) {
								// Numeric literal, so convert it into a number
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
				name: "html",
				match: "<[Hh][Tt][Mm][Ll]>",
				lookaheadRegExp: /<[Hh][Tt][Mm][Ll]>((?:.|\n)*?)<\/[Hh][Tt][Mm][Ll]>/gm,
				handler: function (w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;

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
				name: "commentByBlock",
				match: "/(?:%|\\*)",
				lookaheadRegExp: /\/(%|\*)((?:.|\n)*?)\1\//gm,
				handler: function (w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
					}
				}
			},

			{
				name: "htmlCommentByBlock",
				match: "<!--",
				lookaheadRegExp: /<!--((?:.|\\n)*?)-->/gm,
				handler: function (w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						w.output.appendChild(document.createComment(lookaheadMatch[1]));
						w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
					}
				}
			},

			{
				name: "boldByChar",
				match: "''",
				terminator: "''",
				element: "strong",
				handler: Wikifier.helpers.charFormat
			},

			{
				name: "strikeByChar",
				match: "==",
				terminator: "==",
				element: "strike",
				handler: Wikifier.helpers.charFormat
			},

			{
				name: "underlineByChar",
				match: "__",
				terminator: "__",
				element: "u",
				handler: Wikifier.helpers.charFormat
			},

			{
				name: "italicByChar",
				match: "//",
				terminator: "//",
				element: "em",
				handler: Wikifier.helpers.charFormat
			},

			{
				name: "subscriptByChar",
				match: "~~",
				terminator: "~~",
				element: "sub",
				handler: Wikifier.helpers.charFormat
			},

			{
				name: "superscriptByChar",
				match: "\\^\\^",
				terminator: "\\^\\^",
				element: "sup",
				handler: Wikifier.helpers.charFormat
			},

			{
				name: "monospacedByChar",
				match: "\\{\\{\\{",
				lookahead: "\\{\\{\\{((?:.|\\n)*?)\\}\\}\\}",
				handler: function (w) {
					var lookaheadRegExp = new RegExp(this.lookahead, "gm");
					lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						insertElement(w.output, "code", null, null, lookaheadMatch[1]);
						w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
					}
				}
			},

			{
				name: "styleByChar",
				match: "@@",
				terminator: "@@",
				lookahead: Wikifier.textPrimitives.inlineCSS,
				handler: function (w) {
					var	el  = insertElement(w.output, "span"),
						css = Wikifier.helpers.inlineCSS(w);
					if (css.styles.length === 0 && css.classes.length === 0) {
						el.className = "marked";
					} else {
						for (var i = 0; i < css.styles.length; i++) {
							el.style[css.styles[i].style] = css.styles[i].value;
						}
						for (var i = 0; i < css.classes.length; i++) {
							el.classList.add(css.classes[i]);
						}
					}
					w.subWikify(el, this.terminator);
				}
			},

			{
				name: "emdash",
				match: "--",
				handler: function (w) {
					insertText(w.output, "\u2014");
				}
			},

			{
				name: "lineContinuation",
				match: "\\\\[\\s\\u00a0\\u2028\\u2029]*?(?:\\n|$)", // Unicode space-character escapes required for IE < 11 (maybe < 10?)
				handler: function (w) {
					w.nextMatch = w.matchStart + w.matchLength;
				}
			},

			{
				name: "lineBreak",
				match: "\\n|<br ?/?>",
				handler: function (w) {
					if (w._nobr.length === 0 || !w._nobr[0]) {
						insertElement(w.output, "br");
					}
				}
			},

			{
				name: "rawText",
				match: "\"{3}|<nowiki>",
				lookaheadRegExp: /(?:\"{3}|<nowiki>)((?:.|\n)*?)(?:\"{3}|<\/nowiki>)/gm,
				handler: function(w) {
					this.lookaheadRegExp.lastIndex = w.matchStart;
					var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
					if (lookaheadMatch && lookaheadMatch.index === w.matchStart) {
						insertElement(w.output, "span", null, null, lookaheadMatch[1]);
						w.nextMatch = this.lookaheadRegExp.lastIndex;
					}
				}
			},

			{
				name: "htmlCharacterReference",
				match: "(?:(?:&#?[a-zA-Z0-9]{2,8};|.)(?:&#?(?:x0*(?:3[0-6][0-9a-fA-F]|1D[c-fC-F][0-9a-fA-F]|20[d-fD-F][0-9a-fA-F]|FE2[0-9a-fA-F])|0*(?:76[89]|7[7-9][0-9]|8[0-7][0-9]|761[6-9]|76[2-7][0-9]|84[0-3][0-9]|844[0-7]|6505[6-9]|6506[0-9]|6507[0-1]));)+|&#?[a-zA-Z0-9]{2,8};)",
				handler: function(w) {
					var el = document.createElement("span");
					el.innerHTML = w.matchText;
					insertText(w.output, el.textContent);
					if (typeof el.remove === "function") {
						el.remove();
					}
				}
			},

			{   // n.b. This formatter MUST come after any formatter which handles HTML tag-like constructs (e.g. html & rawText)
				name: "htmlTag",
				match: "<\\w+(?:\\s+[^\\u0000-\\u001F\\u007F-\\u009F\\s\"'>\\/=]+(?:\\s*=\\s*(?:\"[^\"]*?\"|'[^']*?'|[^\\s\"'=<>`]+))?)*\\s*\\/?>",
				tagPattern: "<(\\w+)",
				voidElements: [ "area", "base", "br", "col", "embed", "hr", "img", "input", "keygen", "link", "menuitem", "meta", "param", "source", "track", "wbr" ],
				nobrElements: [ "colgroup", "datalist", "dl", "figure", "ol", "optgroup", "select", "table", "tbody", "tfoot", "thead", "tr", "ul" ],
				handler: function (w) {
					var	tagMatch = new RegExp(this.tagPattern).exec(w.matchText),
						tag      = tagMatch && tagMatch[1],
						tagName  = tag && tag.toLowerCase();

					//if (tagName && ["html", "nowiki"].contains(tagName)) {
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
							var el = document.createElement(w.output.tagName);
							el.innerHTML = w.matchText;
							while (el.firstChild) {
								el = el.firstChild;
							}

							if (el.hasAttribute("data-passage")) {
								this.processDataAttributes(el);
							}

							if (terminatorMatch) {
								if (isNobr) {
									w._nobr.unshift(true);
								} else if (w._nobr.length !== 0) {
									w._nobr.unshift(false);
								}
								try {
									w.subWikify(el, terminator, true); // ignore case during match
								} finally {
									if (w._nobr.length !== 0) {
										w._nobr.shift();
									}
								}
							}
							w.output.appendChild(el);
						} else {
							throwError(w.output, 'HTML tag "' + tag + '" is not closed', w.matchText + "\u2026");
						}
					}
				},
				processDataAttributes: function (el) {
					var passage = el.getAttribute("data-passage");
					if (passage == null) { return; } // use lazy equality

					passage = ((typeof passage !== "string") ? String(passage) : passage).trim();
					if (/^\$\w+/.test(passage)) {
						passage = Wikifier.getValue(passage);
						el.setAttribute("data-passage", passage);
					}
					if (passage !== "") {
						if (el.tagName.toUpperCase() === "IMG") {
							var source;
							// check for Twine 1.4 Base64 image passage transclusion
							if (tale.has(passage)) {
								passage = tale.get(passage);
								if (passage.tags.contains("Twine.image")) {
									source = passage.text;
								}
							}
							el.src = source;
						} else {
							var	setter   = el.getAttribute("data-setter"),
								callback;
							if (setter != null) { // use lazy equality
								setter = ((typeof setter !== "string") ? String(setter) : setter).trim();
								if (setter !== "") {
									callback = (function (ex) { return function () { Wikifier.evalStatements(ex); }; }(Wikifier.parse(setter)));
								}
							}
							if (tale.has(passage)) {
								el.classList.add("link-internal");
								if (config.addVisitedLinkClass && state.has(passage)) {
									el.classList.add("link-visited");
								}
							} else {
								el.classList.add("link-broken");
							}
							jQuery(el).click(function () {
								if (typeof callback === "function") { callback(); }
								state.display(passage, el);
							});
						}
					}
				}
			}
		]
	}); // End formatters

	/**
	 * Setup aliases for externally used formatters
	 */
	Object.defineProperty(Wikifier, "imageFormatter", {
		value : _formatterImage
	});


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Wikifier; // export the constructor

}());

