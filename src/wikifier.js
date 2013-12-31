/***********************************************************************************************************************
** [Begin wikifier.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Global Object/Prototype Extensions]
***********************************************************************************************************************/
/**
 * Returns an array of macro parameters, parsed from the string
 *   n.b. Used by the Wikifier
 */
String.prototype.readMacroParams = function ()
{
	// RegExp groups: Double quoted | Single quoted | Empty quotes | Double square-bracketed | Barewords
	//var   re     = new RegExp("(?:(?:\"((?:(?:\\\\\")|[^\"])+)\")|(?:'((?:(?:\\\\')|[^'])+)')|((?:\"\")|(?:''))|(?:(\\[\\[(?:\\s|\\S)*?\\](?:\\[(?:\\s|\\S)*?\\])?\\]))|([^\"'\\s]\\S*))", "gm")
	var   re     = new RegExp("(?:(?:\"((?:(?:\\\\\")|[^\"])+)\")|(?:'((?:(?:\\\\')|[^'])+)')|((?:\"\")|(?:''))|(?:(\\[\\[(?:\\s|\\S)*?\\]\\]))|([^\"'\\s]\\S*))", "gm")
		, match
		, params = [];

	while ((match = re.exec(this)) !== null)
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
			var   linkRe    = new RegExp(Wikifier.textPrimitives.linkPattern)
				, linkMatch = linkRe.exec(n)
				, linkObj   = {};
			if (linkMatch !== null)
			{	// 1=(text), 2=(~), 3=link, 4=(set)
				linkObj.count      = linkMatch[1] ? 2 : 1;
				linkObj.link       = /\$\w+/.test(linkMatch[3]) ? Wikifier.getValue(linkMatch[3]) : linkMatch[3];
				linkObj.text       = linkMatch[1] ? (/\$\w+/.test(linkMatch[1]) ? Wikifier.getValue(linkMatch[1]) : linkMatch[1]) : linkObj.link;
				linkObj.isExternal = !linkMatch[2] && Wikifier.formatterHelpers.isExternalLink(linkObj.link);
				linkObj.setFn      = linkMatch[4]
					? function (ex) { return function () { macros.eval(ex, null, null); }; }(Wikifier.parse(linkMatch[4]))
					: null;
				n = linkObj;
			}
		}

		// Barewords
		else if (match[5])
		{
			n = match[5];

			// $variable, so substitute its value
			if (/\$\w+/.test(n))
			{
				n = Wikifier.getValue(n);
			}

			// Numeric literal, so convert it into a number
			else if (isNumeric(n))
			{
				// n.b. Octal literals are not handled correctly by Number() (e.g. Number("077") yields 77, not 63).
				//      We could use eval("077") instead, which does correctly yield 63, however, it's probably far
				//      more likely that the average Twine/Twee author would expect "077" to yield 77 rather than 63.
				//      So, we cater to author expectation and use Number().
				//
				//      Besides, octal literals are browser extensions, which aren't part of the ECMAScript standard,
				//      and are considered deprecated in most (all?) browsers anyway.
				n = Number(n);
			}

			// Boolean literal, so convert it into a boolean
			else if (isBoolean(n))
			{
				n = (n === "true") ? true : false;
			}

			// Null literal, so convert it into null
			else if (n === "null")
			{
				n = null;
			}

			// Undefined literal, so convert it into undefined
			else if (n === "undefined")
			{
				n = undefined;
			}

			// Object/Array literals are too complex to worry about automatically converting and so are left as-is.
			// Authors really shouldn't be passing object/array literals as arguments anyway.  If they want to pass
			// a complex type, store it in a variable and pass that instead.
		}

		params.push(n);
	}

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
	this.byName     = {};
	var pattern     = [];

	for (var i = 0; i < formatters.length; i++)
	{
		pattern.push("(" + formatters[i].match + ")");
		this.formatters.push(formatters[i]);
		this.byName[formatters[i].name] = this.formatters[this.formatters.length - 1];
	}

	this.formatterRegExp = new RegExp(pattern.join("|"), "gm");
}

function Wikifier(place, source)
{
	this.source    = source;
	this.output    = place;
	this.nextMatch = 0;
	this.formatter = formatter;	// formatter comes from the top-level scope of the module

	this.subWikify(this.output);
	if (typeof this.output.normalize === "function")
	{
		this.output.normalize();
	}
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
					break;	// stop once we've found the matching formatter
				}
			}

			// Call the formatter
			if (matchingFormatter !== -1)
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

/**
 * Returns the passed string with all Twine/Twee operators converted to their JavaScript counterparts
 */
Wikifier.parse = function (expression)
{
	// Double quoted | Single quoted | Empty quotes | Operator delimiters | Barewords & Sigil
	var   re    = new RegExp("(?:(?:\"((?:(?:\\\\\")|[^\"])+)\")|(?:'((?:(?:\\\\\')|[^'])+)')|((?:\"\")|(?:''))|([=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}]+)|([^\"'=+\\-*\\/%<>&\\|\\^~!?:,;\\(\\)\\[\\]{}\\s]+))", "g")
		, match
		, map   =
			{
				// standard Twine/Twee operators
				  "$"      : "state.active.variables."
				, "eq"     : "=="
				, "neq"    : "!="
				, "gt"     : ">"
				, "gte"    : ">="
				, "lt"     : "<"
				, "lte"    : "<="
				, "and"    : "&&"
				, "or"     : "||"
				, "not"    : "!"
				// Twine2-compatible operators
				, "is"     : "==="
				, "is not" : "!=="
				, "to"     : "="
				// SugarCube operators
				, "def"    : '"undefined" !== typeof'
				, "ndef"   : '"undefined" === typeof'
			};

	while ((match = re.exec(expression)) !== null)
	{
		// noop: Double quoted | Single quoted | Empty quote | Operator delimiters

		// Barewords & Sigil
		if (match[5])
		{
			var token = match[5];

			// special case: if the token is "$", then it's the jQuery function alias or a naked dollar-sign, so skip over it
			if (token === "$")
			{
				continue;
			}
			// special case: if the token starts with a "$", then it's a $variable, so just replace the sigil ("$")
			else if (token[0] === "$")
			{
				token = "$";
			}
			// special case: if the token is "is", check to see if it's part of the "is not" operator
			else if (token === "is" && expression.slice(match.index, match.index + 6) === "is not")
			{
				token = "is not";
			}

			if (map[token])
			{
				expression = expression.splice
				(
					  match.index	// starting index
					, token.length	// replace how many
					, map[token]	// replacement string
				);
				re.lastIndex += map[token].length - token.length;
			}
		}
	}

	return expression;
};

/**
 * Returns the value of the passed story $variable
 */
Wikifier.getValue = function (storyVar)
{
	var   pNames = Wikifier.parseStoryVariable(storyVar)
		, retVal = undefined;

	if (pNames.length !== 0)
	{
		retVal = state.active.variables;
		for (var i = 0, len = pNames.length; i < len; i++)
		{
			if (typeof retVal[pNames[i]] !== "undefined")
			{
				retVal = retVal[pNames[i]];
			}
			else
			{
				retVal = undefined;
				break;
			}
		}
	}
	return retVal;
};

/**
 * Sets the value of the passed story $variable
 */
Wikifier.setValue = function (storyVar, newValue)
{
	var pNames = Wikifier.parseStoryVariable(storyVar);

	if (pNames.length !== 0)
	{
		var   baseObj = state.active.variables
			, varName = pNames.pop();
		for (var i = 0, len = pNames.length; i < len; i++)
		{
			if (typeof baseObj[pNames[i]] !== "undefined")
			{
				baseObj = baseObj[pNames[i]];
			}
			else
			{
				baseObj = undefined;
				break;
			}
		}
		if (baseObj !== undefined)
		{
			baseObj[varName] = newValue;
			return true;
		}
	}
	return false;
};

/**
 * Returns the property name chain of the passed story $variable, which may be of arbitrary complexity
 */
Wikifier.parseStoryVariable = function (varText)
{
	var   re     = /^(?:\$(\w+)|\.(\w+)|\[(?:(?:\"((?:\\.|[^\"\\])+)\")|(?:\'((?:\\.|[^\'\\])+)\')|(\$\w.*)|(\d+))\])/
		, match
		, pNames = [];

	while ((match = re.exec(varText)) !== null)
	{
		// Remove full match from varText
		varText = varText.slice(match[0].length);

		// Base variable
		if (match[1]) { pNames.push(match[1]); }

		// Dot property
		else if (match[2]) { pNames.push(match[2]); }

		// Square-bracketed property (double quoted)
		else if (match[3]) { pNames.push(match[3]); }

		// Square-bracketed property (single quoted)
		else if (match[4]) { pNames.push(match[4]); }

		// Square-bracketed property (embedded $variable)
		else if (match[5]) { pNames.push(Wikifier.getValue(match[5])); }

		// Square-bracketed property (numeric index)
		else if (match[6]) { pNames.push(Number(match[6])); }
	}
	return (varText === "") ? pNames : [];
};

/**
 * Wikify the passed text and discard the output, throwing if there were errors
 */
Wikifier.wikifyEval = function (text)
{
	var errTrap = document.createElement("div");
	try
	{
		new Wikifier(errTrap, text);
		while (errTrap.hasChildNodes())
		{
			var fc = errTrap.firstChild;
			if (fc.classList && fc.classList.contains("error"))
			{
				throw new Error(fc.textContent.replace(/^Error:\s+/, ""));
			}
			errTrap.removeChild(fc);
		}
	}
	finally
	{
		removeChildren(errTrap);	// remove any remaining children
		if (typeof errTrap["remove"] === "function")
		{
			errTrap.remove();		// remove the trap itself
		}
	}
}

/**
 * Create and return an internal link
 */
Wikifier.createInternalLink = function (place, passage, text, callback)
{
	var el = document.createElement("a");
	if (typeof passage !== "undefined")	// 0 is a valid ID and name, so we have to type check
	{
		el.setAttribute("data-passage", passage);
		el.className = tale.has(passage) ? "link-internal" : "link-broken";
	}
	if (text)
	{
		insertText(el, text);
	}
	if (place)
	{
		place.appendChild(el);
	}
	if (typeof passage !== "undefined")	// 0 is a valid ID and name, so we have to type check
	{
		$(el).click(function () {
			if (typeof callback === "function") { callback(); }
			state.display(passage, el);
		});
	}
	return el;
};

/**
 * Create and return an external link
 */
Wikifier.createExternalLink = function (place, url, text)
{
	var el = insertElement(place, "a", null, "link-external", text);
	if (url)
	{
		el.href = url;
	}
	el.target = "_blank";
	return el;
};

/**
 * Setup the basic text primitives (regular expressions)
 */
if (!((new RegExp("[\u0150\u0170]","g")).test("\u0150")))
{
	Wikifier.textPrimitives =
	{
		/*
		  upperLetter     : "[A-Z\u00c0-\u00de]"
		, lowerLetter     : "[a-z0-9_\\-\u00df-\u00ff]"
		, anyLetter       : "[A-Za-z0-9_\\-\u00c0-\u00de\u00df-\u00ff]"
		, anyLetterStrict : "[A-Za-z0-9\u00c0-\u00de\u00df-\u00ff]"
		*/
		anyLetter: "[A-Za-z0-9_\\-\u00c0-\u00de\u00df-\u00ff]"
	};
}
else
{
	Wikifier.textPrimitives =
	{
		/*
		  upperLetter     : "[A-Z\u00c0-\u00de\u0150\u0170]"
		, lowerLetter     : "[a-z0-9_\\-\u00df-\u00ff\u0151\u0171]"
		, anyLetter       : "[A-Za-z0-9_\\-\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]"
		, anyLetterStrict : "[A-Za-z0-9\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]"
		*/
		anyLetter: "[A-Za-z0-9_\\-\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]"
	};
}
Wikifier.textPrimitives.urlPattern   = "(?:file|https?|mailto|ftp|javascript|irc|news|data):[^\\s'\"]+(?:/|\\b)";
Wikifier.textPrimitives.linkPattern  = "\\[\\[\\s*(?:(.+?)\\s*\\|\\s*)?(~)?(.+?)\\s*\\](?:\\[\\s*(.+?)\\s*\\])?\\]";	// 1=(text), 2=(~), 3=link, 4=(set)
Wikifier.textPrimitives.imagePattern = "\\[([<]?)([>]?)[Ii][Mm][Gg]\\[\\s*(?:(.+?)\\s*\\|\\s*)?([^\\|]+?)\\s*\\](?:\\[\\s*(~)?(.+?)\\s*\\])?(?:\\[\\s*(.+?)\\s*\\])?\\]";	// 1=(left), 2=(right), 3=(title), 4=source, 5=(~), 6=(link), 7=(set)

/**
 * Setup helper functions for the formatters
 */
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
	},
	isExternalLink: function(link)
	{
		if (tale.has(link)) { return false; }

		var urlRegExp = new RegExp("^" + Wikifier.textPrimitives.urlPattern, "gim");
		if (urlRegExp.test(link) || link.search(/[\.\/\\#]/) !== -1)
		{
			return true;
		}
		return false;
	}
};

/**
 * Setup the wiki formatters
 */
Wikifier.formatters =
[	// Begin formatters

{
	name: "table",
	match: "^\\|(?:[^\\n]*)\\|(?:[fhck]?)$",
	lookahead: "^\\|([^\\n]*)\\|([fhck]?)$",
	rowTerminator: "\\|(?:[fhck]?)$\\n?",
	cellPattern: "(?:\\|([^\\n\\|]*)\\|)|(\\|[fhck]?$\\n?)",
	cellTerminator: "(?:\\x20*)\\|",
	rowTypes: { "c": "caption", "h": "thead", "": "tbody", "f": "tfoot" },
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
					w.nextMatch = cellMatch.index + cellMatch[0].length;
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
	lookaheadRegExp: /(\[\[(?:\s|\S)*?\]\])/gm,
	handler: function (w)
	{
		this.lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			var   re    = new RegExp("^" + Wikifier.textPrimitives.linkPattern + "$")
				, match = re.exec(lookaheadMatch[0]);
			if (match !== null)
			{	// 1=(text), 2=(~), 3=link, 4=(set)
				w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;

				var   link  = /\$\w+/.test(match[3]) ? Wikifier.getValue(match[3]) : match[3]
					, text  = match[1] ? (/\$\w+/.test(match[1]) ? Wikifier.getValue(match[1]) : match[1]) : link
					, setFn = match[4]
						? function (ex) { return function () { macros.eval(ex, null, null); }; }(Wikifier.parse(match[4]))
						: null;
				if (!match[2] && Wikifier.formatterHelpers.isExternalLink(link))
				{
					Wikifier.createExternalLink(w.output, link, text);
				}
				else
				{
					Wikifier.createInternalLink(w.output, link, text, setFn);
				}
			}
		}
	}
},

{
	name: "urlLink",
	match: Wikifier.textPrimitives.urlPattern,
	handler: function (w)
	{
		var el = Wikifier.createExternalLink(w.output, w.matchText);
		w.outputText(el, w.matchStart, w.nextMatch);
	}
},

{
	name: "image",
	match: "\\[[<>]?[Ii][Mm][Gg]\\[",
	lookaheadRegExp: /(\[[<>]?[Ii][Mm][Gg]\[(?:\s|\S)*?\]\])/gm,
	handler: function (w)
	{
		this.lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			var   re    = new RegExp("^" + Wikifier.textPrimitives.imagePattern + "$")
				, match = re.exec(lookaheadMatch[0]);
			if (match !== null)
			{	// 1=(left), 2=(right), 3=(title), 4=source, 5=(~), 6=(link), 7=(set)
				w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;

				var   el     = w.output
					, setFn  = match[7]
						? function (ex) { return function () { macros.eval(ex, null, null); }; }(Wikifier.parse(match[7]))
						: null
					, source;

				if (match[6])
				{
					var link = /\$\w+/.test(match[6]) ? Wikifier.getValue(match[6]) : match[6];
					if (!match[5] && Wikifier.formatterHelpers.isExternalLink(link))
					{
						el = Wikifier.createExternalLink(el, link);
					}
					else
					{
						el = Wikifier.createInternalLink(el, link, null, setFn);
					}
					el.classList.add("link-image");
				}
				el = insertElement(el, "img");
				source = /\$\w+/.test(match[4]) ? Wikifier.getValue(match[4]) : match[4];
				// check for Twine 1.4 Base64 image passage transclusion
				if (source.slice(0, 5) !== "data:" && tale.has(source))
				{
					var passage = tale.get(source);
					if (passage.tags.indexOf("Twine.image") !== -1)
					{
						source = passage.text;
					}
				}
				el.src = source;
				if (match[3])
				{
					el.title = /\$\w+/.test(match[3]) ? Wikifier.getValue(match[3]) : match[3];
				}
				if (match[1])
				{
					el.align = "left";
				}
				else if (match[2])
				{
					el.align = "right";
				}
			}
		}
	}
},

{
	name: "macro",
	match: "<<",
	lookaheadRegExp: /<<([^>\s]+)(?:\s*)((?:(?:\"(?:\\.|[^\"\\])*\")|(?:\'(?:\\.|[^\'\\])*\')|[^>]|(?:>(?!>)))*)>>/gm,
	working: { name: "", handlerName: "", arguments: "", index: 0 },	// the working parse object
	context: null,	// last execution context object (top-level macros, hierarchically, have a null context)
	handler: function (w)
	{
		this.lookaheadRegExp.lastIndex = w.matchStart;
		if (this.parseTag(w))
		{
			// if parseBody() is called below, it will change the current working
			// values, so we must cache them now
			var   macroName   = this.working.name
				, handlerName = this.working.handlerName
				, macroArgs   = this.working.arguments;
			try
			{
				var macro = macros.get(macroName);
				if (macro)
				{
					/* legacy kludges */
					if (macro.hasOwnProperty("excludeParams"))
					{
						macro["skipArgs"] = macro["excludeParams"];
						delete macro["excludeParams"];
					}
					if (macro.hasOwnProperty("children") && !macro.hasOwnProperty("tags"))
					{
						macro["tags"] = macro["children"];
						delete macro["children"];
					}
					/* /legacy kludges */

					var payload = null;
					if (macro.hasOwnProperty("tags"))
					{
						payload = this.parseBody(w, macro.tags);
						if (!payload)
						{
							return throwError(w.output, "cannot find a closing tag for macro <<" + macroName + ">>");
						}
					}
					if (typeof macro[handlerName] === "function")
					{
						var args = (!macro.hasOwnProperty("skipArgs") || !macro["skipArgs"]) ? macroArgs.readMacroParams() : [];

						// new-style macros
						if (macro.hasOwnProperty("_USE_MACROS_API"))
						{
							var   prevContext = this.context
								, curContext  =	// setup the execution context object (should probably make a factory for this)
									{
										// data properties
										  "self"    : macro
										, "name"    : macroName
										, "args"    : args
										, "payload" : payload
										, "output"  : w.output
										, "parser"  : w
										, "context" : this.context

										// method properties
										, "contextHas": function (filter)
											{
												var c = this;

												while ((c = c.context) !== null)
												{
													if (filter(c)) { return true; }
												}
												return false;
											}
										, "contextSelect": function (filter)
											{
												var   c   = this
													, res = [];

												while ((c = c.context) !== null)
												{
													if (filter(c)) { res.push(c); }
												}
												return res;
											}
										, "error": function (message)
											{
												throwError(this.output, "<<" + this.name + ">>: " + message);
												return false;
											}
									};
							// extend the args array with the raw and full argument strings
							curContext.args["raw"]  = macroArgs;
							curContext.args["full"] = Wikifier.parse(macroArgs);

							// call the handler, modifying the execution context chain appropriately
							//   n.b. there's no catch clause because this try/finally is here simply to ensure that
							//        the execution context is properly restored in the event that an uncaught exception
							//        is thrown during the handler call
							try
							{
								this.context = curContext;
								macro[handlerName].call(curContext);
							}
							finally
							{
								this.context = prevContext;
							}
						}
						// old-style macros
						else
						{
							w._macroRawArgs = macroArgs;	// cache the raw arguments for use by Wikifier.rawArgs() & Wikifier.fullArgs()
							macro[handlerName](w.output, macroName, args, w, payload);
							w._macroRawArgs = "";
						}
					}
					else
					{
						return throwError(w.output, "macro <<" + macroName + '>> property "' + handlerName + '" '
							+ (macro.hasOwnProperty(handlerName) ? "is not a function" : "does not exist"));
					}
				}
				else if (macros.tags.hasOwnProperty(macroName))
				{
					return throwError(w.output, "child tag <<" + macroName + ">> was found outside of a call to its parent macro"
						+ (macros.tags[macroName].length === 1 ? '' : 's') + " <<" + macros.tags[macroName].join(">>, <<") + ">>");
				}
				else
				{
					return throwError(w.output, "macro <<" + macroName + ">> does not exist");
				}
			}
			catch (e)
			{
				return throwError(w.output, "cannot execute " + ((macro && macro.isWidget) ? "widget" : "macro") + " <<" + macroName + ">>: " + e.message);
			}
			finally
			{
				this.working.name        = "";
				this.working.handlerName = "";
				this.working.arguments   = "";
				this.working.index       = 0;
			}
		}
	},
	parseTag: function (w)
	{
		var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart && lookaheadMatch[1])
		{
			w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
			this.lookaheadRegExp.lastIndex = w.nextMatch;

			var fnSigil = lookaheadMatch[1].indexOf("::");
			if (fnSigil !== -1)
			{
				this.working.name = lookaheadMatch[1].slice(0, fnSigil);
				this.working.handlerName = lookaheadMatch[1].slice(fnSigil + 2);
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
	parseBody: function (w, tags)
	{
		var   openTag      = this.working.name
			, closeTag     = "/" + openTag
			, closeAlt     = "end" + openTag
			, bodyTags     = Array.isArray(tags) ? tags : false
			, end          = -1
			, opened       = 1
			, curTag       = this.working.name
			, curArgument  = this.working.arguments
			, contentStart = w.nextMatch
			, payload      = [];

		while (
			   (w.matchStart = w.source.indexOf("<<", w.nextMatch)) !== -1
			&& this.parseTag(w)
		)
		{
			var   tagName  = this.working.name
				, tagArgs  = this.working.arguments
				, tagBegin = this.working.index
				, tagEnd   = w.nextMatch;

			switch (tagName)
			{
			case openTag:
				opened++;
				break;

			case closeAlt:
				/* FALL-THROUGH */
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
							payload.push({
								  name      : curTag
								, arguments : curArgument
								, contents  : w.source.slice(contentStart, tagBegin)
							});
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
				payload.push({
					  name      : curTag
					, arguments : curArgument
					, contents  : w.source.slice(contentStart, tagBegin)
				});
				end = tagEnd;
				break;
			}
		}

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
	lookaheadRegExp: /<[Hh][Tt][Mm][Ll]>((?:.|\n)*?)<\/[Hh][Tt][Mm][Ll]>/gm,
	handler: function (w)
	{
		this.lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;

			var   frag = document.createDocumentFragment()
				, temp = document.createElement("div");
			temp.innerHTML = lookaheadMatch[1];
			while (temp.firstChild)
			{
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
	handler: function (w)
	{
		this.lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
			w.nextMatch = lookaheadMatch.index + lookaheadMatch[0].length;
		}
	}
},

{
	name: "htmlCommentByBlock",
	match: "<!--",
	lookaheadRegExp: /<!--((?:.|\\n)*?)-->/gm,
	handler: function (w)
	{
		this.lookaheadRegExp.lastIndex = w.matchStart;
		var lookaheadMatch = this.lookaheadRegExp.exec(w.source);
		if (lookaheadMatch && lookaheadMatch.index === w.matchStart)
		{
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
		//insertElement(w.output, "span", null, null, "\u2014");
		insertText(w.output, "\u2014");
	}
},

{
	name: "lineContinuation",
	match: "\\\\[\\s\\u00a0\\u2028\\u2029]*?(?:\\n|$)",	// Unicode space-character escapes required for IE < 11 (maybe < 10?)
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
	lookaheadRegExp: /(?:\"{3}|<nowiki>)((?:.|\n)*?)(?:\"{3}|<\/nowiki>)/gm,
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
},

{	// n.b. This formatter MUST come after any formatter which handles HTML tag-like constructs (e.g. html & rawText)
	name: "htmlTag",
	match: "<\\w+(?:\\s+[^\\u0000-\\u001F\\u007F-\\u009F\\s\"'>\\/=]+(?:\\s*=\\s*(?:\"[^\"]+\"|'[^']+'|[^\\s\"'=<>`]+))?)*\\s*\\/?>",
	tagPattern: "<(\\w+)",
	voidElements: [ "area", "base", "br", "col", "embed", "hr", "img", "input", "keygen", "link", "menuitem", "meta", "param", "source", "track", "wbr" ],
	handler: function (w)
	{
		var   tagMatch = new RegExp(this.tagPattern).exec(w.matchText)
			, tagName  = tagMatch && tagMatch[1];

		if (tagName)	// && ["html", "nowiki"].indexOf(tagName.toLowerCase()) === -1)
		{
			var   isVoid = this.voidElements.indexOf(tagName.toLowerCase()) !== -1
				, terminator
				, terminatorRegExp
				, terminatorMatch;

			if (!isVoid)
			{
				terminator = "<\\/" + tagName + "\\s*>";
				terminatorRegExp = new RegExp(terminator, "gm");
				terminatorRegExp.lastIndex = w.matchStart;
				terminatorMatch = terminatorRegExp.exec(w.source);
			}
			if (isVoid || terminatorMatch)
			{
				var el = document.createElement(w.output.tagName);
				el.innerHTML = w.matchText;
				while (el.firstChild)
				{
					el = el.firstChild;
				}
				if (terminatorMatch)
				{
					w.subWikify(el, terminator);
				}
				w.output.appendChild(el);
			}
			else
			{
				throwError(w.output, 'HTML tag "' + tagName + '" is not closed');
			}
		}
	}
}

];	// End formatters


/***********************************************************************************************************************
** [End wikifier.js]
***********************************************************************************************************************/
