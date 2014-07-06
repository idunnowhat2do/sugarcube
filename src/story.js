/***********************************************************************************************************************
** [Begin story.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [History]
***********************************************************************************************************************/
function History(instanceName) {
	if (DEBUG) {
		console.log("[History()]");
		console.log("    > config.historyMode: " + (config.historyMode === HistoryMode.Hash ? "Hash" : (config.historyMode === HistoryMode.Window ? "Window" : "Session")));
		if (History.getWindowState()) {
			if (config.historyMode === HistoryMode.Session) {
				console.log("    > History.getWindowState(): " + History.getWindowState().sidx + " / " + History.getWindowState().suid);
			} else if (config.historyMode === HistoryMode.Window) {
				//console.log("    > History.getWindowState(): " + History.getWindowState().history.length);
				console.log("    > History.getWindowState(): " + History.getWindowState().delta.length);
			}
		} else {
				console.log("    > History.getWindowState(): " + History.getWindowState());
		}
	}

	// currently active/displayed state
	this.active = { init : true, variables : {} };  // allows macro initialization to set variables at startup

	// current hash, if in Hash mode
	if (config.historyMode === HistoryMode.Hash) {
		this.hash = "";
	}

	// history state stack
	//     Session [{ title : null, variables : {}, sidx : null }]
	//     Window  [{ title : null, variables : {} }]
	//     Hash    [{ title : null, variables : {} }]
	this.history = [];

	// update instance reference in SugarCube global object
	window.SugarCube[instanceName || "state"] = this;
}

// setup some getters
History.prototype = {
	get top ()     { return (this.history.length !== 0) ? this.history[this.history.length - 1] : null; },
	get bottom ()  { return (this.history.length !== 0) ? this.history[0] : null; },
	get isEmpty () { return this.history.length === 0; },
	get length ()  { return (config.historyMode === HistoryMode.Session) ? this.active.sidx + 1 : this.history.length; }
};

/*
History.prototype.clone = function (at) {
	if (this.isEmpty) { return null; }
	at = 1 + (at ? Math.abs(at) : 0);
	if (at > this.history.length) { return null; }

	var dup = clone(this.history[this.history.length - at]);
	if (config.historyMode === HistoryMode.Session) {
		delete dup.sidx;
	}
	return dup;
};
*/

History.prototype.getDeltaFromHistory = function (end) {
	return History.deltaEncodeHistory(end != null ? this.history.slice(0, end) : this.history);  // use lazy equality on null check
};

History.prototype.setHistoryFromDelta = function (delta) {
	this.history = History.deltaDecodeHistory(delta);
};

History.prototype.index = function (idx) {
	if (this.isEmpty) { return null; }
	if (idx < 0 || idx >= this.length) { return null; }

	return this.history[idx];
};

History.prototype.peek = function (at) {
	if (this.isEmpty) { return null; }
	at = 1 + (at ? Math.abs(at) : 0);
	if (at > this.length) { return null; }

	return this.history[this.length - at];
};

History.prototype.push = function (/* variadic */) {
	if (arguments.length === 0) { return; }  // maybe throw?

	for (var i = 0; i < arguments.length; i++) {
		var state = arguments[i];
		if (config.historyMode === HistoryMode.Session) {
			state.sidx = this.history.length;
		}
		this.history.push(state);
	}
	return this.history.length;
};

History.prototype.pop = function (num) {
	if (this.isEmpty) { return []; }
	num = num ? Math.abs(num) : 1;
	//if (num > this.history.length) { return []; }

	return (num === 1) ? this.history.pop() : this.history.splice(this.history.length - num, num);
};

History.prototype.activate = function (state) {
	if (arguments.length === 0) { return; }  // maybe throw?
	if (state == null) { throw new Error("state activation attempted with null/undefined"); }  // use lazy equality

	if (typeof state === "object") {
		this.active = clone(state);
	} else {
		if (this.isEmpty) { return null; }
		if (state < 0 || state >= this.history.length) { return null; }
		this.active = clone(this.history[state]);
	}
	if (this.prng) {
		this.prng = SeedablePRNG.unmarshal({
			seed  : this.prng.seed,
			count : this.active.rcount
		});
	}

	return this.active;
};

History.prototype.init = function () {
	if (DEBUG) { console.log("[<History>.init()]"); }

	// display the initial passage
	if (typeof testPlay !== "undefined" && testPlay !== "") {
		// enables the Twine 1.4+ "Test Play From Here" feature
		if (DEBUG) { console.log('    > display: "' + testPlay + '" (testPlay)'); }
		this.display(testPlay);
	} else if (!this.restore()) {
		if (DEBUG) { console.log('    > display: "' + config.startPassage + '"'); }
		this.display(config.startPassage);
	}

	// setup the history change handlers
	//   n.b. do not update these to use jQuery; the "popstate" event gains
	//        nothing from being wrapped in the jQuery Event object and it would
	//        complicate either the handlers, by having to deal with it, or the
	//        jQuery Event object, if we pushed the properties we need onto it
	if (config.historyMode === HistoryMode.Session) {
		window.addEventListener("popstate", History.popStateHandler_Session, false);
	} else if (config.historyMode === HistoryMode.Window) {
		window.addEventListener("popstate", History.popStateHandler_Window, false);
	} else {
		window.addEventListener("hashchange", History.hashChangeHandler, false);
	}
};

History.prototype.display = function (title, link, option) {
	if (DEBUG) { console.log("[<History>.display()]"); }

	// process option
	var updateDisplay = (option === "hidden" || option === "offscreen" || option === "quietly" || option === false) ? false : true,
		updateHistory = (option === "replace" || option === "back") ? false : true;

	// reset the runtime temp/scratch object
	runtime.temp = {};

	// n.b. the title parameter can either be a passage title (string) or passage ID (number), so
	//      after loading the passage, always refer to passage.title and never the title parameter
	var passage     = tale.get(title),
		windowTitle = (config.displayPassageTitles && passage.title !== config.startPassage)
			? tale.title + ": " + passage.title
			: tale.title;

	// ensure that this.active is set if we have history
	if (this.active.init && !this.isEmpty) {
		if (config.historyMode === HistoryMode.Session) {
			if (DEBUG) {
				console.log("    [S]> state.active.init && !state.isEmpty; activating: "
					+ (History.hasWindowState() ? "History.getWindowState().sidx = " + History.getWindowState().sidx : "state.top"));
			}
			this.activate(History.hasWindowState() ? History.getWindowState().sidx : this.top);
		} else {
			if (DEBUG) {
				if (config.historyMode === HistoryMode.Window) {
					console.log("    [W]> state.active.init && !state.isEmpty; activating: state.top");
				} else {
					console.log("    [H]> state.active.init && !state.isEmpty; activating: state.top");
				}
			}
			this.activate(this.top);
		}
	}

	// create a fresh entry in the history
	if (updateHistory) {
		if (!this.isEmpty) {
			if (config.disableHistoryTracking) {
				this.pop();
			} else if (config.historyMode === HistoryMode.Session && History.getWindowState().sidx < this.top.sidx) {
				if (DEBUG) { console.log("    > stacks out of sync; popping " + (this.top.sidx - History.getWindowState().sidx) + " states to equalize"); }
				// stack IDs are out of sync, pop our stack until we're back in
				// sync with the window.history
				this.pop(this.top.sidx - History.getWindowState().sidx);
			}
		}

		this.push({ title : passage.title, variables : clone(this.active.variables) });
		if (this.prng) {
			this.top.rcount = this.prng.count;
		}
		this.activate(this.top);
	}
	if ((updateHistory || config.disableHistoryControls) && config.historyMode !== HistoryMode.Hash) {
		if (DEBUG) { console.log("    > typeof History.getWindowState(): " + typeof History.getWindowState()); }
		var stateObj;
		if (config.historyMode === HistoryMode.Session) {
			stateObj = { suid : this.suid, sidx : this.active.sidx };
		} else {  // HistoryMode.Window
			stateObj = { delta : this.getDeltaFromHistory() };
			if (this.hasOwnProperty("prng")) {
				stateObj.rseed = this.prng.seed;
			}
		}
		History[(!History.hasWindowState() || config.disableHistoryControls)
			? "replaceWindowState"
			: "addWindowState"
		](stateObj, windowTitle);
	}
	if (config.historyMode !== HistoryMode.Window) {
		this.save();
	}

	// clear <body> classes and execute the PassageReady passage
	if (updateDisplay) {
		if (document.body.className) {
			document.body.className = "";
		}
		if (tale.has("PassageReady")) {
			try {
				Wikifier.wikifyEval(tale.get("PassageReady").text);
			} catch (e) {
				technicalAlert("PassageReady", e.message);
			}
		}
	}

	// add it to the page
	var el = passage.render();
	el.style.visibility = "visible";
	if (updateDisplay) {
		var passages = document.getElementById("passages"),
			outgoing = passages.querySelector(".passage");
		if (
			   outgoing !== null
			&& (
				   typeof config.passageTransitionOut === "number"
				|| (typeof config.passageTransitionOut === "boolean" && config.passageTransitionOut && config.transitionEndEventName !== "")
			)
		) {
			outgoing.id = "out-" + outgoing.id;
			outgoing.classList.add("transition-out");
			if (typeof config.passageTransitionOut === "boolean") {
				$(outgoing).on(config.transitionEndEventName, function () {
					if (this.parentNode) { this.parentNode.removeChild(this); }
				});
			} else {
				setTimeout(function () {
					if (outgoing.parentNode) { outgoing.parentNode.removeChild(outgoing); }
				}, config.passageTransitionOut);  // in milliseconds
			}
		} else {
			removeChildren(passages);
		}
		el.classList.add("transition-in");
		passages.appendChild(el);
		setTimeout(function () { el.classList.remove("transition-in"); }, 1);

		if (config.displayPassageTitles && passage.title !== config.startPassage) {
			document.title = windowTitle;
		}

		if (config.historyMode === HistoryMode.Hash) {
			window.location.hash = this.hash;
		}

		window.scroll(0, 0);
	}

	// execute the PassageDone passage and update the non-passage page elements, if enabled
	if (updateDisplay) {
		if (tale.has("PassageDone")) {
			try {
				Wikifier.wikifyEval(tale.get("PassageDone").text);
			} catch (e) {
				technicalAlert("PassageDone", e.message);
			}
		}
		if (config.updatePageElements) {
			UISystem.setPageElements();
		}
	}

	// handle autosaves
	if (typeof config.saves.autosave !== "undefined") {
		switch (typeof config.saves.autosave) {
		case "boolean":
			if (config.saves.autosave) {
				SaveSystem.saveAuto();
			}
			break;
		case "string":
			if (passage.tags.contains(config.saves.autosave)) {
				SaveSystem.saveAuto();
			}
			break;
		case "object":
			if (Array.isArray(config.saves.autosave) && passage.tags.some(function (v) { return config.saves.autosave.contains(v); })) {
				SaveSystem.saveAuto();
			}
			break;
		}
	}

	return el;
};

History.prototype.regenerateSuid = function () {
	if (DEBUG) { console.log("[<History>.regenerateSuid()]"); }
	this.suid = UUID.generate();
	this.save();
};

History.prototype.restart = function () {
	if (DEBUG) { console.log("[<History>.restart()]"); }
	if (config.historyMode !== HistoryMode.Hash) {
		History.addWindowState(null, tale.title);  // using null here is deliberate
		window.location.reload();
	} else {
		window.location.hash = "";
	}
};

History.prototype.save = function () {
	if (DEBUG) { console.log("[<History>.save()]"); }
	var stateObj = { delta : this.getDeltaFromHistory() };
	if (this.hasOwnProperty("prng")) {
		stateObj.rseed = this.prng.seed;
	}
	if (config.historyMode === HistoryMode.Session) {
		if (DEBUG) { console.log("    > this.suid: " + this.suid); }
		session.setItem("history." + this.suid, stateObj);
	} else if (config.historyMode === HistoryMode.Hash) {
		this.hash = History.serializeWindowHashState(stateObj);
	}
};

History.prototype.restore = function (suid) {
	if (DEBUG) { console.log("[<History>.restore()]"); }
	if (config.historyMode === HistoryMode.Session) {
		if (suid) {
			this.suid = suid;
		} else {
			if (History.hasWindowState()) {
				this.suid = History.getWindowState().suid;
			} else {
				this.suid = UUID.generate();
			}
		}
		if (this.suid && session.hasItem("history." + this.suid)) {
			var stateObj = session.getItem("history." + this.suid),
				sidx     = History.getWindowState().sidx;
			if (DEBUG) { console.log("    > History.getWindowState(): " + History.getWindowState().sidx + " / " + History.getWindowState().suid); }
			if (DEBUG) { console.log("    > history." + this.suid + ": " + JSON.stringify(stateObj)); }

			this.setHistoryFromDelta(stateObj.delta);
			if (this.hasOwnProperty("prng") && stateObj.hasOwnProperty("rseed")) {
				this.prng.seed = stateObj.rseed;
			}
			if (tale.has(this.history[sidx].title)) {
				this.display(this.history[sidx].title, null, "replace");
				return true;
			}
		}
	} else if (config.historyMode === HistoryMode.Window) {
		if (DEBUG) {
			console.log("    > typeof window.history: " + typeof window.history);
			console.log("    > typeof History.getWindowState(): " + typeof History.getWindowState());
		}
		if (History.hasWindowState()) {
			var windowState = History.getWindowState();
			this.setHistoryFromDelta(windowState.delta);
			if (this.hasOwnProperty("prng") && windowState.hasOwnProperty("rseed")) {
				this.prng.seed = windowState.rseed;
			}
		}
		if (!this.isEmpty && tale.has(this.top.title)) {
			this.display(this.top.title, null, "replace");
			return true;
		}
	} else {
		if (History.hasWindowHashState()) {
			if (DEBUG) {
				console.log("    > History.hasWindowHashState(): true");
				console.log("    > (!this.hash): " + !this.hash);
			}
			if (!this.hash) {
				// manually call the "hashchange" event handler to handle page reloads
				History.hashChangeHandler();
			}
			return true;
		}
	}
	return false;
};

History.serializeWindowState = function (obj) {
	return LZString.compressToUTF16(JSON.stringify(obj));
};

History.deserializeWindowState = function (obj) {
	return JSON.parse(LZString.decompressFromUTF16(obj));
};

History.addWindowState = function (obj, title, url) {
	// required by IE (if you pass undefined as the URL, IE will happily set it to that, so you must not pass it at all in that case)
	if (url != null) {  // use lazy equality
		window.history.pushState((obj != null) ? History.serializeWindowState(obj) : null, title, url);
	} else {
		window.history.pushState((obj != null) ? History.serializeWindowState(obj) : null, title);
	}
};

History.replaceWindowState = function (obj, title, url) {
	// required by IE (if you pass undefined as the URL, IE will happily set it to that, so you must not pass it at all in that case)
	if (url != null) {  // use lazy equality
		window.history.replaceState((obj != null) ? History.serializeWindowState(obj) : null, title, url);
	} else {
		window.history.replaceState((obj != null) ? History.serializeWindowState(obj) : null, title);
	}
};

History.hasWindowState = function (obj) {
	if (arguments.length === 0) { obj = window.history; }
	return obj.state != null;  // use lazy equality
};

History.getWindowState = function (obj) {
	if (arguments.length === 0) { obj = window.history; }
	return (obj.state != null) ? History.deserializeWindowState(obj.state) : null;  // use lazy equality
};

History.serializeWindowHashState = function (obj) {
	return "#" + (LZString.compressToBase64(JSON.stringify(obj))
		.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ".")
	);
};

History.deserializeWindowHashState = function (obj) {
	return JSON.parse(LZString.decompressFromBase64(obj.slice(1)
		.replace(/\-/g, "+").replace(/_/g, "/").replace(/\./g, "=")
	));
};

History.hasWindowHashState = function (hash) {
	if (arguments.length === 0) { hash = window.location.hash; }
	return (hash !== "" && hash !== "#");
};

History.getWindowHashState = function (hash) {
	if (arguments.length === 0) { hash = window.location.hash; }
	return (hash !== "" && hash !== "#") ? History.deserializeWindowHashState(hash) : null;
};

History.popStateHandler_Session = function (evt) {
	if (DEBUG) {
		console.log("[History.popStateHandler_Session()]");
		if (!History.hasWindowState(evt)) { console.log("    > evt.state: null; no-op"); }
	}

	// no-op if state is null
	if (!History.hasWindowState(evt)) { return; }

	// close any open UI dialog
	if (UISystem.isOpen()) { UISystem.close(); }

	var windowState = History.getWindowState(evt);

	// update the history stack if necessary
	if (windowState.suid !== state.suid) {
		if (DEBUG) { console.log("    > state from previous history detected, swapping in history"); }
		state.save();
		state.restore(windowState.suid);
	}

	state.display(state.activate(windowState.sidx).title, null, "replace");
};

History.popStateHandler_Window = function (evt) {
	if (DEBUG) {
		console.log("[History.popStateHandler_Window()]");
		if (!History.hasWindowState(evt)) { console.log("    > evt.state: null; no-op"); }
	}

	// no-op if state is null
	if (!History.hasWindowState(evt)) { return; }

	// close any open UI dialog
	if (UISystem.isOpen()) { UISystem.close(); }

	var windowState = History.getWindowState(evt);

	// throw error if state has no history or history is empty
	if (!windowState.hasOwnProperty("delta") || windowState.delta.length === 0) {
		throw new Error("window state has no history or history is empty");
	}

	//state.history = windowState.history;
	state.setHistoryFromDelta(windowState.delta);
	if (state.hasOwnProperty("prng") && windowState.hasOwnProperty("rseed")) {
		state.prng.seed = windowState.rseed;
	}
	state.display(state.activate(state.top).title, null, "replace");
};

History.hashChangeHandler = function (evt) {
	if (DEBUG) {
		console.log("[History.hashChangeHandler()]");
		//console.log("    > evt:", evt);
		if (window.location.hash === state.hash) {
			console.log("    > noop (window.location.hash === state.hash)");
		} else {
			console.log("    > process hash (window.location.hash !== state.hash)");
		}
		//console.log("    > window.location.hash:", window.location.hash);
		//console.log("    > state.hash:", state.hash);
	}

	// no-op if hashes match
	if (window.location.hash === state.hash) { return; }

	if (History.hasWindowHashState()) {
		// close any open UI dialog
		if (UISystem.isOpen()) { UISystem.close(); }

		var hashState = History.getWindowHashState();
//console.log("hashState:", hashState);

		// throw error if state has no history or history is empty
		if (!hashState.hasOwnProperty("delta") || hashState.delta.length === 0) {
			throw new Error("hash state has no history or history is empty");
		}

		state.setHistoryFromDelta(hashState.delta);
		if (state.hasOwnProperty("prng") && hashState.hasOwnProperty("rseed")) {
			state.prng.seed = hashState.rseed;
		}
		state.display(state.activate(state.top).title, null, "replace");
	} else {
//console.log("**** ALERT! ALERT! DANGER, WILL ROBINSON! DANGER! ****  (window.location.hash !== state.hash && !History.hasWindowHashState())");
//console.log("    > window.location.hash:", window.location.hash);
//console.log("    > state.hash:", state.hash);
		window.location.reload();
	}
	if (window.location.hash !== state.hash) {
//console.log("**** ASSIGNING window.location.hash TO state.hash ****  (window.location.hash !== state.hash)");
		state.hash = window.location.hash;
	}
};

History.initPRNG = function (seed, useEntropy) {
	if (DEBUG) { console.log("[History.initPRNG()]"); }

	runtime.flags.HistoryPRNG.isEnabled = true;
	state.prng = new SeedablePRNG(seed, useEntropy);
	state.active.rcount = state.prng.count;

	if (!runtime.flags.HistoryPRNG.isMathPRNG) {
		runtime.flags.HistoryPRNG.isMathPRNG = true;
		Math.random = function () {
			if (DEBUG) { console.log("**** state.prng.random() called via Math.random() ****"); }
			return state.prng.random();
		};
	}
};

History.deltaEncodeHistory = function (hist) {
	if (!Array.isArray(hist)) { return null; }
	if (hist.length === 0) { return []; }

	var delta = [ clone(hist[0]) ];
	for (var i = 1, len = hist.length; i < len; i++) {
		delta.push(Util.diff(hist[i-1], hist[i]));
	}
	return delta;
};

History.deltaDecodeHistory = function (delta) {
	if (!Array.isArray(delta)) { return null; }
	if (delta.length === 0) { return []; }

	var hist = [ clone(delta[0]) ];
	for (var i = 1, len = delta.length; i < len; i++) {
		hist.push(Util.patch(hist[i-1], delta[i]));
	}
	return hist;
};

History.marshal = function () {
	if (DEBUG) { console.log("[History.marshal()]"); }

	var stateObj = { mode : config.historyMode };
	if (state.hasOwnProperty("prng")) {
		stateObj.rseed = state.prng.seed;
	}
	if (config.historyMode === HistoryMode.Session) {
		stateObj.history = clone(state.history.slice(0, state.active.sidx + 1));
	} else {
		stateObj.history = clone(state.history);
	}
	return stateObj;
};

History.unmarshal = function (stateObj) {
	if (DEBUG) { console.log("[History.unmarshal()]"); }

	if (!stateObj || !stateObj.hasOwnProperty("mode") || !(stateObj.hasOwnProperty("history") || stateObj.hasOwnProperty("delta"))) {
		throw new Error("state object is missing required data");
	}
	if (stateObj.mode !== config.historyMode) {
		throw new Error("state object is from an incompatible history mode");
	}

	// necessary?
	document.title = tale.title;

	// reset the history
	state = new History();
	if (runtime.flags.HistoryPRNG.isEnabled) {
		History.initPRNG(stateObj.hasOwnProperty("rseed") ? stateObj.rseed : null);
	}
	if (config.historyMode === HistoryMode.Session) {
		state.regenerateSuid();
		//if (DEBUG) { console.log("    > this.suid: " + state.suid); }
	}

	// load the state history from the save
	state.history = clone(stateObj.history);

	// restore the window history states (in order)
	if (config.historyMode !== HistoryMode.Hash) {
		for (var i = 0, len = state.history.length; i < len; i++) {
			if (DEBUG) { console.log("    > loading state into window history: " + i + " (" + state.history[i].title + ")"); }

			// load the state into the window history
			if (!config.disableHistoryControls) {
				var windowState,
					windowTitle = (config.displayPassageTitles && state.history[i].title !== config.startPassage)
						? tale.title + ": " + state.history[i].title
						: tale.title;
				switch (config.historyMode) {
				case HistoryMode.Session:
					windowState = { suid : state.suid, sidx : state.history[i].sidx };
					break;
				case HistoryMode.Window:
					windowState = { delta : state.getDeltaFromHistory(i + 1) };
					if (state.hasOwnProperty("prng")) {
						windowState.rseed = state.prng.seed;
					}
					break;
				}
				History.addWindowState(windowState, windowTitle);
			}
		}
	}

	// activate the current top and display the passage
	state.activate(state.top);
	state.display(state.active.title, null, "replace");
};


/***********************************************************************************************************************
** [Passage]
***********************************************************************************************************************/
function Passage(title, el, order) {
	this.title = title;
	if (el) {
		this.id          = order;
		this.domId       = "passage-" + Util.slugify(this.title);
		this.text        = Passage.unescapeLineBreaks(el.firstChild ? el.firstChild.nodeValue : "");
		this.textExcerpt = Passage.getExcerptFromText(this.text);
		this.tags        = el.hasAttribute("tags") ? el.getAttribute("tags").trim() : "";
		if (this.tags) {
			this.tags      = this.tags.split(/\s+/);  // readBracketedList();
			this.classes   = [];
			this.className = "";

			// add tags as classes
			if (this.tags.length > 0) {
				// tags to skip transforming into classes
				//     "debug"        : special tag
				//     "nobr"         : special tag
				//     "passage"      : the default class
				//     "script"       : special tag
				//     "stylesheet"   : special tag
				//     "widget"       : special tag
				//     "twine.*"      : special tag (in theory, anyway)
				//  ?? "twinequest.*" : private use tag
				//  ?? "tq.*"         : private use tag, AFAIK shorthand form of twinequest.*
				var tagsToSkip = /^(?:debug|nobr|passage|script|stylesheet|widget|twine\.\w*)$/i;

				var tagClasses = [];
				for (var i = 0; i < this.tags.length; i++) {
					var tag = this.tags[i].toLowerCase();
					if (!tagsToSkip.test(tag)) {
						tagClasses.push(Util.slugify(tag));
					}
				}
				if (tagClasses.length > 0) {
					if (el.className) {
						tagClasses = tagClasses.concat(el.className.split(/\s+/));
					}
					// sort and filter out non-uniques
					tagClasses = tagClasses.sort().filter(function (val, i, aref) { return (i === 0 || aref[i-1] !== val); });

					this.classes   = tagClasses;
					this.className = tagClasses.join(' ');
				}
			}
		} else {
			this.tags      = [];
			this.classes   = [];
			this.className = "";
		}
	} else {
		this.text      = String.format('<span class="error" title="{0}">Error: this passage does not exist: {0}</span>',
							this.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
		this.tags      = [];
		this.classes   = [];
		this.className = "";
	}
}

Passage.prototype.processText = function () {
	var res = this.text;

	if (this.tags.contains("nobr")) {
		res = res.replace(/\n/g, " ");
	}
	// check for Twine 1.4 Base64 image passage transclusion
	if (this.tags.contains("Twine.image")) {
		res = "[img[" + res + "]]";
	}
	return res;
};

Passage.prototype.render = function () {
	if (DEBUG) { console.log("[<Passage>.render()]"); }

	// create the new passage element
	var passage = insertElement(null, "section", this.domId, "passage");
	passage.setAttribute("data-passage", this.title);
	passage.style.visibility = "hidden";

	// add classes (generated from tags) to the passage and <body>
	for (var i = 0, len = this.classes.length; i < len; i++) {
		document.body.classList.add(this.classes[i]);
		passage.classList.add(this.classes[i]);
	}

	// add the passage header, content, and footer elements
	insertElement(passage, "header", null, "header");
	var content = insertElement(passage, "div", null, "body content");
	insertElement(passage, "footer", null, "footer");

	// execute pre-render tasks
	for (var task in prerender) {
		if (typeof prerender[task] === "function") { prerender[task].call(this, content, task); }
	}

	// wikify the passage into the content element
	new Wikifier(content, this.processText());

	// execute post-render tasks
	for (var task in postrender) {
		if (typeof postrender[task] === "function") { postrender[task].call(this, content, task); }
	}

	// update the excerpt cache to reflect the rendered text
	this.textExcerpt = Passage.getExcerptFromNode(content);

	return passage;
};

Passage.prototype.reset = function () {
	/**
	 * This method should never be called, so this code is largely redundant
	 *   n.b. <Tale>.reset() does call this method, but nothing calls it, so...
	 */
	var store = document.getElementById("store-area").childNodes;
	for (var i = 0; i < store.length; i++) {
		var el = store[i],
			tiddlerTitle;
		if (el.getAttribute && (tiddlerTitle = el.getAttribute("tiddler"))) {
			if (this.title === tiddlerTitle) {
				this.text = Passage.unescapeLineBreaks(el.firstChild ? el.firstChild.nodeValue : "");
				return;
			}
		}
	}
	this.text = "<html><span class=\"error\">Error: this passage does not exist</span></html>";
};

Passage.prototype.excerpt = function () {
	return this.textExcerpt;
};

Passage.getExcerptFromText = function (text, count) {
	var pattern = new RegExp("(\\S+(?:\\s+\\S+){0," + (typeof count !== 'undefined' ? count - 1 : 7) + "})"),
		result  = text
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

Passage.getExcerptFromNode = function (node, count) {
	function getTextFromNode(node) {
		if (!node.hasChildNodes()) { return ""; }

		var nodes  = node.childNodes,
			output = "";

		for (var i = 0, len = nodes.length; i < len; i++) {
			switch (nodes[i].nodeType) {
			case 1:  // element nodes
				if (nodes[i].style.display !== "none") {
					output += " ";  // out here to handle void nodes, in addition to child bearing nodes
					if (nodes[i].hasChildNodes()) {
						output += getTextFromNode(nodes[i]);
					}
				}
				break;
			case 3:  // text nodes
				output += nodes[i].textContent;
				break;
			default:
				if (DEBUG) { console.log(" ~> nodes[" + i + "].nodeType: " + nodes[i].nodeType); }
				break;
			}
		}
		return output;
	}

	if (!node.hasChildNodes()) { return ""; }

	var excerptRe = new RegExp("(\\S+(?:\\s+\\S+){0," + (typeof count !== 'undefined' ? count - 1 : 7) + "})"),
		excerpt   = getTextFromNode(node).trim();

	if (excerpt) {
		excerpt = excerpt
			// compact whitespace
			.replace(/\s+/g, " ")
			// attempt to match the excerpt regexp
			.match(excerptRe);
	}
	return (excerpt ? excerpt[1] + "\u2026" : "\u2026");
};

Passage.unescapeLineBreaks = function (text) {
	if (text && text !== "") {
		return text
			.replace(/\\n/gm, '\n')
			.replace(/\\t/gm, '\t')     // Twine 1.4.1 "feature"
			.replace(/\\s|\\/gm, '\\')  // "\\s" is required to workaround a Twine "feature"
			.replace(/\r/gm, "");
	}
	return "";
};

/* DEPRECATED */
Passage.mergeClassNames = function (/* variadic */) {
	if (arguments.length == 0) { return ""; }

	var classes = [];
	for (var i = 0; i < arguments.length; i++) {
		if (typeof arguments[i] === "object" && Array.isArray(arguments[i])) {
			classes = classes.concat(arguments[i]);
		} else if (typeof arguments[i] === "string") {
			classes = classes.concat(arguments[i].split(/\s+/));
		}
	}
	if (classes.length > 0) {
		// return a string of sorted, and unique, class names
		return classes.sort().filter(function (v, i, a) { return (i === 0 || a[i-1] !== v); }).join(' ');
	}
	return "";
};


/***********************************************************************************************************************
** [Tale]
***********************************************************************************************************************/
function Tale(instanceName) {
	if (DEBUG) { console.log("[Tale()]"); }

	this.passages = {};
	// Chrome breaks some data URIs if you don't normalize
	if (document.normalize) {
		document.normalize();
	}
	var store = document.getElementById("store-area").childNodes;

	for (var i = 0; i < store.length; i++) {
		var el = store[i],
			tiddlerTitle;
		if (el.getAttribute && (tiddlerTitle = el.getAttribute("tiddler"))) {
			this.passages[tiddlerTitle] = new Passage(tiddlerTitle, el, i);
		}
	}

	if (this.passages.hasOwnProperty("StoryTitle")) {
		var buf = document.createElement("div");
		new Wikifier(buf, this.passages.StoryTitle.processText().trim());
		this.setTitle(buf.textContent);
	} else {
		this.setTitle("Untitled Story");
	}

	// update instance reference in SugarCube global object
	window.SugarCube[instanceName || "tale"] = this;
}

Tale.prototype.setTitle = function (title) {
	this.title = document.title = title;
	this.domId = Util.slugify(title);
};

Tale.prototype.has = function (key) {
	if (typeof key === "string") {
		return this.passages[key] != null;  // use lazy equality
	} else if (typeof key === "number") {
		for (var pname in this.passages) {
			if (this.passages[pname].id === key) {
				return true;
			}
		}
	}
	return false;
};

Tale.prototype.get = function (key) {
	if (typeof key === "string") {
		return this.passages[key] || new Passage(key);
	} else if (typeof key === "number") {
		for (var pname in this.passages) {
			if (this.passages[pname].id === key) {
				return this.passages[pname];
			}
		}
	}
	return;  //FIXME: should this return null instead of undefined?
};

Tale.prototype.lookup = function (key, value, sortKey) {
	if (!sortKey) { sortKey = "title"; }
	var results = [];

	for (var pname in this.passages) {
		var passage = this.passages[pname];

		switch (typeof passage[key]) {
		case "undefined":
			/* noop */
			break;
		case "object":
			// currently, we assume that the only properties which are objects
			// will be either arrays or array-like-objects
			for (var i = 0; i < passage[key].length; i++) {
				if (passage[key][i] == value) {  // use lazy equality
					results.push(passage);
					break;
				}
			}
			break;
		default:
			if (passage[key] == value) {  // use lazy equality
				results.push(passage);
			}
			break;
		}
	}

	results.sort(function (a, b) { return (a[sortKey] == b[sortKey]) ? 0 : ((a[sortKey] < b[sortKey]) ? -1 : +1); });  // use lazy equality

	return results;
};

Tale.prototype.reset = function () {
	/**
	 * This method should never be called, so this code is largely redundant
	 */
	for (var i in this.passages) {
		this.passages[i].reset();
	}
};


/***********************************************************************************************************************
** [End story.js]
***********************************************************************************************************************/
