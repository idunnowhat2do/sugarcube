/***********************************************************************************************************************
** [Begin macros.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Macro Initialization]
***********************************************************************************************************************/
macros["_children"] = {};


/***********************************************************************************************************************
** [Macro Utility Functions]
***********************************************************************************************************************/
function registerMacroTags(parent, tagNames)
{
	if (!parent) { throw new Error("no parent specified"); }

	if (!tagNames) { tagNames = []; }
	tagNames.push("/" + parent, "end" + parent);	// automatically add the standard closing tags

	for (var i = 0; i < tagNames.length; i++)
	{
		if (macros.hasOwnProperty(tagNames[i]))
		{
			throw new Error("cannot register tag for existing macro");
		}
		if (!macros._children.hasOwnProperty(tagNames[i]))
		{
			macros._children[tagNames[i]] = parent;
		}
	}
	return tagNames;
}

function getContainerMacroData(parser, macroName, childTags)
{
	var   openTag      = macroName
		, closeTag     = "/" + macroName
		, closeAlt     = "end" + macroName
		, start        = parser.source.indexOf(">>", parser.matchStart) + 2
		, end          = -1
		, tagBegin     = start
		, tagEnd       = start
		, opened       = 1
		, curTag       = macroName
		, curArgument  = parser.rawArgs()
		, contentStart = start
		, macroData    = [];

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
		case openTag:
			opened++;
			break;

		case closeAlt:
			// fallthrough
		case closeTag:
			opened--;
			break;

		default:
			if (opened === 1 && childTags)
			{
				for (var i = 0, len = childTags.length; i < len; i++)
				{
					if (tagName === childTags[i])
					{
						macroData.push({ name: curTag, arguments: curArgument, contents: parser.source.slice(contentStart, tagBegin) });
						curTag       = tagName;
						curArgument  = (tagDelim === -1) ? "" : tagData.slice(tagDelim + 1);
						contentStart = tagEnd;
					}
				}
			}
			break;
		}
		if (opened === 0)
		{
			macroData.push({ name: curTag, arguments: curArgument, contents: parser.source.slice(contentStart, tagBegin) });
			end = tagBegin;
			break;
		}
	}

	if (end !== -1)
	{
		parser.nextMatch = tagEnd;
		return macroData;
	}
	return null;
}

function evalMacroExpression(expression, place, macroName)
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


/***********************************************************************************************************************
** [Macro Definitions]
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
version.extensions["backMacro"] = version.extensions["returnMacro"] = { major: 2, minor: 0, revision: 0 };
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
					if (config.historyMode === modes.hashTag)
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
					else
					{
						return function ()
						{
							if (state.length > 1)
							{
								window.history.go(-(steps));
							}
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
version.extensions["bindMacro"] = { major: 1, minor: 1, revision: 0 };
macros["bind"] =
{
	children: registerMacroTags("bind"),
	handler: function (place, macroName, params, parser)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no link text specified");
			return;
		}

		var macroData = getContainerMacroData(parser, macroName);

		if (macroData)
		{
			var   linkText = params[0]
				, passage  = params.length > 1 ? params[1] : undefined
				, el       = document.createElement("a");

			el.classList.add(macroName + "Link");
			el.classList.add(passage ? (tale.has(passage) ? "internalLink" : "brokenLink") : "internalLink");
			el.innerHTML = linkText;
			el.onclick = (function (bindBody)
			{
				return function ()
				{
					// execute the contents and discard the output (if any)
					if (bindBody !== "")
					{
						new Wikifier(document.createElement("div"), bindBody);
					}

					// go to the specified passage (if any)
					if (passage !== undefined)
					{
						state.display(passage, el);
					}
				};
			}(macroData[0].contents));
			place.appendChild(el);
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};

/**
 * <<choice>> (only for compatibility with Jonah)
 */
version.extensions["choiceMacro"] = { major: 1, minor: 0, revision: 1 };
macros["choice"] =
{
	handler: function (place, macroName, params)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no passage specified");
			return;
		}

		Wikifier.createInternalLink(place, params[0], params[0]);
	}
};

/**
 * <<class>>
 */
version.extensions["classMacro"] = { major: 2, minor: 1, revision: 0 };
macros["class"] =
{
	children: registerMacroTags("class"),
	handler: function (place, macroName, params, parser)
	{
		var macroData = getContainerMacroData(parser, macroName);

		if (macroData)
		{
			var   elName    = params[1] || "span"
				, elClasses = params[0] || ""
				, el        = insertElement(place, elName, null, elClasses);

			new Wikifier(el, macroData[0].contents);
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};

/**
 * <<classupdate>>
 */
version.extensions["classupdateMacro"] = { major: 1, minor: 0, revision: 0 };
macros["classupdate"] =
{
	handler: function (place, macroName, params, parser)
	{
		if (params.length < 3)
		{
			var errors = [];
			if (params.length < 1) { errors.push("element ID"); }
			if (params.length < 2) { errors.push("action"); }
			if (params.length < 3) { errors.push("class names"); }
			throwError(place, "<<" + macroName + ">>: no " + errors.join(" or ") + " specified");
			return;
		}

		var   targetEl = document.getElementById(params[0])
			, updType  = params[1]
			, classes  = params[2].trim().split(/\s+/);

		if (!targetEl)
		{
			throwError(place, "<<" + macroName + '>>: element with ID "' + params[0] + '" does not exist');
			return;
		}
		if (updType !== "add" && updType !== "remove" && updType !== "toggle")
		{
			throwError(place, "<<" + macroName + '>>: "' + updType + '" is not a valid action (add|remove|toggle)');
			return;
		}

		for (var i = 0; i < classes.length ; i++)
		{
			switch (updType)
			{
			case "add":
				targetEl.classList.add(classes[i]);
				break;
			case "remove":
				targetEl.classList.remove(classes[i]);
				break;
			case "toggle":
				targetEl.classList.toggle(classes[i]);
				break;
			}
		}
	}
};

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
 * <<id>>
 */
version.extensions["idMacro"] = { major: 2, minor: 1, revision: 0 };
macros["id"] =
{
	children: registerMacroTags("id"),
	handler: function (place, macroName, params, parser)
	{
		var macroData = getContainerMacroData(parser, macroName);

		if (macroData)
		{
			var   elName = params[1] || "span"
				, elId   = params[0] || ""
				, el     = insertElement(place, elName, elId);

			new Wikifier(el, macroData[0].contents);
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};

/**
 * <<if>>
 */
version.extensions["ifMacro"] = { major: 2, minor: 1, revision: 0 };
macros["if"] =
{
	excludeParams: true,
	children: registerMacroTags("if", [ "elseif", "else" ]),
	handler: function (place, macroName, params, parser)
	{
		var   elseTag   = "else"
			, macroData = getContainerMacroData(parser, macroName, [ elseTag + macroName, elseTag ]);

		if (macroData)
		{
			try
			{
				for (var i = 0, len = macroData.length; i < len; i++)
				{
					if (macroData[i].name === elseTag || eval(Wikifier.parse(macroData[i].arguments)))
					{
						new Wikifier(place, macroData[i].contents);
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

/**
 * <<link>>
 */
version.extensions["linkMacro"] = { major: 1, minor: 0, revision: 0 };
macros["link"] =
{
	handler: function (place, macroName, params)
	{
		function createInternalLink(place, passage, text)
		{
			var el = insertPassageLink(place, passage, text);
			el.onclick = function ()
			{
				state.active.variables["#link"][passage] = true;
				state.display(passage, el);
			};
			return el;
		}

		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no link location specified");
			return;
		}

		var   linkText = params[0]
			, linkLoc
			, onceType;

		if (params.length === 1)
		{
			linkLoc = params[0];
		}
		else if (params.length === 2)
		{
			if (params[1] === "once" || params[1] === "keep")
			{
				linkLoc  = params[0];
				onceType = params[1];
			}
			else
			{
				linkLoc = params[1];
			}
		}
		else if (params.length === 3)
		{
			linkLoc  = params[1];
			onceType = params[2];
		}
		if (onceType && onceType !== "once" && onceType !== "keep")
		{
			throwError(place, "<<" + macroName + '>>: "' + onceType + '" is not a valid action (once|keep)');
			return;
		}

		if (onceType)
		{
			if (!state.active.variables.hasOwnProperty("#link"))
			{
				state.active.variables["#link"] = {};
			}
			else if (state.active.variables["#link"][linkLoc])
			{
				if (onceType === "keep")
				{
					insertText(place, linkText);
				}
				return;
			}
		}

		if (params.length === 1)
		{
			createInternalLink(place, linkLoc, linkText);
		}
		else	// params.length === 2
		{
			if (tale.has(linkLoc))
			{
				createInternalLink(place, linkLoc, linkText);
			}
			else
			{
				Wikifier.createExternalLink(place, linkLoc, linkText);
			}
		}
	}
};

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
version.extensions["rememberMacro"] = { major: 2, minor: 1, revision: 0 };
macros["remember"] =
{
	excludeParams: true,
	handler: function (place, macroName, params, parser)
	{
		var statement = parser.fullArgs();
		if (evalMacroExpression(statement, place, macroName))
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
 * <<run>>, <<runjs>>, & <<set>>
 */
version.extensions["runMacro"] = version.extensions["runjsMacro"] = version.extensions["setMacro"] = { major: 2, minor: 1, revision: 0 };
macros["run"] = macros["runjs"] = macros["set"] =
{
	excludeParams: true,
	handler: function (place, macroName, params, parser)
	{
		evalMacroExpression(macroName === "runjs" ? parser.rawArgs() : parser.fullArgs(), place, macroName);
	},
	run: function (expression, place, macroName)
	{	// for "macros.set.run()" legacy compatibility only
		return evalMacroExpression(expression, place, macroName);
	}
};

/**
 * <<silently>>
 */
version.extensions["silentlyMacro"] = { major: 2, minor: 1, revision: 0 };
macros["silently"] =
{
	excludeParams: true,
	children: registerMacroTags("silently"),
	handler: function (place, macroName, params, parser)
	{
		var macroData = getContainerMacroData(parser, macroName);

		if (macroData)
		{
			// execute the contents and discard the output
			new Wikifier(document.createElement("div"), macroData[0].contents);
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};

/**
 * <<update>>
 */
version.extensions["updateMacro"] = { major: 1, minor: 1, revision: 0 };
macros["update"] =
{
	children: registerMacroTags("update"),
	handler: function (place, macroName, params, parser)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no element ID specified");
			return;
		}

		var macroData = getContainerMacroData(parser, macroName);

		if (macroData)
		{
			var   parentEl = document.getElementById(params[0])
				, targetEl
				, updType  = params[1];

			if (!parentEl)
			{
				throwError(place, "<<" + macroName + '>>: element with ID "' + params[0] + '" does not exist');
				return;
			}
			if (updType && updType !== "append" && updType !== "prepend" && updType !== "replace")
			{
				throwError(place, "<<" + macroName + '>>: "' + updType + '" is not a valid action (append|prepend|replace)');
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
			new Wikifier(targetEl, macroData[0].contents);
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};

/**
 * <<widget>>
 */
version.extensions["widgetMacro"] = { major: 1, minor: 1, revision: 0 };
macros["widget"] =
{
	children: registerMacroTags("widget"),
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

		var macroData = getContainerMacroData(parser, macroName);

		if (macroData)
		{
			try
			{
				macros[widgetName] = 
				{
					isWidget: true,
					handler: (function (widgetBody)
					{
						return function (place, macroName, params, parser)
						{
							// store arguments arrays from in-progress calls
							if (state.active.variables.hasOwnProperty("args"))
							{
								if (!state.active.variables.hasOwnProperty("#widget-args"))
								{
									state.active.variables["#widget-args"] = [];
								}
								state.active.variables["#widget-args"].push(state.active.variables.args);
							}

							// setup the widget arguments array
							state.active.variables.args = [];
							state.active.variables.args[0] = parser.fullArgs();
							for (var i = 0, len = params.length; i < len; i++)
							{
								state.active.variables.args[i+1] = params[i];
							}

							// attempt to execute the widget
							try
							{
								new Wikifier(place, widgetBody);
							}
							catch (e)
							{
								throwError(place, "<<" + macroName + '>>: cannot execute widget: ' + e.message);
							}

							// teardown the widget arguments array
							delete state.active.variables.args;

							// restore arguments arrays from in-progress calls
							if (state.active.variables.hasOwnProperty("#widget-args"))
							{
								state.active.variables.args = state.active.variables["#widget-args"].pop();
								if (state.active.variables["#widget-args"].length === 0)
								{
									// teardown the in-progress widget arguments array stack
									delete state.active.variables["#widget-args"];
								}
							}
						};
					}(macroData[0].contents))
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


/***********************************************************************************************************************
** [End macros.js]
***********************************************************************************************************************/
