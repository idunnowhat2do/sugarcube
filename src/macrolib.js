/***********************************************************************************************************************
 *
 * macrolib.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global AudioWrapper, Has, Macro, State, Story, Util, Wikifier, config, insertElement,insertText, postdisplay,
	       prehistory, printableStringOrDefault, runtime, storage, strings, turns
*/

/***********************************************************************************************************************
 * Utility Functions
 **********************************************************************************************************************/
function getWikifyEvalHandler(content, widgetArgs, callback) {
	return function () {
		if (content !== "") {
			var argsCache;
			/*
				There's no catch clause because this try/finally is here simply to ensure that
				the `$args` variable is properly restored in the event that an exception is thrown
				during the `Wikifier.wikifyEval()` call.
			*/
			try {
				if (typeof widgetArgs !== "undefined") {
					// Cache the existing $args variable, if any.
					if (State.variables.hasOwnProperty("args")) {
						argsCache = State.variables.args;
					}

					// Setup the $args variable.
					State.variables.args = widgetArgs;
				}

				// Wikify the content and discard any output, unless there were errors.
				Wikifier.wikifyEval(content);
			} finally {
				if (typeof widgetArgs !== "undefined") {
					// Teardown the $args variable.
					delete State.variables.args;

					// Restore the cached $args variable, if any.
					if (typeof argsCache !== "undefined") {
						State.variables.args = argsCache;
					}
				}
			}
		}

		// Call the given callback function, if any.
		if (typeof callback === "function") {
			callback.call(this);
		}
	};
}


/***********************************************************************************************************************
 * Links Macros
 **********************************************************************************************************************/
/*
	<<actions>>
*/
Macro.add("actions", {
	handler : function () {
		var list = insertElement(this.output, "ul");
		list.classList.add(this.name);
		if (!State.variables["#actions"]) {
			State.variables["#actions"] = {};
		}
		for (var i = 0; i < this.args.length; ++i) {
			var	passage,
				text,
				image,
				setFn,
				el;

			if (typeof this.args[i] === "object" && this.args[i].isImage) {
				// Argument was in wiki image syntax.
				image = document.createElement("img");
				image.src = this.args[i].source;
				if (this.args[i].hasOwnProperty("passage")) {
					image.setAttribute("data-passage", this.args[i].passage);
				}
				if (this.args[i].hasOwnProperty("title")) {
					image.title = this.args[i].title;
				}
				if (this.args[i].hasOwnProperty("align")) {
					image.align = this.args[i].align;
				}
				passage = this.args[i].link;
				setFn   = this.args[i].setFn;
			} else {
				if (typeof this.args[i] === "object") {
					// Argument was in wiki link syntax.
					text    = this.args[i].text;
					passage = this.args[i].link;
					setFn   = this.args[i].setFn;
				} else {
					// Argument was simply the passage name.
					text = passage = this.args[i];
				}
			}

			if (
				   State.variables["#actions"].hasOwnProperty(passage)
				&& State.variables["#actions"][passage]
			) {
				continue;
			}

			el = Wikifier.createInternalLink(insertElement(list, "li"), passage, null, (function (p, fn) {
				return function () {
					State.variables["#actions"][p] = true;
					if (typeof fn === "function") { fn(); }
				};
			})(passage, setFn));
			if (image == null) { // lazy equality for null
				insertText(el, text);
			} else {
				el.appendChild(image);
			}
			el.classList.add("macro-" + this.name);
		}
	}
});

/*
	<<back>> & <<return>>
*/
Macro.add([ "back", "return" ], {
	handler : function () {
		var	passage,
			text,
			image,
			el,
			momentIndex     = -1,
			findMomentIndex = function (title) {
				/*
					Find the index of the most recent moment within the in-play history (past only)
					whose title does not match that of the active (present) moment's.
				*/
				for (var i = State.length - 2; i >= 0; --i) {
					if (State.history[i].title === title) {
						return i;
					}
				}
				return -1;
			};

		/* legacy */
		if (this.args.length > 1) {
			return this.error("too many arguments specified, check the documentation for details");
		}
		/* /legacy */

		if (this.args.length === 1) {
			if (typeof this.args[0] === "object") {
				if (this.args[0].isImage) {
					// Argument was in wiki image syntax.
					image = document.createElement("img");
					image.src = this.args[0].source;
					if (this.args[0].hasOwnProperty("passage")) {
						image.setAttribute("data-passage", this.args[0].passage);
					}
					if (this.args[0].hasOwnProperty("title")) {
						image.title = this.args[0].title;
					}
					if (this.args[0].hasOwnProperty("align")) {
						image.align = this.args[0].align;
					}
					if (this.args[0].hasOwnProperty("link")) {
						passage = this.args[0].link;
					}
				} else {
					// Argument was in wiki link syntax.
					if (this.args[0].count === 1) {
						// Simple link syntax: `[[...]]`.
						passage = this.args[0].link;
					} else {
						// Pretty link syntax: `[[...|...]]`.
						text    = this.args[0].text;
						passage = this.args[0].link;
					}
				}
			} else if (this.args.length === 1) {
				// Argument was simply the link text.
				text = this.args[0];
			}
		}

		if (passage == null) { // lazy equality for null
			/*
				Find the index and title of the most recent moment whose title does not match
				that of the active (present) moment's.
			*/
			momentIndex = findMomentIndex(State.passage);
			if (momentIndex !== -1) {
				passage = State.history[momentIndex].title;
			}
			// Fallback to `State.expiredUnique` if we failed to find a passage.
			else if (State.expiredUnique !== "") {
				passage = State.expiredUnique;
			}
		} else {
			if (!Story.has(passage)) {
				return this.error('passage "' + passage + '" does not exist');
			}
			if (this.name === "back") {
				/*
					Find the index of the most recent moment whose title does not match that
					of the specified passage.
				*/
				momentIndex = findMomentIndex(passage);
				if (momentIndex === -1) {
					return this.error('cannot find passage "' + passage + '" in the current story history');
				}
			}
		}

		if (passage == null) { // lazy equality for null
			return this.error("cannot find passage");
		}
//		if (this.name === "back" && momentIndex === -1) {
//			// no-op; we're already at the first passage in the current story history
//			return;
//		}

		if (this.name !== "back" || momentIndex !== -1) {
			el = document.createElement("a");
			jQuery(el)
				.addClass("link-internal")
				.ariaClick({ one : true }, this.name === "return"
					? function () { State.play(passage); }
					: function () { State.goTo(momentIndex); });
		} else {
			el = document.createElement("span");
			el.classList.add("link-disabled");
		}
		el.classList.add("macro-" + this.name);
		if (image == null) { // lazy equality for null
			insertText(el, text != null ? text : strings.macros[this.name].text); // lazy equality for null
		} else {
			el.appendChild(image);
		}
		this.output.appendChild(el);
	}
});

/*
	<<choice>>
*/
Macro.add("choice", {
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no passage specified");
		}

		var	passage,
			text,
			image,
			setFn,
			choiceId = State.passage,
			el;

		if (this.args.length === 1) {
			if (typeof this.args[0] === "object" && this.args[0].isImage) {
				// Argument was in wiki image syntax.
				image = document.createElement("img");
				image.src = this.args[0].source;
				if (this.args[0].hasOwnProperty("passage")) {
					image.setAttribute("data-passage", this.args[0].passage);
				}
				if (this.args[0].hasOwnProperty("title")) {
					image.title = this.args[0].title;
				}
				if (this.args[0].hasOwnProperty("align")) {
					image.align = this.args[0].align;
				}
				passage = this.args[0].link;
				setFn   = this.args[0].setFn;
			} else {
				if (typeof this.args[0] === "object") {
					// Argument was in wiki link syntax.
					text    = this.args[0].text;
					passage = this.args[0].link;
					setFn   = this.args[0].setFn;
				} else {
					// Argument was simply the passage name.
					text = passage = this.args[0];
				}
			}
		} else {
			// Yes, the arguments are backwards.
			passage  = this.args[0];
			text = this.args[1];
		}

		if (!State.variables.hasOwnProperty("#choice")) {
			State.variables["#choice"] = {};
		} else if (
			   State.variables["#choice"].hasOwnProperty(choiceId)
			&& State.variables["#choice"][choiceId]
		) {
			el = insertElement(this.output, "span");
			if (image == null) { // lazy equality for null
				insertText(el, text);
			} else {
				el.appendChild(image);
			}
			el.classList.add("link-disabled");
			el.classList.add("macro-" + this.name);
			el.setAttribute("tabindex", -1);
			return;
		}

		el = Wikifier.createInternalLink(this.output, passage, null, function () {
			State.variables["#choice"][choiceId] = true;
			if (typeof setFn === "function") { setFn(); }
		});
		if (image == null) { // lazy equality for null
			insertText(el, text);
		} else {
			el.appendChild(image);
		}
		el.classList.add("macro-" + this.name);
	}
});


/***********************************************************************************************************************
 * Display Macros
 **********************************************************************************************************************/
/*
	<<display>>
*/
Macro.add("display", {
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no passage specified");
		}

		var passage;

		if (typeof this.args[0] === "object") {
			// Argument was in wiki link syntax.
			passage = this.args[0].link;
		} else {
			// Argument was simply the passage name.
			passage = this.args[0];
		}
		if (!Story.has(passage)) {
			return this.error('passage "' + passage + '" does not exist');
		}

		var el = this.output;

		passage = Story.get(passage);
		if (this.args[1]) {
			el = insertElement(el, this.args[1], null, passage.domId);
			el.setAttribute("data-passage", passage.title);
		}
		new Wikifier(el, passage.processText());
	}
});

/*
	<<nobr>>
*/
Macro.add("nobr", {
	skipArgs : true,
	tags     : null,
	handler  : function () {
		// Wikify the contents, after removing all newlines.
		new Wikifier(this.output, this.payload[0].contents.replace(/^\n+|\n+$/g, "").replace(/\n+/g, " "));
	}
});

/*
	<<print>>, <<=>>, & <<->>
*/
Macro.add([ "print", "=", "-" ], {
	skipArgs : true,
	handler  : function () {
		if (this.args.full.length === 0) {
			return this.error("no expression specified");
		}

		try {
			var	result = printableStringOrDefault(Util.evalExpression(this.args.full), null);
			if (result !== null) {
				new Wikifier(this.output, this.name === "-" ? Util.escape(result) : result);
			}
		} catch (e) {
			return this.error("bad expression: " + e.message);
		}
	}
});

/*
	<<silently>>
*/
Macro.add("silently", {
	skipArgs : true,
	tags     : null,
	handler  : function () {
		var	errTrap = document.createDocumentFragment(),
			errList = [];

		// Wikify the contents.
		new Wikifier(errTrap, this.payload[0].contents.trim());

		// Discard the output, unless there were errors.
		while (errTrap.hasChildNodes()) {
			var fc = errTrap.firstChild;
			if (fc.classList && fc.classList.contains("error")) {
				errList.push(fc.textContent);
			}
			errTrap.removeChild(fc);
		}
		if (errList.length > 0) {
			return this.error("error" + (errList.length === 1 ? "" : "s") + " within contents ("
				+ errList.join('; ') + ")");
		}
	}
});


/***********************************************************************************************************************
 * Control Macros
 **********************************************************************************************************************/
/*
	<<if>>, <<elseif>>, & <<else>>
*/
Macro.add("if", {
	skipArgs : true,
	tags     : [ "elseif", "else" ],
	handler  : function () {
		try {
			for (var i = 0, len = this.payload.length; i < len; ++i) {
				// Sanity checks.
				switch (this.payload[i].name) {
				case "else":
					if (this.payload[i].arguments.length !== 0) {
						if (/^\s*if\b/i.test(this.payload[i].arguments)) {
							return this.error(
								'whitespace is not allowed between the "else" and "if" in <<elseif>> clause'
								+ (i > 0 ? " (#" + i + ")" : "")
							);
						}
						return this.error(
							"<<else>> does not accept a conditional expression"
							+ " (perhaps you meant to use <<elseif>>), invalid: "
							+ this.payload[i].arguments
						);
					}
					break;
				default:
					if (this.payload[i].arguments.length === 0) {
						return this.error(
							"no conditional expression specified for <<" + this.payload[i].name
							+ ">> clause" + (i > 0 ? " (#" + i + ")" : "")
						);
					} else if (config.macros.ifAssignmentError && /[^!=&^|<>*/%+-]=[^=]/.test(this.payload[i].arguments)) {
						return this.error(
							'assignment operator "=" found within <<'
							+ this.payload[i].name + ">> clause" + (i > 0 ? " (#" + i + ")" : "")
							+ " (perhaps you meant to use an equality operator:"
							+ ' ==, ===, eq, is), invalid: '
							+ this.payload[i].arguments
						);
					}
					break;
				}
				// Conditional test.
				if (this.payload[i].name === "else" || !!Wikifier.evalExpression(this.payload[i].arguments)) {
					new Wikifier(this.output, this.payload[i].contents);
					break;
				}
			}
		} catch (e) {
			return this.error(
				"bad conditional expression in <<" + (i === 0 ? "if" : "elseif") + ">> clause"
				+ (i > 0 ? " (#" + i + ")" : "") + ": " + e.message
			);
		}
	}
});

/*
	<<for>>, <<break>>, & <<continue>>
*/
Macro.add("for", {
	skipArgs : true,
	tags     : null,
	handler  : function () {
		var	init,
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
			if (init) {
				try {
					Util.evalExpression(init);
				} catch (e) {
					return this.error("bad init expression: " + e.message);
				}
			}
			while (Util.evalExpression(condition)) {
				if (--safety < 0) {
					return this.error("exceeded configured maximum loop iterations ("
						+ config.macros.maxLoopIterations + ")");
				}
				new Wikifier(this.output, first ? payload.replace(/^\n/, "") : payload);
				if (first) {
					first = false;
				}
				if (runtime.temp.break != null) { // lazy equality for null
					if (runtime.temp.break === 1) {
						runtime.temp.break = null;
					} else if (runtime.temp.break === 2) {
						runtime.temp.break = null;
						break;
					}
				}
				if (post) {
					try {
						Util.evalExpression(post);
					} catch (e) {
						return this.error("bad post expression: " + e.message);
					}
				}
			}
		} catch (e) {
			return this.error("bad conditional expression: " + e.message);
		} finally {
			runtime.temp.break = null;
		}
	}
});
Macro.add([ "break", "continue" ], {
	skipArgs : true,
	handler  : function () {
		if (this.contextHas(function (c) { return c.name === "for"; })) {
			runtime.temp.break = this.name === "continue" ? 1 : 2;
		} else {
			return this.error("must only be used in conjunction with its parent macro <<for>>");
		}
	}
});


/***********************************************************************************************************************
 * Variables Macros
 **********************************************************************************************************************/
/*
	<<set>>
*/
Macro.add("set", {
	skipArgs : true,
	handler  : function () {
		if (this.args.full.length === 0) {
			return this.error("no expression specified");
		}

		Macro.evalStatements(this.args.full, this);
	}
});

/*
	<<unset>>
*/
Macro.add("unset", {
	skipArgs : true,
	handler  : function () {
		if (this.args.full.length === 0) {
			return this.error("no $variable list specified");
		}

		var	expression = this.args.full,
			re         = /State\.variables\.(\w+)/g,
			match;

		while ((match = re.exec(expression)) !== null) {
			var name = match[1];

			if (State.variables.hasOwnProperty(name)) {
				delete State.variables[name];
			}
		}
	}
});

/*
	<<remember>>
*/
Macro.add("remember", {
	skipArgs : true,
	handler  : function () {
		if (this.args.full.length === 0) {
			return this.error("no expression specified");
		}

		var expression = this.args.full;
		if (Macro.evalStatements(expression, this)) {
			var	remember = storage.get("remember") || {},
				re       = /State\.variables\.(\w+)/g,
				match;

			while ((match = re.exec(expression)) !== null) {
				var name = match[1];

				remember[name] = State.variables[name];
			}
			if (!storage.set("remember", remember)) {
				return this.error("unknown error, cannot remember: " + this.args.raw);
			}
		}
	},
	init : function () {
		var remember = storage.get("remember");
		if (remember) {
			Object.keys(remember).forEach(function (name) {
				State.variables[name] = remember[name];
			});
		}
	}
});

/*
	<<forget>>
*/
Macro.add("forget", {
	skipArgs : true,
	handler  : function () {
		if (this.args.full.length === 0) {
			return this.error("no $variable list specified");
		}

		var	expression = this.args.full,
			re         = /State\.variables\.(\w+)/g,
			match,
			remember   = storage.get("remember"),
			needStore  = false;

		while ((match = re.exec(expression)) !== null) {
			var name = match[1];

			if (State.variables.hasOwnProperty(name)) {
				delete State.variables[name];
			}
			if (remember && remember.hasOwnProperty(name)) {
				needStore = true;
				delete remember[name];
			}
		}
		if (needStore && !storage.set("remember", remember)) {
			return this.error("unknown error, cannot update remember store");
		}
	}
});


/***********************************************************************************************************************
 * Scripting Macros
 **********************************************************************************************************************/
/*
	<<run>>
*/
Macro.add("run", "set"); // add <<run>> as an alias of <<set>>

/*
	<<script>>
*/
Macro.add("script", {
	skipArgs : true,
	tags     : null,
	handler  : function () {
		Macro.evalStatements(this.payload[0].contents, this);
	}
});


/***********************************************************************************************************************
 * Interactive Macros
 **********************************************************************************************************************/
/*
	<<button>> & <<click>>
*/
Macro.add([ "button", "click" ], {
	tags    : null,
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no " + (this.name === "click" ? "link" : "button") + " text specified");
		}

		var	widgetArgs = (function () { // eslint-disable-line no-extra-parens
				var wargs;
				if (
					   State.variables.hasOwnProperty("args")
					&& this.contextHas(function (c) { return c.self.isWidget; })
				) {
					wargs = State.variables.args;
				}
				return wargs;
			}.call(this)),
			el      = document.createElement(this.name === "click" ? "a" : "button"),
			passage;

		if (typeof this.args[0] === "object" && this.args[0].isImage) {
			// Argument was in wiki image syntax.
			var img = insertElement(el, "img");
			img.src = this.args[0].source;
			if (this.args[0].hasOwnProperty("passage")) {
				img.setAttribute("data-passage", this.args[0].passage);
			}
			if (this.args[0].hasOwnProperty("title")) {
				img.title = this.args[0].title;
			}
			if (this.args[0].hasOwnProperty("align")) {
				img.align = this.args[0].align;
			}
			passage = this.args[0].link;
		} else {
			var text;
			if (typeof this.args[0] === "object") {
				// Argument was in wiki link syntax.
				text    = this.args[0].text;
				passage = this.args[0].link;
			} else {
				// Argument was simply the link text.
				text    = this.args[0];
				passage = this.args.length > 1 ? this.args[1] : undefined;
			}
			insertText(el, text);
		}
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
		} else {
			el.classList.add("link-internal");
		}
		el.classList.add("macro-" + this.name);
		jQuery(el)
			.ariaClick({
				namespace : ".macros",
				one       : passage != null /* lazy equality for null */
			}, getWikifyEvalHandler(
				this.payload[0].contents.trim(),
				widgetArgs,
				passage != null ? function () { State.play(passage); } : undefined /* lazy equality for null */
			));
		this.output.appendChild(el);
	}
});

/*
	<<checkbox>>
*/
Macro.add("checkbox", {
	handler : function () {
		if (this.args.length < 3) {
			var errors = [];
			if (this.args.length < 1) { errors.push("$variable name"); }
			if (this.args.length < 2) { errors.push("unchecked value"); }
			if (this.args.length < 3) { errors.push("checked value"); }
			return this.error("no " + errors.join(" or ") + " specified");
		}

		/*
			Try to ensure that we receive the $variable's name (incl. sigil), not its value.
		*/
		if (typeof this.args[0] !== "string" || this.args[0].trim()[0] !== "$") {
			return this.error('$variable name "' + this.args[0] + '" is missing its sigil ($)');
		}

		var	varName      = this.args[0].trim(),
			varId        = Util.slugify(varName),
			uncheckValue = this.args[1],
			checkValue   = this.args[2],
			el           = document.createElement("input");

		/*
			Setup and append the input element to the output buffer.
		*/
		jQuery(el)
			.attr({
				"id"       : "checkbox-" + varId,
				"name"     : "checkbox-" + varId,
				"type"     : "checkbox",
				"tabindex" : 0 // for accessiblity
			})
			.addClass("macro-" + this.name)
			.on("change", function () {
				Wikifier.setValue(varName, this.checked ? checkValue : uncheckValue);
			})
			.appendTo(this.output);

		/*
			Set the $variable and input element to the appropriate value and state, as requested.
		*/
		if (this.args.length > 3 && this.args[3] === "checked") {
			el.checked = true;
			Wikifier.setValue(varName, checkValue);
		} else {
			Wikifier.setValue(varName, uncheckValue);
		}

	}
});

/*
	<<radiobutton>>
*/
Macro.add("radiobutton", {
	handler : function () {
		if (this.args.length < 2) {
			var errors = [];
			if (this.args.length < 1) { errors.push("$variable name"); }
			if (this.args.length < 2) { errors.push("checked value"); }
			return this.error("no " + errors.join(" or ") + " specified");
		}

		/*
			Try to ensure that we receive the $variable's name (incl. sigil), not its value.
		*/
		if (typeof this.args[0] !== "string" || this.args[0].trim()[0] !== "$") {
			return this.error('$variable name "' + this.args[0] + '" is missing its sigil ($)');
		}

		var	varName    = this.args[0].trim(),
			varId      = Util.slugify(varName),
			checkValue = this.args[1],
			el         = document.createElement("input");

		/*
			Setup and increment the group counter.
		*/
		if (!runtime.temp.hasOwnProperty("radiobutton")) {
			runtime.temp.radiobutton = {};
		}
		if (!runtime.temp.radiobutton.hasOwnProperty(varId)) {
			runtime.temp.radiobutton[varId] = 0;
		}

		/*
			Setup and append the input element to the output buffer.
		*/
		jQuery(el)
			.attr({
				"id"       : "radiobutton-" + varId + "-" + runtime.temp.radiobutton[varId]++,
				"name"     : "radiobutton-" + varId,
				"type"     : "radio",
				"tabindex" : 0 // for accessiblity
			})
			.addClass("macro-" + this.name)
			.on("change", function () {
				if (this.checked) {
					Wikifier.setValue(varName, checkValue);
				}
			})
			.appendTo(this.output);

		/*
			Set the $variable to the checked value and the input element to checked, if requested.
		*/
		if (this.args.length > 2 && this.args[2] === "checked") {
			el.checked = true;
			Wikifier.setValue(varName, checkValue);
		}
	}
});

/*
	<<textarea>>
*/
Macro.add("textarea", {
	handler : function () {
		if (this.args.length < 2) {
			var errors = [];
			if (this.args.length < 1) { errors.push("$variable name"); }
			if (this.args.length < 2) { errors.push("default value"); }
			return this.error("no " + errors.join(" or ") + " specified");
		}

		/*
			Try to ensure that we receive the $variable's name (incl. sigil), not its value.
		*/
		if (typeof this.args[0] !== "string" || this.args[0].trim()[0] !== "$") {
			return this.error('$variable name "' + this.args[0] + '" is missing its sigil ($)');
		}

		var	varName      = this.args[0].trim(),
			varId        = Util.slugify(varName),
			defaultValue = this.args[1],
			autofocus    = this.args[2] === "autofocus",
			el           = document.createElement("textarea");

		/*
			Setup and append the textarea element to the output buffer.
		*/
		jQuery(el)
			.attr({
				"id"       : "textarea-" + varId,
				"name"     : "textarea-" + varId,
				"rows"     : 4,
				"cols"     : 68,
				"tabindex" : 0 // for accessiblity
			})
			.addClass("macro-" + this.name)
			.on("change", function () {
				Wikifier.setValue(varName, this.value);
			})
			.appendTo(this.output);

		/*
			Set the $variable and textarea element to the default value.
		*/
		Wikifier.setValue(varName, defaultValue);
		// Ideally, we should be setting the `.defaultValue` property here, but IE doesn't support
		// it, so we have to use `.textContent`, which is equivalent to `.defaultValue` anyway.
		el.textContent = defaultValue;

		/*
			Autofocus the textarea element, if requested.
		*/
		if (autofocus) {
			// Set the element's "autofocus" attribute.
			el.setAttribute("autofocus", "autofocus");

			// Setup a single-use post-display task to autofocus the element.
			postdisplay["#autofocus:" + el.id] = function (task) {
				setTimeout(function () { el.focus(); }, 1);
				delete postdisplay[task]; // single-use task
			};
		}
	}
});

/*
	<<textbox>>
*/
Macro.add("textbox", {
	handler : function () {
		if (this.args.length < 2) {
			var errors = [];
			if (this.args.length < 1) { errors.push("$variable name"); }
			if (this.args.length < 2) { errors.push("default value"); }
			return this.error("no " + errors.join(" or ") + " specified");
		}

		/*
			Try to ensure that we receive the $variable's name (incl. sigil), not its value.
		*/
		if (typeof this.args[0] !== "string" || this.args[0].trim()[0] !== "$") {
			return this.error('$variable name "' + this.args[0] + '" is missing its sigil ($)');
		}

		var	varName      = this.args[0].trim(),
			varId        = Util.slugify(varName),
			defaultValue = this.args[1],
			autofocus    = false,
			el           = document.createElement("input"),
			passage;

		if (this.args.length > 3) {
			passage   = this.args[2];
			autofocus = this.args[3] === "autofocus";
		} else if (this.args.length > 2) {
			if (this.args[2] === "autofocus") {
				autofocus = true;
			} else {
				passage = this.args[2];
			}
		}

		/*
			Setup and append the input element to the output buffer.
		*/
		jQuery(el)
			.attr({
				"id"       : "textbox-" + varId,
				"name"     : "textbox-" + varId,
				"type"     : "text",
				"tabindex" : 0 // for accessiblity
			})
			.addClass("macro-" + this.name)
			.on("change", function () {
				Wikifier.setValue(varName, this.value);
			})
			.on("keypress", function (evt) {
				// If Return/Enter is pressed, set the $variable and, optionally, forward to another passage.
				if (evt.which === 13) { // 13 is Return/Enter
					evt.preventDefault();
					Wikifier.setValue(varName, this.value);
					if (passage != null) { // lazy equality for null
						State.play(passage);
					}
				}
			})
			.appendTo(this.output);

		/*
			Set the $variable and input element to the default value.
		*/
		Wikifier.setValue(varName, defaultValue);
		el.value = defaultValue;

		/*
			Autofocus the input element, if requested.
		*/
		if (autofocus) {
			// Set the element's "autofocus" attribute.
			el.setAttribute("autofocus", "autofocus");

			// Setup a single-use post-display task to autofocus the element.
			postdisplay["#autofocus:" + el.id] = function (task) {
				setTimeout(function () { el.focus(); }, 1);
				delete postdisplay[task]; // single-use task
			};
		}
	}
});


/***********************************************************************************************************************
 * DOM (Classes) Macros
 **********************************************************************************************************************/
/*
	<<addclass>> & <<toggleclass>>
*/
Macro.add([ "addclass", "toggleclass" ], {
	handler : function () {
		if (this.args.length < 2) {
			var errors = [];
			if (this.args.length < 1) { errors.push("selector"); }
			if (this.args.length < 2) { errors.push("class names"); }
			return this.error("no " + errors.join(" or ") + " specified");
		}

		var $targets = jQuery(this.args[0]);

		if ($targets.length === 0) {
			return this.error('no elements matched the selector "' + this.args[0] + '"');
		}

		switch (this.name) {
		case "addclass":
			$targets.addClass(this.args[1].trim());
			break;
		case "toggleclass":
			$targets.toggleClass(this.args[1].trim());
			break;
		}
	}
});

/*
	<<removeclass>>
*/
Macro.add("removeclass", {
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no selector specified");
		}

		var $targets = jQuery(this.args[0]);

		if ($targets.length === 0) {
			return this.error('no elements matched the selector "' + this.args[0] + '"');
		}

		if (this.args.length > 1) {
			$targets.removeClass(this.args[1].trim());
		} else {
			$targets.removeClass();
		}
	}
});


/***********************************************************************************************************************
 * DOM (Content) Macros
 **********************************************************************************************************************/
/*
	<<copy>>
*/
Macro.add("copy", {
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no selector specified");
		}

		var $targets = jQuery(this.args[0]);

		if ($targets.length === 0) {
			return this.error('no elements matched the selector "' + this.args[0] + '"');
		}

		jQuery(this.output).append($targets.html());
	}
});

/*
	<<append>>, <<prepend>>, & <<replace>>
*/
Macro.add([ "append", "prepend", "replace" ], {
	tags    : null,
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no selector specified");
		}

		var $targets = jQuery(this.args[0]);

		if ($targets.length === 0) {
			return this.error('no elements matched the selector "' + this.args[0] + '"');
		}

		if (this.name === "replace") {
			$targets.empty();
		}
		if (this.payload[0].contents !== "") {
			var frag = document.createDocumentFragment();
			new Wikifier(frag, this.payload[0].contents);
			switch (this.name) {
			case "replace":
			case "append":
				$targets.append(frag);
				break;
			case "prepend":
				$targets.prepend(frag);
				break;
			}
		}
	}
});

/*
	<<remove>>
*/
Macro.add("remove", {
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no selector specified");
		}

		var $targets = jQuery(this.args[0]);

		if ($targets.length === 0) {
			return this.error('no elements matched the selector "' + this.args[0] + '"');
		}

		$targets.remove();
	}
});


/***********************************************************************************************************************
 * Miscellaneous Macros
 **********************************************************************************************************************/
/*
	<<goto>>
*/
Macro.add("goto", {
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no passage specified");
		}

		var passage;

		if (typeof this.args[0] === "object") {
			// Argument was in wiki link syntax.
			passage = this.args[0].link;
		} else {
			// Argument was simply the passage name.
			passage = this.args[0];
		}
		if (!Story.has(passage)) {
			return this.error('passage "' + passage + '" does not exist');
		}

		/*
			Call State.play().

			n.b. This does not terminate the current Wikifier call chain, though, ideally, it probably
			     should, however, doing so wouldn't be trivial and there's the question of would that
			     behavior be unwanted by users, who are used to the current behavior from similar macros
			     and constructs.
		*/
		setTimeout(function () {
			State.play(passage);
		}, 40); // not too short, not too long
	}
});

/*
	<<timed>>
*/
Macro.add("timed", {
	tags    : [ "next" ],
	timers  : {},
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no time value specified in <<timed>>");
		}

		var	items = [];
		try {
			items.push({
				delay   : Math.max(10, Util.fromCSSTime(this.args[0].trim())),
				content : this.payload[0].contents
			});
		} catch (e) {
			return this.error(e.message + " in <<timed>>");
		}
		if (this.payload.length > 1) {
			try {
				for (var i = 1, len = this.payload.length; i < len; ++i) {
					items.push({
						delay : this.payload[i].arguments.length === 0
							? items[items.length - 1].delay
							: Math.max(10, Util.fromCSSTime(this.payload[i].arguments.trim())),
						content : this.payload[i].contents
					});
				}
			} catch (e) {
				return this.error(e.message + " in <<next>> (#" + i + ")");
			}
		}

		// Register the timer and, possibly, a clean up task.
		this.self.registerTimeout(insertElement(this.output, "span", null, "macro-timed timed-insertion-container"), items);
	},
	registerTimeout : function (container, items) {
		var	turnId   = turns(),
			timers   = this.timers,
			timerId  = null,
			nextItem = items.shift(),
			worker   = function () {
				// 1. Bookkeeping.
				delete timers[timerId];
				if (turnId !== turns()) {
					return;
				}

				// 2. Set the current item and setup the next worker, if any.
				var curItem = nextItem;
				if ((nextItem = items.shift()) != null) { // lazy equality for null
					timers[(timerId = setTimeout(worker, nextItem.delay))] = true;
				}

				// 3. Wikify the content last to reduce drift.
				var frag = document.createDocumentFragment();
				new Wikifier(frag, curItem.content);
				container.appendChild(frag);
			};
		timers[(timerId = setTimeout(worker, nextItem.delay))] = true;

		// Setup a single-use `prehistory` task to remove pending timers.
		if (!prehistory.hasOwnProperty("#timed-timers-cleanup")) {
			prehistory["#timed-timers-cleanup"] = function (task) {
				var timerIds = Object.keys(timers);
				for (var i = 0; i < timerIds.length; ++i) {
					delete timers[timerIds[i]];
					clearTimeout(timerIds[i]);
				}
				delete prehistory[task]; // single-use task
			};
		}
	}
});

/*
	<<widget>>
*/
Macro.add("widget", {
	tags    : null,
	handler : function () {
		if (this.args.length === 0) {
			return this.error("no widget name specified");
		}

		var widgetName = this.args[0];

		if (Macro.has(widgetName)) {
			if (!Macro.get(widgetName).isWidget) {
				return this.error('cannot clobber existing macro "' + widgetName + '"');
			}

			// Delete the existing widget.
			Macro.delete(widgetName);
		}

		try {
			Macro.add(widgetName, {
				isWidget : true,
				handler  : (function (contents) {
					return function () {
						var argsCache;
						try {
							// Cache the existing $args variable, if any.
							if (State.variables.hasOwnProperty("args")) {
								argsCache = State.variables.args;
							}

							// Setup the widget arguments array.
							State.variables.args = [];
							for (var i = 0, len = this.args.length; i < len; ++i) {
								State.variables.args[i] = this.args[i];
							}
							State.variables.args.raw = this.args.raw;
							State.variables.args.full = this.args.full;

							// Setup the error trapping variables.
							var	outFrag = document.createDocumentFragment(),
								resFrag = document.createDocumentFragment(),
								errList = [];

							// Wikify the widget contents.
							new Wikifier(resFrag, contents);

							// Carry over the output, unless there were errors.
							while (resFrag.hasChildNodes()) {
								var fc = resFrag.firstChild;
								if (fc.classList && fc.classList.contains("error")) {
									errList.push(fc.textContent);
								}
								outFrag.appendChild(fc);
							}
							if (errList.length === 0) {
								this.output.appendChild(outFrag);
							} else {
								return this.error("error" + (errList.length === 1 ? "" : "s")
									+ " within widget contents (" + errList.join('; ') + ")");
							}
						} catch (e) {
							return this.error("cannot execute widget: " + e.message);
						} finally {
							// Teardown the widget arguments array.
							delete State.variables.args;

							// Restore the cached $args variable, if any.
							if (typeof argsCache !== "undefined") {
								State.variables.args = argsCache;
							}
						}
					};
				})(this.payload[0].contents)
			});
		} catch (e) {
			return this.error('cannot create widget macro "' + widgetName + '": ' + e.message);
		}
	}
});


/***********************************************************************************************************************
 * Audio Macros
 **********************************************************************************************************************/
if (!Has.audio) {
	Macro.add([ "audio", "stopallaudio", "cacheaudio", "playlist", "setplaylist" ], {
		handler : function () { /* empty */ }
	});
} else {
	/**
		<<audio>>
	*/
	Macro.add("audio", {
		handler : function () {
			if (this.args.length < 2) {
				var errors = [];
				if (this.args.length < 1) { errors.push("track ID"); }
				if (this.args.length < 2) { errors.push("actions"); }
				return this.error("no " + errors.join(" or ") + " specified");
			}

			var	tracks = Macro.get("cacheaudio").tracks,
				id     = this.args[0];

			if (!tracks.hasOwnProperty(id)) {
				return this.error("no track by ID: " + id);
			}

			var	audio   = tracks[id],
				action,
				volume,
				mute,
				time,
				loop,
				fadeTo,
				passage,
				raw;

			// Process arguments.
			var args = this.args.slice(1);
			while (args.length > 0) {
				var arg = args.shift();
				switch (arg) {
				case "play":
				case "pause":
				case "stop":
					action = arg;
					break;
				case "fadein":
					action = "fade";
					fadeTo = 1;
					break;
				case "fadeout":
					action = "fade";
					fadeTo = 0;
					break;
				case "fadeto":
					if (args.length === 0) {
						return this.error("fadeto missing required level value");
					}
					action = "fade";
					raw = args.shift();
					fadeTo = parseFloat(raw);
					if (isNaN(fadeTo) || !isFinite(fadeTo)) {
						return this.error("cannot parse fadeto: " + raw);
					}
					break;
				case "volume":
					if (args.length === 0) {
						return this.error("volume missing required level value");
					}
					raw = args.shift();
					volume = parseFloat(raw);
					if (isNaN(volume) || !isFinite(volume)) {
						return this.error("cannot parse volume: " + raw);
					}
					break;
				case "mute":
				case "unmute":
					mute = arg === "mute";
					break;
				case "time":
					if (args.length === 0) {
						return this.error("time missing required seconds value");
					}
					raw = args.shift();
					time = parseFloat(raw);
					if (isNaN(time) || !isFinite(time)) {
						return this.error("cannot parse time: " + raw);
					}
					break;
				case "loop":
				case "unloop":
					loop = arg === "loop";
					break;
				case "goto":
					if (args.length === 0) {
						return this.error("goto missing required passage title");
					}
					raw = args.shift();
					if (typeof raw === "object") {
						// Argument was in wiki link syntax.
						passage = raw.link;
					} else {
						// Argument was simply the passage name.
						passage = raw;
					}
					if (!Story.has(passage)) {
						return this.error('passage "' + passage + '" does not exist');
					}
					break;
				default:
					return this.error("unknown action: " + arg);
				}
			}

			try {
				if (volume != null) { // lazy equality for null
					audio.volume = volume;
				}
				if (time != null) { // lazy equality for null
					audio.time = time;
				}
				if (mute != null) { // lazy equality for null
					if (mute) {
						audio.mute();
					} else {
						audio.unmute();
					}
				}
				if (loop != null) { // lazy equality for null
					if (loop) {
						audio.loop();
					} else {
						audio.unloop();
					}
				}
				if (passage != null) { // lazy equality for null
					audio.oneEnd(function () { // execute the callback once only
						State.play(passage);
					});
				}
				switch (action) {
				case "play":
					audio.play();
					break;
				case "pause":
					audio.pause();
					break;
				case "stop":
					audio.stop();
					break;
				case "fade":
					if (audio.volume === fadeTo) {
						if (fadeTo === 0) {
							audio.volume = 1;
						} else if (fadeTo === 1) {
							audio.volume = 0;
						}
					}
					audio.fade(audio.volume, fadeTo);
					break;
				}
			} catch (e) {
				return this.error("error playing audio: " + e.message);
			}
		}
	});

	/**
		<<stopallaudio>>
	*/
	Macro.add("stopallaudio", {
		handler : function () {
			var tracks = Macro.get("cacheaudio").tracks;
			Object.keys(tracks).forEach(function (id) {
				tracks[id].stop();
			});
		}
	});

	/**
		<<cacheaudio>>
	*/
	Macro.add("cacheaudio", {
		handler : function () {
			if (this.args.length < 2) {
				var errors = [];
				if (this.args.length < 1) { errors.push("track ID"); }
				if (this.args.length < 2) { errors.push("sources"); }
				return this.error("no " + errors.join(" or ") + " specified");
			}

			var	types   = this.self.types,
				canPlay = this.self.canPlay,
				audio   = document.createElement("audio"),
				id      = this.args[0],
				extRe   = /^.+?(?:\.([^\.\/\\]+?))$/;

			for (var i = 1; i < this.args.length; ++i) {
				var	url   = this.args[i],
					match = extRe.exec(url);

				if (match === null) {
					continue;
				}

				var	ext  = match[1].toLowerCase(),
					type = types.hasOwnProperty(ext) ? types[ext] : "audio/" + ext;

				// Determine and cache the `canPlay` status.
				if (!canPlay.hasOwnProperty(type)) {
					// Some early implementations return "no" instead of the empty string.
					canPlay[type] = audio.canPlayType(type).replace(/^no$/i, "") !== "";
				}

				if (canPlay[type]) {
					var source  = document.createElement("source");
					source.src  = url;
					source.type = type;
					audio.appendChild(source);
				}
			}

			// If it contains any <source> elements, wrap the <audio> element and add it to the tracks.
			if (audio.hasChildNodes()) {
				audio.preload = "auto";
				this.self.tracks[id] = new AudioWrapper(audio);
			}
		},
		types : Object.freeze({
			/*
				Define the supported audio types via MIME-type (incl. the codecs property).

				n.b. Opera (Presto) will return a false-negative if the codecs value is quoted.
				     Opera (Blink) will return a false-negative for WAVE audio if the preferred
				     MIME-type of "audio/wave" is specified, instead "audio/wav" must be used.
			*/
			mp3  : 'audio/mpeg; codecs=mp3',
			ogg  : 'audio/ogg; codecs=vorbis',
			webm : 'audio/webm; codecs=vorbis',
			wav  : 'audio/wav; codecs=1'
		}),
		canPlay : {},
		tracks  : {}
	});

	/**
		<<playlist>>
	*/
	Macro.add("playlist", {
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no actions specified");
			}

			var	self    = this.self,
				action,
				volume,
				mute,
				loop,
				shuffle,
				fadeTo,
				raw;

			// Process arguments.
			var args = this.args.slice(0);
			while (args.length > 0) {
				var arg = args.shift();
				switch (arg) {
				case "play":
				case "pause":
				case "stop":
					action = arg;
					break;
				case "fadein":
					action = "fade";
					fadeTo = 1;
					break;
				case "fadeout":
					action = "fade";
					fadeTo = 0;
					break;
				case "fadeto":
					if (args.length === 0) {
						return this.error("fadeto missing required level value");
					}
					action = "fade";
					raw = args.shift();
					fadeTo = parseFloat(raw);
					if (isNaN(fadeTo) || !isFinite(fadeTo)) {
						return this.error("cannot parse fadeto: " + raw);
					}
					break;
				case "volume":
					if (args.length === 0) {
						return this.error("volume missing required level value");
					}
					raw = args.shift();
					volume = parseFloat(raw);
					if (isNaN(volume) || !isFinite(volume)) {
						return this.error("cannot parse volume: " + raw);
					}
					break;
				case "mute":
				case "unmute":
					mute = arg === "mute";
					break;
				case "loop":
				case "unloop":
					loop = arg === "loop";
					break;
				case "shuffle":
				case "unshuffle":
					shuffle = arg === "shuffle";
					break;
				default:
					return this.error("unknown action: " + arg);
				}
			}

			try {
				if (volume != null) { // lazy equality for null
					self.setVolume(volume);
				}
				if (mute != null) { // lazy equality for null
					self.muted = mute;
					if (mute) {
						self.mute();
					} else {
						self.unmute();
					}
				}
				if (loop != null) { // lazy equality for null
					self.loop = loop;
				}
				if (shuffle != null) { // lazy equality for null
					self.shuffle = shuffle;
					self.buildList();
				}
				switch (action) {
				case "play":
					self.play();
					break;
				case "pause":
					self.pause();
					break;
				case "stop":
					self.stop();
					break;
				case "fade":
					if (self.volume === fadeTo) {
						if (fadeTo === 0) {
							self.setVolume(1);
						} else if (fadeTo === 1) {
							self.setVolume(0);
						}
					}
					self.fade(fadeTo);
					break;
				}
			} catch (e) {
				return this.error("error playing audio: " + e.message);
			}
		},
		play : function () {
			if (this.list.length === 0) {
				this.buildList();
			}
			if (this.current === null || this.current.isEnded()) {
				this.next();
			}
			this.current.play();
		},
		pause : function () {
			if (this.current !== null) {
				this.current.pause();
			}
		},
		stop : function () {
			if (this.current !== null) {
				this.current.stop();
			}
		},
		fade : function (to) {
			if (this.list.length === 0) {
				this.buildList();
			}
			if (this.current === null || this.current.isEnded()) {
				this.next();
			} else {
				this.current.volume = this.volume;
			}
			this.current.fade(this.current.volume, to);
			this.volume = to; // kludgey, but necessary
		},
		mute : function () {
			if (this.current !== null) {
				this.current.mute();
			}
		},
		unmute : function () {
			if (this.current !== null) {
				this.current.unmute();
			}
		},
		next : function () {
			this.current = this.list.shift();
			this.current.volume = this.volume;
		},
		setVolume : function (vol) {
			this.volume = vol;
			if (this.current !== null) {
				this.current.volume = vol;
			}
		},
		onEnd : function () {
			var	thisp = Macro.get("playlist");
			if (thisp.list.length === 0) {
				if (!thisp.loop) {
					return;
				}
				thisp.buildList();
			}
			thisp.next();
			if (thisp.muted) {
				thisp.mute();
			}
			thisp.current.play();
		},
		buildList : function () {
			this.list = this.tracks.slice(0);
			if (this.shuffle) {
				this.list.shuffle();

				// Try not to immediately replay the last track when shuffling.
				if (this.list.length > 1 && this.list[0] === this.current) {
					this.list.push(this.list.shift());
				}
			}
		},
		tracks  : [],
		list    : [],
		current : null,
		volume  : 1,
		muted   : false,
		loop    : true,
		shuffle : false
	});

	/**
		<<setplaylist>>
	*/
	Macro.add("setplaylist", {
		handler : function () {
			if (this.args.length === 0) {
				return this.error("no track ID(s) specified");
			}

			var	tracks   = Macro.get("cacheaudio").tracks,
				playlist = Macro.get("playlist"),
				list     = [];

			for (var i = 0; i < this.args.length; ++i) {
				var	id = this.args[i];
				if (!tracks.hasOwnProperty(id)) {
					return this.error("no track by ID: " + id);
				}
				var track = tracks[id].clone();
				track.stop();
				track.unloop();
				track.unmute();
				track.volume = 1;
				jQuery(track.audio)
					.off("ended")
					.on("ended.macros:playlist", playlist.onEnd);
				list.push(track);
			}
			if (playlist.current !== null) {
				playlist.current.pause();
			}
			playlist.tracks  = list;
			playlist.list    = [];
			playlist.current = null;
			playlist.volume  = 1;
			playlist.muted   = false;
			playlist.loop    = true;
			playlist.shuffle = false;
		}
	});
}

