/***********************************************************************************************************************
** [Begin story.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [History]
***********************************************************************************************************************/
function History()
{
	DEBUG("[History()]");
	DEBUG("    > mode: " + (config.historyMode === modes.hashTag ? "hashTag" : (config.historyMode === modes.windowHistory ? "windowHistory" : "sessionHistory")));
	if (History.getWindowState()) { if (config.historyMode === modes.windowHistory) { DEBUG("    > History.getWindowState(): " + History.getWindowState().length); } else if (config.historyMode === modes.sessionHistory) { DEBUG("    > History.getWindowState(): " + History.getWindowState().sidx + "/" + History.getWindowState().suid); } } else { DEBUG("    > History.getWindowState(): " + History.getWindowState()); }

	// currently active/displayed state
	this.active = { init: true, variables: {} };	// allows macro initialization to set variables at startup

	// history state stack
	//     hashTag        [{ title: null, variables: {} }]
	//     windowHistory  [{ title: null, variables: {} }]
	//     sessionHistory [{ title: null, variables: {}, sidx: null }]
	this.history = [];
}

// setup accessor and mutator properties
History.prototype =
{
	get top ()     { return (this.history.length !== 0) ? this.history[this.history.length - 1] : null; },
	get bottom ()  { return (this.history.length !== 0) ? this.history[0] : null; },
	get isEmpty () { return this.history.length === 0; },
	get length ()  { return (config.historyMode === modes.sessionHistory) ? this.active.sidx + 1 : this.history.length; }
};

/*
History.prototype.clone = function (at)
{
	if (this.isEmpty) { return null; }
	at = 1 + (at ? Math.abs(at) : 0);
	if (at > this.history.length) { return null; }

	var dup = clone(this.history[this.history.length - at], true);
	if (config.historyMode === modes.sessionHistory)
	{
		delete dup.sidx;
	}
	return dup;
};
*/

History.prototype.index = function (idx)
{
	if (this.isEmpty) { return null; }
	if (idx < 0 || idx >= this.length) { return null; }

	return this.history[idx];
};

History.prototype.peek = function (at)
{
	if (this.isEmpty) { return null; }
	at = 1 + (at ? Math.abs(at) : 0);
	if (at > this.length) { return null; }

	return this.history[this.length - at];
};

History.prototype.push = function (/* variadic */)
{
	if (arguments.length === 0) { return; }	// maybe throw?

	for (var i = 0; i < arguments.length; i++)
	{
		var state = arguments[i];
		if (config.historyMode === modes.sessionHistory)
		{
			state.sidx = this.history.length;
		}
		this.history.push(state);
	}
	return this.history.length;
};

History.prototype.pop = function (num)
{
	if (this.isEmpty) { return []; }
	num = num ? Math.abs(num) : 1;
	//if (num > this.history.length) { return []; }

	return (num === 1) ? this.history.pop() : this.history.splice(this.history.length - num, num);
};

History.prototype.activate = function (state)
{
	if (arguments.length === 0) { return; }	// maybe throw?
	if (state == null) { throw new Error("State activation attempted with null/undefined."); }	// use lazy equality

	if (typeof state === "object")
	{
		this.active = clone(state, true);
	}
	else
	{
		if (this.isEmpty) { return null; }
		if (state < 0 || state >= this.history.length) { return null; }
		this.active = clone(this.history[state], true);
	}
	if (this.prng)
	{
		this.prng = SeedablePRNG.unmarshal({
			  seed  : this.prng.seed
			, count : this.active.rcount
		});
	}

	return this.active;
};

History.prototype.init = function ()
{
	DEBUG("[<History>.init()]");

	// display the initial passage
	if (typeof testPlay !== "undefined" && testPlay !== "")	// enables the Twine 1.4+ "Test Play From Here" feature
	{
		DEBUG('    > display: "' + testPlay + '" (testPlay)');
		this.display(testPlay);
	}
	else if (!this.restore())
	{
		DEBUG('    > display: "' + config.startPassage + '"');
		this.display(config.startPassage);
	}

	// setup the history change handlers
	//   n.b. do not update these to use jQuery; the "popstate" event gains
	//        nothing from being wrapped in the jQuery Event object and it would
	//        complicate either the handlers, by having to deal with it, or the
	//        jQuery Event object, if we pushed the properties we need onto it
	if (config.historyMode === modes.sessionHistory)
	{
		window.addEventListener("popstate", History.popStateHandler_sessionHistory, false);
	}
	else if (config.historyMode === modes.windowHistory)
	{
		window.addEventListener("popstate", History.popStateHandler_windowHistory, false);
	}
	else
	{
		window.addEventListener("hashchange", History.hashChangeHandler, false);
	}
};

History.prototype.display = function (title, link, option)
{
	DEBUG("[<History>.display()]");

	// process option
	var   updateDisplay = (option === "hidden" || option === "offscreen" || option === "quietly" || option === false) ? false : true
		, updateHistory = (option === "replace" || option === "back") ? false : true;

	// reset the system temp/scratch object
	systemp = {};

	// n.b. the title parameter can either be a passage title (string) or passage ID (number), so
	//      after loading the passage, always refer to passage.title and never the title parameter
	var   passage     = tale.get(title)
		, windowTitle = (config.displayPassageTitles && passage.title !== "Start")
				? tale.title + ": " + passage.title
				: tale.title;

	// ensure that this.active is set if we have history
	if (this.active.init && !this.isEmpty)
	{
		if (config.historyMode === modes.sessionHistory)
		{
			DEBUG("    [SH]> state.active.init && !state.isEmpty; activating: " + (History.hasWindowState() ? "History.getWindowState().sidx" : "state.top"));
			this.activate(History.hasWindowState() ? History.getWindowState().sidx : this.top);	// use lazy equality
		}
		else if (config.historyMode === modes.windowHistory)
		{
			DEBUG("    [WH]> state.active.init && !state.isEmpty; activating: state.top");
			this.activate(this.top);
		}
		else
		{
			DEBUG("    [HT]> state.active.init && !state.isEmpty; activating: state.top");
			this.activate(this.top);
		}
	}

	// create a fresh entry in the history
	if (updateHistory)
	{
		if (!this.isEmpty)
		{
			if (config.disableHistoryTracking)
			{
				this.pop();
			}
			else if (config.historyMode === modes.sessionHistory && History.getWindowState().sidx < this.top.sidx)
			{
				DEBUG("    > stacks out of sync; popping " + (this.top.sidx - History.getWindowState().sidx) + " states to equalize");
				// stack IDs are out of sync, pop our stack until we're back in
				// sync with the window.history
				this.pop(this.top.sidx - History.getWindowState().sidx);
			}
		}

		this.push({ title: passage.title, variables: clone(this.active.variables, true) });
		if (this.prng)
		{
			this.top.rcount = this.prng.count;
		}
		this.activate(this.top);
	}
	if ((updateHistory || config.disableHistoryControls) && config.historyMode !== modes.hashTag)
	{
		DEBUG("    > typeof History.getWindowState(): " + typeof History.getWindowState());
		var stateObj;
		switch (config.historyMode)
		{
		case modes.sessionHistory:
			stateObj = { suid: this.suid, sidx: this.active.sidx };
			break;
		case modes.windowHistory:
			stateObj = { history: this.history };
			if (this.hasOwnProperty("prng"))
			{
				stateObj.rseed = this.prng.seed;
			}
			break;
		}

		History[(!History.hasWindowState() || config.disableHistoryControls)
			? "replaceWindowState"
			: "addWindowState"
		](stateObj, windowTitle);
	}
	if (config.historyMode !== modes.windowHistory)
	{
		this.save();
	}

	// clear <body> classes and execute the PassageReady passage
	if (updateDisplay)
	{
		if (document.body.className)
		{
			document.body.className = "";
		}
		if (tale.has("PassageReady"))
		{
			try
			{
				Wikifier.wikifyEval(tale.get("PassageReady").text);
			}
			catch (e)
			{
				technicalAlert("PassageReady", e.message);
			}
		}
	}

	// add it to the page
	var el = passage.render();
	el.style.visibility = "visible";
	if (updateDisplay)
	{
		var   passages = document.getElementById("passages")
			, outgoing = passages.querySelector(".passage");
		if
		(
			outgoing !== null
			&&
			(
				typeof config.passageTransitionOut === "number"
				|| (typeof config.passageTransitionOut === "boolean" && config.passageTransitionOut && config.transitionEndEventName !== "")
			)
		)
		{
			outgoing.id = "out-" + outgoing.id;
			outgoing.classList.add("transition-out");
			if (typeof config.passageTransitionOut === "boolean")
			{
				$(outgoing).on(config.transitionEndEventName, function () {
					if (this.parentNode) { this.parentNode.removeChild(this); }
				});
			}
			else
			{
				setTimeout(function () {
					if (outgoing.parentNode) { outgoing.parentNode.removeChild(outgoing); }
				}, config.passageTransitionOut);	// in milliseconds
			}
		}
		else
		{
			removeChildren(passages);
		}
		el.classList.add("transition-in");
		passages.appendChild(el);
		setTimeout(function () { el.classList.remove("transition-in"); }, 1);

		if (config.historyMode === modes.hashTag)
		{
			if (config.displayPassageTitles && passage.title !== "Start")
			{
				document.title = windowTitle;
			}
			if (!config.disableHistoryControls)
			{
				window.location.hash = this.hash = this.active.hash;
			}
			else
			{
				session.setItem("activeHash", this.hash = this.active.hash);
			}
		}

		window.scroll(0, 0);
	}

	// execute the PassageDone passage and update the non-passage page elements, if enabled
	if (updateDisplay)
	{
		if (tale.has("PassageDone"))
		{
			try
			{
				Wikifier.wikifyEval(tale.get("PassageDone").text);
			}
			catch (e)
			{
				technicalAlert("PassageDone", e.message);
			}
		}
		if (config.updatePageElements)
		{
			UISystem.setPageElements();
		}
	}

	// handle autosaves
	if (typeof config.saves.autosave !== "undefined")
	{
		if (typeof config.saves.autosave === "boolean")
		{
			if (config.saves.autosave)
			{
				SaveSystem.saveAuto();
			}
		}
		else if (passage.tags.contains(config.saves.autosave))
		{
			SaveSystem.saveAuto();
		}
	}

	return el;
};

History.prototype.regenerateSuid = function ()
{
	DEBUG("[<History>.regenerateSuid()]");
	session.removeItem("activeHistory");
	this.suid = Util.generateUuid();
	this.save();
};

History.prototype.restart = function ()
{
	DEBUG("[<History>.restart()]");
	if (config.historyMode === modes.sessionHistory)
	{
		session.removeItem("activeHistory");
		window.location.reload();
	}
	else if (config.historyMode === modes.windowHistory)
	{
		History.addWindowState(null, tale.title); // using null here is deliberate
		window.location.reload();
	}
	else
	{
		if (!config.disableHistoryControls)
		{
			window.location.hash = "";
		}
		else
		{
			session.removeItem("activeHash");
			window.location.reload();
		}
	}
};

History.prototype.save = function ()
{
	DEBUG("[<History>.save()]");
	if (config.historyMode === modes.sessionHistory)
	{
		DEBUG("    > this.suid: " + this.suid);
		var stateObj = { history: this.history };
		if (this.hasOwnProperty("prng"))
		{
			stateObj.rseed = this.prng.seed;
		}
		if (session.setItem("history." + this.suid, stateObj))
		{
			DEBUG("    > activeHistory: " + this.suid);
			session.setItem("activeHistory", this.suid);
		}
	}
	else if (config.historyMode === modes.hashTag)
	{
		var order = "";

		// encode our history
		for (var i = 0; i < this.history.length; i++)
		{
			var passage = tale.get(this.history[i].title);
			if (passage && typeof passage.id !== "undefined")	// 0 is a valid ID, so typeof it is
			{
				order += passage.id.toString(36) + ".";
			}
		}

		// save to the active & top history (stripping the trailing period)
		this.active.hash = this.top.hash = "#" + order.substr(0, order.length - 1);

		return this.active.hash;
	}
};

History.prototype.restore = function (suid)
{
	DEBUG("[<History>.restore()]");
	if (config.historyMode === modes.sessionHistory)
	{
		if (suid)
		{
			this.suid = suid;
		}
		else
		{
			if (History.hasWindowState() && session.hasItem("activeHistory"))
			{
				this.suid = session.getItem("activeHistory");
			}
			else
			{
				this.suid = Util.generateUuid();
			}
		}
		if (this.suid && session.hasItem("history." + this.suid))
		{
			var   stateObj = session.getItem("history." + this.suid)
				, sidx     = History.getWindowState().sidx;
			DEBUG("    > History.getWindowState().sidx: " + sidx);

			this.history = stateObj.history;
			if (this.hasOwnProperty("prng") && stateObj.hasOwnProperty("rseed"))
			{
				this.prng.seed = stateObj.rseed;
			}
			if (tale.has(this.history[sidx].title))
			{
				this.display(this.history[sidx].title, null, "replace");
				return true;
			}
		}
	}
	else if (config.historyMode === modes.windowHistory)
	{
		DEBUG("    > typeof window.history: "+ typeof window.history);
		DEBUG("    > typeof History.getWindowState(): "+ typeof History.getWindowState());
		if (History.hasWindowState())
		{
			this.history = History.getWindowState().history;
			if (this.hasOwnProperty("prng") && History.getWindowState().hasOwnProperty("rseed"))
			{
				this.prng.seed = History.getWindowState().rseed;
			}
		}
		if (!this.isEmpty && tale.has(this.top.title))
		{
			this.display(this.top.title, null, "replace");
			return true;
		}
	}
	else
	{
		var order;
		if (session.hasItem("activeHash"))
		{
			order = session.getItem("activeHash").replace("#", "").split(".");
		}
		else if (window.location.hash !== "" && window.location.hash !== "#")
		{
			order = window.location.hash.replace("#", "").split(".");
		}
		if (order)
		{
			try
			{
				// render the passages in the order the reader clicked them
				// we only show the very last one
				for (var i = 0, end = order.length - 1; i <= end; i++)
				{
					var id = parseInt(order[i], 36);

					if (!tale.has(id)) { return false; }

					DEBUG("    > id: " + id + " (" + order[i] + ")");

					this.display(id, null, (i === end) ? null : "hidden");
				}

				return true;
			}
			catch (e)
			{
				DEBUG(true, "restore failed", e);
			}
		}
	}
	return false;
};

History.serializeWindowState = function (obj)
{
	return LZString.compressToUTF16(Util.serialize(obj));
};

History.deserializeWindowState = function (obj)
{
	return Util.deserialize(LZString.decompressFromUTF16(obj));
};

History.addWindowState = function (obj, title, url)
{
	// required by IE (if you pass undefined as the URL, IE will happily set it to that, so you must not pass it at all in that case)
	if (url != null) // use lazy equality
	{
		window.history.pushState((obj != null) ? History.serializeWindowState(obj) : null, title, url);
	}
	else
	{
		window.history.pushState((obj != null) ? History.serializeWindowState(obj) : null, title);
	}
};

History.replaceWindowState = function (obj, title, url)
{
	// required by IE (if you pass undefined as the URL, IE will happily set it to that, so you must not pass it at all in that case)
	if (url != null) // use lazy equality
	{
		window.history.replaceState((obj != null) ? History.serializeWindowState(obj) : null, title, url);
	}
	else
	{
		window.history.replaceState((obj != null) ? History.serializeWindowState(obj) : null, title);
	}
};

History.hasWindowState = function (obj)
{
	if (arguments.length === 0) { obj = window.history; }
	return obj.state != null; // use lazy equality
};

History.getWindowState = function (obj)
{
	if (arguments.length === 0) { obj = window.history; }
	return (obj.state != null) ? History.deserializeWindowState(obj.state) : null; // use lazy equality
};

History.popStateHandler_sessionHistory = function (evt)
{
	DEBUG("[History.popStateHandler_sessionHistory()]");
	DEBUG(!History.hasWindowState(evt), "    > evt.state: null; no-op");

	// no-op if state is null
	if (!History.hasWindowState(evt)) { return; }

	// close any open UI dialog
	if (UISystem.isOpen()) { UISystem.close(); }

	var windowState = History.getWindowState(evt);

	// update the history stack if necessary
	if (windowState.suid !== state.suid)
	{
		DEBUG("    > state from previous history detected, swapping in history");
		state.save();
		state.restore(windowState.suid);
	}

	state.display(state.activate(windowState.sidx).title, null, "replace");
};

History.popStateHandler_windowHistory = function (evt)
{
	DEBUG("[History.popStateHandler_windowHistory()]");
	DEBUG(!History.hasWindowState(evt), "    > evt.state: null; no-op");

	// no-op if state is null
	if (!History.hasWindowState(evt)) { return; }

	// close any open UI dialog
	if (UISystem.isOpen()) { UISystem.close(); }

	var windowState = History.getWindowState(evt);

	// throw error if state has no history or history is empty
	if (!windowState.hasOwnProperty("history") || windowState.history.length === 0)
	{
		throw new Error("Window state has no history or history is empty.");
	}

	state.history = windowState.history;
	if (state.hasOwnProperty("prng") && windowState.hasOwnProperty("rseed"))
	{
		state.prng.seed = windowState.rseed;
	}
	state.display(state.activate(state.top).title, null, "replace");
};

History.hashChangeHandler = function (evt)
{
	DEBUG("[History.hashChangeHandler()]");
	DEBUG(window.location.hash === state.hash, "    > noop (window.location.hash === state.hash)");
	DEBUG(window.location.hash !== state.hash, "    > differ, process hash (window.location.hash !== state.hash)");

	if (window.location.hash !== state.hash)
	{
		if (window.location.hash !== "" && window.location.hash !== "#")
		{
			var el = document.getElementById("passages");

			// reset the history, making a copy of the <<remember>> variables
			var remember = storage.getItem("remember");
			window.SugarCube.state = state = new History();
			if (remember !== null) { state.active.variables = clone(remember, true); }
			if (sysconfig.HistoryPRNG.isEnabled) { History.initPRNG(); }

			if (!config.disableHistoryControls)
			{
				el.style.visibility = "hidden";
				removeChildren(el);
				if (!state.restore())
				{
					technicalAlert(null, "The passage you had previously visited could not be found.");
				}
				el.style.visibility = "visible";
			}
			else
			{
				session.setItem("activeHash", state.hash = window.location.hash);
				window.location.hash = "";
				return;
			}
		}
		else
		{
			window.location.reload();
		}
		state.hash = window.location.hash;
	}
};

History.initPRNG = function (seed, useEntropy)
{
	DEBUG("[History.initPRNG()]");

	sysconfig.HistoryPRNG.isEnabled = true;
	state.prng = new SeedablePRNG(seed, useEntropy);
	state.active.rcount = state.prng.count;

	if (!sysconfig.HistoryPRNG.replacedMathPRNG)
	{
		sysconfig.HistoryPRNG.replacedMathPRNG = true;
		Math.random = function () {
			DEBUG("**** HistoryPRNG: Math.random() called!");
			return state.prng.random();
		};
	}
};

History.marshal = function ()
{
	DEBUG("[History.marshal()]");

	var stateObj =
	{
		mode : config.historyMode
	};
	if (state.hasOwnProperty("prng"))
	{
		stateObj.rseed = state.prng.seed;
	}
	switch (config.historyMode)
	{
	case modes.sessionHistory:
		stateObj.history = clone(state.history.slice(0, state.active.sidx + 1), true);
		break;
	case modes.windowHistory:
		stateObj.history = clone(state.history, true);
		break;
	case modes.hashTag:
		stateObj.history = state.active.hash;
		break;
	}

	return stateObj;
};

History.unmarshal = function (stateObj)
{
	DEBUG("[History.unmarshal()]");

	if (!stateObj || !stateObj.hasOwnProperty("mode") || !stateObj.hasOwnProperty("history"))
	{
		throw new Error("State object is missing required data.");
	}
	if (stateObj.mode !== config.historyMode)
	{
		throw new Error("State object is from an incompatible history mode.");
	}

	switch (config.historyMode)
	{
	case modes.windowHistory:
		/* FALL-THROUGH */
	case modes.sessionHistory:
		// necessary?
		document.title = tale.title;

		// start a new state history (do not call init()!)
		window.SugarCube.state = state = new History();
		if (sysconfig.HistoryPRNG.isEnabled)
		{
			History.initPRNG(stateObj.hasOwnProperty("rseed") ? stateObj.rseed : null);
		}
		if (config.historyMode === modes.sessionHistory)
		{
			state.regenerateSuid();
			//DEBUG("    > [History.unmarshal()] this.suid: " + state.suid);
		}

		// restore the history states in order
		for (var i = 0, len = stateObj.history.length; i < len; i++)
		{
			// load the state from the save
			state.history.push(clone(stateObj.history[i], true));

			DEBUG("    > loading: " + i + " (" + state.history[i].title + ")");

			// load the state into the window history
			if (!config.disableHistoryControls)
			{
				var   windowState
					, windowTitle = (config.displayPassageTitles && state.history[i].title !== "Start")
						? tale.title + ": " + state.history[i].title
						: tale.title;
				switch (config.historyMode)
				{
				case modes.sessionHistory:
					windowState = { suid: state.suid, sidx: state.history[i].sidx };
					break;
				case modes.windowHistory:
					windowState = { history: state.history };
					if (state.hasOwnProperty("prng"))
					{
						windowState.rseed = state.prng.seed;
					}
					break;
				}
				History.addWindowState(windowState, windowTitle);
			}
		}

		// activate the current top and display the passage
		state.activate(state.top);
		state.display(state.active.title, null, "replace");
		break;

	case modes.hashTag:
		if (!config.disableHistoryControls)
		{
			window.location.hash = stateObj.history;
		}
		else
		{
			session.setItem("activeHash", stateObj.history);
			window.location.reload();
		}
		break;
	}
};


/***********************************************************************************************************************
** [Passage]
***********************************************************************************************************************/
function Passage(title, el, order)
{
	this.title = title;
	if (el)
	{
		this.id          = order;
		this.domId       = "passage-" + Util.slugify(this.title);
		this.text        = Passage.unescapeLineBreaks(el.firstChild ? el.firstChild.nodeValue : "");
		this.textExcerpt = Passage.getExcerptFromText(this.text);
		this.tags        = el.hasAttribute("tags") ? el.getAttribute("tags").trim() : "";
		if (this.tags)
		{
			this.tags      = this.tags.split(/\s+/);	// readBracketedList();
			this.classes   = [];
			this.className = "";

			// add tags as classes
			if (this.tags.length > 0)
			{
				// tags to skip transforming into classes
				//     "debug"        : special tag
				//     "nobr"         : special tag
				//     "passage"      : the default class
				//     "script"       : special tag
				//     "stylesheet"   : special tag
				//     "widget"       : special tag
				//     "twine.*"      : special tag (in theory, anyway)
				//   ? "twinequest.*" : private use tag
				//   ? "tq.*"         : private use tag, AFAIK shorthand form of twinequest.*
				var tagsToSkip = /^(?:debug|nobr|passage|script|stylesheet|widget|twine\.\w*)$/i;

				var tagClasses = [];
				for (var i = 0; i < this.tags.length; i++)
				{
					var tag = this.tags[i].toLowerCase();
					if (!tagsToSkip.test(tag))
					{
						tagClasses.push(Util.slugify(tag));
					}
				}
				if (tagClasses.length > 0)
				{
					if (el.className)
					{
						tagClasses = tagClasses.concat(el.className.split(/\s+/));
					}
					// sort and filter out non-uniques
					tagClasses = tagClasses.sort().filter(function (val, i, aref) { return (i === 0 || aref[i-1] != val) ? true : false });

					this.classes   = tagClasses;
					this.className = tagClasses.join(' ');
				}
			}
		}
		else
		{
			this.tags      = [];
			this.classes   = [];
			this.className = "";
		}
	}
	else
	{
		this.text      = String.format('<span class="error" title="{0}">Error: this passage does not exist: {0}</span>',
							this.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
		this.tags      = [];
		this.classes   = [];
		this.className = "";
	}
}

Passage.prototype.processText = function ()
{
	var res = this.text;

	if (this.tags.contains("nobr"))
	{
		res = res.replace(/\n/g, " ");
	}
	// check for Twine 1.4 Base64 image passage transclusion
	if (this.tags.contains("Twine.image"))
	{
		res = "[img[" + res + "]]";
	}
	return res;
};

Passage.prototype.render = function ()
{
	DEBUG("[<Passage>.render()]");

	// create the new passage element
	var passage = insertElement(null, "section", this.domId, "passage");
	passage.setAttribute("data-passage", this.title);
	passage.style.visibility = "hidden";

	// add classes (generated from tags) to the passage and <body>
	for (var i = 0, len = this.classes.length; i < len; i++)
	{
		document.body.classList.add(this.classes[i]);
		passage.classList.add(this.classes[i]);
	}

	// add the passage header, content, and footer elements
	insertElement(passage, "header", null, "header");
	var content = insertElement(passage, "div", null, "body content");
	insertElement(passage, "footer", null, "footer");

	// execute pre-render tasks
	for (var task in prerender)
	{
		if (typeof prerender[task] === "function") { prerender[task].call(this, content, task); }
	}

	// wikify the passage into the content element
	new Wikifier(content, this.processText());

	// execute post-render tasks
	for (var task in postrender)
	{
		if (typeof postrender[task] === "function") { postrender[task].call(this, content, task); }
	}

	// update the excerpt cache to reflect the rendered text
	this.textExcerpt = Passage.getExcerptFromNode(content);

	return passage;
};

Passage.prototype.reset = function ()
{
	/**
	 * This method should never be called, so this code is largely redundant
	 *   n.b. <Tale>.reset() does call this method, but nothing calls it, so...
	 */
	var store = document.getElementById("store-area").childNodes;
	for (var i = 0; i < store.length; i++)
	{
		var   el = store[i]
			, tiddlerTitle;
		if (el.getAttribute && (tiddlerTitle = el.getAttribute("tiddler")))
		{
			if (this.title === tiddlerTitle)
			{
				this.text = Passage.unescapeLineBreaks(el.firstChild ? el.firstChild.nodeValue : "");
				return;
			}
		}
	}
	this.text = "<html><span class=\"error\">Error: this passage does not exist</span></html>";
};

Passage.prototype.excerpt = function ()
{
	return this.textExcerpt;
};

Passage.getExcerptFromText = function (text, count)
{
	var   pattern = new RegExp("(\\S+(?:\\s+\\S+){0," + (typeof count !== 'undefined' ? count - 1 : 7) + "})")
		, result  = text
			// strip macro tags (replace with a space)
			.replace(/<<.*?>>/g, " ")
			// strip html tags (replace with a space)
			.replace(/<.*?>/g, " ")
			// the above might have left problematic whitespace, so trim
			.trim()
			// strip wiki tables
			.replace(/^\s*\|.*\|.*?$/gm, "")
			// strip wiki images
			.replace(/\[[<>]?img\[[^\]]*\]\]/g, "")
			// clean wiki links, i.e. remove all but the pretty link text
			.replace(/\[\[([^|\]]*)(?:|[^\]]*)?\]\]/g, "$1")
			// clean wiki !headings
			.replace(/^\s*!+(.*?)$/gm, "$1")
			// clean wiki bold/italic/underline/highlight formatting
			.replace(/\'{2}|\/{2}|_{2}|@{2}/g, "")
			// compact remaining whitespace
			.replace(/\s+/g, " ")
			// a final trim
			.trim()
			// lastly, match the excerpt
			.match(pattern);
	return (result ? result[1] + "\u2026" : "\u2026");
};

Passage.getExcerptFromNode = function (node, count)
{
	function getTextFromNode(node)
	{
		if (!node.hasChildNodes()) { return ""; }

		var   nodes  = node.childNodes
			, output = "";

		for (var i = 0, len = nodes.length; i < len; i++)
		{
			switch (nodes[i].nodeType)
			{
			case 1:	// element nodes
				if (nodes[i].style.display !== "none")
				{
					output += " ";	// out here to handle void nodes, in addition to child bearing nodes
					if (nodes[i].hasChildNodes())
					{
						output += getTextFromNode(nodes[i]);
					}
				}
				break;
			case 3:	// text nodes
				output += nodes[i].textContent;
				break;
			default:
				DEBUG(" ~> nodes[" + i + "].nodeType: " + nodes[i].nodeType);
				break;
			}
		}
		return output;
	}

	if (!node.hasChildNodes()) { return ""; }

	var   excerptRe = new RegExp("(\\S+(?:\\s+\\S+){0," + (typeof count !== 'undefined' ? count - 1 : 7) + "})")
		, excerpt   = getTextFromNode(node).trim();

	if (excerpt)
	{
		excerpt = excerpt
			// compact whitespace
			.replace(/\s+/g, " ")
			// attempt to match the excerpt regexp
			.match(excerptRe);
	}
	return (excerpt ? excerpt[1] + "\u2026" : "\u2026");
};

Passage.unescapeLineBreaks = function (text)
{
	if (text && text !== "")
	{
		return text
			.replace(/\\n/gm, '\n')
			.replace(/\\t/gm, '\t')		// Twine 1.4.1 "feature"
			.replace(/\\s|\\/gm, '\\')	// "\\s" is required to workaround a Twine "feature"
			.replace(/\r/gm, "");
	}
	else
	{
		return "";
	}
};

Passage.mergeClassNames = function (/* variadic */)
{
	if (arguments.length == 0) { return ""; }

	var classes = [];
	for (var i = 0; i < arguments.length; i++)
	{
		if (typeof arguments[i] === "object" && Array.isArray(arguments[i]))
		{
			classes = classes.concat(arguments[i]);
		}
		else if (typeof arguments[i] === "string")
		{
			classes = classes.concat(arguments[i].split(/\s+/));
		}
	}
	if (classes.length > 0)
	{
		// return a string of sorted, and unique, class names
		return classes
			.sort()
			.filter(function (val, i, aref) { return (i == 0 || aref[i-1] != val) ? true : false })
			.join(' ');
	}
	return "";
};


/***********************************************************************************************************************
** [Tale]
***********************************************************************************************************************/
function Tale()
{
	DEBUG("[Tale()]");

	this.passages = {};
	// Chrome breaks some data URLs if you don't normalize
	if (document.normalize)
	{
		document.normalize();
	}
	var store = document.getElementById("store-area").childNodes;

	for (var i = 0; i < store.length; i++)
	{
		var   el = store[i]
			, tiddlerTitle;
		if (el.getAttribute && (tiddlerTitle = el.getAttribute("tiddler")))
		{
			this.passages[tiddlerTitle] = new Passage(tiddlerTitle, el, i);
		}
	}

	if (this.passages.hasOwnProperty("StoryTitle"))
	{
		var buf = document.createElement("div");
		new Wikifier(buf, this.passages.StoryTitle.processText().trim());
		this.setTitle(buf.textContent);
	}
	else
	{
		this.setTitle("Untitled Story");
	}

}

Tale.prototype.setTitle = function (title)
{
	this.title = document.title = title;
	this.domId = Util.slugify(title);
};

Tale.prototype.has = function (key)
{
	if (typeof key === "string")
	{
		return this.passages[key] != null;	// use lazy equality
	}
	else if (typeof key === "number")
	{
		for (var pname in this.passages)
		{
			if (this.passages[pname].id === key)
			{
				return true;
			}
		}
	}
	return false;
};

Tale.prototype.get = function (key)
{
	if (typeof key === "string")
	{
		return this.passages[key] || new Passage(key);
	}
	else if (typeof key === "number")
	{
		for (var pname in this.passages)
		{
			if (this.passages[pname].id === key)
			{
				return this.passages[pname];
			}
		}
	}
	return;	//FIXME: should this return null instead of undefined?
};

Tale.prototype.lookup = function (key, value, sortKey)
{
	if (!sortKey) { sortKey = "title"; }
	var results = [];

	for (var pname in this.passages)
	{
		var passage = this.passages[pname];

		switch (typeof passage[key])
		{
		case "undefined":
			/* noop */
			break;
		case "object":
			// currently, we assume that the only properties which are objects
			// will be either arrays or array-like-objects
			for (var i = 0; i < passage[key].length; i++)
			{
				if (passage[key][i] == value)	// use lazy equality
				{
					results.push(passage);
					break;
				}
			}
			break;
		default:
			if (passage[key] == value)	// use lazy equality
			{
				results.push(passage);
			}
			break;
		}
	}

	results.sort(function (a, b) { return (a[sortKey] == b[sortKey]) ? 0 : ((a[sortKey] < b[sortKey]) ? -1 : +1); });	// use lazy equality

	return results;
};

Tale.prototype.reset = function ()
{
	/**
	 * This method should never be called, so this code is largely redundant
	 */
	for (var i in this.passages)
	{
		this.passages[i].reset();
	}
};


/***********************************************************************************************************************
** [End story.js]
***********************************************************************************************************************/
