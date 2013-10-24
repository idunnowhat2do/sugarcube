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
function registerMacroTags(parent, bodyTags)
{
	if (!parent) { throw new Error("no parent specified"); }
	if (!bodyTags) { bodyTags = []; }

	var   endTags = [ "/" + parent, "end" + parent ]	// automatically create the closing tags
		, allTags = [];
	
	allTags.concat(bodyTags, endTags);

	for (var i = 0; i < allTags.length; i++)
	{
		if (macros.hasOwnProperty(allTags[i]))
		{
			throw new Error("cannot register tag for existing macro");
		}
		if (!macros._children.hasOwnProperty(allTags[i]))
		{
			macros._children[allTags[i]] = parent;
		}
	}
	return { "endTags": endTags, "bodyTags": bodyTags };
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
version.extensions["actionsMacro"] = { major: 1, minor: 4, revision: 0 };
macros["actions"] =
{
	handler: function (place, macroName, params)
	{
		var list = insertElement(place, "ul");
		list.classList.add(macroName);
		if (!state.active.variables["#actions"])
		{
			state.active.variables["#actions"] = {};
		}
		for (var i = 0; i < params.length; i++)
		{
			var   actText
				, passage
				, delim   = params[i].indexOf("|");
			if (delim === -1)
			{
				actText = passage = params[i];
			}
			else
			{
				actText = params[i].slice(0, delim);
				passage = params[i].slice(delim + 1);
			}

			if (state.active.variables["#actions"][passage])
			{
				continue;
			}

			var   item = insertElement(list, "li")
				, link = insertPassageLink(item, passage, actText);
			link.classList.add("link-" + macroName);
			link.addEventListener("click", (function ()
			{
				var   p = passage
					, l = link;
				return function ()
				{
					state.active.variables["#actions"][p] = true;
					state.display(p, l);
				};
			}()), false);
		}
	}
};

/**
 * <<back>> & <<return>>
 */
version.extensions["backMacro"] = version.extensions["returnMacro"] = { major: 2, minor: 1, revision: 0 };
macros["back"] = macros["return"] =
{
	handler: function (place, macroName, params)
	{
		var   steps = 1
			, pname
			, ctext
			, ltext = macroName[0].toUpperCase() + macroName.slice(1)
			, el;

		if (params.length === 1)
		{
			ctext = params[0];
		}
		else if (params.length !== 0)
		{
			if (params.length === 3)
			{
				ctext = params.shift();
			}

			var histLen = (config.historyMode !== modes.sessionHistory) ? state.length : state.active.sidx + 1;
			if (params[0] === "go")
			{
				if (isNaN(params[1]) || params[1] < 1)
				{
					throwError(place, "<<" + macroName + '>>: the argument after "go" must be a whole number greater than zero');
					return;
				}
				steps = (params[1] < histLen) ? params[1] : histLen - 1;
				pname = state.peek(steps).title;
				ltext += " (go " + steps + ")";
			}
			else if (params[0] === "to")
			{
				if (!tale.has(params[1]))
				{
					throwError(place, "<<" + macroName + '>>: the "' + params[1] + '" passage does not exist');
					return;
				}
				for (var i = histLen - 1; i >= 0; i--)
				{
					if (state.history[i].title === params[1])
					{
						steps = (histLen - 1) - i;
						pname = params[1];
						ltext += ' (to "' + pname + '")';
						break;
					}
				}
				if (pname === undefined)
				{
					throwError(place, "<<" + macroName + '>>: cannot find passage "' + params[1] + '" in the current story history');
					return;
				}
			}
			else
			{
				throwError(place, "<<" + macroName + '>>: "' + params[0] + '" is not a valid action (go|to)');
				return;
			}
		}
		if (pname === undefined && state.length > 1)
		{
			pname = state.peek(steps).title;
		}

		if (pname === undefined)
		{
			throwError(place, "<<" + macroName + ">>: cannot find passage");
			return;
		}
		else if (steps === 0)
		{
			throwError(place, "<<" + macroName + ">>: already at the first passage in the current story history");
			return;
		}

		el = document.createElement("a");
		el.classList.add("link-" + macroName);
		if (steps > 0)
		{
			el.addEventListener("click", (function ()
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
			}()), false);
		}
		if (macroName === "back")
		{
			el.innerHTML = ctext || this.backText || ltext;
		}
		else
		{
			el.innerHTML = ctext || this.returnText || ltext;
		}
		place.appendChild(el);
	},
	linktext: function (place, macroName, params)
	{
		if (params.length === 0)
		{
			if (macroName === "back")
			{
				delete this.backText;
			}
			else
			{
				delete this.returnText;
			}
		}
		else
		{
			if (macroName === "back")
			{
				this.backText = params[0];
			}
			else
			{
				this.returnText = params[0];
			}
		}
	}
};

/**
 * <<bind>>
 */
version.extensions["bindMacro"] = { major: 2, minor: 0, revision: 0 };
macros["bind"] =
{
	children: registerMacroTags("bind"),
	handler: function (place, macroName, params, parser, payload)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no link text specified");
			return;
		}

		if (payload)
		{
			var   linkText   = params[0]
				, passage    = params.length > 1 ? params[1] : undefined
				, widgetArgs = (macros.hasOwnProperty("_widgetCall") && state.active.variables.hasOwnProperty("args")) ? state.active.variables.args : undefined
				, el         = document.createElement("a");

			el.classList.add("link-" + (passage ? (tale.has(passage) ? "internal" : "broken") : "internal"));
			el.classList.add("link-" + macroName);
			el.innerHTML = linkText;
			el.addEventListener("click", (function (bindBody, widgetArgs)
			{
				return function ()
				{
					if (bindBody !== "")
					{
						if (widgetArgs !== undefined)
						{
							// store existing $args variables
							if (state.active.variables.hasOwnProperty("args"))
							{
								if (!macros.bind.hasOwnProperty("_argsStack"))
								{
									macros.bind._argsStack = [];
								}
								macros.bind._argsStack.push(state.active.variables.args);
							}

							// setup the $args variable
							state.active.variables.args = widgetArgs;
						}

						// attempt to execute the contents and discard the output (if any)
						new Wikifier(document.createElement("div"), bindBody);

						if (widgetArgs !== undefined)
						{
							// teardown the $args variable
							delete state.active.variables.args;

							// restore existing $args variables
							if (macros.bind.hasOwnProperty("_argsStack"))
							{
								state.active.variables.args = macros.bind._argsStack.pop();
								if (macros.bind._argsStack.length === 0)
								{
									// teardown the stack
									delete macros.bind._argsStack;
								}
							}
						}
					}

					// go to the specified passage (if any)
					if (passage !== undefined)
					{
						state.display(passage, el);
					}
				};
			}(payload[0].contents.trim(), widgetArgs)), false);
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

		var el = insertPassageLink(place, params[0], params[0], "link-" + macroName);
		el.addEventListener("click", function ()
		{
			state.display(params[0], el);
		}, false);
	}
};

/**
 * <<class>>
 */
version.extensions["classMacro"] = { major: 2, minor: 1, revision: 0 };
macros["class"] =
{
	children: registerMacroTags("class"),
	handler: function (place, macroName, params, parser, payload)
	{
		if (payload)
		{
			var   elName    = params[1] || "span"
				, elClasses = params[0] || ""
				, el        = insertElement(place, elName, null, elClasses);

			new Wikifier(el, payload[0].contents);
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
	handler: function (place, macroName, params)
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

		var   targetEl = (params[0] === "body") ? document.body : document.getElementById(params[0])
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
	handler: function (place, macroName, params)
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
	handler: function (place, macroName, params, parser, payload)
	{
		if (payload)
		{
			var   elName = params[1] || "span"
				, elId   = params[0] || ""
				, el     = insertElement(place, elName, elId);

			new Wikifier(el, payload[0].contents);
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
	handler: function (place, macroName, params, parser, payload)
	{
		if (payload)
		{
			try
			{
				for (var i = 0, len = payload.length; i < len; i++)
				{
					if (payload[i].name === "else" || eval(Wikifier.parse(payload[i].arguments)))
					{
						new Wikifier(place, payload[i].contents);
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
			var el = insertPassageLink(place, passage, text, "link-" + macroName);
			el.addEventListener("click", function ()
			{
				if (onceType)
				{
					state.active.variables["#link"][passage] = true;
				}
				state.display(passage, el);
			}, false);
			return el;
		}
		function createExternalLink(place, url, text)
		{
			var el = insertElement(place, "a", null, "link-external link-" + macroName, text);
			el.href = url;
			el.target = "_blank";
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
				createExternalLink(place, linkLoc, linkText);
			}
		}
	}
};

/**
 * <<option>>
 */
version.extensions["optionMacro"] = { major: 1, minor: 0, revision: 0 };
macros["option"] =
{
	children: registerMacroTags("option", [ "onchange" ]),
	handler: function (place, macroName, params, parser, payload)
	{
		if (params.length < 2)
		{
			var errors = [];
			if (params.length < 1) { errors.push("property"); }
			if (params.length < 2) { errors.push("type"); }
			throwError(place, "<<" + macroName + ">>: no " + errors.join(" or ") + " specified");
			return;
		}

		var   propertyName = params[0]
			, controlType  = params[1];

		if (controlType !== "toggle" && controlType !== "list")
		{
			throwError(place, "<<" + macroName + '>>: "' + controlType + '" is not a valid type (switch|list)');
			return;
		}
		if (controlType === "list" && params.length < 3)
		{
			throwError(place, "<<" + macroName + ">>: no list specified");
			return;
		}

		if (payload)
		{
			var   propertyId = slugify(propertyName)
				, elOption   = document.createElement("div")
				, elLabel    = document.createElement("div")
				, elControl  = document.createElement("div");

			elOption.appendChild(elLabel);
			elOption.appendChild(elControl);
			elOption.id  = "option-body-" + propertyId;
			elLabel.id   = "option-label-" + propertyId;
			elControl.id = "option-control-" + propertyId;

			// setup the label
			new Wikifier(elLabel, payload[0].contents.trim());

			// setup the control
			var onChangeBody = (payload.length === 2 && payload[1].name === "onchange") ? payload[1].contents.trim() : "";
			if (!options.hasOwnProperty(propertyName))
			{
				options[propertyName] = undefined;
			}
			switch (controlType)
			{
			case "toggle":
				var   linkText = params.length > 2 ? params[2] : undefined
					, elInput  = document.createElement("a");
				if (options[propertyName] === undefined)
				{
					options[propertyName] = false;
				}
				if (options[propertyName])
				{
					insertText(elInput, linkText || "On");
					elInput.classList.add("enabled");
				}
				else
				{
					insertText(elInput, linkText || "Off");
				}
				elInput.addEventListener("click", (function ()
				{
					return function (e)
					{
						removeChildren(elInput);
						if (options[propertyName])
						{
							insertText(elInput, linkText || "Off");
							elInput.classList.remove("enabled");
							options[propertyName] = false;
						}
						else
						{
							insertText(elInput, linkText || "On");
							elInput.classList.add("enabled");
							options[propertyName] = true;
						}
						macros.option.store();

						// if <<onchange>> exists, execute the contents and discard the output (if any)
						if (onChangeBody !== "")
						{
							new Wikifier(document.createElement("div"), onChangeBody);
						}
					}
				}()), false);
				break;
			case "list":
				var   items    = params[2]
					, elInput  = document.createElement("select");
				if (options.hasOwnProperty(items))
				{
					items = options[items];
				}
				else
				{
					items = items.trim().split(/\s*,\s*/);
				}
				if (options[propertyName] === undefined)
				{
					options[propertyName] = items[0];
				}
				for (var i = 0; i < items.length; i++)
				{
					var elItem = document.createElement("option");
					insertText(elItem, items[i]);
					elInput.appendChild(elItem);
				}
				elInput.value = options[propertyName];
				elInput.addEventListener("change", (function ()
				{
					return function (e)
					{
						options[propertyName] = e.target.value;
						macros.option.store();

						// if <<onchange>> exists, execute the contents and discard the output (if any)
						if (onChangeBody !== "")
						{
							new Wikifier(document.createElement("div"), onChangeBody);
						}
					}
				}()), false);
				break;
			}
			elInput.id = "option-input-" + propertyId;
			elControl.appendChild(elInput);

			place.appendChild(elOption);
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	},
	controlbar: function (place)
	{
		var   elSet   = document.createElement("div")
			, elClose = document.createElement("button")
			, elReset = document.createElement("button");

		elSet.appendChild(elClose);
		elSet.appendChild(elReset);

		elSet.classList.add("controls");
		elClose.classList.add("ui-close");
		elReset.classList.add("ui-close");

		insertText(elClose, "Close");
		insertText(elReset, "Reset to Defaults");

		elReset.addEventListener("click", function (e)
		{
			macros.option.purge();
			window.location.reload();
		}, false);

		place.appendChild(elSet);
	},
	store: function ()
	{
		return storage.setItem("options", options);
	},
	purge: function ()
	{
		options = {};
		return storage.removeItem("options");
	},
	init: function ()
	{
		var opts = storage.getItem("options");
		if (opts !== null)
		{
			for (var varName in opts)
			{
				options[varName] = opts[varName];
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
		var expression = parser.fullArgs();
		if (evalMacroExpression(expression, place, macroName))
		{
			var   remember = storage.getItem("remember") || {}
				, varRe    = new RegExp("state\\.active\\.variables\\.(\\w+)", "g")
				, varMatch;

			while ((varMatch = varRe.exec(expression)) !== null)
			{
				var varName = varMatch[1];

				remember[varName] = state.active.variables[varName];
			}

			if (!storage.setItem("remember", remember))
			{
				throwError(place, "<<" + macroName + ">>: unknown error, cannot remember: " + parser.rawArgs());
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
version.extensions["silentlyMacro"] = { major: 3, minor: 0, revision: 0 };
macros["silently"] =
{
	excludeParams: true,
	children: registerMacroTags("silently"),
	handler: function (place, macroName, params, parser, payload)
	{
		if (payload)
		{
			// execute the contents and discard the output, except for errors (which are displayed)
			var   errTrap = document.createElement("div")
				, errList = [];
			new Wikifier(errTrap, payload[0].contents.trim());
			while (errTrap.hasChildNodes())
			{
				var fc = errTrap.firstChild;
				if (fc.classList && fc.classList.contains("error")) { errList.push(fc.textContent); }
				errTrap.removeChild(fc);
			}
			if (errList.length > 0)
			{
				throwError(place, "<<" + macroName + ">>: error within contents: " + errList.join('; '));
			}
		}
		else
		{
			throwError(place, "<<" + macroName + ">>: cannot find a matching close tag");
		}
	}
};

/**
 * <<unset>>
 */
version.extensions["unsetMacro"] = { major: 1, minor: 0, revision: 0 };
macros["unset"] =
{
	excludeParams: true,
	handler: function (place, macroName, params, parser)
	{
		var   expression = parser.fullArgs()
			, varRe      = new RegExp("state\\.active\\.variables\\.(\\w+)", "g")
			, varMatch
			, remember   = storage.getItem("remember")
			, needStore  = false;

		while ((varMatch = varRe.exec(expression)) !== null)
		{
			var varName = varMatch[1];

			// remove it from the normal variable store
			if (state.active.variables.hasOwnProperty(varName))
			{
				delete state.active.variables[varName];
			}
			// remove it from the remember variable store
			if (remember && remember.hasOwnProperty(varName))
			{
				needStore = true;
				delete remember[varName];
			}
		}

		if (needStore && !storage.setItem("remember", remember))
		{
			throwError(place, "<<" + macroName + ">>: unknown error, cannot update remember store");
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
	handler: function (place, macroName, params, parser, payload)
	{
		if (params.length === 0)
		{
			throwError(place, "<<" + macroName + ">>: no element ID specified");
			return;
		}

		if (payload)
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
			new Wikifier(targetEl, payload[0].contents);
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
version.extensions["widgetMacro"] = { major: 1, minor: 2, revision: 0 };
macros["widget"] =
{
	children: registerMacroTags("widget"),
	handler: function (place, macroName, params, parser, payload)
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

		if (payload)
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
							// store existing $args variables
							if (state.active.variables.hasOwnProperty("args"))
							{
								if (!macros.widget.hasOwnProperty("_argsStack"))
								{
									macros.widget._argsStack = [];
								}
								macros.widget._argsStack.push(state.active.variables.args);
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
								// increase the widget call count
								if (!macros.hasOwnProperty("_widgetCall"))
								{
									macros._widgetCall = 0;
								}
								macros._widgetCall++;

								new Wikifier(place, widgetBody);

								// reduce the widget call count
								macros._widgetCall--;
								if (macros._widgetCall === 0)
								{
									delete macros._widgetCall;
								}
							}
							catch (e)
							{
								throwError(place, "<<" + macroName + '>>: cannot execute widget: ' + e.message);
							}

							// teardown the widget arguments array
							delete state.active.variables.args;

							// restore existing $args variables
							if (macros.widget.hasOwnProperty("_argsStack"))
							{
								state.active.variables.args = macros.widget._argsStack.pop();
								if (macros.widget._argsStack.length === 0)
								{
									// teardown the widget arguments stack
									delete macros.widget._argsStack;
								}
							}
						};
					}(payload[0].contents))
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
