/***********************************************************************************************************************
** [Begin macros.js]
***********************************************************************************************************************/
/**
 * <<actions>>
 */
version.extensions["actionsMacro"] = { major: 1, minor: 3, revision: 0 };
macros["actions"] =
{
	handler: function (place, macroName, params)
	{
		var list = insertElement(place, "ul");
		list.className = "actions";
		if (!state.active.variables["#actions"])
		{
			state.active.variables["#actions"] = {};
		}
		for (var i = 0; i < params.length; i++)
		{
			var   action
				, passage
				, delim   = params[i].indexOf("|");
			if (delim === -1)
			{
				action = passage = params[i];
			}
			else
			{
				action  = params[i].slice(0, delim);
				passage = params[i].slice(delim + 1);
			}

			if (state.active.variables["#actions"][passage])
			{
				continue;
			}

			var   item = insertElement(list, "li")
				, link = insertPassageLink(item, passage, action);
			link.onclick = (function ()
			{
				var   p = passage
					, l = link;
				return function ()
				{
					state.active.variables["#actions"][p] = true;
					state.display(p, l);
				};
			}());
		}
	}
};

/**
 * <<back>> & <<return>>
 */
version.extensions["backMacros"] = { major: 2, minor: 0, revision: 0 };
macros["back"] = macros["return"] =
{
	handler: function (place, macroName, params)
	{
		var   steps = 1
			, pname
			, ltext = ""
			, el;

		if (params.length > 0)
		{
			if (params.length > 1 && params[1] === "steps")
			{
				if (isNaN(params[0]))
				{
					throwError(place, "<<" + macroName + '>>: the parameter before "steps" must be a number');
					return;
				}
				else if (params[0] < state.length)
				{
					pname = state.peek(params[0]).title;
					steps = params[0];
					ltext = " (" + steps + " steps)";
				}
			}
			else
			{
				if (!tale.has(params[0]))
				{
					throwError(place, "<<" + macroName + '>>: the "' + params[0] + '" passage does not exist');
					return;
				}
				for (var i = state.history.length - 1; i >= 0; i--)
				{
					if (state.history[i].title === params[0])
					{
						pname = params[0];
						steps = (state.history.length - 1) - i;
						ltext = ' (to "' + pname + '")';
						break;
					}
				}
			}
		}
		else if (state.length > 1)
		{
			pname = state.peek(steps).title;
		}
		if (!pname)
		{
			if (params[0])
			{
				throwError(place, "<<" + macroName + '>>: cannot find passage associated with "'
					+ params[0]
					+ ((params.length > 1 && params[1] === "steps") ? " steps" : "")
					+ '"');
			}
			else
			{
				throwError(place, "<<" + macroName + ">>: cannot find passage");
			}
			return;
		}

		el = document.createElement("a");
		el.className = macroName;
		if (steps > 0)
		{
			el.onclick = (function ()
			{
				if (macroName === "back")
				{
					if (config.hasPushState)
					{
						return function ()
						{
							if (state.length > 1)
							{
								window.history.go(-(steps));
							}
						};
					}
					else
					{
						return function ()
						{
							// pop the history stack
							//     n.b. (steps > 0) is correct, since SugarCube's history stack does not store "dirty"
							//          (i.e. pre-rendered/executed) states; in most other headers, something like
							//          (steps >= 0) would probably be necessary
							while (steps > 0)
							{
								if (!state.isEmpty)
								{
									state.pop();
								}
								steps--;
							}
							// activate the new top since we popped the stack
							state.activate(state.top);
							// display the passage
							state.display(pname, el, "back");
						};
					}
				}
				else
				{
					return function ()
					{
						state.display(pname, el);
					};
				}
			}());
		}
		el.innerHTML = "<b>\u00ab</b> " + macroName[0].toUpperCase() + macroName.slice(1) + ltext;
		place.appendChild(el);
	}
};

/**
 * <<bind>>
 */
version.extensions["bindMacro"] = { major: 1, minor: 0, revision: 0 };
macros["bind"] =
{
	handler: function (place, macroName, params, parser)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no link text specified");
			return;
		}

		var   openTag   = macroName
			, closeTag  = "/" + macroName
			, closeAlt  = "end" + macroName
			, start     = parser.source.indexOf(">>", parser.matchStart) + 2
			, end       = -1
			, tagBegin  = start
			, tagEnd    = start
			, opened    = 1;

		// matryoshka handling
		while ((tagBegin = parser.source.indexOf("<<", tagEnd)) !== -1
			&& (tagEnd = parser.source.indexOf(">>", tagBegin)) !== -1)
		{
			var   tagName  = parser.source.slice(tagBegin + 2, tagEnd)
				, tagDelim = tagName.search(/[\s\u00a0\u2028\u2029]/);	// Unicode space-character escapes required for IE
			if (tagDelim !== -1)
			{
				tagName = tagName.slice(0, tagDelim);
			}

			tagEnd += 2;
			switch (tagName)
			{
			case closeAlt:
				// fallthrough
			case closeTag:
				opened--;
				break;

			case openTag:
				opened++;
				break;
			}
			if (opened === 0)
			{
				end = tagBegin;
				break;
			}
		}

		if (end !== -1)
		{
			parser.nextMatch = tagEnd;

			var   linkText = params[0]
				, passage  = params.length > 1 ? params[1] : undefined
				, el       = document.createElement("a");

			el.className = "internalLink " + macroName + "Link";
			el.onclick = (function ()
			{
				var bindBody = parser.source.slice(start, end);
				return function ()
				{
					// execute the contents and discard the output
					new Wikifier(document.createElement("div"), bindBody);

					// go to the specified passage (if any)
					if (passage !== undefined)
					{
						state.display(passage, el);
					}
				};
			}());
			el.innerHTML = linkText;
			place.appendChild(el);
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};
macros["/bind"] = macros["endbind"] = { excludeParams: true, handler: function () {} };

/**
 * <<choice>> (only for compatibility with Jonah)
 */
version.extensions["choiceMacro"] = { major: 1, minor: 0, revision: 0 };
macros["choice"] =
{
	handler: function (place, macroName, params)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no passage specified");
			return;
		}

		Wikifier.createInternalLink(place, params[0]);
	}
};

/**
 * <<class>> & <<id>>
 */
version.extensions["classMacro"] = version.extensions["idMacro"] = { major: 2, minor: 0, revision: 0 };
macros["class"] = macros["id"] =
{
	handler: function (place, macroName, params, parser)
	{
		var   openTag   = macroName
			, closeTag  = "/" + macroName
			, closeAlt  = "end" + macroName
			, start     = parser.source.indexOf(">>", parser.matchStart) + 2
			, end       = -1
			, tagBegin  = start
			, tagEnd    = start
			, opened    = 1;

		// matryoshka handling
		while ((tagBegin = parser.source.indexOf("<<", tagEnd)) !== -1
			&& (tagEnd = parser.source.indexOf(">>", tagBegin)) !== -1)
		{
			var   tagName  = parser.source.slice(tagBegin + 2, tagEnd)
				, tagDelim = tagName.search(/[\s\u00a0\u2028\u2029]/);	// Unicode space-character escapes required for IE
			if (tagDelim !== -1)
			{
				tagName = tagName.slice(0, tagDelim);
			}

			tagEnd += 2;
			switch (tagName)
			{
			case closeAlt:
				// fallthrough
			case closeTag:
				opened--;
				break;

			case openTag:
				opened++;
				break;
			}
			if (opened === 0)
			{
				end = tagBegin;
				break;
			}
		}

		if (end !== -1)
		{
			parser.nextMatch = tagEnd;

			var   elName     = params[1] || "span"
				, elSelector = params[0] || ""
				, el;

			if (macroName === "id")
			{
				el = insertElement(place, elName, elSelector);
			}
			else	// macroName === "class"
			{
				el = insertElement(place, elName, null, elSelector);
			}

			new Wikifier(el, parser.source.slice(start, end));
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};
macros["/class"] = macros["endclass"] = macros["/id"] = macros["endid"] = { excludeParams: true, handler: function () {} };

/**
 * <<display>>
 */
version.extensions["displayMacro"] = { major: 2, minor: 1, revision: 0 };
macros["display"] =
{
	handler: function (place, macroName, params, parser)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no passage specified");
			return;
		}
		if (!tale.has(params[0]))
		{
			throwError(place, "<<" + macroName + '>>: passage "' + params[0] + '" does not exist');
			return;
		}

		var passage = tale.get(params[0]);
		if (params[1])
		{
			new Wikifier(insertElement(place, params[1], null, passage.domId), passage.text);
		}
		else
		{
			new Wikifier(place, passage.text);
		}
	}
};

/**
 * <<if>>
 */
version.extensions["ifMacro"] = { major: 2, minor: 0, revision: 0 };
macros["if"] =
{
	excludeParams: true,
	handler: function (place, macroName, params, parser)
	{
		var   openTag   = macroName
			, elseTag   = "else"
			, elseIfTag = "else" + macroName
			, closeTag  = "/" + macroName
			, closeAlt  = "end" + macroName
			, start     = parser.source.indexOf(">>", parser.matchStart) + 2
			, end       = -1
			, tagBegin  = start
			, tagEnd    = start
			, opened    = 1;
		var   antecedents     = []
			, consequents     = []
			, curAntecedent   = parser.fullArgs()
			, consequentStart = start;

		// matryoshka handling
		while ((tagBegin = parser.source.indexOf("<<", tagEnd)) !== -1
			&& (tagEnd = parser.source.indexOf(">>", tagBegin)) !== -1)
		{
			var   tagData  = parser.source.slice(tagBegin + 2, tagEnd)
				, tagDelim = tagData.search(/[\s\u00a0\u2028\u2029]/)	// Unicode space-character escapes required for IE
				, tagName  = (tagDelim === -1) ? tagData : tagData.slice(0, tagDelim);

			tagEnd += 2;
			switch (tagName)
			{
			case closeAlt:
				// fallthrough
			case closeTag:
				opened--;
				break;

			case elseIfTag:
				if (opened === 1)
				{
					antecedents.push(curAntecedent);
					consequents.push(parser.source.slice(consequentStart, tagBegin));
					curAntecedent   = Wikifier.parse(tagData.slice(tagDelim + 1, tagEnd - 2));
					consequentStart = tagEnd;
				}
				break;

			case elseTag:
				if (opened === 1)
				{
					antecedents.push(curAntecedent);
					consequents.push(parser.source.slice(consequentStart, tagBegin));
					curAntecedent   = true;
					consequentStart = tagEnd;
				}
				break;

			case openTag:
				opened++;
				break;
			}
			if (opened === 0)
			{
				antecedents.push(curAntecedent);
				consequents.push(parser.source.slice(consequentStart, tagBegin));
				end = tagBegin;
				break;
			}
		}

		if (end !== -1)
		{
			parser.nextMatch = tagEnd;

			try
			{
				for (var i = 0; i < antecedents.length; i++)
				{
					if (eval(antecedents[i]))
					{
						new Wikifier(place, consequents[i]);
						break;
					}
				}
			}
			catch (e)
			{
				throwError(place, "<<" + macroName + ">>: bad conditional expression: " + e.message);
			}
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};
macros["elseif"] = macros["else"] = macros["/if"] = macros["endif"] = { excludeParams: true, handler: function () {} };

/**
 * <<print>>
 */
version.extensions["printMacro"] = { major: 1, minor: 2, revision: 0 };
macros["print"] =
{
	excludeParams: true,
	handler: function (place, macroName, params, parser)
	{
		try
		{
			var output = eval(parser.fullArgs());
			if (output != null && (typeof output !== "number" || !isNaN(output)))
			{
				new Wikifier(place, output.toString());
			}
		}
		catch (e)
		{
			throwError(place, "<<" + macroName + ">>: bad expression: " + e.message);
		}
	}
};

/**
 * <<remember>>
 */
version.extensions["rememberMacro"] = { major: 2, minor: 0, revision: 0 };
macros["remember"] =
{
	excludeParams: true,
	handler: function (place, macroName, params, parser)
	{
		var statement = parser.fullArgs();
		if (macros["set"].run(statement, place, macroName))
		{
			var   remember = storage.getItem("remember") || {}
				, varRe    = new RegExp("state\\.active\\.variables\\.(\\w+)", "g")
				, varMatch;

			while ((varMatch = varRe.exec(statement)) !== null)
			{
				var varName = varMatch[1];

				remember[varName] = state.active.variables[varName];
			}

			if (!storage.setItem("remember", remember))
			{
				throwError(place, "<<" + macroName + ">>: unknown error, cannot remember: " + statement);
			}
		}
	},
	init: function ()
	{
		var remember = storage.getItem("remember");
		if (remember !== null)
		{
			for (var varName in remember)
			{
				state.active.variables[varName] = remember[varName];
			}
		}
	}
};

/**
 * <<set>>
 */
version.extensions["setMacro"] = { major: 2, minor: 0, revision: 0 };
macros["set"] =
{
	excludeParams: true,
	handler: function (place, macroName, params, parser)
	{
		macros[macroName].run(parser.fullArgs(), place, macroName);
	},
	run: function (expression, place, macroName)
	{
		try
		{
			eval(expression);
			return true;
		}
		catch (e)
		{
			throwError(place, "<<" + macroName + ">>: bad expression: " + e.message);
			return false;
		}
	}
};

/**
 * <<silently>>
 */
version.extensions["silentlyMacro"] = { major: 2, minor: 0, revision: 0 };
macros["silently"] =
{
	excludeParams: true,
	handler: function (place, macroName, params, parser)
	{
		var   openTag   = macroName
			, closeTag  = "/" + macroName
			, closeAlt  = "end" + macroName
			, start     = parser.source.indexOf(">>", parser.matchStart) + 2
			, end       = -1
			, tagBegin  = start
			, tagEnd    = start
			, opened    = 1;

		// matryoshka handling
		while ((tagBegin = parser.source.indexOf("<<", tagEnd)) !== -1
			&& (tagEnd = parser.source.indexOf(">>", tagBegin)) !== -1)
		{
			var   tagName  = parser.source.slice(tagBegin + 2, tagEnd)
				, tagDelim = tagName.search(/[\s\u00a0\u2028\u2029]/);	// Unicode space-character escapes required for IE
			if (tagDelim !== -1)
			{
				tagName = tagName.slice(0, tagDelim);
			}

			tagEnd += 2;
			switch (tagName)
			{
			case closeAlt:
				// fallthrough
			case closeTag:
				opened--;
				break;

			case openTag:
				opened++;
				break;
			}
			if (opened === 0)
			{
				end = tagBegin;
				break;
			}
		}

		if (end !== -1)
		{
			parser.nextMatch = tagEnd;

			// execute the contents and discard the output
			new Wikifier(document.createElement("div"), parser.source.slice(start, end));
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};
macros["/silently"] = macros["endsilently"] = { excludeParams: true, handler: function () {} };

/**
 * <<update>>
 */
version.extensions["updateMacro"] = { major: 1, minor: 0, revision: 0 };
macros["update"] =
{
	handler: function (place, macroName, params, parser)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no element ID specified");
			return;
		}

		var   openTag   = macroName
			, closeTag  = "/" + macroName
			, closeAlt  = "end" + macroName
			, start     = parser.source.indexOf(">>", parser.matchStart) + 2
			, end       = -1
			, tagBegin  = start
			, tagEnd    = start
			, opened    = 1;

		// matryoshka handling
		while ((tagBegin = parser.source.indexOf("<<", tagEnd)) !== -1
			&& (tagEnd = parser.source.indexOf(">>", tagBegin)) !== -1)
		{
			var   tagName  = parser.source.slice(tagBegin + 2, tagEnd)
				, tagDelim = tagName.search(/[\s\u00a0\u2028\u2029]/);	// Unicode space-character escapes required for IE
			if (tagDelim !== -1)
			{
				tagName = tagName.slice(0, tagDelim);
			}

			tagEnd += 2;
			switch (tagName)
			{
			case closeAlt:
				// fallthrough
			case closeTag:
				opened--;
				break;

			case openTag:
				opened++;
				break;
			}
			if (opened === 0)
			{
				end = tagBegin;
				break;
			}
		}

		if (end !== -1)
		{
			parser.nextMatch = tagEnd;

			var   parentEl = document.getElementById(params[0])
				, targetEl
				, updType  = params[1];

			if (!parentEl)
			{
				throwError(place, "<<" + macroName + '>>: element with ID "' + params[0] + '" does not exist');
				return;
			}
			switch (updType)
			{
			case "prepend":
				// create a wrapper for the new content, required for prepends
				var wrapper = document.createElement("span");
				parentEl.insertBefore(wrapper, parentEl.firstChild);
				targetEl = wrapper;
				break;
			case "append":
				targetEl = parentEl;
				break;
			default:
				targetEl = parentEl;
				// remove the old contents
				removeChildren(targetEl);
				break;
			}

			// add the new content
			new Wikifier(targetEl, parser.source.slice(start, end));
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};
macros["/update"] = macros["endupdate"] = { excludeParams: true, handler: function () {} };

/**
 * <<widget>>
 */
version.extensions["widgetMacro"] = { major: 1, minor: 0, revision: 0 };
macros["widget"] =
{
	handler: function (place, macroName, params, parser)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no widget name specified");
			return;
		}

		var widgetName = params[0];
		if (macros[widgetName])
		{
			if (!macros[widgetName].isWidget)
			{
				throwError(place, "<<" + macroName + '>>: cannot clobber existing macro "' + widgetName + '"');
				return;
			}

			// delete existing widget
			delete macros[widgetName];
			delete version.extensions[widgetName + "WidgetMacro"];
		}

		var   openTag   = macroName
			, closeTag  = "/" + macroName
			, closeAlt  = "end" + macroName
			, start     = parser.source.indexOf(">>", parser.matchStart) + 2
			, end       = -1
			, tagBegin  = start
			, tagEnd    = start
			, opened    = 1;

		// matryoshka handling
		while ((tagBegin = parser.source.indexOf("<<", tagEnd)) !== -1
			&& (tagEnd = parser.source.indexOf(">>", tagBegin)) !== -1)
		{
			var   tagName  = parser.source.slice(tagBegin + 2, tagEnd)
				, tagDelim = tagName.search(/[\s\u00a0\u2028\u2029]/);	// Unicode space-character escapes required for IE
			if (tagDelim !== -1)
			{
				tagName = tagName.slice(0, tagDelim);
			}

			tagEnd += 2;
			switch (tagName)
			{
			case closeAlt:
				// fallthrough
			case closeTag:
				opened--;
				break;

			case openTag:
				opened++;
				break;
			}
			if (opened === 0)
			{
				end = tagBegin;
				break;
			}
		}

		if (end !== -1)
		{
			parser.nextMatch = tagEnd;

			try
			{
				macros[widgetName] = 
				{
					isWidget: true,
					handler: (function ()
					{
						var widgetBody = parser.source.slice(start, end);
						return function (place, macroName, params, parser)
						{
							// setup the widget arguments array
							state.active.variables.args = [];
							state.active.variables.args[0] = parser.fullArgs();
							for (var i = 0, len = params.length; i < len; i++)
							{
								state.active.variables.args[i+1] = params[i];
							}

							try
							{
								// attempt to execute the widget
								new Wikifier(place, widgetBody);
							}
							catch (e)
							{
								throwError(place, "<<" + macroName + '>>: cannot execute widget: ' + e.message);
							}
							finally
							{
								// teardown the widget arguments array
								delete state.active.variables.args;
							}
						};
					}())
				};
				version.extensions[widgetName + "WidgetMacro"] = { major: 1, minor: 0, revision: 0 };
			}
			catch (e)
			{
				throwError(place, "<<" + macroName + '>>: cannot create widget macro "' + widgetName + '": ' + e.message);
			}
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};
macros["/widget"] = macros["endwidget"] = { excludeParams: true, handler: function () {} };


/***********************************************************************************************************************
** [End macros.js]
***********************************************************************************************************************/
