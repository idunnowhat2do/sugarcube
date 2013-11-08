/***********************************************************************************************************************
** [Begin macros.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [New-style Macro Initialization]
***********************************************************************************************************************/
macros =
{
	// data properties
	children:    {},
	definitions: {},

	// method properties
	has: function (name, includeChildren)
	{
		//return this.definitions.hasOwnProperty(name) || this.children.hasOwnProperty(name);
		//return this.definitions.hasOwnProperty(name);
		return this.definitions.hasOwnProperty(name) || (includeChildren && this.children.hasOwnProperty(name));
	},
	get: function (name)
	{
		var macro = null;

		if (this.definitions.hasOwnProperty(name) && typeof this.definitions[name]["handler"] === "function")
		{
			macro = this.definitions[name];
		}
		else if (this.hasOwnProperty(name) && typeof this[name]["handler"] === "function")
		{
			macro = this[name];
		}
		return macro;
	},
	getHandler: function (name, handler)
	{
		var macro = this.get(name);

		if (!handler) { handler = "handler"; }
		return macro.hasOwnProperty(handler) ? macro[handler] : null;
	},
	add: function (name, definition)
	{
		if (Array.isArray(name))
		{
			name.forEach(function (n) { this.add(n, definition); }, this);
			return;
		}

		if (this.has(name))
		{
			throw new Error("cannot clobber existing macro <<" + name + ">>");
		}
		else if (this.children.hasOwnProperty(name))
		{
			throw new Error("cannot clobber child tag <<" + name + ">> of parent macro <<" + this.children[name] + ">>");
		}

		try
		{
			// add the macro definition
			if (typeof definition === "object")
			{
				this.definitions[name] = deepCopy(definition);
			}
			// add the macro alias
			else
			{
				if (this.has(definition))
				{
					this.definitions[name] = this.definitions[definition];
				}
				else
				{
					throw new Error("cannot create alias of nonexistent macro <<" + definition + ">>");
				}
			}

			/* legacy kludges for old-style macros */
			this.definitions[name]["_newStyleMacro"] = true;
			/* /legacy kludges for old-style macros */

			// protect the macro, if requested
			if (this.definitions[name].hasOwnProperty("protect") && this.definitions[name]["protect"])
			{
				Object.defineProperty(this.definitions, name, { writable: false });
			}
		}
		catch (e)
		{
			throw new Error("cannot clobber protected macro <<" + name + ">>");
		}

		// automatic post-processing
		if (this.definitions[name].hasOwnProperty("children"))
		{
			if (Array.isArray(this.definitions[name].children) && this.definitions[name].children.length !== 0)
			{
				this.definitions[name].children = this.addTags(name, this.definitions[name].children);
			}
			else
			{
				this.definitions[name].children = this.addTags(name);
			}
		}
	},
	remove: function (name)
	{
		if (Array.isArray(name))
		{
			name.forEach(function (n) { this.remove(n); }, this);
			return;
		}

		if (this.definitions.hasOwnProperty(name))
		{
			// automatic pre-processing
			if (this.definitions[name].hasOwnProperty("children"))
			{
				this.removeTags(name);
			}

			try
			{
				// unprotect the macro, if necessary
				if (this.definitions[name].hasOwnProperty("protect") && this.definitions[name]["protect"])
				{
					Object.defineProperty(this.definitions, name, { writable: true });
				}

				// remove the macro definition
				delete this.definitions[name];
			}
			catch (e)
			{
				throw new Error("unknown error removing macro <<" + name + ">>: " + e.message);
			}
		}
		else if (this.children.hasOwnProperty(name))
		{
			throw new Error("cannot remove child tag <<" + name + ">> of parent macro <<" + this.children[name] + ">>");
		}
	},
	addTags: function (parent, bodyTags)
	{
		if (!parent) { throw new Error("no parent specified"); }
		if (!bodyTags) { bodyTags = []; }

		var   endTags = [ "/" + parent, "end" + parent ]	// automatically create the closing tags
			, allTags = [];
	
		allTags.concat(bodyTags, endTags);

		for (var i = 0; i < allTags.length; i++)
		{
			if (this.definitions.hasOwnProperty(allTags[i]))
			{
				throw new Error("cannot register tag for an existing macro");
			}
			if (this.children.hasOwnProperty(allTags[i]))
			{
				throw new Error("tag is already registered (to: <<" + this.children[allTags[i]] + ">>)");
			}
			else
			{
				this.children[allTags[i]] = parent;
			}
		}
		return { "endTags": endTags, "bodyTags": bodyTags };
	},
	removeTags: function (parent)
	{
		if (!parent) { throw new Error("no parent specified"); }
		if (!bodyTags) { bodyTags = []; }

		var   endTags = [ "/" + parent, "end" + parent ]	// automatically create the closing tags
			, allTags = [];
	
		allTags.concat(bodyTags, endTags);

		for (var i = 0; i < allTags.length; i++)
		{
			if (this.children.hasOwnProperty(allTags[i]))
			{
				if (this.children[allTags[i]] !== parent)
				{
					throw new Error("cannot remove tag registered to another macro (<<" + this.children[allTags[i]] + ">>)");
				}
				else
				{
					delete this.children[allTags[i]];
				}
			}
		}
	},
	eval: function (expression, output, name)
	{
		try
		{
			eval("(function(){" + expression + "}());");
			return true;
		}
		catch (e)
		{
			return throwError(output, "<<" + name + ">>: bad expression: " + e.message);
		}
	}
};

// protect the special properties of the macros variable
/* Object.freeze(macros); */
Object.defineProperties(macros, {
	// data properties
	"children":    { enumerable: false, configurable: false },
	"definitions": { enumerable: false, configurable: false },

	// method properties
	"has":        { writable: false, enumerable: false, configurable: false },
	"get":        { writable: false, enumerable: false, configurable: false },
	"getHandler": { writable: false, enumerable: false, configurable: false },
	"add":        { writable: false, enumerable: false, configurable: false },
	"remove":     { writable: false, enumerable: false, configurable: false },
	"addTags":    { writable: false, enumerable: false, configurable: false },
	"removeTags": { writable: false, enumerable: false, configurable: false },
	"eval":       { writable: false, enumerable: false, configurable: false }
});


/***********************************************************************************************************************
** [Macro Definitions]
***********************************************************************************************************************/
/*******************************************************************************
 * Links
 ******************************************************************************/
/**
 * <<actions>>
 */
macros.add("actions", {
	version: { major: 2, minor: 0, revision: 0 },
	handler: function ()
	{
		var list = insertElement(this.output, "ul");
		list.classList.add(this.name);
		if (!state.active.variables["#actions"])
		{
			state.active.variables["#actions"] = {};
		}
		for (var i = 0; i < this.args.length; i++)
		{
			var   linkText
				, passage;

			if (typeof this.args[i] === "object")
			{	// argument was in wiki link syntax
				linkText = this.args[i].text;
				passage  = this.args[i].link;
			}
			else
			{	// argument was simply the passage name
				linkText = passage = this.args[i];
			}

			if (state.active.variables["#actions"][passage])
			{
				continue;
			}

			var   item = insertElement(list, "li")
				, link = $(insertPassageLink(item, passage, linkText));
			link.addClass("link-" + this.name);
			link.click(function ()
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
});

/**
 * <<back>> & <<return>>
 */
macros.add(["back", "return"], {
	version: { major: 4, minor: 0, revision: 0 },
	handler: function ()
	{
		var   steps = 1
			, pname
			, ctext
			, ltext = this.name[0].toUpperCase() + this.name.slice(1)
			, el;

		// translate wiki link syntax into the <<back>>/<<return>> "to" syntax
		if (this.args.length === 1 && typeof this.args[0] === "object")
		{	// argument was in wiki link syntax
			if (this.args[0].count === 1)
			{	// passage only syntax: [[...]]
				this.args.push(this.args[0].link);
				this.args[0] = "to"
			}
			else
			{	// text and passage syntax: [[...|...]]
				this.args.push("to");
				this.args.push(this.args[0].link);
				this.args[0] = this.args[0].text;
			}
		}

		if (this.args.length === 1)
		{
			ctext = this.args[0];
		}
		else if (this.args.length !== 0)
		{
			if (this.args.length === 3)
			{
				ctext = this.args.shift();
			}

			var histLen = (config.historyMode !== modes.sessionHistory) ? state.length : state.active.sidx + 1;
			if (this.args[0] === "go")
			{
				if (isNaN(this.args[1]) || this.args[1] < 1)
				{
					throwError(this.output, "<<" + this.name + '>>: the argument after "go" must be a whole number greater than zero');
					return;
				}
				steps = (this.args[1] < histLen) ? this.args[1] : histLen - 1;
				pname = state.peek(steps).title;
				ltext += " (go " + steps + ")";
			}
			else if (this.args[0] === "to")
			{
				if (typeof this.args[1] === "object")
				{	// argument was in wiki link syntax
					this.args[1] = this.args[1].link;
				}
				if (!tale.has(this.args[1]))
				{
					throwError(this.output, "<<" + this.name + '>>: the "' + this.args[1] + '" passage does not exist');
					return;
				}
				for (var i = histLen - 1; i >= 0; i--)
				{
					if (state.history[i].title === this.args[1])
					{
						steps = (histLen - 1) - i;
						pname = this.args[1];
						ltext += ' (to "' + pname + '")';
						break;
					}
				}
				if (pname === undefined)
				{
					throwError(this.output, "<<" + this.name + '>>: cannot find passage "' + this.args[1] + '" in the current story history');
					return;
				}
			}
			else
			{
				throwError(this.output, "<<" + this.name + '>>: "' + this.args[0] + '" is not a valid action (go|to)');
				return;
			}
		}
		if (pname === undefined && state.length > 1)
		{
			pname = state.peek(steps).title;
		}

		if (pname === undefined)
		{
			throwError(this.output, "<<" + this.name + ">>: cannot find passage");
			return;
		}
		else if (steps === 0)
		{
			throwError(this.output, "<<" + this.name + ">>: already at the first passage in the current story history");
			return;
		}

		el = $(document.createElement("a"));
		el.addClass("link-" + this.name);
		if (steps > 0)
		{
			el.click(function ()
			{
				if (this.name === "back")
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
			}.call(this));
		}
		el.append(ctext || this.self.dtext || ltext);
		el.appendTo(this.output);
	},
	linktext: function ()
	{
		if (this.args.length === 0)
		{
			delete this.self.dtext;
		}
		else
		{
			this.self.dtext = this.args[0];
		}
	}
});

/**
 * <<choice>> (only for compatibility with Jonah)
 */
macros.add("choice", {
	version: { major: 3, minor: 0, revision: 0 },
	handler: function ()
	{
		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no passage specified");
		}

		var   linkText
			, passage;

		if (this.args.length === 1)
		{
			if (typeof this.args[0] === "object")
			{	// argument was in wiki link syntax
				linkText = this.args[0].text;
				passage  = this.args[0].link;
			}
			else
			{	// argument was simply the passage name
				linkText = passage = this.args[0];
			}
		}
		else
		{
			passage  = this.args[0];
			linkText = this.args[1];
		}

		var el = $(insertPassageLink(this.output, passage, linkText, "link-" + this.name));
		el.click(function ()
		{
			state.display(passage, el);
		});
	}
});

/**
 * <<link>>
 */
macros.add("link", {
	version: { major: 3, minor: 0, revision: 0 },
	handler: function ()
	{
		function createInternalLink(output, passage, text)
		{
			var el = $(insertPassageLink(output, passage, text, "link-" + this.name));
			el.click(function ()
			{
				if (onceType)
				{
					state.active.variables["#link"][passage] = true;
				}
				state.display(passage, el);
			});
			return el;
		}
		function createExternalLink(output, url, text)
		{
			var el = insertElement(output, "a", null, "link-external link-" + this.name, text);
			el.href = url;
			el.target = "_blank";
			return el;
		}

		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no link location specified");
		}

		var   argCount
			, linkText
			, linkLoc
			, onceType;

		if (this.args.length === 3)
		{
			onceType = this.args.pop();
		}
		else if (this.args.length === 2 && (this.args[1] === "once" || this.args[1] === "keep"))
		{
			onceType = this.args.pop();
		}
		if (onceType && onceType !== "once" && onceType !== "keep")
		{
			return throwError(this.output, "<<" + this.name + '>>: "' + onceType + '" is not a valid action (once|keep)');
		}

		if (this.args.length === 2)
		{
			linkText = this.args[0];
			linkLoc  = this.args[1];
			argCount = 2;
		}
		else
		{
			if (typeof this.args[0] === "object")
			{	// argument was in wiki link syntax
				linkText = this.args[0].text;
				linkLoc  = this.args[0].link;
				argCount = this.args[0].count;
			}
			else
			{	// argument was simply the link location
				linkText = linkLoc = this.args[0];
				argCount = 1;
			}
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
					insertText(this.output, linkText);
				}
				return;
			}
		}

		if (argCount === 1)
		{
			createInternalLink(this.output, linkLoc, linkText);
		}
		else	// argCount === 2
		{
			if (tale.has(linkLoc))
			{
				createInternalLink(this.output, linkLoc, linkText);
			}
			else
			{
				createExternalLink(this.output, linkLoc, linkText);
			}
		}
	}
});


/*******************************************************************************
 * Display
 ******************************************************************************/
/**
 * <<display>>
 */
macros.add("display", {
	version: { major: 3, minor: 0, revision: 0 },
	handler: function ()
	{
		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no passage specified");
		}

		var passage;

		if (typeof this.args[0] === "object")
		{	// argument was in wiki link syntax
			passage = this.args[0].link;
		}
		else
		{	// argument was simply the passage name
			passage = this.args[0];
		}
		if (!tale.has(passage))
		{
			return throwError(this.output, "<<" + this.name + '>>: passage "' + passage + '" does not exist');
		}

		passage = tale.get(passage);
		if (this.args[1])
		{
			new Wikifier(insertElement(this.output, this.args[1], null, passage.domId), passage.text);
		}
		else
		{
			new Wikifier(this.output, passage.text);
		}
	}
});

/**
 * <<print>>
 */
macros.add("print", {
	version: { major: 2, minor: 0, revision: 0 },
	fillArgsArray: false,
	handler: function ()
	{
		try
		{
			var result = eval(this.args.full);
			if (result != null && (typeof result !== "number" || !isNaN(result)))
			{
				new Wikifier(this.output, result.toString());
			}
		}
		catch (e)
		{
			return throwError(this.output, "<<" + this.name + ">>: bad expression: " + e.message);
		}
	}
});

/**
 * <<silently>>
 */
macros.add("silently", {
	version: { major: 4, minor: 0, revision: 0 },
	fillArgsArray: false,
	children: null,
	handler: function ()
	{
		// execute the contents and discard the output, except for errors (which are displayed)
		var   errTrap = document.createElement("div")
			, errList = [];

		new Wikifier(errTrap, this.payload[0].contents.trim());

		while (errTrap.hasChildNodes())
		{
			var fc = errTrap.firstChild;
			if (fc.classList && fc.classList.contains("error")) { errList.push(fc.textContent); }
			errTrap.removeChild(fc);
		}
		if (errList.length > 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: error within contents: " + errList.join('; '));
		}
	}
});


/*******************************************************************************
 * Control
 ******************************************************************************/
/**
 * <<if>>
 */
macros.add("if", {
	version: { major: 3, minor: 0, revision: 0 },
	fillArgsArray: false,
	children: [ "elseif", "else" ],
	handler: function ()
	{
		try
		{
			for (var i = 0, len = this.payload.length; i < len; i++)
			{
				if (this.payload[i].name === "else" || eval(Wikifier.parse(this.payload[i].arguments)))
				{
					new Wikifier(this.output, this.payload[i].contents);
					break;
				}
			}
		}
		catch (e)
		{
			return throwError(this.output, "<<" + this.name + ">>: bad conditional expression: " + e.message);
		}
	}
});


/*******************************************************************************
 * Variables
 ******************************************************************************/
/**
 * <<set>>
 */
macros.add("set", {
	version: { major: 3, minor: 0, revision: 0 },
	fillArgsArray: false,
	handler: function ()
	{
		macros.eval(this.args.full, this.output, this.name);
	}
});
/*
// for "macros.set.run()" legacy compatibility only
macros["set"] = { run: function (expression, output, name) { return macros.eval(expression, output, name); } };
*/

/**
 * <<unset>>
 */
macros.add("unset", {
	version: { major: 2, minor: 0, revision: 0 },
	fillArgsArray: false,
	handler: function ()
	{
		var   expression = this.args.full
			, re         = /state\.active\.variables\.(\w+)/g
			, match;

		while ((match = re.exec(expression)) !== null)
		{
			var name = match[1];

			if (state.active.variables.hasOwnProperty(name))
			{
				delete state.active.variables[name];
			}
		}
	}
});

/**
 * <<remember>>
 */
macros.add("remember", {
	version: { major: 3, minor: 0, revision: 0 },
	fillArgsArray: false,
	handler: function ()
	{
		var expression = this.args.full;
		if (macros.eval(expression, this.output, this.name))
		{
			var   remember = storage.getItem("remember") || {}
				, re       = /state\.active\.variables\.(\w+)/g
				, match;

			while ((match = re.exec(expression)) !== null)
			{
				var name = match[1];

				remember[name] = state.active.variables[name];
			}

			if (!storage.setItem("remember", remember))
			{
				return throwError(this.output, "<<" + this.name + ">>: unknown error, cannot remember: " + this.args.raw);
			}
		}
	},
	init: function ()
	{
		var remember = storage.getItem("remember");
		if (remember)
		{
			for (var name in remember)
			{
				state.active.variables[name] = remember[name];
			}
		}
	}
});

/**
 * <<forget>>
 */
macros.add("forget", {
	version: { major: 1, minor: 0, revision: 0 },
	fillArgsArray: false,
	handler: function ()
	{
		var   expression = this.args.full
			, re         = /state\.active\.variables\.(\w+)/g
			, match
			, remember   = storage.getItem("remember")
			, needStore  = false;

		if (remember)
		{
			while ((match = re.exec(expression)) !== null)
			{
				var name = match[1];

				if (remember.hasOwnProperty(name))
				{
					needStore = true;
					delete remember[name];
				}
			}

			if (needStore && !storage.setItem("remember", remember))
			{
				return throwError(this.output, "<<" + this.name + ">>: unknown error, cannot update remember store");
			}
		}
	}
});


/*******************************************************************************
 * Scripting
 ******************************************************************************/
/**
 * <<run>>
 */
macros.add("run", {
	version: { major: 3, minor: 0, revision: 0 },
	fillArgsArray: false,
	handler: function ()
	{
		macros.eval(this.args.full, this.output, this.name);
	}
});

/**
 * <<script>>
 */
macros.add("script", {
	version: { major: 1, minor: 0, revision: 0 },
	children: null,
	fillArgsArray: false,
	handler: function ()
	{
		macros.eval(this.payload[0].contents.trim(), this.output, this.name);
	},
});


/*******************************************************************************
 * Events
 ******************************************************************************/
/**
 * <<click>>
 */
macros.add("click", {
	version: { major: 3, minor: 0, revision: 0 },
	children: null,
	handler: function ()
	{
		function getWidgetArgs(context)
		{
			var wargs;

			if (state.active.variables.hasOwnProperty("args"))
			{
				if (Array.isArray(context) && context.some(function (v) { return v.self.isWidget; }))
				{
					wargs = state.active.variables.args;
				}
			}

			return wargs;
		}

		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no link text specified");
		}

		var   linkText
			, passage
			, widgetArgs = getWidgetArgs(this.context)
			, el         = $(document.createElement("a"));

		if (typeof this.args[0] === "object")
		{	// argument was in wiki link syntax
			linkText = this.args[0].text;
			passage  = this.args[0].link;
		}
		else
		{	// argument was simply the link text
			linkText = this.args[0];
			passage  = this.args.length > 1 ? this.args[1] : undefined;
		}

		el.addClass("link-" + (passage ? (tale.has(passage) ? "internal" : "broken") : "internal"));
		el.addClass("link-" + this.name);
		el.append(linkText);
		el.click(function (self, contents, widgetArgs) {
			return function ()
			{
				if (contents !== "")
				{
					if (widgetArgs !== undefined)
					{
						// store existing $args variables
						if (state.active.variables.hasOwnProperty("args"))
						{
							if (!self.hasOwnProperty("_argsStack"))
							{
								self._argsStack = [];
							}
							self._argsStack.push(state.active.variables.args);
						}

						// setup the $args variable
						state.active.variables.args = widgetArgs;
					}

					// attempt to execute the contents and discard the output (if any)
					new Wikifier(document.createElement("div"), contents);

					if (widgetArgs !== undefined)
					{
						// teardown the $args variable
						delete state.active.variables.args;

						// restore existing $args variables
						if (self.hasOwnProperty("_argsStack"))
						{
							state.active.variables.args = self._argsStack.pop();
							if (self._argsStack.length === 0)
							{
								// teardown the stack
								delete self._argsStack;
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
		}(this.self, this.payload[0].contents.trim(), widgetArgs));
		el.appendTo(this.output);
	}
});


/*******************************************************************************
 * DOM, Boxing
 ******************************************************************************/
/**
 * <<div>> & <<span>>  (Keep these???  It's a requested feature...)
 */
macros.add(["div", "span"], {
	version: { major: 1, minor: 0, revision: 0 },
	children: null,
	handler: function ()
	{
		var   elId
			, elClasses
			, arg;

		while (arg = this.args.shift())
		{
			switch (arg)
			{
			case "id":
				elId = this.args.shift();
				break;
			case "class":
				elClasses = this.args.shift();
				break;
			}
		}

		new Wikifier(insertElement(this.output, this.name, elId, elClasses), this.payload[0].contents);
	}
});


/*******************************************************************************
 * DOM, Classes
 ******************************************************************************/
/**
 * <<addclass>>
 */
macros.add("addclass", {
	version: { major: 1, minor: 0, revision: 0 },
	protect: true,
	handler: function ()
	{
		if (this.args.length < 2)
		{
			var errors = [];
			if (this.args.length < 1) { errors.push("selector"); }
			if (this.args.length < 2) { errors.push("class names"); }
			return throwError(this.output, "<<" + this.name + ">>: no " + errors.join(" or ") + " specified");
		}

		var targets = $(this.args[0]);

		if (targets.length === 0)
		{
			return throwError(this.output, "<<" + this.name + '>>: no elements matched the selector "' + this.args[0] + '"');
		}

		targets.addClass(this.args[1].trim());
	}
});

/**
 * <<removeclass>>
 */
macros.add("removeclass", {
	version: { major: 1, minor: 0, revision: 0 },
	handler: function ()
	{
		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no selector specified");
		}

		var targets = $(this.args[0]);

		if (targets.length === 0)
		{
			return throwError(this.output, "<<" + this.name + '>>: no elements matched the selector "' + this.args[0] + '"');
		}

		if (this.args.length > 1)
		{
			targets.removeClass(this.args[1].trim());
		}
		else
		{
			targets.removeClass();
		}
	}
});

/**
 * <<toggleclass>>
 */
macros.add("toggleclass", {
	version: { major: 1, minor: 0, revision: 0 },
	handler: function ()
	{
		if (this.args.length < 2)
		{
			var errors = [];
			if (this.args.length < 1) { errors.push("selector"); }
			if (this.args.length < 2) { errors.push("class names"); }
			return throwError(this.output, "<<" + this.name + ">>: no " + errors.join(" or ") + " specified");
		}

		var targets = $(this.args[0]);

		if (targets.length === 0)
		{
			return throwError(this.output, "<<" + this.name + '>>: no elements matched the selector "' + this.args[0] + '"');
		}

		targets.toggleClass(this.args[1].trim());
	}
});


/*******************************************************************************
 * DOM, Content
 ******************************************************************************/
/**
 * <<append>>
 */
macros.add("append", {
	version: { major: 1, minor: 0, revision: 0 },
	children: null,
	handler: function ()
	{
		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no selector specified");
		}

		var targets = $(this.args[0]);

		if (targets.length === 0)
		{
			return throwError(this.output, "<<" + this.name + '>>: no elements matched the selector "' + this.args[0] + '"');
		}

		var frag = document.createDocumentFragment();
		new Wikifier(frag, this.payload[0].contents);
		targets.append(frag);
	}
});

/**
 * <<prepend>>
 */
macros.add("prepend", {
	version: { major: 1, minor: 0, revision: 0 },
	children: null,
	handler: function ()
	{
		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no selector specified");
		}

		var targets = $(this.args[0]);

		if (targets.length === 0)
		{
			return throwError(this.output, "<<" + this.name + '>>: no elements matched the selector "' + this.args[0] + '"');
		}

		var frag = document.createDocumentFragment();
		new Wikifier(frag, this.payload[0].contents);
		targets.prepend(frag);
	}
});

/**
 * <<replace>>
 */
macros.add("replace", {
	version: { major: 1, minor: 0, revision: 0 },
	children: null,
	handler: function ()
	{
		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no selector specified");
		}

		var targets = $(this.args[0]);

		if (targets.length === 0)
		{
			return throwError(this.output, "<<" + this.name + '>>: no elements matched the selector "' + this.args[0] + '"');
		}

		if (this.payload[0].contents)
		{
			var frag = document.createDocumentFragment();
			new Wikifier(frag, this.payload[0].contents);
			targets.empty().append(frag);
		}
		else
		{
			targets.empty();
		}
	}
});

/**
 * <<remove>>
 */
macros.add("remove", {
	version: { major: 1, minor: 0, revision: 0 },
	handler: function ()
	{
		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no selector specified");
		}

		var targets = $(this.args[0]);

		if (targets.length === 0)
		{
			return throwError(this.output, "<<" + this.name + '>>: no elements matched the selector "' + this.args[0] + '"');
		}

		targets.remove();
	}
});


/*******************************************************************************
 * Miscellaneous
 ******************************************************************************/
/**
 * <<widget>>
 */
macros.add("widget", {
	version: { major: 2, minor: 0, revision: 0 },
	children: null,
	handler: function ()
	{
		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no widget name specified");
		}

		var widgetName = this.args[0];

		if (macros.has(widgetName))
		{
			if (!macros.get(widgetName).isWidget)
			{
				return throwError(this.output, "<<" + this.name + '>>: cannot clobber existing macro "' + widgetName + '"');
			}

			// remove existing widget
			macros.remove(widgetName);
		}

		try
		{
			macros.add(widgetName, {
				version: { major: 1, minor: 0, revision: 0 },
				isWidget: true,
				handler: (function (widgetBody)
				{
					return function ()
					{
						try
						{
							// store existing $args variables
							if (state.active.variables.hasOwnProperty("args"))
							{
								if (!this.self.hasOwnProperty("_argsStack"))
								{
									this.self._argsStack = [];
								}
								this.self._argsStack.push(state.active.variables.args);
							}

							// setup the widget arguments array
							state.active.variables.args = [];
							for (var i = 0, len = this.args.length; i < len; i++)
							{
								state.active.variables.args[i] = this.args[i];
							}
							state.active.variables.args.raw = this.args.raw;
							state.active.variables.args.full = this.args.full;

							// attempt to execute the widget
							new Wikifier(this.output, widgetBody);
						}
						catch (e)
						{
							return throwError(this.output, "<<" + this.name + '>>: cannot execute widget: ' + e.message);
						}
						finally
						{
							// teardown the widget arguments array
							delete state.active.variables.args;

							// restore existing $args variables
							if (this.self.hasOwnProperty("_argsStack"))
							{
								state.active.variables.args = this.self._argsStack.pop();
								if (this.self._argsStack.length === 0)
								{
									// teardown the widget arguments stack
									delete this.self._argsStack;
								}
							}
						}
					};
				}(this.payload[0].contents))
			});
		}
		catch (e)
		{
			return throwError(this.output, "<<" + this.name + '>>: cannot create widget macro "' + widgetName + '": ' + e.message);
		}
	}
});


/*******************************************************************************
 * Options
 ******************************************************************************/
/**
 * <<option>>
 */
macros.add("option", {
	version: { major: 2, minor: 0, revision: 0 },
	children: [ "onchange" ],
	handler: function ()
	{
		if (this.args.length < 2)
		{
			var errors = [];
			if (this.args.length < 1) { errors.push("property"); }
			if (this.args.length < 2) { errors.push("type"); }
			return throwError(this.output, "<<" + this.name + ">>: no " + errors.join(" or ") + " specified");
		}

		var   propertyName = this.args[0]
			, controlType  = this.args[1];

		if (controlType !== "toggle" && controlType !== "list")
		{
			return throwError(this.output, "<<" + this.name + '>>: "' + controlType + '" is not a valid type (switch|list)');
		}
		if (controlType === "list" && this.args.length < 3)
		{
			return throwError(this.output, "<<" + this.name + ">>: no list specified");
		}

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
		new Wikifier(elLabel, this.payload[0].contents.trim());

		// setup the control
		var onChangeBody = (this.payload.length === 2 && this.payload[1].name === "onchange") ? this.payload[1].contents.trim() : "";
		if (!options.hasOwnProperty(propertyName))
		{
			options[propertyName] = undefined;
		}
		switch (controlType)
		{
		case "toggle":
			var   linkText = this.args.length > 2 ? this.args[2] : undefined
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
			$(elInput).click(function ()
			{
				return function (evt)
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
			}());
			break;
		case "list":
			var   items    = this.args[2]
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
			$(elInput).change(function ()
			{
				return function (evt)
				{
					options[propertyName] = evt.target.value;
					macros.option.store();

					// if <<onchange>> exists, execute the contents and discard the output (if any)
					if (onChangeBody !== "")
					{
						new Wikifier(document.createElement("div"), onChangeBody);
					}
				}
			}());
			break;
		}
		elInput.id = "option-input-" + propertyId;
		elControl.appendChild(elInput);

		this.output.appendChild(elOption);
	},
	controlbar: function ()
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

		$(elReset).click(function (evt) {
			macros.option.purge();
			window.location.reload();
		});

		this.output.appendChild(elSet);
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
			for (var name in opts)
			{
				options[name] = opts[name];
			}
		}
	}
});


/***********************************************************************************************************************
** [DEPRECIATED Macro Utility Functions]
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
		if (macros.definitions.hasOwnProperty(allTags[i]))
		{
			throw new Error("cannot register tag for an existing macro");
		}
		if (macros.children.hasOwnProperty(allTags[i]))
		{
			throw new Error("tag is already registered (to: <<" + macros.children[allTags[i]] + ">>)");
		}
		else
		{
			macros.children[allTags[i]] = parent;
		}
	}
	return { "endTags": endTags, "bodyTags": bodyTags };
}

function evalMacroExpression(expression, place, macroName)
{
	try
	{
		eval("(function(){" + expression + "}());");
		return true;
	}
	catch (e)
	{
		return throwError(place, "<<" + macroName + ">>: bad expression: " + e.message);
	}
}


/***********************************************************************************************************************
** [DEPRECIATED Macro Definitions]
***********************************************************************************************************************/
/**
 * <<bind>> (DEPRECIATED)
 */
macros.add("bind", "click");	// add <<bind>> as an alias of <<click>>

/**
 * <<class>> (DEPRECIATED)
 */
macros.add("class", {
	version: { major: 2, minor: 2, revision: 0 },
	children: null,
	handler: function ()
	{
		var   elName    = this.args[1] || "span"
			, elClasses = this.args[0] || ""
			, el        = insertElement(this.output, elName, null, elClasses);

		new Wikifier(el, this.payload[0].contents);
	}
});

/**
 * <<classupdate>> (DEPRECIATED)
 */
macros.add("classupdate", {
	version: { major: 1, minor: 0, revision: 0 },
	handler: function ()
	{
		if (this.args.length < 3)
		{
			var errors = [];
			if (this.args.length < 1) { errors.push("element ID"); }
			if (this.args.length < 2) { errors.push("action"); }
			if (this.args.length < 3) { errors.push("class names"); }
			return throwError(this.output, "<<" + this.name + ">>: no " + errors.join(" or ") + " specified");
		}

		var   targetEl = (this.args[0] === "body") ? document.body : document.getElementById(this.args[0])
			, updType  = this.args[1]
			, classes  = this.args[2].trim().split(/\s+/);

		if (!targetEl)
		{
			return throwError(this.output, "<<" + this.name + '>>: element with ID "' + this.args[0] + '" does not exist');
		}
		if (updType !== "add" && updType !== "remove" && updType !== "toggle")
		{
			return throwError(this.output, "<<" + this.name + '>>: "' + updType + '" is not a valid action (add|remove|toggle)');
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
});

/**
 * <<id>> (DEPRECIATED)
 */
macros.add("id", {
	version: { major: 2, minor: 2, revision: 0 },
	children: null,
	handler: function ()
	{
		var   elName = this.args[1] || "span"
			, elId   = this.args[0] || ""
			, el     = insertElement(this.output, elName, elId);

		new Wikifier(el, this.payload[0].contents);
	}
});

/**
 * <<runjs>> (DEPRECIATED)
 */
macros.add("runjs", {
	version: { major: 3, minor: 0, revision: 0 },
	fillArgsArray: false,
	handler: function ()
	{
		macros.eval(this.args.raw, this.output, this.name);
	},
});

/**
 * <<update>> (DEPRECIATED)
 */
macros.add("update", {
	version: { major: 2, minor: 0, revision: 0 },
	children: null,
	handler: function ()
	{
		if (this.args.length === 0)
		{
			return throwError(this.output, "<<" + this.name + ">>: no element ID specified");
		}

		var   parentEl = document.getElementById(this.args[0])
			, updType  = this.args[1];

		if (!parentEl)
		{
			return throwError(this.output, "<<" + this.name + '>>: element with ID "' + this.args[0] + '" does not exist');
		}
		if (updType && updType !== "append" && updType !== "prepend" && updType !== "replace")
		{
			return throwError(this.output, "<<" + this.name + '>>: "' + updType + '" is not a valid action (append|prepend|replace)');
		}

		switch (updType)
		{
		case "prepend":
			var frag = document.createDocumentFragment();
			new Wikifier(frag, this.payload[0].contents);
			parentEl.insertBefore(frag, parentEl.firstChild);
			break;
		case "append":
			new Wikifier(parentEl, this.payload[0].contents);
			break;
		default:	// replace
			removeChildren(parentEl);
			new Wikifier(parentEl, this.payload[0].contents);
			break;
		}
	}
});


/***********************************************************************************************************************
** [End macros.js]
***********************************************************************************************************************/
