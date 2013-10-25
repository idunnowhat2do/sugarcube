/***********************************************************************************************************************
** [Begin wikifier.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Global Object/Prototype Extensions] (ad hoc extensions to global objects and prototypes is a BAD IDEA!)
***********************************************************************************************************************/
/**
 * Returns an array of macro parameters, parsed from the string
 *   n.b. Used by the Wikifier
 */
String.prototype.readMacroParams = function (replaceVars)
{
	function getVal(argText)
	{
		function getPropNames(varText)
		{
			var   re    = /^(?:\$(\w+)|\.(\w+)|\[(?:(?:\"((?:\\.|[^\"\\])+)\")|(?:\'((?:\\.|[^\'\\])+)\')|(\$\w.*)|(\d+))\])/
				, match
				, names = [];

			while ((match = re.exec(varText)) !== null)
			{
				// Remove full match from varText
				varText = varText.slice(match[0].length);

			     // Base variable
				if (match[1]) { names.push(match[1]); }

				// Dot property
				else if (match[2]) { names.push(match[2]); }

				// Square-bracketed property (double quoted)
				else if (match[3]) { names.push(match[3]); }

				// Square-bracketed property (single quoted)
				else if (match[4]) { names.push(match[4]); }

				// Square-bracketed property (embedded $variable)
				else if (match[5]) { names.push(match[5].readMacroParams(true)[0]); }

				// Square-bracketed property (numeric index)
				else if (match[6]) { names.push(Number(match[6])); }
			}
			return (varText === "") ? names : [];
		}

		var   names  = getPropNames(argText)
			, retVal = undefined;

		if (names.length !== 0)
		{
			retVal = state.active.variables;
			for (var i = 0, len = names.length; i < len; i++)
			{
				if (typeof retVal[names[i]] !== "undefined")
				{
					retVal = retVal[names[i]];
				}
				else
				{
					retVal = undefined;
					break;
				}
			}
		}
		return retVal;
	}

	// RegExp groups: Double quoted | Single quoted | Empty quotes | Double square-bracketed | Barewords
	var   re     = new RegExp("(?:(?:\"((?:(?:\\\\\")|[^\"])+)\")|(?:'((?:(?:\\\\\')|[^'])+)')|((?:\"\")|(?:''))|(?:\\[\\[((?:\\s|\\S)*?)\\]\\])|([^\"'\\s]\\S*))", "gm")
		, params = [];

	do
	{
		var match = re.exec(this);
		if (match)
		{
			var n;

			// Double quoted
			if (match[1]) { n = match[1]; }

			// Single quoted
			else if (match[2]) { n = match[2]; }

			// Empty quotes
			else if (match[3]) { n = ""; }

			// Double square-bracketed
			else if (match[4])
			{
				n = match[4];

				// Convert to an object
				var delim = n.indexOf("|");	// FIXME?  This doesn't play well with quoted strings
				if (delim === -1)
				{
					n = { "link": n, "text": n };
				}
				else
				{
					n = { "link": n.slice(delim + 1), "text": n.slice(0, delim) };
				}

				// Check for $variables
				if (replaceVars)
				{
					for (var propName in n)
					{
						// $variable, so substitute its value
						if (/\$\w+/.test(n[propName]))
						{
							n[propName] = getVal(n[propName]);
						}
					}
				}
			}

			// Barewords
			else if (match[5])
			{
				n = match[5];

				// $variable, so substitute its value
				if (replaceVars && /\$\w+/.test(n))
				{
					n = getVal(n);
				}

				// Numeric literal, so coerce it into a number
				else if (isNumeric(n))
				{
					// n.b. Octal literals are not handled correctly by Number() (e.g. Number("077") yields 77, not 63).
					//      We could use eval("077") instead, which does correctly yield 63, however, it's probably far
					//      more likely that the average Twine/Twee author would expect "077" to yield 77 rather than 63.
					//      So, we cater to author expectation and use Number().
					n = Number(n);
				}

				// Boolean literal, so coerce it into a boolean
				else if (isBoolean(n))
				{
					n = (n === "true") ? true : false;
				}

				// Object/Array literals are too complex to automatically coerce and so are left as-is.  Authors really
				// shouldn't be passing object/array literals as arguments anyway.  If they want to pass a complex type,
				// store it in a variable and pass that instead.
			}

			params.push(n);
		}
	} while (match);

	return params;
};

/**
 * Returns a DOM property name for a CSS property, parsed from the string
 *   n.b. Used by the Wikifier
 */
String.prototype.unDash = function ()
{
	var t, s = this.split("-");
	if (s.length > 1)
	{
		for (t = 1; t < s.length; t++)
		{
			s[t] = s[t].substr(0,1).toUpperCase() + s[t].substr(1);
		}
	}
	return s.join("");
};


/***********************************************************************************************************************
** [Initialization]
***********************************************************************************************************************/
function WikiFormatter(formatters)
{
	this.formatters = [];
	var pattern     = [];

	for (var i = 0; i < formatters.length; i++)
	{
		pattern.push("(" + formatters[i].match + ")");
		this.formatters.push(formatters[i]);
	}

	this.formatterRegExp = new RegExp(pattern.join("|"), "gm");
}

function Wikifier(place, source)
{
	this.source    = source;
	this.output    = place;
	this.nextMatch = 0;
	this.formatter = formatter;	// formatter comes from the top-level scope

	this.subWikify(this.output);
}

Wikifier.prototype.subWikify = function (output, terminator)
{
	// Temporarily replace the output pointer
	var oldOutput = this.output;
	this.output = output;

	// Prepare the terminator RegExp
	var terminatorRegExp = terminator ? new RegExp("(" + terminator + ")", "gm") : null;

	var formatterMatch, terminatorMatch;
	do
	{
		// Prepare the RegExp match positions
		this.formatter.formatterRegExp.lastIndex = this.nextMatch;
		if (terminatorRegExp)
		{
			terminatorRegExp.lastIndex = this.nextMatch;
		}

		// Get the first matches
		formatterMatch = this.formatter.formatterRegExp.exec(this.source);
		terminatorMatch = terminatorRegExp ? terminatorRegExp.exec(this.source) : null;

		// Check for a terminator match
		if (terminatorMatch && (!formatterMatch || terminatorMatch.index <= formatterMatch.index))
		{
			// Output any text before the match
			if (terminatorMatch.index > this.nextMatch)
			{
				this.outputText(this.output, this.nextMatch, terminatorMatch.index);
			}

			// Set the match parameters
			this.matchStart = terminatorMatch.index;
			this.matchLength = terminatorMatch[1].length;
			this.matchText = terminatorMatch[1];
			this.nextMatch = terminatorMatch.index + terminatorMatch[1].length;

			// Restore the output pointer and exit
			this.output = oldOutput;
			return;
		}

		// Check for a formatter match
		else if (formatterMatch)
		{
			// Output any text before the match
			if (formatterMatch.index > this.nextMatch)
			{
				this.outputText(this.output, this.nextMatch, formatterMatch.index);
			}

			// Set the match parameters
			this.matchStart = formatterMatch.index;
			this.matchLength = formatterMatch[0].length;
			this.matchText = formatterMatch[0];
			this.nextMatch = this.formatter.formatterRegExp.lastIndex;

			// Figure out which formatter matched
			var matchingFormatter = -1;
			for (var i = 1; i < formatterMatch.length; i++)
			{
				if (formatterMatch[i])
				{
					matchingFormatter = i - 1;
				}
			}

			// Call the formatter
			if (matchingFormatter != -1)
			{
				this.formatter.formatters[matchingFormatter].handler(this);
			}
		}
	} while (terminatorMatch || formatterMatch);

	// Output any text after the last match
	if (this.nextMatch < this.source.length)
	{
		this.outputText(this.output, this.nextMatch, this.source.length);
		this.nextMatch = this.source.length
	}

	// Restore the output pointer
	this.output = oldOutput;
};

Wikifier.prototype.outputText = function (place, startPos, endPos)
{
	insertText(place, this.source.substring(startPos, endPos));
};

/**
 * Meant to be called by macros, this returns the raw, unprocessed, text passed to the currently executing macro.
 * Unlike TiddlyWiki's default mechanism, this does not attempt to split up the arguments into an array.
 */
Wikifier.prototype.rawArgs = function ()
{
	/*
	var   endPos  = this.source.indexOf(">>", this.matchStart)
		, wsDelim = this.source.slice(this.matchStart + 2, endPos).search(/[\s\u00a0\u2028\u2029]/);	// Unicode space-character escapes required for IE

	// +3 from: +2 to skip "<<" and +1 to eat the first whitespace character
	return (wsDelim === -1) ? "" : this.source.slice(this.matchStart + wsDelim + 3, endPos);
	*/

	return this._macroRawArgs;
};

/**
 * Meant to be called by macros, this returns the text passed to the currently executing macro after doing some
 * magic with certain Twine/Twee operators (like: eq, gt, and $variable).
 */
Wikifier.prototype.fullArgs = function ()
{
	return Wikifier.parse(this.rawArgs());
};

Wikifier.parse = function (expression, mappings)
{
	// Double quoted | Single quoted | Empty quotes | Operator delimiters | Barewords & Sigil
	var   tRe    = new RegExp("(?:(?:\"((?:(?:\\\\\")|[^\"])+)\")|(?:'((?:(?:\\\\\')|[^'])+)')|((?:\"\")|(?:''))|([=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}]+)|([^\"'=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}\\s]+))", "g")
		, tMatch
		, tMap   = mappings ||
			{
				// standard Twine/Twee operators
				  "$"    : "state.active.variables."
				, "eq"   : "=="
				, "neq"  : "!="
				, "gt"   : ">"
				, "gte"  : ">="
				, "lt"   : "<"
				, "lte"  : "<="
				, "and"  : "&&"
				, "or"   : "||"
				, "not"  : "!"
				// Twine2-compatible operators
				, "is"   : "=="
				, "to"   : "="
				// SugarCube operators
				, "def"  : '"undefined" !== typeof'
				, "ndef" : '"undefined" === typeof'
			};

	while ((tMatch = tRe.exec(expression)) !== null)
	{
		// noop: Double quoted | Single quoted | Empty quote | Operator delimiters

		// Barewords & Sigil
		if (tMatch[5])
		{
			var token = tMatch[5];

			if (token[0] === "$")	// special case
			{
				token = "$";
			}

			if (tMap[token])
			{
				expression = expression.splice
				(
					  tMatch.index	// starting index
					, token.length	// replace how many
					, tMap[token]	// replacement string
				);
				tRe.lastIndex += tMap[token].length - token.length;
			}
		}
	}

	return expression;
};

Wikifier.formatterHelpers =
{
	charFormatHelper: function (w)
	{
		var b = insertElement(w.output, this.element);
		w.subWikify(b, this.terminator);
	},
	inlineCssHelper: function (w)
	{
		var styles = [];
		var lookahead = "(?:(" + Wikifier.textPrimitives.anyLetter + "+)\\(([^\\)\\|\\n]+)(?:\\):))|(?:(" + Wikifier.textPrimitives.anyLetter + "+):([^;\\|\\n]+);)";
		var lookaheadRegExp = new RegExp(lookahead, "gm");
		var hadStyle = false;
		do
		{
			lookaheadRegExp.lastIndex = w.nextMatch;
			var lookaheadMatch = lookaheadRegExp.exec(w.source);
			var gotMatch = lookaheadMatch && lookaheadMatch.index == w.nextMatch;
			if (gotMatch)
			{
				var s, v;
				hadStyle = true;
				if (lookaheadMatch[1])
				{
					s = lookaheadMatch[1].unDash();
					v = lookaheadMatch[2];
				}
				else
				{
					s = lookaheadMatch[3].unDash();
					v = lookaheadMatch[4];
				}
				switch (s)
				{
				case "bgcolor":
					s = "backgroundColor";
					break;
				case "float":
					s = "cssFloat";
					break;
				}
				styles.push({ style: s, value: v });
				w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
			}
		} while (gotMatch);
		return styles;
	},
	monospacedByLineHelper: function (w)
	{
		var lookaheadRegExp = new RegExp(this.lookahead, "gm");
		lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			var text = lookaheadMatch[1];
			if (config.browser.isIE && config.browser.ieVersion < 10)
			{
				text = text.replace(/\n/g, "\r");
			}
			insertElement(w.output, "pre", null, null, text);
			w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
		}
	}
};

Wikifier.formatters =
[	// Begin formatters

{
	name: "table",
	match: "^\\|(?:[^\\n]*)\\|(?:[fhck]?)$",
	lookahead: "^\\|([^\\n]*)\\|([fhck]?)$",
	rowTerminator: "\\|(?:[fhck]?)$\\n?",
	cellPattern: "(?:\\|([^\\n\\|]*)\\|)|(\\|[fhck]?$\\n?)",
	cellTerminator: "(?:\\x20*)\\|",
	rowTypes: {"c": "caption", "h": "thead", "": "tbody", "f": "tfoot"},
	handler: function (w)
	{
		var   table           = insertElement(w.output, "table")
			, lookaheadRegExp = new RegExp(this.lookahead, "gm")
			, curRowType      = null
			, nextRowType
			, rowContainer
			, rowElement
			, prevColumns     = []
			, rowCount        = 0;
		w.nextMatch = w.matchStart;
		do
		{
			lookaheadRegExp.lastIndex = w.nextMatch;
			var   lookaheadMatch = lookaheadRegExp.exec(w.source)
				, matched        = lookaheadMatch && lookaheadMatch.index === w.nextMatch;
			if (matched)
			{
				nextRowType = lookaheadMatch[2];
				if (nextRowType === "k")
				{
					table.className = lookaheadMatch[1];
					w.nextMatch += lookaheadMatch[0].length + 1;
				}
				else
				{
					if (nextRowType !== curRowType)
					{
						rowContainer = insertElement(table, this.rowTypes[nextRowType]);
					}
					curRowType = nextRowType;
					if (curRowType === "c")
					{
						if (rowCount === 0)
						{
							rowContainer.setAttribute("align", "top");
						}
						else
						{
							rowContainer.setAttribute("align", "bottom");
						}
						w.nextMatch = w.nextMatch + 1;
						w.subWikify(rowContainer, this.rowTerminator);
					}
					else
					{
						rowElement = insertElement(rowContainer, "tr");
						this.rowHandler(w, rowElement, prevColumns);
					}
					rowCount++;
				}
			}
		} while (matched);
	},
	rowHandler: function (w, e, prevColumns)
	{
		var   col          = 0
			, curColCount  = 1
			, cellRegExp   = new RegExp(this.cellPattern, "gm");
		do
		{
			cellRegExp.lastIndex = w.nextMatch;
			var   cellMatch = cellRegExp.exec(w.source)
				, matched   = cellMatch && cellMatch.index === w.nextMatch;
			if (matched)
			{
				if (cellMatch[1] === "~")
				{
					var last = prevColumns[col];
					if (last)
					{
						last.rowCount++;
						last.element.setAttribute("rowSpan", last.rowCount);
						last.element.setAttribute("rowspan", last.rowCount);
						last.element.valign = "center";
					}
					w.nextMatch = cellMatch.index + cellMatch[0].length-1;
				}
				else if (cellMatch[1] === ">")
				{
					curColCount++;
					w.nextMatch = cellMatch.index + cellMatch[0].length-1;
				}
				else if (cellMatch[2])
				{
					w.nextMatch = cellMatch.index + cellMatch[0].length;;
					break;
				}
				else
				{
					var   spaceLeft  = false
						, spaceRight = false
						, cell;
					w.nextMatch++;
					var styles = Wikifier.formatterHelpers.inlineCssHelper(w);
					while (w.source.substr(w.nextMatch, 1) === " ")
					{
						spaceLeft = true;
						w.nextMatch++;
					}
					if (w.source.substr(w.nextMatch, 1) === "!")
					{
						cell = insertElement(e, "th");
						w.nextMatch++;
					}
					else
					{
						cell = insertElement(e, "td");
					}
					prevColumns[col] = { rowCount: 1, element: cell };
					var   lastColCount   = 1
						, lastColElement = cell;
					if (curColCount > 1)
					{
						cell.setAttribute("colSpan", curColCount);
						cell.setAttribute("colspan", curColCount);
						curColCount = 1;
					}
					for (var i = 0; i < styles.length; i++)
					{
						cell.style[styles[i].style] = styles[i].value;
					}
					w.subWikify(cell, this.cellTerminator);
					if (w.matchText.substr(w.matchText.length - 2, 1) === " ")
					{
						spaceRight = true;
					}
					if (spaceLeft && spaceRight)
					{
						cell.align = "center";
					}
					else if (spaceLeft)
					{
						cell.align = "right";
					}
					else if (spaceRight)
					{
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
	handler: function (w)
	{
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
	handler: function (w)
	{
		var lookaheadRegExp = new RegExp(this.lookahead, "gm");
		w.nextMatch = w.matchStart;
		var   placeStack = [w.output]
			, curType    = null
			, newType
			, curLevel   = 0
			, newLevel
			, i;
		do
		{
			lookaheadRegExp.lastIndex = w.nextMatch;
			var lookaheadMatch = lookaheadRegExp.exec(w.source);
			var matched = lookaheadMatch && lookaheadMatch.index == w.nextMatch;
			if (matched)
			{
				if (lookaheadMatch[2])
				{
					newType = "ol";
				}
				else
				{
					newType = "ul";
				}
				newLevel = lookaheadMatch[0].length;
				w.nextMatch += lookaheadMatch[0].length;
				if (newLevel > curLevel)
				{
					for (i = curLevel; i < newLevel; i++)
					{
						placeStack.push(insertElement(placeStack[placeStack.length - 1], newType));
					}
				}
				else if (newLevel < curLevel)
				{
					for (i = curLevel; i > newLevel; i--)
					{
						placeStack.pop();
					}
				}
				else if (newLevel == curLevel && newType != curType)
				{
					placeStack.pop();
					placeStack.push(insertElement(placeStack[placeStack.length - 1], newType));
				}
				curLevel = newLevel;
				curType = newType;
				var el = insertElement(placeStack[placeStack.length - 1], "li");
				w.subWikify(el, this.terminator);
			}
		} while (matched);
	}
},

{
	name: "quoteByBlock",
	match: "^<<<\\n",
	terminator: "^<<<\\n",
	handler: function (w)
	{
		var el = insertElement(w.output, "blockquote");
		w.subWikify(el, this.terminator);
	}
},

{
	name: "quoteByLine",
	match: "^>+",
	terminator: "\\n",
	element: "blockquote",
	handler: function (w)
	{
		var   lookaheadRegExp = new RegExp(this.match, "gm")
			, placeStack      = [w.output]
			, curLevel        = 0
			, newLevel        = w.matchLength
			, i;
		do
		{
			if (newLevel > curLevel)
			{
				for (i = curLevel; i < newLevel; i++)
				{
					placeStack.push(insertElement(placeStack[placeStack.length - 1], this.element));
				}
			}
			else
			{
				if (newLevel < curLevel)
				{
					for (i = curLevel; i > newLevel; i--)
					{
						placeStack.pop();
					}
				}
			}
			curLevel = newLevel;
			w.subWikify(placeStack[placeStack.length - 1], this.terminator);
			insertElement(placeStack[placeStack.length - 1], "br");
			lookaheadRegExp.lastIndex = w.nextMatch;
			var lookaheadMatch = lookaheadRegExp.exec(w.source);
			var matched = lookaheadMatch && lookaheadMatch.index == w.nextMatch;
			if (matched)
			{
				newLevel = lookaheadMatch[0].length;
				w.nextMatch += lookaheadMatch[0].length;
			}
		} while (matched);
	}
},

{
	name: "rule",
	match: "^----+$\\n?|<hr ?/?>\\n?",
	handler: function (w)
	{
		insertElement(w.output, "hr");
	}
},

{
	name: "monospacedByLine",
	match: "^\\{\\{\\{\\n",
	lookahead: "^\\{\\{\\{\\n((?:^[^\\n]*\\n)+?)(^\\}\\}\\}$\\n?)",
	handler: Wikifier.formatterHelpers.monospacedByLineHelper
},

{
	name: "monospacedByLineForPlugin",
	match: "^//\\{\\{\\{\\n",
	lookahead: "^//\\{\\{\\{\\n\\n*((?:^[^\\n]*\\n)+?)(\\n*^//\\}\\}\\}$\\n?)",
	handler: Wikifier.formatterHelpers.monospacedByLineHelper
},

{
	name: "wikifyCommentForPlugin",
	match: "^/\\*\\*\\*\\n",
	terminator: "^\\*\\*\\*/\\n",
	handler: function (w)
	{
		w.subWikify(w.output, this.terminator);
	}
},

{
	name: "prettyLink",
	match: "\\[\\[",
	lookahead: "\\[\\[([^\\|\\]]*?)(?:(\\]\\])|(\\|(.*?)\\]\\]))",
	terminator: "\\|",
	handler: function (w)
	{
		var lookaheadRegExp = new RegExp(this.lookahead, "gm");
		lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = lookaheadRegExp.exec(w.source);
		var el;
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			if (lookaheadMatch[2])
			{
				el = Wikifier.createInternalLink(w.output, lookaheadMatch[1]);
				w.outputText(el, w.nextMatch, w.nextMatch + lookaheadMatch[1].length);
				w.nextMatch += lookaheadMatch[1].length + 2;
			}
			else if (lookaheadMatch[3])
			{
				if (tale.has(lookaheadMatch[4]))
				{
					el = Wikifier.createInternalLink(w.output, lookaheadMatch[4]);
				}
				else
				{
					el = Wikifier.createExternalLink(w.output, lookaheadMatch[4]);
				}
				w.outputText(el, w.nextMatch, w.nextMatch + lookaheadMatch[1].length);
				w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
			}
		}
	}
},

{
	name: "urlLink",
	match: "(?:http|https|mailto|ftp):[^\\s'\"]+(?:/|\\b)",
	handler: function (w)
	{
		var el = Wikifier.createExternalLink(w.output, w.matchText);
		w.outputText(el, w.matchStart, w.nextMatch);
	}
},

{
	name: "image",
	match: "\\[(?:[<]{0,1})(?:[>]{0,1})[Ii][Mm][Gg]\\[",
	lookahead: "\\[([<]{0,1})([>]{0,1})[Ii][Mm][Gg]\\[(?:([^\\|\\]]+)\\|)?([^\\[\\]\\|]+)\\](?:\\[([^\\]]*)\\]?)?(\\])",
	handler: function (w)
	{
		var lookaheadRegExp = new RegExp(this.lookahead, "gm");
		lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			var el = w.output;
			if (lookaheadMatch[5])
			{
				if (tale.has(lookaheadMatch[5]))
				{
					el = Wikifier.createInternalLink(w.output, lookaheadMatch[5]);
				}
				else
				{
					el = Wikifier.createExternalLink(w.output, lookaheadMatch[5]);
				}
			}
			var img = insertElement(el, "img");
			if (lookaheadMatch[1])
			{
				img.align = "left";
			}
			else if (lookaheadMatch[2])
			{
				img.align = "right";
			}
			if (lookaheadMatch[3])
			{
				img.title = lookaheadMatch[3];
			}
			img.src = lookaheadMatch[4];
			w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
		}
	}
},

{
	name: "macro",
	match: "<<",
	//lookahead: "<<([^>\\s]+)(?:\\s*)((?:(?:\"(?:\\\\.|[^\"\\\\])*\")|(?:'(?:\\\\.|[^'\\\\])*')|[^>]|(?:>(?!>)))*)>>",
	lookaheadRegExp: /<<([^>\s]+)(?:\s*)((?:(?:\"(?:\\.|[^\"\\])*\")|(?:\'(?:\\.|[^\'\\])*\')|[^>]|(?:>(?!>)))*)>>/gm,
	working: { name: "", handlerName: "", arguments: "", index: 0 },
	handler: function (w)
	{
//console.log("[formatters.macro.handler()]");
		this.lookaheadRegExp.lastIndex = w.matchStart;
		if (this.parseMacroTag(w))
		{
//console.log("   +> " + this.working.name + ": tagBegin: " + this.working.index + ", tagEnd: " + w.nextMatch + ", tagData: `" + w.source.slice(this.working.index + 2, w.nextMatch - 2) + "`, tagArgs: " + this.working.arguments);
			// the call to processChildren() below will likely change the working
			// values, so we must cache them now
			var   macroName = this.working.name
				, funcName  = this.working.handlerName
				, macroArgs = this.working.arguments;
			try
			{
				var macro = macros[macroName];
				if (macro)
				{
					var payload;
					if (macro.hasOwnProperty("children"))
					{
						payload = this.processChildren(w, macro.children.bodyTags);
					}
					if (typeof macro[funcName] === "function")
					{
						var params = [];
						if (!macro["excludeParams"])
						{
							params = macroArgs.readMacroParams(macro["replaceVarParams"] !== undefined ? macro["replaceVarParams"] : true);
						}
						w._macroRawArgs = macroArgs;	// cache the raw arguments for use by rawArgs()/fullArgs()
						macro[funcName](w.output, macroName, params, w, payload);
						w._macroRawArgs = "";
					}
					else
					{
						throwError(w.output, "macro <<" + macroName + '>> property "' + funcName + '" ' + (macro.hasOwnProperty(funcName) ? "is not a function" : "does not exist"));
					}
				}
				else if (macros._children.hasOwnProperty(macroName))
				{
					throwError(w.output, "macro <<" + macroName + ">> was found outside of a call to its parent <<" + macros._children[macroName] + ">>");
				}
				else
				{
					throwError(w.output, "macro <<" + macroName + ">> does not exist");
				}
			}
			catch (e)
			{
				throwError(w.output, "cannot execute " + ((macro && macro.isWidget) ? "widget" : "macro") + " <<" + macroName + ">>: " + e.message);
				return;
			}
			finally
			{
				this.working.name = "";
				this.working.handlerName = "";
				this.working.arguments = "";
				this.working.index = 0;
			}
		}
	},
	parseMacroTag: function (w)
	{
		var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart && lookaheadMatch[1])
		{
			w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
			this.lookaheadRegExp.lastIndex = w.nextMatch;

			var funcSigil = lookaheadMatch[1].indexOf("::");
			if (funcSigil !== -1)
			{
				this.working.name = lookaheadMatch[1].slice(0, funcSigil);
				this.working.handlerName = lookaheadMatch[1].slice(funcSigil + 2);
			}
			else
			{
				this.working.name = lookaheadMatch[1];
				this.working.handlerName = "handler";
			}
			this.working.arguments = lookaheadMatch[2];
			this.working.index = lookaheadMatch.index;

			return true;
		}
		return false;
	},
	processChildren: function (w, bodyTags)
	{
////console.log("[processChildren(" + this.working.name + ")]");
		var   openTag      = this.working.name
			, closeTag     = "/" + openTag
			, closeAlt     = "end" + openTag
			, end          = -1
			, opened       = 1
			, curTag       = this.working.name
			, curArgument  = this.working.arguments
			, contentStart = w.nextMatch
			, payload      = [];

		while ((w.matchStart = w.source.indexOf("<<", w.nextMatch)) !== -1
			&& this.parseMacroTag(w))
		{
			var   tagName  = this.working.name
				, tagArgs  = this.working.arguments
				, tagBegin = this.working.index
				, tagEnd   = w.nextMatch;
//console.log("   -> " + this.working.name + ": tagBegin: " + this.working.index + ", tagEnd: " + w.nextMatch + ", tagData: `" + w.source.slice(this.working.index + 2, w.nextMatch - 2) + "`, tagArgs: " + this.working.arguments);

			switch (tagName)
			{
			case openTag:
				opened++;
				break;

			case closeAlt:
				// fallthrough
			case closeTag:
				opened--;
				break;

			default:
				if (opened === 1 && bodyTags)
				{
					for (var i = 0, len = bodyTags.length; i < len; i++)
					{
						if (tagName === bodyTags[i])
						{
							payload.push({ name: curTag, arguments: curArgument, contents: w.source.slice(contentStart, tagBegin) });
							curTag       = tagName;
							curArgument  = tagArgs;
							contentStart = tagEnd;
						}
					}
				}
				break;
			}
			if (opened === 0)
			{
				payload.push({ name: curTag, arguments: curArgument, contents: w.source.slice(contentStart, tagBegin) });
				end = tagEnd;
				break;
			}
		}

//console.log("< end: " + end);
		if (end !== -1)
		{
			w.nextMatch = end;
			return payload;
		}
		return null;
	}
},

{
	name: "html",
	match: "<[Hh][Tt][Mm][Ll]>",
	lookahead: "<[Hh][Tt][Mm][Ll]>((?:.|\\n)*?)</[Hh][Tt][Mm][Ll]>",
	handler: function (w)
	{
		var lookaheadRegExp = new RegExp(this.lookahead, "gm");
		lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			/* don't wrap the contents of the <html> tag
			var el = insertElement(w.output, "span");
			el.innerHTML = lookaheadMatch[1];
			*/
			/*
			jQuery(w.output).append(lookaheadMatch[1]);
			*/
			var   frag = document.createDocumentFragment()
				, temp = document.createElement("div");
			temp.innerHTML = lookaheadMatch[1];
			while (temp.firstChild)
			{
				frag.appendChild(temp.firstChild);
			}
			w.output.appendChild(frag);

			w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
		}
	}
},

{
	name: "commentByBlock",
	match: "/%",
	lookahead: "/%((?:.|\\n)*?)%/",
	handler: function (w)
	{
		var lookaheadRegExp = new RegExp(this.lookahead, "gm");
		lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
		}
	}
},

{
	name: "boldByChar",
	match: "''",
	terminator: "''",
	element: "strong",
	handler: Wikifier.formatterHelpers.charFormatHelper
},

{
	name: "strikeByChar",
	match: "==",
	terminator: "==",
	element: "strike",
	handler: Wikifier.formatterHelpers.charFormatHelper
},

{
	name: "underlineByChar",
	match: "__",
	terminator: "__",
	element: "u",
	handler: Wikifier.formatterHelpers.charFormatHelper
},

{
	name: "italicByChar",
	match: "//",
	terminator: "//",
	element: "em",
	handler: Wikifier.formatterHelpers.charFormatHelper
},

{
	name: "subscriptByChar",
	match: "~~",
	terminator: "~~",
	element: "sub",
	handler: Wikifier.formatterHelpers.charFormatHelper
},

{
	name: "superscriptByChar",
	match: "\\^\\^",
	terminator: "\\^\\^",
	element: "sup",
	handler: Wikifier.formatterHelpers.charFormatHelper
},

{
	name: "monospacedByChar",
	match: "\\{\\{\\{",
	lookahead: "\\{\\{\\{((?:.|\\n)*?)\\}\\}\\}",
	handler: function (w)
	{
		var lookaheadRegExp = new RegExp(this.lookahead, "gm");
		lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			insertElement(w.output, "code", null, null, lookaheadMatch[1]);
			w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
		}
	}
},

{
	name: "styleByChar",
	match: "@@",
	terminator: "@@",
	lookahead: "(?:([^\\(@]+)\\(([^\\)]+)(?:\\):))|(?:([^:@]+):([^;]+);)",
	handler: function (w)
	{
		var el = insertElement(w.output, "span", null, null, null);
		var styles = Wikifier.formatterHelpers.inlineCssHelper(w);
		if (styles.length == 0)
		{
			el.className = "marked";
		}
		else
		{
			for (var i = 0; i < styles.length; i++)
			{
				el.style[styles[i].style] = styles[i].value;
			}
		}
		w.subWikify(el, this.terminator);
	}
},

{
	name: "emdash",
	match: "--",
	handler: function (w)
	{
		insertElement(w.output, "span").innerHTML = "\u2014";
	}
},

{
	name: "lineContinuation",
	match: "\\\\[\\s\\u00a0\\u2028\\u2029]*?(?:\\n|$)",	// Unicode space-character escapes required for IE
	handler: function (w)
	{
		w.nextMatch = w.matchStart + w.matchLength;
	}
},

{
	name: "lineBreak",
	match: "\\n|<br ?/?>",
	handler: function (w)
	{
		insertElement(w.output, "br");
	}
},

{
	name: "rawText",
	match: "\"{3}|<nowiki>",
	lookaheadRegExp: /(?:\"{3}|<nowiki>)((?:.|\n)*?)(?:\"{3}|<\/nowiki>)/mg,
	handler: function(w)
	{
		this.lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
		if(lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			insertElement(w.output, "span", null, null, lookaheadMatch[1]);
			w.nextMatch = this.lookaheadRegExp.lastIndex;
		}
	}
//},
//
//{
//	name: "htmlEntitiesEncoding",
//	match: "(?:(?:&#?[a-zA-Z0-9]{2,8};|.)(?:&#?(?:x0*(?:3[0-6][0-9a-fA-F]|1D[c-fC-F][0-9a-fA-F]|20[d-fD-F][0-9a-fA-F]|FE2[0-9a-fA-F])|0*(?:76[89]|7[7-9][0-9]|8[0-7][0-9]|761[6-9]|76[2-7][0-9]|84[0-3][0-9]|844[0-7]|6505[6-9]|6506[0-9]|6507[0-1]));)+|&#?[a-zA-Z0-9]{2,8};)",
//	handler: function(w)
//	{
//		insertElement(w.output, "span").innerHTML = w.matchText;
//	}
}

];	// End formatters

Wikifier.createInternalLink = function (place, passage, text)
{
	var el = insertPassageLink(place, passage, text);
	el.addEventListener("click", function ()
	{
		state.display(passage, el);
	}, false);
	return el;
};

Wikifier.createExternalLink = function (place, url, text)
{
	var el = insertElement(place, "a", null, "link-external", text);
	el.href = url;
	el.target = "_blank";
	return el;
};

Wikifier.textPrimitives =
{
	//anyDigit: "[0-9]",
	//anyNumberChar: "[0-9\\.E]",
	//urlPattern: "(?:http|https|mailto|ftp):[^\\s'\"]+(?:/|\\b)"
};
if (!((new RegExp("[\u0150\u0170]", "g")).test("\u0150")))
{
	//Wikifier.textPrimitives.upperLetter = "[A-Z\u00c0-\u00de]";
	//Wikifier.textPrimitives.lowerLetter = "[a-z\u00df-\u00ff_0-9\\-]";
	Wikifier.textPrimitives.anyLetter = "[A-Za-z\u00c0-\u00de\u00df-\u00ff_0-9\\-]";
}
else
{
	//Wikifier.textPrimitives.upperLetter = "[A-Z\u00c0-\u00de\u0150\u0170]";
	//Wikifier.textPrimitives.lowerLetter = "[a-z\u00df-\u00ff_0-9\\-\u0151\u0171]";
	Wikifier.textPrimitives.anyLetter = "[A-Za-z\u00c0-\u00de\u00df-\u00ff_0-9\\-\u0150\u0170\u0151\u0171]";
};


/***********************************************************************************************************************
** [End wikifier.js]
***********************************************************************************************************************/
