/***********************************************************************************************************************
** [Begin macroslib.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Standard Macro Definitions]
***********************************************************************************************************************/
function addStandardMacros() {
	/***************************************************************************
	 * Links
	 **************************************************************************/
	/**
	 * <<actions>>
	 */
	macros.add("actions", {
		version : { major : 2, minor : 2, patch : 0 },
		handler : function () {
			var list = insertElement(this.output, "ul");
			list.classList.add(this.name);
			if (!state.active.variables["#actions"]) {
				state.active.variables["#actions"] = {};
			}
			for (var i = 0; i < this.args.length; i++) {
				var linkText,
					passage,
					setFn,
					el;

				if (typeof this.args[i] === "object") {
					// argument was in wiki link syntax
					linkText = this.args[i].text;
					passage  = this.args[i].link;
					setFn    = this.args[i].setFn;
				} else {
					// argument was simply the passage name
					linkText = passage = this.args[i];
				}

				if (state.active.variables["#actions"][passage]) {
					continue;
				}

				el = Wikifier.createInternalLink(insertElement(list, "li"), passage, linkText, function (p, fn) {
					return function () {
						state.active.variables["#actions"][p] = true;
						if (typeof fn === "function") { fn(); }
					};
				}(passage, setFn));
				el.classList.add("link-" + this.name);
			}
		}
	});

	/**
	 * <<back>> & <<return>>
	 */
	macros.add(["back", "return"], {
		version : { major : 4, minor : 2, patch : 0 },
		handler : function () {
			var steps = 1,
				pname,
				ctext,
				ltext = this.name[0].toUpperCase() + this.name.slice(1),
				el;

			// translate wiki link syntax into the <<back>>/<<return>> "to" syntax
			if (this.args.length === 1 && typeof this.args[0] === "object") {
				if (this.args[0].count === 1) {
					// simple link syntax: [[...]]
					this.args.push(this.args[0].link);
					this.args[0] = "to"
				} else {
					// pretty link syntax: [[...|...]]
					this.args.push("to");
					this.args.push(this.args[0].link);
					this.args[0] = this.args[0].text;
				}
			}

			if (this.args.length === 1) {
				ctext = this.args[0];
			} else if (this.args.length !== 0) {
				if (this.args.length === 3) {
					ctext = this.args.shift();
				}

				if (this.args[0] === "go") {
					if (isNaN(this.args[1]) || this.args[1] < 1) {
						return this.error('the argument after "go" must be a whole number greater than zero');
					}
					steps = (this.args[1] < state.length) ? this.args[1] : state.length - 1;
					pname = state.peek(steps).title;
					ltext += " (go " + steps + ")";
				} else if (this.args[0] === "to") {
					if (typeof this.args[1] === "object") {
						// argument was in wiki link syntax
						this.args[1] = this.args[1].link;
					}
					if (!tale.has(this.args[1])) {
						return this.error('the "' + this.args[1] + '" passage does not exist');
					}
					if (this.name === "return") { // || config.disableHistoryTracking) // allow <<back>> to work like <<return>> when config.disableHistoryTracking is enabled
						pname = this.args[1];
						ltext += ' (to "' + pname + '")';
					} else {
						for (var i = state.length - 1; i >= 0; i--) {
							if (state.history[i].title === this.args[1]) {
								steps = (state.length - 1) - i;
								pname = this.args[1];
								ltext += ' (to "' + pname + '")';
								break;
							}
						}
					}
					if (pname === undefined) {
						return this.error('cannot find passage "' + this.args[1] + '" in the current story history');
					}
				} else {
					return this.error('"' + this.args[0] + '" is not a valid action (go|to)');
				}
			}
			if (pname === undefined && state.length > 1) {
				pname = state.peek(steps).title;
			}

			if (pname === undefined) {
				return this.error("cannot find passage");
			} else if (steps === 0) {
				return this.error("already at the first passage in the current story history");
			}

			el = document.createElement("a");
			el.classList.add("link-internal");
			el.classList.add("link-" + this.name);
			if (steps > 0) {
				$(el).click(function () {
					if (this.name === "back") {
						if (config.historyMode === History.Modes.Hash || config.disableHistoryControls) {
							return function () {
								// pop the history stack
								//   n.b. (steps > 0) is correct, since SugarCube's history stack does not store "dirty"
								//        (i.e. post-rendered/executed) states; in most other headers, something like
								//        (steps >= 0) would probably be necessary
								while (steps > 0) {
									if (!state.isEmpty) {
										state.pop();
									}
									steps--;
								}
								// activate the new top since we popped the stack
								state.activate(state.top);
								// display the passage
								state.display(pname, el, "replace");
							};
						} else {
							return function () {
								if (state.length > 1) {
									window.history.go(-(steps));
								}
							};
						}
					} else {
						return function () {
							state.display(pname, el);
						};
					}
				}.call(this));
			}
			insertText(el, ctext || this.self.dtext || ltext);
			this.output.appendChild(el);
		},
		linktext : function () {
			if (this.args.length === 0) {
				delete this.self.dtext;
			} else {
				this.self.dtext = this.args[0];
			}
		}
	}, true);

	/**
	 * <<choice>>
	 */
	macros.add("choice", {
		version : { major : 4, minor : 0, patch : 0 },
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no passage specified");
			}

			var linkText,
				passage,
				setFn,
				choiceId  = state.active.title,
				el;

			if (this.args.length === 1) {
				if (typeof this.args[0] === "object") {
					// argument was in wiki link syntax
					linkText = this.args[0].text;
					passage  = this.args[0].link;
					setFn    = this.args[0].setFn;
				} else {
					// argument was simply the passage name
					linkText = passage = this.args[0];
				}
			} else {
				// yes, the arguments are backwards
				passage  = this.args[0];
				linkText = this.args[1];
			}

			if (!state.active.variables.hasOwnProperty("#choice")) {
				state.active.variables["#choice"] = {};
			} else if (state.active.variables["#choice"][choiceId]) {
				insertElement(this.output, "span", null, "link-disabled link-" + this.name, linkText);
				return;
			}

			el = Wikifier.createInternalLink(this.output, passage, linkText, function () {
				state.active.variables["#choice"][choiceId] = true;
				if (typeof setFn === "function") { setFn(); }
			});
			el.classList.add("link-" + this.name);
		}
	});

	/**
	 * <<link>>
	 */
	macros.add("link", {
		version : { major : 3, minor : 4, patch : 0 },
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no link location specified");
			}

			var linkText,
				linkLoc,
				isExternal,
				setFn,
				limit,
				el;

			if (this.args.length === 3) {
				limit = this.args.pop();
			} else if (this.args.length === 2 && (this.args[1] === "keep" || this.args[1] === "remove" || this.args[1] === "once")) {
				limit = this.args.pop();
			}
			if (limit && limit !== "keep" && limit !== "remove" && limit !== "once") {
				return this.error('"' + limit + '" is not a valid action (keep|remove)');
			}

			if (this.args.length === 2) {
				linkText = this.args[0];
				linkLoc  = this.args[1];
			} else {
				if (typeof this.args[0] === "object") {
					// argument was in wiki link syntax
					linkText   = this.args[0].text;
					linkLoc    = this.args[0].link;
					isExternal = this.args[0].isExternal;
					setFn      = this.args[0].setFn;
				} else {
					// argument was simply the link location
					linkText = linkLoc = this.args[0];
				}
			}
			if (isExternal === undefined) {
				isExternal = Wikifier.formatterHelpers.isExternalLink(linkLoc);
			}

			if (limit) {
				if (!state.active.variables.hasOwnProperty("#link")) {
					state.active.variables["#link"] = {};
				} else if (state.active.variables["#link"][linkLoc]) {
					if (limit === "keep") {
						insertElement(this.output, "span", null, "link-disabled link-" + this.name, linkText);
					}
					return;
				}
			}

			if (isExternal) {
				el = Wikifier.createExternalLink(this.output, linkLoc, linkText);
			} else {
				el = Wikifier.createInternalLink(this.output, linkLoc, linkText, function () {
					if (limit) { state.active.variables["#link"][linkLoc] = true; }
					if (typeof setFn === "function") { setFn(); }
				});
			}
			el.classList.add("link-" + this.name);
		}
	});


	/***************************************************************************
	 * Display
	 **************************************************************************/
	/**
	 * <<display>>
	 */
	macros.add("display", {
		version : { major : 3, minor : 1, patch : 0 },
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no passage specified");
			}

			var passage;

			if (typeof this.args[0] === "object") {
				// argument was in wiki link syntax
				passage = this.args[0].link;
			} else {
				// argument was simply the passage name
				passage = this.args[0];
			}
			if (!tale.has(passage)) {
				return this.error('passage "' + passage + '" does not exist');
			}

			var el = this.output;

			passage = tale.get(passage);
			if (this.args[1]) {
				el = insertElement(el, this.args[1], null, passage.domId);
				el.setAttribute("data-passage", passage.title);
			}
			new Wikifier(el, passage.processText());
		}
	});

	/**
	 * <<nobr>>
	 */
	macros.add("nobr", {
		version  : { major : 1, minor : 1, patch : 0 },
		skipArgs : true,
		tags     : null,
		handler  : function () {
			// wikify the contents, after removing all newlines
			new Wikifier(this.output, this.payload[0].contents.replace(/\n/g, " "));
		}
	});

	/**
	 * <<print>>
	 */
	macros.add("print", {
		version  : { major : 2, minor : 1, patch : 0 },
		skipArgs : true,
		handler  : function () {
			if (this.args.full.length === 0) {
				return this.error("no expression specified");
			}

			try {
				var result = Util.evalExpression(this.args.full);
				if (result != null && (typeof result !== "number" || !isNaN(result))) {
					new Wikifier(this.output, result.toString());
				}
			} catch (e) {
				return this.error("bad expression: " + e.message);
			}
		}
	});

	/**
	 * <<silently>>
	 */
	macros.add("silently", {
		version  : { major : 4, minor : 0, patch : 0 },
		skipArgs : true,
		tags     : null,
		handler  : function () {
			var errTrap = document.createDocumentFragment(),
				errList = [];

			// wikify the contents
			new Wikifier(errTrap, this.payload[0].contents.trim());

			// discard the output, unless there were errors
			while (errTrap.hasChildNodes()) {
				var fc = errTrap.firstChild;
				if (fc.classList && fc.classList.contains("error")) { errList.push(fc.textContent); }
				errTrap.removeChild(fc);
			}
			if (errList.length > 0) {
				return this.error("error" + (errList.length === 1 ? "" : "s") + " within contents (" + errList.join('; ') + ")");
			}
		}
	});


	/***************************************************************************
	 * Control
	 **************************************************************************/
	/**
	 * <<if>>
	 */
	macros.add("if", {
		version  : { major : 3, minor : 1, patch : 1 },
		skipArgs : true,
		tags     : [ "elseif", "else" ],
		handler  : function () {
			try {
				for (var i = 0, len = this.payload.length; i < len; i++) {
					if (this.payload[i].name !== "else" && this.payload[i].arguments.length === 0) {
						return this.error("no conditional expression specified for <<" + this.payload[i].name + ">> clause" + (i > 0 ? " (#" + i + ")" : ""));
					} else if (this.payload[i].name === "else" && this.payload[i].arguments.length !== 0) {
						if (/^\s*if\b/i.test(this.payload[i].arguments)) {
							return this.error('whitespace is not allowed between the "else" and "if" in <<elseif>> clause' + (i > 0 ? " (#" + i + ")" : ""));
						}
						return this.error("<<else>> does not accept a conditional expression (perhaps you meant to use <<elseif>> instead), invalid: " + this.payload[i].arguments);
					}
					if (this.payload[i].name === "else" || !!Wikifier.evalExpression(this.payload[i].arguments)) {
						new Wikifier(this.output, this.payload[i].contents);
						break;
					}
				}
			} catch (e) {
				return this.error("bad conditional expression: " + e.message);
			}
		}
	});

	/**
	 * <<for>>, <<break>>, & <<continue>>
	 */
	macros.add("for", {
		version  : { major : 1, minor : 0, patch : 0 },
		skipArgs : true,
		tags     : null,
		handler  : function () {
			var init,
				condition = this.args.full.trim(),
				post,
				parts,
				payload   = this.payload[0].contents.replace(/\n$/, ""),
				first     = true,
				safety    = config.macros.maxLoopIterations;

			if (condition.length === 0) {
				condition = true;
			} else if (condition.indexOf(";") !== -1) {
				if ((parts = condition.match(/^([^;]*?)\s*;\s*([^;]*?)\s*;\s*([^;]*?)$/)) !== null) {
					init      = parts[1];
					condition = parts[2];
					post      = parts[3];
				} else {
					return this.error("invalid 3-part syntax, format: init ; condition ; post");
				}
			}

			try {
				runtime.temp.break = null;
				try {
					if (init) { Util.evalExpression(init); }
				} catch (e) {
					return this.error("bad init expression: " + e.message);
				}
				while (!!Util.evalExpression(condition)) {
					if (--safety < 0) {
						return this.error("exceeded configured maximum loop iterations (" + config.macros.maxLoopIterations + ")");
					}
					new Wikifier(this.output, first ? payload.replace(/^\n/, "") : payload);
					if (first) { first = false; }
					if (runtime.temp.break != null) {
						if (runtime.temp.break === 1) {
							runtime.temp.break = null;
						} else if (runtime.temp.break === 2) {
							runtime.temp.break = null;
							break;
						}
					}
					try {
						if (post) { Util.evalExpression(post); }
					} catch (e) {
						return this.error("bad post expression: " + e.message);
					}
				}
			} catch (e) {
				return this.error("bad conditional expression: " + e.message);
			} finally {
				runtime.temp.break = null;
			}
		}
	});
	macros.add(["break", "continue"], {
		version  : { major : 1, minor : 0, patch : 0 },
		skipArgs : true,
		handler  : function () {
			if (this.contextHas(function (c) { return c.name === "for"; })) {
				runtime.temp.break = (this.name === "continue") ? 1 : 2;
			} else {
				return this.error("must only be used in conjunction with its parent macro <<for>>");
			}
		}
	});


	/***************************************************************************
	 * Variables
	 **************************************************************************/
	/**
	 * <<set>>
	 */
	macros.add("set", {
		version  : { major : 3, minor : 1, patch : 0 },
		skipArgs : true,
		handler  : function () {
			if (this.args.full.length === 0) {
				return this.error("no expression specified");
			}

			macros.evalStatements(this.args.full, this);
		}
	});

	/**
	 * <<unset>>
	 */
	macros.add("unset", {
		version  : { major : 2, minor : 1, patch : 0 },
		skipArgs : true,
		handler  : function () {
			if (this.args.full.length === 0) {
				return this.error("no $variable list specified");
			}

			var expression = this.args.full,
				re         = /state\.active\.variables\.(\w+)/g,
				match;

			while ((match = re.exec(expression)) !== null) {
				var name = match[1];

				if (state.active.variables.hasOwnProperty(name)) {
					delete state.active.variables[name];
				}
			}
		}
	});

	/**
	 * <<remember>>
	 */
	macros.add("remember", {
		version  : { major : 3, minor : 1, patch : 0 },
		skipArgs : true,
		handler  : function () {
			if (this.args.full.length === 0) {
				return this.error("no expression specified");
			}

			var expression = this.args.full;
			if (macros.evalStatements(expression, this)) {
				var remember = storage.getItem("remember") || {},
					re       = /state\.active\.variables\.(\w+)/g,
					match;

				while ((match = re.exec(expression)) !== null) {
					var name = match[1];

					remember[name] = state.active.variables[name];
				}
				if (!storage.setItem("remember", remember)) {
					return this.error("unknown error, cannot remember: " + this.args.raw);
				}
			}
		},
		init : function () {
			var remember = storage.getItem("remember");
			if (remember) {
				Object.keys(remember).forEach(function (name) {
					state.active.variables[name] = remember[name];
				});
			}
		}
	});

	/**
	 * <<forget>>
	 */
	macros.add("forget", {
		version  : { major : 1, minor : 1, patch : 0 },
		skipArgs : true,
		handler  : function () {
			if (this.args.full.length === 0) {
				return this.error("no $variable list specified");
			}

			var expression = this.args.full,
				re         = /state\.active\.variables\.(\w+)/g,
				match,
				remember   = storage.getItem("remember"),
				needStore  = false;

			while ((match = re.exec(expression)) !== null) {
				var name = match[1];

				if (state.active.variables.hasOwnProperty(name)) {
					delete state.active.variables[name];
				}
				if (remember && remember.hasOwnProperty(name)) {
					needStore = true;
					delete remember[name];
				}
			}
			if (needStore && !storage.setItem("remember", remember)) {
				return this.error("unknown error, cannot update remember store");
			}
		}
	});


	/***************************************************************************
	 * Scripting
	 **************************************************************************/
	/**
	 * <<run>>
	 */
	macros.add("run", "set"); // add <<run>> as an alias of <<set>>

	/**
	 * <<script>>
	 */
	macros.add("script", {
		version  : { major : 1, minor : 0, patch : 0 },
		skipArgs : true,
		tags     : null,
		handler  : function () {
			macros.evalStatements(this.payload[0].contents, this);
		}
	});


	/***************************************************************************
	 * Interactive
	 **************************************************************************/
	/**
	 * <<click>> & <<button>>
	 */
	macros.add(["click", "button"], {
		version : { major : 4, minor : 1, patch : 1 },
		tags    : null,
		handler : function () {
			function getWidgetArgs() {
				var wargs;
				if (
					   state.active.variables.hasOwnProperty("args")
					&& this.contextHas(function (c) { return c.self.isWidget; })
				) {
					wargs = state.active.variables.args;
				}
				return wargs;
			}

			if (this.args.length === 0) {
				return this.error("no " + (this.name === "click" ? "link" : "button") + " text specified");
			}

			var elText,
				passage,
				widgetArgs = getWidgetArgs.call(this),
				el         = document.createElement(this.name === "click" ? "a" : "button");

			if (typeof this.args[0] === "object") {
				// argument was in wiki link syntax
				elText  = this.args[0].text;
				passage = this.args[0].link;
			} else {
				// argument was simply the link text
				elText  = this.args[0];
				passage = this.args.length > 1 ? this.args[1] : undefined;
			}

			el.classList.add("link-" + (passage ? (tale.has(passage) ? "internal" : "broken") : "internal"));
			el.classList.add("link-" + this.name);
			insertText(el, elText);
			$(el).click(function (self, contents, widgetArgs) {
				return function () {
					if (contents !== "") {
						if (widgetArgs !== undefined) {
							// store existing $args variables
							if (state.active.variables.hasOwnProperty("args")) {
								if (!self.hasOwnProperty("_argsStack")) {
									self._argsStack = [];
								}
								self._argsStack.push(state.active.variables.args);
							}

							// setup the $args variable
							state.active.variables.args = widgetArgs;
						}

						// wikify the contents and discard any output, unless there were errors
						Wikifier.wikifyEval(contents);

						if (widgetArgs !== undefined) {
							// teardown the $args variable
							delete state.active.variables.args;

							// restore existing $args variables
							if (self.hasOwnProperty("_argsStack")) {
								state.active.variables.args = self._argsStack.pop();
								if (self._argsStack.length === 0) {
									// teardown the stack
									delete self._argsStack;
								}
							}
						}
					}

					// go to the specified passage (if any)
					if (passage !== undefined) {
						state.display(passage, el);
					}
				};
			}(this.self, this.payload[0].contents.trim(), widgetArgs));
			this.output.appendChild(el);
		}
	});

	/**
	 * <<textbox>>
	 */
	macros.add("textbox", {
		version : { major : 4, minor : 0, patch : 0 },
		handler : function () {
			if (this.args.length < 2) {
				var errors = [];
				if (this.args.length < 1) { errors.push("$variable name"); }
				if (this.args.length < 2) { errors.push("default value"); }
				return this.error("no " + errors.join(" or ") + " specified");
			}

			var varName      = this.args[0].trim(),
				varId        = Util.slugify(varName),
				defaultValue = this.args[1],
				passage      = this.args.length > 2 ? this.args[2] : undefined,
				el           = document.createElement("input"),
				enterKeyUsed = false;

			// legacy error
			if (varName[0] !== "$") {
				return this.error('$variable name "' + varName + '" is missing its sigil ($)');
			}

			el.type  = "text";
			el.id    = "textbox-" + varId;
			el.name  = "textbox-" + varId;
			el.value = defaultValue;
			Wikifier.setValue(varName, defaultValue);
			$(el)
				.change(function () {
					// set the $variable upon change, only if Return/Enter was not pressed
					if (!enterKeyUsed) {
						Wikifier.setValue(varName, this.value);
					}
				})
				.keypress(function (evt) {
					// set the $variable and, optionally, forward to another passage if Return/Enter is pressed
					if (evt.which === 13) {
						evt.preventDefault();
						enterKeyUsed = true;
						Wikifier.setValue(varName, this.value);
						if (typeof passage !== "undefined") {
							state.display(passage, this);
						}
					}
				});
			this.output.appendChild(el);
		}
	});

	/**
	 * <<checkbox>>
	 */
	macros.add("checkbox", {
		version : { major : 5, minor : 0, patch : 0 },
		handler : function () {
			if (this.args.length < 3) {
				var errors = [];
				if (this.args.length < 1) { errors.push("$variable name"); }
				if (this.args.length < 2) { errors.push("unchecked value"); }
				if (this.args.length < 3) { errors.push("checked value"); }
				return this.error("no " + errors.join(" or ") + " specified");
			}

			var varName      = this.args[0].trim(),
				varId        = Util.slugify(varName),
				uncheckValue = this.args[1],
				checkValue   = this.args[2],
				el           = document.createElement("input");

			// legacy error
			if (varName[0] !== "$") {
				return this.error('$variable name "' + varName + '" is missing its sigil ($)');
			}

			el.type  = "checkbox";
			el.id    = this.name + "-" + varId;
			el.name  = this.name + "-" + varId;
			if (this.args.length > 3 && this.args[3] === "checked") {
				el.checked = true;
				Wikifier.setValue(varName, checkValue);
			} else {
				Wikifier.setValue(varName, uncheckValue);
			}
			$(el)
				.change(function () {
					Wikifier.setValue(varName, this.checked ? checkValue : uncheckValue);
				});
			this.output.appendChild(el);
		}
	});

	/**
	 * <<radiobutton>>
	 */
	macros.add("radiobutton", {
		version : { major : 5, minor : 0, patch : 0 },
		handler : function () {
			if (this.args.length < 2) {
				var errors = [];
				if (this.args.length < 1) { errors.push("$variable name"); }
				if (this.args.length < 2) { errors.push("checked value"); }
				return this.error("no " + errors.join(" or ") + " specified");
			}

			var varName    = this.args[0].trim(),
				varId      = Util.slugify(varName),
				checkValue = this.args[1],
				el         = document.createElement("input");

			// legacy error
			if (varName[0] !== "$") {
				return this.error('$variable name "' + varName + '" is missing its sigil ($)');
			}

			if (!runtime.temp.hasOwnProperty("radiobutton")) { runtime.temp["radiobutton"] = {}; }
			if (!runtime.temp["radiobutton"].hasOwnProperty(varId)) { runtime.temp["radiobutton"][varId] = 0; }

			el.type  = "radio";
			el.id    = this.name + "-" + varId + "-" + runtime.temp["radiobutton"][varId]++;
			el.name  = this.name + "-" + varId;
			if (this.args.length > 2 && this.args[2] === "checked") {
				el.checked = true;
				Wikifier.setValue(varName, checkValue);
			}
			$(el)
				.change(function () {
					if (this.checked) {
						Wikifier.setValue(varName, checkValue);
					}
				});
			this.output.appendChild(el);
		}
	});


	/***************************************************************************
	 * DOM (Classes)
	 **************************************************************************/
	/**
	 * <<addclass>> & <<toggleclass>>
	 */
	macros.add(["addclass", "toggleclass"], {
		version : { major : 2, minor : 0, patch : 0 },
		handler : function () {
			if (this.args.length < 2) {
				var errors = [];
				if (this.args.length < 1) { errors.push("selector"); }
				if (this.args.length < 2) { errors.push("class names"); }
				return this.error("no " + errors.join(" or ") + " specified");
			}

			var targets = $(this.args[0]);

			if (targets.length === 0) {
				return this.error('no elements matched the selector "' + this.args[0] + '"');
			}

			switch (this.name) {
			case "addclass":
				targets.addClass(this.args[1].trim());
				break;
			case "toggleclass":
				targets.toggleClass(this.args[1].trim());
				break;
			}
		}
	});

	/**
	 * <<removeclass>>
	 */
	macros.add("removeclass", {
		version : { major : 1, minor : 0, patch : 0 },
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no selector specified");
			}

			var targets = $(this.args[0]);

			if (targets.length === 0) {
				return this.error('no elements matched the selector "' + this.args[0] + '"');
			}

			if (this.args.length > 1) {
				targets.removeClass(this.args[1].trim());
			} else {
				targets.removeClass();
			}
		}
	});


	/***************************************************************************
	 * DOM (Content)
	 **************************************************************************/
	/**
	 * <<append>>, <<prepend>>, & <<replace>>
	 */
	macros.add(["append", "prepend", "replace"], {
		version : { major : 2, minor : 0, patch : 1 },
		tags    : null,
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no selector specified");
			}

			var targets = $(this.args[0]);

			if (targets.length === 0) {
				return this.error('no elements matched the selector "' + this.args[0] + '"');
			}

			if (this.payload[0].contents !== "") {
				var frag = document.createDocumentFragment();
				new Wikifier(frag, this.payload[0].contents);
				switch (this.name) {
				case "replace":
					targets.empty();
					/* FALL-THROUGH */
				case "append":
					targets.append(frag);
					break;
				case "prepend":
					targets.prepend(frag);
					break;
				}
			}
		}
	});

	/**
	 * <<remove>>
	 */
	macros.add("remove", {
		version : { major : 1, minor : 0, patch : 0 },
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no selector specified");
			}

			var targets = $(this.args[0]);

			if (targets.length === 0) {
				return this.error('no elements matched the selector "' + this.args[0] + '"');
			}

			targets.remove();
		}
	});


	/***************************************************************************
	 * Miscellaneous
	 **************************************************************************/
	/**
	 * <<widget>>
	 */
	macros.add("widget", {
		version : { major : 2, minor : 0, patch : 0 },
		tags    : null,
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no widget name specified");
			}

			var widgetName = this.args[0];

			if (macros.has(widgetName)) {
				if (!macros.get(widgetName).isWidget) {
					return this.error('cannot clobber existing macro "' + widgetName + '"');
				}

				// remove existing widget
				macros.remove(widgetName);
			}

			try {
				macros.add(widgetName, {
					version  : { major : 1, minor : 0, patch : 0 },
					isWidget : true,
					handler  : (function (contents) {
						return function () {
							try {
								// store existing $args variables
								if (state.active.variables.hasOwnProperty("args")) {
									if (!this.self.hasOwnProperty("_argsStack")) {
										this.self._argsStack = [];
									}
									this.self._argsStack.push(state.active.variables.args);
								}

								// setup the widget arguments array
								state.active.variables.args = [];
								for (var i = 0, len = this.args.length; i < len; i++) {
									state.active.variables.args[i] = this.args[i];
								}
								state.active.variables.args.raw = this.args.raw;
								state.active.variables.args.full = this.args.full;

								// setup the error trapping variables
								var outFrag = document.createDocumentFragment(),
									resFrag = document.createDocumentFragment(),
									errList = [];

								// wikify the widget contents
								new Wikifier(resFrag, contents);

								// carry over the output, unless there were errors
								while (resFrag.hasChildNodes()) {
									var fc = resFrag.firstChild;
									if (fc.classList && fc.classList.contains("error")) { errList.push(fc.textContent); }
									outFrag.appendChild(fc);
								}
								if (errList.length === 0) {
									this.output.appendChild(outFrag);
								} else {
									return this.error("error" + (errList.length === 1 ? "" : "s") + " within widget contents (" + errList.join('; ') + ")");
								}
							} catch (e) {
								return this.error("cannot execute widget: " + e.message);
							} finally {
								// teardown the widget arguments array
								delete state.active.variables.args;

								// restore existing $args variables
								if (this.self.hasOwnProperty("_argsStack")) {
									state.active.variables.args = this.self._argsStack.pop();
									if (this.self._argsStack.length === 0) {
										// teardown the widget arguments stack
										delete this.self._argsStack;
									}
								}
							}
						};
					}(this.payload[0].contents))
				});
			} catch (e) {
				return this.error('cannot create widget macro "' + widgetName + '": ' + e.message);
			}
		}
	});


	/***************************************************************************
	 * Options
	 **************************************************************************/
	/**
	 * <<optionlist>> & <<optiontoggle>>
	 */
	macros.add(["optiontoggle", "optionlist"], {
		version : { major : 2, minor : 0, patch : 0 },
		tags    : [ "onchange" ],
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no option property specified");
			}
			if (this.name === "optionlist" && this.args.length < 2) {
				return this.error("no list specified");
			}

			var propertyName = this.args[0],
				propertyId   = Util.slugify(propertyName),
				elOption     = document.createElement("div"),
				elLabel      = document.createElement("div"),
				elControl    = document.createElement("div");

			elOption.appendChild(elLabel);
			elOption.appendChild(elControl);
			elOption.id  = "option-body-" + propertyId;
			elLabel.id   = "option-label-" + propertyId;
			elControl.id = "option-control-" + propertyId;

			// setup the label
			new Wikifier(elLabel, this.payload[0].contents.trim());

			// setup the control
			var onChangeContents = this.payload.length === 2 ? this.payload[1].contents.trim() : "";
			if (!options.hasOwnProperty(propertyName)) {
				options[propertyName] = undefined;
			}
			switch (this.name) {
			case "optiontoggle":
				var linkText = this.args.length > 1 ? this.args[1] : undefined,
					elInput  = document.createElement("a");
				if (options[propertyName] === undefined) {
					options[propertyName] = false;
				}
				if (options[propertyName]) {
					insertText(elInput, linkText || "On");
					elInput.classList.add("enabled");
				} else {
					insertText(elInput, linkText || "Off");
				}
				$(elInput).click(function () {
					return function (evt) {
						removeChildren(elInput);
						if (options[propertyName]) {
							insertText(elInput, linkText || "Off");
							elInput.classList.remove("enabled");
							options[propertyName] = false;
						} else {
							insertText(elInput, linkText || "On");
							elInput.classList.add("enabled");
							options[propertyName] = true;
						}
						macros.get("saveoptions").handler();

						// if <<onchange>> exists, execute the contents and discard the output (if any)
						if (onChangeContents !== "") {
							new Wikifier(document.createElement("div"), onChangeContents);
						}
					}
				}());
				break;
			case "optionlist":
				var items   = this.args[1],
					elInput = document.createElement("select");
				if (!Array.isArray(items)) {
					if (options.hasOwnProperty(items)) {
						items = options[items];
					} else {
						items = items.trim().split(/\s*,\s*/);
					}
				}
				if (options[propertyName] === undefined) {
					options[propertyName] = items[0];
				}
				for (var i = 0; i < items.length; i++) {
					var elItem = document.createElement("option");
					insertText(elItem, items[i]);
					elInput.appendChild(elItem);
				}
				elInput.value = options[propertyName];
				$(elInput).change(function () {
					return function (evt) {
						options[propertyName] = evt.target.value;
						macros.get("saveoptions").handler();

						// if <<onchange>> exists, execute the contents and discard the output (if any)
						if (onChangeContents !== "") {
							new Wikifier(document.createElement("div"), onChangeContents);
						}
					}
				}());
				break;
			}
			elInput.id = "option-input-" + propertyId;
			elControl.appendChild(elInput);

			this.output.appendChild(elOption);
		}
	});

	/**
	 * <<optionbar>>
	 */
	macros.add("optionbar", {
		version : { major : 3, minor : 0, patch : 0 },
		handler : function () {
			var elSet   = document.createElement("ul"),
				elOK    = document.createElement("li"),
				elReset = document.createElement("li");

			elSet.appendChild(elOK);
			elSet.appendChild(elReset);

			elOK.appendChild(insertElement(null, "button", "options-ok", "ui-close", "OK"));
			elReset.appendChild(insertElement(null, "button", "options-reset", "ui-close", "Reset to Defaults"));

			$("button", elReset).click(function (evt) {
				macros.get("deleteoptions").handler();
				window.location.reload();
			});

			this.output.appendChild(elSet);
		},
	});

	/**
	 * <<saveoptions>>
	 */
	macros.add("saveoptions", {
		version : { major : 2, minor : 0, patch : 0 },
		handler : function () {
			return storage.setItem("options", options);
		},
		init : function () {
			var opts = storage.getItem("options");
			if (opts !== null) {
				Object.keys(opts).forEach(function (name) {
					options[name] = opts[name];
				});
			}
		}
	});

	/**
	 * <<deleteoptions>>
	 */
	macros.add("deleteoptions", {
		version : { major : 2, minor : 0, patch : 0 },
		handler : function () {
			options = {};
			if (!storage.removeItem("options")) {
				return this.error("unknown error, cannot update options store");
			}
		}
	});
}


/***********************************************************************************************************************
** [End macroslib.js]
***********************************************************************************************************************/
