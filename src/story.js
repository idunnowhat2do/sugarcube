/***********************************************************************************************************************
 *
 * story.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Save, SeedablePRNG, UI, Util, Wikifier, clone, config, convertBreaksToParagraphs, insertElement,
	       postdisplay, postrender, predisplay, prehistory, prerender, removeChildren, runtime, session,
	       state:true, strings, tale, technicalAlert
*/

/***********************************************************************************************************************
 * History API
 **********************************************************************************************************************/
// Setup the History constructor
function History(instanceName) {
	/* eslint-disable max-len */
	if (DEBUG) {
		console.log("[History()]");
		console.log("    > config.historyMode: " + (config.historyMode === History.Modes.Hash ? "Hash" : config.historyMode === History.Modes.Window ? "Window" : "Session"));
		if (History.getWindowState()) {
			if (config.historyMode === History.Modes.Session) {
				console.log("    > History.getWindowState(): " + History.getWindowState().sidx + " / " + History.getWindowState().suid);
			} else if (config.historyMode === History.Modes.Window) {
				//console.log("    > History.getWindowState(): " + History.getWindowState().history.length);
				console.log("    > History.getWindowState(): " + History.getWindowState().delta.length);
			}
		} else {
			console.log("    > History.getWindowState(): " + History.getWindowState());
		}
	}
	/* eslint-enable max-len */

	// currently active/displayed state
	this.active = { init : true, variables : {} }; // allows macro initialization to set variables at startup

	// current hash, if in Hash mode
	if (config.historyMode === History.Modes.Hash) {
		this.hash = "";
	}

	// history state stack
	//     Session [{ title : null, variables : {}, sidx : null }]
	//     Window  [{ title : null, variables : {} }]
	//     Hash    [{ title : null, variables : {} }]
	this.history = [];

	// last time `this.display()` was called, in milliseconds
	this.lastDisplay = null;

	// update instance reference in SugarCube global object
	window.SugarCube[instanceName || "state"] = this;
}

// Setup the History Modes enumeration
History.Modes = Object.freeze({
	Hash    : 1,
	Window  : 2,
	Session : 3
});

// Setup the History prototype
Object.defineProperties(History.prototype, {
	// getters
	top : {
		get : function () {
			return this.history.length !== 0 ? this.history[this.history.length - 1] : null;
		}
	},

	bottom : {
		get : function () {
			return this.history.length !== 0 ? this.history[0] : null;
		}
	},

	length : {
		get : function () {
			return config.historyMode === History.Modes.Session ? this.active.sidx + 1 : this.history.length;
		}
	},

	variables : {
		get : function () {
			return this.active.variables;
		}
	},

	// methods
	isEmpty : {
		value : function () {
			return this.history.length === 0;
		}
	},

	/*
	clone : {
		enumerable : true,
		get        : function (at) {
			if (this.isEmpty()) { return null; }
			at = 1 + (at ? Math.abs(at) : 0);
			if (at > this.history.length) { return null; }

			var dup = clone(this.history[this.history.length - at]);
			if (config.historyMode === History.Modes.Session) {
				delete dup.sidx;
			}
			return dup;
		}
	},
	*/

	marshal : {
		value : function (upto) {
			var stateObj = {
				delta : History.deltaEncodeHistory(upto != null /* lazy equality for null */
					? this.history.slice(0, upto)
					: this.history)
			};
			if (this.hasOwnProperty("prng")) {
				stateObj.rseed = this.prng.seed;
			}
			return stateObj;
		}
	},

	unmarshal : {
		value : function (stateObj) {
			if (stateObj == null) { // lazy equality for null
				throw new Error("History.prototype.unmarshal stateObj parameter is null or undefined");
			}
			if (!stateObj.hasOwnProperty("delta") || stateObj.delta.length === 0) {
				throw new Error("History.prototype.unmarshal state object has no history or history is empty");
			}

			this.history = History.deltaDecodeHistory(stateObj.delta);
			if (this.hasOwnProperty("prng") && stateObj.hasOwnProperty("rseed")) {
				this.prng.seed = stateObj.rseed;
			}
		}
	},

	has : {
		value : function (title) {
			if (this.isEmpty()) { return false; }
			if (arguments.length === 0 || title == null || title === "") { return false; } // lazy equality for null

			return this.history.slice(0, this.length).some(function (o) { return o.title === title; });
		}
	},

	index : {
		value : function (idx) {
			if (this.isEmpty()) { return null; }
			if (idx < 0 || idx >= this.length) { return null; }

			return this.history[idx];
		}
	},

	peek : {
		value : function (at) {
			if (this.isEmpty()) { return null; }
			at = 1 + (at ? Math.abs(at) : 0);
			if (at > this.length) { return null; }

			return this.history[this.length - at];
		}
	},

	push : {
		value : function (/* variadic */) {
			if (arguments.length === 0) { return; } // maybe throw?

			for (var i = 0; i < arguments.length; i++) {
				var state = arguments[i];
				if (config.historyMode === History.Modes.Session) {
					state.sidx = this.history.length;
				}
				this.history.push(state);
			}
			return this.history.length;
		}
	},

	pop : {
		value : function (num) {
			if (this.isEmpty()) { return []; }
			num = num ? Math.abs(num) : 1;
			//if (num > this.history.length) { return []; }

			return num === 1 ? this.history.pop() : this.history.splice(this.history.length - num, num);
		}
	},

	setActiveState : {
		value : function (state) {
			if (arguments.length === 0) { return; } // maybe throw?
			if (state == null) { // lazy equality for null
				throw new Error("state activation attempted with null or undefined");
			}

			if (typeof state === "object") {
				this.active = clone(state);
			} else {
				if (this.isEmpty()) { return null; }
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
		}
	},

	init : {
		value : function () {
			if (DEBUG) { console.log("[<History>.init()]"); }

			// execute the StoryInit passage
			if (tale.has("StoryInit")) {
				try {
					Wikifier.wikifyEval(tale.get("StoryInit").text);
				} catch (e) {
					technicalAlert("StoryInit", e.message);
				}
			}

			/*
				Finalize the `config.disableHistoryControls` setting before displaying the initial
				passage.
			
				n.b. We do this here to give the author every opportunity to modify the
				     `config.disableHistoryTracking` setting.
			*/
			if (config.disableHistoryTracking) {
				config.disableHistoryControls = true;
			}

			// display the initial passage
			var testPlay; // Twine 1.4+ "Test Play From Here" feature variable
			if (TWINE1) { testPlay = "START_AT"; }
			if (typeof testPlay !== "undefined" && testPlay !== "") {
				// enables the Twine 1.4+ "Test Play From Here" feature
				if (DEBUG) { console.log('    > display: "' + testPlay + '" (testPlay)'); }
				this.display(testPlay);
			} else if (config.startingPassage == null) { // lazy equality for null
				throw new Error("starting passage not selected");
			} else if (!tale.has(config.startingPassage)) {
				throw new Error('starting passage ("' + config.startingPassage + '") not found');
			} else if (!this.restore()) {
				// autoload the autosave, if requested and possible, else load the start passage
				var loadStart = true;
				switch (typeof config.saves.autoload) {
				case "boolean":
					if (config.saves.autoload && Save.autosave.ok()) {
						if (DEBUG) { console.log('    > display/autoload: "' + Save.autosave.get().title + '"'); }
						loadStart = !Save.autosave.load();
					}
					break;
				case "string":
					if (config.saves.autoload === "prompt" && Save.autosave.ok() && Save.autosave.has()) {
						loadStart = false;
						UI.buildDialogAutoload();
						UI.open();
					}
					break;
				case "function":
					if (Save.autosave.ok() && Save.autosave.has() && !!config.saves.autoload()) {
						if (DEBUG) { console.log('    > display/autoload: "' + Save.autosave.get().title + '"'); }
						loadStart = !Save.autosave.load();
					}
					break;
				}
				if (loadStart) {
					if (DEBUG) { console.log('    > display: "' + config.startingPassage + '"'); }
					this.display(config.startingPassage);
				}
			}

			/*
				Setup the history change handlers.

				n.b. Do not update these to use jQuery; these events gain nothing from being wrapped
				     in the jQuery Event object and it would complicate either the handlers, by having
				     to deal with it, or the jQuery Event object, if the necessary properties were
				     pushed onto it.
			*/
			if (config.historyMode === History.Modes.Session) {
				window.addEventListener("popstate", History.popStateHandlerSession, false);
			} else if (config.historyMode === History.Modes.Window) {
				window.addEventListener("popstate", History.popStateHandlerWindow, false);
			} else {
				window.addEventListener("hashchange", History.hashChangeHandler, false);
			}
		}
	},

	display : {
		//writable : true, // the addition of `prehistory` should make this obsolete
		value : function (title, link, option) {
			if (DEBUG) { console.log("[<History>.display()]"); }

			// process option
			var	updateDisplay,
				updateHistory;
			switch (option) {
			case "hidden":
			case "offscreen":
			case "quietly":
			case false:
				updateDisplay = false;
				updateHistory = true;
				break;
			case "replace":
			case "back":
				updateDisplay = true;
				updateHistory = false;
				break;
			default:
				updateDisplay = true;
				updateHistory = true;
				break;
			}

			// reset the runtime temp/scratch object
			runtime.temp = {};

			/*
				n.b. The title parameter may be either a string or a number (though using a number
				     as reference to a numeric title should be discouraged), so after loading the
				     passage, always refer to passage.title and never the title parameter.
			*/
			var	passage     = tale.get(title),
				windowTitle = config.displayPassageTitles && passage.title !== config.startingPassage
					? passage.title + " | " + tale.title
					: tale.title;

			// execute the pre-history tasks
			Object.keys(prehistory).forEach(function (task) {
				if (typeof prehistory[task] === "function") {
					prehistory[task].call(this, task);
				}
			}, passage);

			// ensure that this.active is set if we have history
			if (this.active.init && !this.isEmpty()) {
				if (config.historyMode === History.Modes.Session) {
					if (DEBUG) {
						console.log("    [S]> state.active.init && !state.isEmpty(); activating: "
							+ (History.hasWindowState()
								? "History.getWindowState().sidx = " + History.getWindowState().sidx
								: "state.top"));
					}
					this.setActiveState(History.hasWindowState() ? History.getWindowState().sidx : this.top);
				} else {
					if (DEBUG) {
						if (config.historyMode === History.Modes.Window) {
							console.log("    [W]> state.active.init && !state.isEmpty(); activating: state.top");
						} else {
							console.log("    [H]> state.active.init && !state.isEmpty(); activating: state.top");
						}
					}
					this.setActiveState(this.top);
				}
			}

			// create a fresh entry in the history
			if (updateHistory) {
				if (!this.isEmpty()) {
					if (config.disableHistoryTracking) {
						this.pop();
					} else if (config.historyMode === History.Modes.Session) {
						var windowState = History.getWindowState();
						if (windowState !== null && windowState.sidx < this.top.sidx) {
							if (DEBUG) {
								console.log("    > stacks out of sync; popping "
									+ (this.top.sidx - windowState.sidx) + " states to equalize");
							}
							// stack indexes are out of sync, pop our stack until we're back in
							// sync with the window.history
							this.pop(this.top.sidx - windowState.sidx);
						}
					}
				}

				this.push({ title : passage.title, variables : clone(this.active.variables) });
				if (this.prng) {
					this.top.rcount = this.prng.count;
				}
				this.setActiveState(this.top);
			}
			if ((updateHistory || config.disableHistoryControls) && config.historyMode !== History.Modes.Hash) {
				if (DEBUG) {
					console.log("    > typeof History.getWindowState(): " + typeof History.getWindowState());
				}
				var stateObj;
				if (config.historyMode === History.Modes.Session) {
					stateObj = { suid : this.suid, sidx : this.active.sidx };
				} else { // History.Modes.Window
					stateObj = this.marshal();
				}
				History[
					!History.hasWindowState() || config.disableHistoryControls
						? "replaceWindowState"
						: "addWindowState"
				](stateObj, windowTitle);
			}
			if (config.historyMode !== History.Modes.Window) {
				this.save();
			}

			// clear <body> classes, then execute the PassageReady passage and pre-display tasks
			if (updateDisplay) {
				if (document.body.className) {
					document.body.className = "";
				}
				Object.keys(predisplay).forEach(function (task) {
					if (typeof predisplay[task] === "function") {
						predisplay[task].call(this, task);
					}
				}, passage);
				if (tale.has("PassageReady")) {
					try {
						Wikifier.wikifyEval(tale.get("PassageReady").text);
					} catch (e) {
						technicalAlert("PassageReady", e.message);
					}
				}
			}

			// render the incoming passage and add it to the page
			var incoming = passage.render();
			incoming.style.visibility = "visible";
			this.lastDisplay = Date.now();
			if (updateDisplay) {
				var	passages = document.getElementById("passages");
				if (passages.hasChildNodes()) {
					if (
						/* eslint-disable no-extra-parens */
						   typeof config.passageTransitionOut === "number"
						|| (
							   typeof config.passageTransitionOut === "string"
							&& config.passageTransitionOut !== ""
							&& config.transitionEndEventName !== ""
						)
						/* eslint-enable no-extra-parens */
					) {
						var outgoing = passages.childNodes[0];
						if (!outgoing.classList.contains("passage-out")) {
							outgoing.id = "out-" + outgoing.id;
							outgoing.classList.add("passage-out");
							if (typeof config.passageTransitionOut === "string") {
								jQuery(outgoing).on(config.transitionEndEventName, function (evt) {
									if (
										   this.parentNode
										&& evt.originalEvent.propertyName === config.passageTransitionOut
									) {
										this.parentNode.removeChild(this);
									}
								});
							} else {
								setTimeout(function () {
									if (outgoing.parentNode) {
										outgoing.parentNode.removeChild(outgoing);
									}
								}, config.passageTransitionOut); // in milliseconds
							}
						}
						// remove additional elements (possibly duplicates of the incoming passage due to multi-clicks)
						while (passages.childNodes.length > 1) {
							passages.removeChild(passages.lastChild);
						}
					} else {
						removeChildren(passages);
					}
				}
				incoming.classList.add("passage-in");
				passages.appendChild(incoming);
				setTimeout(function () { incoming.classList.remove("passage-in"); }, 1);

				if (config.displayPassageTitles && passage.title !== config.startingPassage) {
					document.title = windowTitle;
				}

				if (config.historyMode === History.Modes.Hash) {
					window.location.hash = this.hash;
				}

				window.scroll(0, 0);
			}

			// execute the PassageDone passage and post-display tasks, then update
			// the non-passage page elements, if enabled
			if (updateDisplay) {
				if (tale.has("PassageDone")) {
					try {
						Wikifier.wikifyEval(tale.get("PassageDone").text);
					} catch (e) {
						technicalAlert("PassageDone", e.message);
					}
				}
				Object.keys(postdisplay).forEach(function (task) {
					if (typeof postdisplay[task] === "function") {
						postdisplay[task].call(this, task);
					}
				}, passage);
				if (config.updatePageElements) {
					UI.setPageElements();
				}
			}

			/*
				Last second post-processing for accessibility and other things.

				n.b. Perhaps this should be limited to the incoming passage and, if so,
				     maybe before its contents are added to the DOM?
			*/
			jQuery("#story")
				// add `link-external` to all `href` bearing `<a>` elements which don't have it
				.find("a[href]:not(.link-external)")
					.addClass("link-external")
					.end()
				// add `tabindex=0` to all interactive elements which don't have it
				.find("a,link,button,input,select,textarea")
//					.filter(":not([tabindex])")
					.not("[tabindex]")
						.attr("tabindex", 0)
						.end()
					.end()
				// attempt to focus the first element of the incoming passage
				.find("#passages>.passage>*:first-child")
					.focus();

			// handle autosaves
			switch (typeof config.saves.autosave) {
			case "boolean":
				if (config.saves.autosave) {
					Save.autosave.save();
				}
				break;
			case "string":
				if (passage.tags.contains(config.saves.autosave)) {
					Save.autosave.save();
				}
				break;
			case "object":
				if (
					   Array.isArray(config.saves.autosave)
					&& passage.tags.some(function (v) { return config.saves.autosave.contains(v); })
				) {
					Save.autosave.save();
				}
				break;
			}

			return incoming;
		}
	},

	regenerateSuid : {
		value : function () {
			if (DEBUG) { console.log("[<History>.regenerateSuid()]"); }
			this.suid = UUID.generate();
			this.save();
		}
	},

	restart : {
		value : function () {
			if (DEBUG) { console.log("[<History>.restart()]"); }

			// ZUGZUG
			//jQuery(document.body).empty().append("\u00a0"); // daft, but necessary for some browsers ???
			// ZUGZUG

			if (config.historyMode !== History.Modes.Hash) {
				History.addWindowState(null, tale.title); // using null here is deliberate
				window.location.reload();
			} else {
				window.location.hash = "";
			}
		}
	},

	save : {
		value : function () {
			if (DEBUG) { console.log("[<History>.save()]"); }
			var stateObj = this.marshal();
			if (config.historyMode === History.Modes.Session) {
				if (DEBUG) { console.log("    > this.suid: " + this.suid); }
				session.set("history." + this.suid, stateObj);
			} else if (config.historyMode === History.Modes.Hash) {
				this.hash = History.serializeWindowHashState(stateObj);
			}
		}
	},

	restore : {
		value : function (suid) {
			if (DEBUG) { console.log("[<History>.restore()]"); }
			if (config.historyMode === History.Modes.Session) {
				if (suid) {
					this.suid = suid;
				} else if (History.hasWindowState()) {
					this.suid = History.getWindowState().suid;
				} else {
					this.suid = UUID.generate();
					return false; // return false early to skip the session check
				}
				if (session.has("history." + this.suid)) {
					var	stateObj = session.get("history." + this.suid),
						sidx     = History.getWindowState().sidx;
					if (DEBUG) {
						console.log("    > History.getWindowState(): " + History.getWindowState().sidx
							+ " / " + History.getWindowState().suid);
						console.log("    > history." + this.suid + ": " + JSON.stringify(stateObj));
					}

					this.unmarshal(stateObj);
					if (tale.has(this.history[sidx].title)) {
						this.display(this.history[sidx].title, null, "replace");
						return true;
					}
				}
			} else if (config.historyMode === History.Modes.Window) {
				if (DEBUG) {
					console.log("    > typeof window.history: " + typeof window.history);
					console.log("    > typeof History.getWindowState(): " + typeof History.getWindowState());
				}
				if (History.hasWindowState()) {
					this.unmarshal(History.getWindowState());
				}
				if (!this.isEmpty() && tale.has(this.top.title)) {
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
		}
	}
});

// Setup the History static methods
Object.defineProperties(History, {
	serializeWindowState : {
		value : function (obj) {
			return LZString.compressToUTF16(JSON.stringify(obj));
		}
	},

	deserializeWindowState : {
		value : function (obj) {
			return JSON.parse(LZString.decompressFromUTF16(obj));
		}
	},

	hasWindowState : {
		value : function (obj) {
			if (arguments.length === 0) { obj = window.history; }
			return obj.state != null; // lazy equality for null
		}
	},

	getWindowState : {
		value : function (obj) {
			if (arguments.length === 0) { obj = window.history; }
			return obj.state != null ? History.deserializeWindowState(obj.state) : null; // lazy equality for null
		}
	},

	addWindowState : {
		value : function (obj, title, url) {
			// required by IE (if you pass undefined as the URL, IE will happily set it
			// to exactly that, so you must not pass it at all in that case)
			if (url != null) { // lazy equality for null
				window.history.pushState(obj != null /* lazy equality for null */
					? History.serializeWindowState(obj)
					: null,
					title, url);
			} else {
				window.history.pushState(obj != null /* lazy equality for null */
					? History.serializeWindowState(obj)
					: null,
					title);
			}
		}
	},

	replaceWindowState : {
		value : function (obj, title, url) {
			// required by IE (if you pass undefined as the URL, IE will happily set it
			// to exactly that, so you must not pass it at all in that case)
			if (url != null) { // lazy equality for null
				window.history.replaceState(obj != null /* lazy equality for null */
					? History.serializeWindowState(obj)
					: null,
					title, url);
			} else {
				window.history.replaceState(obj != null /* lazy equality for null */
					? History.serializeWindowState(obj)
					: null,
					title);
			}
		}
	},

	serializeWindowHashState : {
		value : function (obj) {
			return "#" + LZString.compressToBase64(JSON.stringify(obj))
				.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ".");
		}
	},

	deserializeWindowHashState : {
		value : function (obj) {
			return JSON.parse(LZString.decompressFromBase64(obj.slice(1)
				.replace(/\-/g, "+").replace(/_/g, "/").replace(/\./g, "=")
			));
		}
	},

	hasWindowHashState : {
		value : function (hash) {
			if (arguments.length === 0) { hash = window.location.hash; }
			return hash !== "" && hash !== "#";
		}
	},

	getWindowHashState : {
		value : function (hash) {
			if (arguments.length === 0) { hash = window.location.hash; }
			return hash !== "" && hash !== "#" ? History.deserializeWindowHashState(hash) : null;
		}
	},

	popStateHandlerSession : {
		value : function (evt) {
			if (DEBUG) {
				console.log("[History.popStateHandlerSession()]");
				if (!History.hasWindowState(evt)) { console.log("    > evt.state: null; no-op"); }
			}

			// no-op if state is null
			if (!History.hasWindowState(evt)) { return; }

			// close any open UI dialog
			if (UI.isOpen()) {
				UI.close();
			}

			var windowState = History.getWindowState(evt);

			// update the game state if necessary
			if (windowState.suid !== state.suid) {
				if (DEBUG) { console.log("    > state from previous history detected, swapping in history"); }
				state.save();
				state.restore(windowState.suid);
			}

			state.display(state.setActiveState(windowState.sidx).title, null, "replace");
		}
	},

	popStateHandlerWindow : {
		value : function (evt) {
			if (DEBUG) {
				console.log("[History.popStateHandlerWindow()]");
				if (!History.hasWindowState(evt)) { console.log("    > evt.state: null; no-op"); }
			}

			// no-op if state is null
			if (!History.hasWindowState(evt)) { return; }

			// close any open UI dialog
			if (UI.isOpen()) {
				UI.close();
			}

			var windowState = History.getWindowState(evt);
			state.unmarshal(windowState);
			state.display(state.setActiveState(state.top).title, null, "replace");
		}
	},

	hashChangeHandler : {
		value : function (/* evt */) {
			if (DEBUG) {
				console.log("[History.hashChangeHandler()]");
				//console.log("    > evt:", evt);
				if (window.location.hash === state.hash) {
					console.log("    > no-op (window.location.hash === state.hash)");
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
				if (UI.isOpen()) {
					UI.close();
				}

				var hashState = History.getWindowHashState();
				state.unmarshal(hashState);
				state.display(state.setActiveState(state.top).title, null, "replace");
			} else {
				window.location.reload();
			}
			if (window.location.hash !== state.hash) {
				state.hash = window.location.hash;
			}
		}
	},

	initPRNG : {
		value : function (seed, useEntropy) {
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
		}
	},

	deltaEncodeHistory : {
		value : function (hist) {
			if (!Array.isArray(hist)) { return null; }
			if (hist.length === 0) { return []; }

			var delta = [ clone(hist[0]) ];
			for (var i = 1, iend = hist.length; i < iend; i++) {
				delta.push(Util.diff(hist[i - 1], hist[i]));
			}
			return delta;
		}
	},

	deltaDecodeHistory : {
		value : function (delta) {
			if (!Array.isArray(delta)) { return null; }
			if (delta.length === 0) { return []; }

			var hist = [ clone(delta[0]) ];
			for (var i = 1, iend = delta.length; i < iend; i++) {
				hist.push(Util.patch(hist[i - 1], delta[i]));
			}
			return hist;
		}
	},

	marshalToSave : {
		value : function () {
			if (DEBUG) { console.log("[History.marshalToSave()]"); }

			var stateObj = { mode : config.historyMode };
			if (state.hasOwnProperty("prng")) {
				stateObj.rseed = state.prng.seed;
			}
			if (config.historyMode === History.Modes.Session) {
				stateObj.history = clone(state.history.slice(0, state.active.sidx + 1));
			} else {
				stateObj.history = clone(state.history);
			}
			return stateObj;
		}
	},

	unmarshalFromSave : {
		value : function (stateObj) {
			if (DEBUG) { console.log("[History.unmarshalFromSave()]"); }

			if (!stateObj || !stateObj.hasOwnProperty("mode") || !stateObj.hasOwnProperty("history")) {
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
			if (config.historyMode === History.Modes.Session) {
				state.regenerateSuid();
				//if (DEBUG) { console.log("    > this.suid: " + state.suid); }
			}

			// load the state history from the save
			state.history = clone(stateObj.history);

			// restore the window history states (in order)
			if (config.historyMode !== History.Modes.Hash && !config.disableHistoryControls) {
				for (var i = 0, iend = state.history.length; i < iend; i++) {
					if (DEBUG) {
						console.log("    > loading state into window history: "
							+ i + " (" + state.history[i].title + ")");
					}

					// load the state into the window history
					var	windowState,
						windowTitle = config.displayPassageTitles && state.history[i].title !== config.startingPassage
							? state.history[i].title + " | " + tale.title
							: tale.title;
					switch (config.historyMode) {
					case History.Modes.Session:
						windowState = {
							suid : state.suid,
							sidx : state.history[i].sidx
						};
						break;
					case History.Modes.Window:
						windowState = state.marshal(i + 1);
						break;
					}
					History.addWindowState(windowState, windowTitle);
				}
			}

			// activate the current top and display the passage
			state.setActiveState(state.top);
			state.display(state.active.title, null, "replace");
		}
	}
});


/***********************************************************************************************************************
 * Passage API
 **********************************************************************************************************************/
// Setup the Passage constructor
function Passage(title, el, id) {
	this.title = title;
	this.domId = "passage-" + Util.slugify(this.title);
	if (el) {
		this.element = el;
		this.id      = id;
		this.tags    = el.hasAttribute("tags") ? el.getAttribute("tags").trim().splitOrEmpty(/\s+/) : [];
		this.classes = [];
		if (this.tags.length > 0) {
			// tags to skip transforming into classes
			//     debug      → special tag
			//     nobr       → special tag
			//     passage    → the default class
			//     script     → special tag (only in Twine 1)
			//     stylesheet → special tag (only in Twine 1)
			//     twine.*    → special tag
			//     widget     → special tag
			var	tagClasses = [],
				tagsToSkip;
			if (TWINE1) {
				tagsToSkip = /^(?:debug|nobr|passage|script|stylesheet|widget|twine\..*)$/i;
			} else {
				tagsToSkip = /^(?:debug|nobr|passage|widget|twine\..*)$/i;
			}
			for (var i = 0; i < this.tags.length; i++) {
				if (!tagsToSkip.test(this.tags[i])) {
					tagClasses.push(Util.slugify(this.tags[i]));
				}
			}
			if (tagClasses.length > 0) {
				if (el.className) {
					tagClasses = tagClasses.concat(el.className.split(/\s+/));
				}
				// sort and filter out non-uniques
				this.classes = tagClasses.sort().filter(function (val, i, aref) { // eslint-disable-line no-shadow
					return i === 0 || aref[i - 1] !== val;
				});
			}
		}
	} else {
		this.element = null;
		this.id      = undefined;
		this.tags    = [];
		this.classes = [];
	}
}

// Setup the Passage prototype
Object.defineProperties(Passage.prototype, {
	// getters
	className : {
		get : function () {
			return this.classes.join(" ");
		}
	},

	text : {
		get : function () {
			if (this.element == null) { // lazy equality for null
				return ('<span class="error" title="%passage%">' + strings.errors.title + ": "
					+ strings.errors.nonexistentPassage
					+ '</span>').replace(/%passage%/g, Util.entityEncode(this.title));
			}
			if (TWINE1) {
				return Passage.unescape(this.element.textContent);
			} else {
				return this.element.textContent.replace(/\r/g, "");
			}
		}
	},

	// methods
	description : {
		value : function () {
			if (config.altPassageDescription != null) { // lazy equality for null
				switch (typeof config.altPassageDescription) {
				case "boolean":
					if (config.altPassageDescription) {
						return this.title;
					}
					break;
				case "object":
					if (config.altPassageDescription.hasOwnProperty(this.title)) {
						return config.altPassageDescription[this.title];
					}
					break;
				case "function":
					var result = config.altPassageDescription.call(this);
					if (result) {
						return result;
					}
					break;
				default:
					throw new TypeError("config.altPassageDescription must be a boolean, object, or function");
				}
			}
			if (this._excerpt == null) { // lazy equality for null
				return Passage.getExcerptFromText(this.text);
			}
			return this._excerpt;
		}
	},

	processText : {
		value : function () {
			var res = this.text;
			// handle the nobr tag
			if (this.tags.contains("nobr")) {
				res = res.replace(/^\n+|\n+$/g, "").replace(/\n+/g, " ");
			}
			// check for Twine 1.4 Base64 image passage transclusion
			if (this.tags.contains("Twine.image")) {
				res = "[img[" + res + "]]";
			}
			return res;
		}
	},

	render : {
		value : function () {
			if (DEBUG) { console.log("[<Passage>.render()] title: " + this.title); }

			// create the new passage element
			var passage = insertElement(null, "section", this.domId, "passage");
			passage.setAttribute("data-passage", this.title);
			passage.style.visibility = "hidden";

			// add classes (generated from tags) to the passage and <body>
			for (var i = 0; i < this.classes.length; i++) {
				document.body.classList.add(this.classes[i]);
				passage.classList.add(this.classes[i]);
			}

			// execute pre-render tasks
			Object.keys(prerender).forEach(function (task) {
				if (typeof prerender[task] === "function") {
					prerender[task].call(this, passage, task);
				}
			}, this);

			// wikify the passage into its element
			new Wikifier(passage, this.processText());

			// convert breaks to paragraphs within the output passage
			if (config.cleanupWikifierOutput) {
				convertBreaksToParagraphs(passage);
			}

			// execute post-render tasks
			Object.keys(postrender).forEach(function (task) {
				if (typeof postrender[task] === "function") {
					postrender[task].call(this, passage, task);
				}
			}, this);

			// create/update the excerpt cache to reflect the rendered text
			this._excerpt = Passage.getExcerptFromNode(passage);

			return passage;
		}
	},

	reset : {
		value : function () { throw new Error("Passage.prototype.reset was called"); }
	}
});

// Setup the Passage static methods
if (TWINE1) {
	Object.defineProperties(Passage, {
		unescape : {
			value : function (str) {
				if (typeof str !== "string" || str === "") { return ""; }
				return str
					// unescape line feeds
					.replace(/\\n/g, "\n")
					// unescape tabs, which is a Twine 1.4.1 "feature"
					.replace(/\\t/g, "\t")
					// unescape backslashes, including "\\s" which is an old Twine "feature"
					.replace(/\\s|\\/g, "\\")
					// remove carriage returns
					.replace(/\r/g, "");
			}
		}
	});
}
Object.defineProperties(Passage, {
	getExcerptFromNode : {
		value : function (node, count) {
			if (!node.hasChildNodes()) { return ""; }

			var	excerptRe = new RegExp("(\\S+(?:\\s+\\S+){0," + (count > 0 ? count - 1 : 7) + "})"),
				excerpt   = node.textContent.trim();
			if (excerpt !== "") {
				excerpt = excerpt
					// compact whitespace
					.replace(/\s+/g, " ")
					// attempt to match the excerpt regexp
					.match(excerptRe);
			}
			return excerpt ? excerpt[1] + "\u2026" : "\u2026"; // horizontal ellipsis
		}
	},

	getExcerptFromText : {
		value : function (text, count) {
			if (text === "") { return ""; }

			var	excerptRe = new RegExp("(\\S+(?:\\s+\\S+){0," + (count > 0 ? count - 1 : 7) + "})"),
				excerpt   = text
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
					// a final trim
					.trim()
					// compact whitespace
					.replace(/\s+/g, " ")
					// attempt to match the excerpt regexp
					.match(excerptRe);
			return excerpt ? excerpt[1] + "\u2026" : "\u2026"; // horizontal ellipsis
		}
	}
});


/***********************************************************************************************************************
 * Tale API
 **********************************************************************************************************************/
// Setup the Tale constructor
function Tale(instanceName) {
	if (DEBUG) { console.log("[Tale()]"); }

	this.passages = {};
	this.styles   = [];
	this.scripts  = [];
	this.widgets  = [];

	var	nodes = document.getElementById("store-area").childNodes;
	var	el, name, tags, passage;

	if (TWINE1) {
		config.startingPassage = "Start"; // set the default starting passage title
		var	storyStylesheet,
			storyScript;
		for (var i = 0; i < nodes.length; i++) {
			el = nodes[i];
			if (el.nodeType !== Node.ELEMENT_NODE) { // skip non-element nodes (should never be any, but…)
				continue;
			}

			name = el.hasAttribute("tiddler") ? el.getAttribute("tiddler") : "";
			if (name === "") { // skip nameless passages (should never be any, but…)
				continue;
			}

			tags = el.hasAttribute("tags") ? el.getAttribute("tags").trim().splitOrEmpty(/\s+/) : [];
			if (tags.containsAny("Twine.private", "annotation")) { // skip passages with forbidden tags
				continue;
			}

			passage = new Passage(name, el, i);

			if (name === "StoryStylesheet") {
				storyStylesheet = passage;
			} else if (name === "StoryScript") {
				storyScript = passage;
			} else if (tags.contains("stylesheet")) {
				this.styles.push(passage);
			} else if (tags.contains("script")) {
				this.scripts.push(passage);
			} else if (tags.contains("widget")) {
				this.widgets.push(passage);
			} else {
				this.passages[name] = passage;
			}
		}
		if (storyStylesheet) {
			this.styles.unshift(storyStylesheet);
		}
		if (storyScript) {
			this.scripts.unshift(storyScript);
		}

		if (this.passages.hasOwnProperty("StoryTitle")) {
			var buf = document.createElement("div");
			new Wikifier(buf, this.passages.StoryTitle.processText().trim());
			this.setTitle(buf.textContent);
		} else {
			throw new Error("cannot find the StoryTitle special passage");
		}
	} else {
		config.startingPassage = null; // no default starting passage title
		var startNode = nodes[0].hasAttribute("startnode") ? nodes[0].getAttribute("startnode") : "";
		nodes = nodes[0].childNodes;
		for (var i = 0; i < nodes.length; i++) { // eslint-disable-line no-redeclare
			el = nodes[i];
			if (el.nodeType !== Node.ELEMENT_NODE) { // skip non-element nodes (should never be any, but…)
				continue;
			}

			switch (el.nodeName.toUpperCase()) {
			case "STYLE":
				this.styles.push(new Passage("user-style-node-" + i, el, -i));
				break;
			case "SCRIPT":
				this.scripts.push(new Passage("user-script-node-" + i, el, -i));
				break;
			default: // TW-PASSAGEDATA
				name = el.hasAttribute("name") ? el.getAttribute("name") : "";
				if (name === "") { // skip nameless passages (should never be any, but…)
					continue;
				}

				tags = el.hasAttribute("tags") ? el.getAttribute("tags").trim().splitOrEmpty(/\s+/) : [];
				if (tags.containsAny("Twine.private", "annotation")) { // skip passages with forbidden tags
					continue;
				}

				var	pid = el.hasAttribute("pid") ? el.getAttribute("pid") : "";
				passage = new Passage(name, el, +pid);

				if (startNode !== "" && startNode === pid) {
					config.startingPassage = name;
				}

				if (tags.contains("widget")) {
					this.widgets.push(passage);
				} else {
					this.passages[name] = passage;
				}
				break;
			}
		}

		if ("{{STORY_NAME}}" !== "") { // eslint-disable-line no-constant-condition, yoda
			this.setTitle("{{STORY_NAME}}");
		} else {
			throw new Error("story title not set");
		}
	}

	// update instance reference in SugarCube global object
	window.SugarCube[instanceName || "tale"] = this;
}

// Setup the Tale prototype
Object.defineProperties(Tale.prototype, {
	setTitle : {
		value : function (title) {
			document.title = this.title = title;
			this.domId = Util.slugify(title);
		}
	},

	has : {
		value : function (title) {
			switch (typeof title) {
			case "number":
				title += "";
				/* falls through */
			case "string":
				return this.passages.hasOwnProperty(title);
			default:
				throw new TypeError("Tale.prototype.has title parameter must be a string");
			}
		}
	},

	get : {
		value : function (title) {
			switch (typeof title) {
			case "number":
				title += "";
				/* falls through */
			case "string":
				return this.passages.hasOwnProperty(title) ? this.passages[title] : new Passage(title || "(unknown)");
			default:
				throw new TypeError("Tale.prototype.get title parameter must be a string");
			}
		}
	},

	lookup : {
		value : function (key, value, sortKey) {
			if (!sortKey) { sortKey = "title"; }

			var	pnames  = Object.keys(this.passages),
				results = [];
			for (var i = 0; i < pnames.length; i++) {
				var passage = this.passages[pnames[i]];
				if (passage.hasOwnProperty(key)) {
					switch (typeof passage[key]) {
					case "undefined":
						/* no-op */
						break;
					case "object":
						// currently, we assume that the only properties which are objects
						// will be either arrays or array-like-objects
						for (var j = 0, jend = passage[key].length; j < jend; j++) {
							/* eslint-disable eqeqeq */
							if (passage[key][j] == value) { // lazy equality for null
								results.push(passage);
								break;
							}
							/* eslint-enable eqeqeq */
						}
						break;
					default:
						/* eslint-disable eqeqeq */
						if (passage[key] == value) { // lazy equality for null
							results.push(passage);
						}
						/* eslint-enable eqeqeq */
						break;
					}
				}
			}

			results.sort(function (a, b) {
				/* eslint-disable eqeqeq */
				return a[sortKey] == b[sortKey] /* lazy equality for null */
					? 0
					: a[sortKey] < b[sortKey] ? -1 : +1;
				/* eslint-enable eqeqeq */
			});

			return results;
		}
	},

	reset : {
		value : function () { throw new Error("Tale.prototype.reset was called"); }
	}
});

