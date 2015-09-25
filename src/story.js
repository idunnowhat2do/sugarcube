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
	if (DEBUG) { console.log("[History()]"); }

	/*
		Core properties.
	*/
	// history state stack
	this.history = [];

	// currently active/displayed state
	this.active = Object.assign(History.State.create(), {
		init : true // flag, for startup active state only - TODO: Necessary?
	});

	// currently active/displayed state index
	this.activeIndex = -1;

	// total number of states which have expired (i.e. fallen off the bottom of the stack)
	this.expired = 0;

	// title of the most recent expired passage
	this.expiredLast = "";

	// title of the most recent expired passage whose title does not match that of the bottom passage
	this.expiredUnique = "";

	/*
		Miscellaneous properties.
	*/
	// last time `this.play()` was called, in milliseconds
	this.lastDisplay = null;

	/*
		Update instance reference in the `SugarCube` global object.
	*/
	window.SugarCube[instanceName || "state"] = this;
}

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
			return this.activeIndex + 1;
		}
	},

	size : {
		get : function () {
			return this.history.length;
		}
	},

	passage : {
		get : function () {
			return this.active.title;
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
			return this.size === 0;
		}
	},

	goTo : {
		value : function (idx) {
			if (DEBUG) { console.log("[<History>.goTo(" + idx + ")]"); }

			if (
				   idx == null /* lazy equality for null */
				|| idx < 0
				|| idx >= this.size
				|| idx === this.activeIndex
			) {
				return false;
			}

			this.activeIndex = idx;
			this.setActiveState(this.activeIndex);
			this.show();

			return true;
		}
	},

	go : {
		value : function (offset) {
			if (DEBUG) { console.log("[<History>.go(" + offset + ")]"); }

			if (offset == null || offset === 0) { // lazy equality for null
				return false;
			}

			return this.goTo(this.activeIndex + offset);
		}
	},

	backward : {
		value : function () {
			return this.go(-1);
		}
	},

	forward : {
		value : function () {
			return this.go(1);
		}
	},

	has : {
		value : function (title) {
			if (this.isEmpty() || title == null || title === "") { // lazy equality for null
				return false;
			}

			for (var i = this.activeIndex; i >= 0; --i) {
				if (this.history[i].title === title) {
					return true;
				}
			}

			return false;
		}
	},

	index : {
		value : function (idx) {
			if (this.isEmpty() || idx < 0 || idx > this.activeIndex) {
				return null;
			}
			return this.history[idx];
		}
	},

	peek : {
		value : function (at) {
			if (this.isEmpty()) {
				return null;
			}
			at = 1 + (at ? Math.abs(at) : 0);
			if (at > this.length) {
				return null;
			}
			return this.history[this.length - at];
		}
	},

	push : {
		value : function (/* variadic */) {
			if (DEBUG) { console.log("[<History>.push()]"); }

			if (arguments.length === 0) {
				return this.length;
			}

			/*
				If we're not at the top of the stack, pop it until we are.
			*/
			if (this.length < this.size) {
				if (DEBUG) { console.log("    > non-top push; popping " + (this.size - this.length) + " states"); }
				this.pop(this.size - this.length);
			}

			/*
				Push each of the new states onto the history stack.
			*/
			for (var i = 0; i < arguments.length; ++i) {
				this.history.push(arguments[i]);
				if (this.prng) {
					this.top.pull = this.prng.pull;
				}
			}

			if (config.history.maxStates !== 0) {
				// using `slice()` or `splice()` here would be difficult, as we need to set the
				// two expired passage name properties
				while (this.size > config.history.maxStates) {
					this.expiredLast = this.history.shift().title;
					if (this.expiredLast !== this.bottom.title) {
						this.expiredUnique = this.expiredLast;
					}
					++this.expired;
				}
			}

			this.activeIndex = this.size - 1;
			this.setActiveState(this.activeIndex);

			return this.length;
		}
	},

	/*
		TODO: This works on the full history, rather than the active history.
		      Perhaps it would be better for it to work on the latter, as does
		      `<History>.push()`.

		TODO: Perhaps make a similar method, `trim()` or something similar, which only
		      removes the future states (i.e. truncate the history to the present).
		      Alternatively, perhaps merging this into `push()`, since its only used
		      there, and renaming it to something like `add()` would be better.

		TODO: Should this remove the active state, `this.active` is not set
		      to the new top.  It probably should do so.
	*/
	pop : {
		value : function (num) {
			if (DEBUG) { console.log("[<History>.pop()]"); }

			if (this.isEmpty()) {
				return [];
			}

			num = Math.max(num ? Number(num) : 1);
			if (num > this.size) {
				num = this.size;
			}

			return this.history.splice(this.size - num, num);
		}
	},

	setActiveState : {
		value : function (state) {
			if (state == null) { // lazy equality for null
				throw new Error("state activation attempted with null or undefined");
			}

			/*
				Set the active state.
			*/
			switch (typeof state) {
			case "object":
				this.active = clone(state);
				break;

			case "number":
				if (this.isEmpty()) {
					throw new Error("state activation attempted with index on empty history");
				}
				if (state < 0 || state >= this.size) {
					throw new RangeError("state activation attempted with out-of-bounds index"
						+ "; need [0, " + (this.size - 1) + "], got " + state);
				}
				this.active = clone(this.history[state]);
				break;

			default:
				throw new TypeError('state activation attempted with a "' + typeof state
					+ '"; must be an object or valid history stack index');
			}

			/*
				Restore the seedable PRNG.

				n.b. We cannot simply set `this.prng.pull` to `this.active.pull` as that would not
				     properly mutate the seedable PRNG's internal state.

				TODO: I believe that seedrandom has been updated to expose its internal state in
				      various ways.  It may now be possible to use that to restore its internal
				      state, rather than having to unmarshal the PRNG every time.
			*/
			if (this.prng) {
				this.prng = SeedablePRNG.unmarshal({
					seed : this.prng.seed,
					pull : this.active.pull
				});
			}

			/*
				Update the session history.
			*/
			session.set("history", this.marshal());

			/*
				Trigger a global `tw:historyupdate` event.
			*/
			jQuery.event.trigger("tw:historyupdate");

			return this.active;
		}
	},

	init : {
		value : function () {
			if (DEBUG) { console.log("[<History>.init()]"); }

			/*
				Execute the StoryInit passage.
			*/
			if (tale.has("StoryInit")) {
				try {
					Wikifier.wikifyEval(tale.get("StoryInit").text);
				} catch (e) {
					technicalAlert("StoryInit", e.message);
				}
			}

			/*
				Complain about deprecated `config.history` properties.
			*/
			if (config.history.hasOwnProperty("mode")) {
				throw new Error("config.history.mode has been deprecated and is no longer used by SugarCube,"
					+ " please remove it from your code");
			}
			if (config.history.hasOwnProperty("tracking")) {
				throw new Error("config.history.tracking has been deprecated, use config.history.maxStates instead");
			}

			/*
				Finalize the various `config.history` properties here, before any passages are displayed.
			
				n.b. We do this here to give authors every opportunity to modify the `config.history.maxStates`
				     property.
			*/
			config.history.maxStates = Math.max(1, Number(config.history.maxStates));
			if (isNaN(config.history.maxStates) || !isFinite(config.history.maxStates)) {
				// maybe we should throw instead?
				config.history.maxStates = 100;
			}
			if (config.history.maxStates === 1) {
				config.history.controls = false;
			}

			/*
				Handle the Twine 1.4+ "Test Play From Here" feature.
			*/
			if (TWINE1) {
				var testPlay = "START_AT";
				if (testPlay !== "") {
					if (DEBUG) { console.log('    > display: "' + testPlay + '" (testPlay)'); }
					this.play(testPlay);
					return;
				}
			}

			/*
				Attempt to restore an active session.  Failing that, attempt to autoload the autosave,
				if requested.  Failing that, display the starting passage.
			*/
			if (config.passages.start == null) { // lazy equality for null
				throw new Error("starting passage not selected");
			}
			if (!tale.has(config.passages.start)) {
				throw new Error('starting passage ("' + config.passages.start + '") not found');
			}
			if (!this.restore()) {
				var loadStart = true;

				switch (typeof config.saves.autoload) {
				case "boolean":
					if (config.saves.autoload && Save.autosave.ok() && Save.autosave.has()) {
						if (DEBUG) { console.log('    > display, attempting autoload: "' + Save.autosave.get().title + '"'); }
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
						if (DEBUG) { console.log('    > display, attempting autoload: "' + Save.autosave.get().title + '"'); }
						loadStart = !Save.autosave.load();
					}
					break;
				}

				if (loadStart) {
					if (DEBUG) { console.log('    > display: "' + config.passages.start + '"'); }
					this.play(config.passages.start);
				}
			}
		}
	},

	restore : {
		value : function () {
			if (DEBUG) { console.log("[<History>.restore()]"); }

			/*
				Attempt to restore an active session history.
			*/
			if (session.has("history")) {
				/*
					Retrieve the session history.
				*/
				var historyObj = session.get("history");
				if (DEBUG) { console.log("    > session history:", historyObj); }
				if (historyObj == null) { // lazy equality for null
					return false;
				}

				/*
					Restore the session history.
				*/
				this.unmarshal(historyObj);
				if (!tale.has(this.active.title)) {
					throw new Error('session restoration failed, no such passage "' + this.active.title + '"');
				}

				/*
					Display the active passage.
				*/
				this.show();
				return true;
			}

			return false;
		}
	},

	restart : {
		value : function () {
			if (DEBUG) { console.log("[<History>.restart()]"); }

			/*
				Delete an active session history and reload the page.
			*/
			session.delete("history");
			window.location.reload();
		}
	},

	/* legacy */
	display : {
		//writable : true, // the addition of `prehistory` should make this obsolete
		value : function (title, link, option) {
			if (DEBUG) { console.log("[<History>.display()]"); }

			// process option
			var noHistory = false;
			switch (option) {
			case undefined:
				/* no-op */
				break;
			case "replace":
			case "back":
				noHistory = true;
				break;
			default:
				throw new Error('<History>.display option parameter called with obsolete value "'
					+ option + '"; please notify the developer');
			}

			this.play(title, noHistory);
		}
	},
	/* /legacy */

	show : {
		value : function () {
			return this.play(this.active.title, true);
		}
	},

	play : {
		value : function (title, noHistory) {
			if (DEBUG) { console.log("[<History>.play()]"); }

			/*
				Reset the runtime temp/scratch object.
			*/
			runtime.temp = {};

			/*
				Retrieve the passage by the given title.

				n.b. The title parameter may be empty, a string, or a number (though using a number
				     as reference to a numeric title should be discouraged), so after loading the
				     passage, always refer to passage.title and never the title parameter.
			*/
			var passage = tale.get(title);

			// execute the pre-history tasks
			Object.keys(prehistory).forEach(function (task) {
				if (typeof prehistory[task] === "function") {
					prehistory[task].call(this, task);
				}
			}, passage);

			/*
				Ensure that `this.active` is set if we have history.

				TODO: I don't think this is necessary any longer, so it should be removed.
			*/
			if (this.active.init && !this.isEmpty()) {
				throw new Error("active state initialization flag seen while history not empty; please notify the developer");
			}

			/*
				Create a new entry in the history.
			*/
			if (!noHistory) {
				this.push(History.State.create(passage.title, this.active.variables));
			}

			/*
				Clear `<body>` classes, then execute the `PassageReady` passage and `predisplay` tasks.
			*/
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

			/*
				Render the incoming passage and update the last display time.
			*/
			var incoming = passage.render();
			this.lastDisplay = Date.now();

			/*
				Add the rendered passage to the page.
			*/
			var	passages = document.getElementById("passages");
			if (passages.hasChildNodes()) {
				if (
					/* eslint-disable no-extra-parens */
					   typeof config.passages.transitionOut === "number"
					|| (
						   typeof config.passages.transitionOut === "string"
						&& config.passages.transitionOut !== ""
						&& config.transitionEndEventName !== ""
					)
					/* eslint-enable no-extra-parens */
				) {
					var outNodes = Array.from(passages.childNodes);
					for (var i = 0; i < outNodes.length; ++i) {
						var outgoing = outNodes[i];
						if (outgoing.nodeType === Node.ELEMENT_NODE && outgoing.classList.contains("passage")) {
							if (outgoing.classList.contains("passage-out")) {
								continue;
							}
							outgoing.id = "out-" + outgoing.id;
							outgoing.classList.add("passage-out");
							if (typeof config.passages.transitionOut === "string") {
								jQuery(outgoing).on(config.transitionEndEventName, function (evt) {
									if (
										   this.parentNode
										&& evt.originalEvent.propertyName === config.passages.transitionOut
									) {
										this.parentNode.removeChild(this);
									}
								});
							} else {
								setTimeout(function () {
									if (outgoing.parentNode) {
										outgoing.parentNode.removeChild(outgoing);
									}
								}, config.passages.transitionOut); // in milliseconds
							}
						} else {
							outgoing.parentNode.removeChild(outgoing);
						}
					}
				} else {
					removeChildren(passages);
				}
			}
			incoming.classList.add("passage-in");
			passages.appendChild(incoming);
			setTimeout(function () {
				incoming.classList.remove("passage-in");
			}, 1);

			/*
				Set the document title.
			*/
			document.title = config.passages.displayTitles && passage.title !== config.passages.start
				? passage.title + " | " + tale.title
				: tale.title;

			/*
				Scroll the window to the top.
			*/
			window.scroll(0, 0);

			/*
				Execute the `PassageDone` passage and `postdisplay` tasks, then update the non-passage
				page elements, if enabled.
			*/
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
			if (config.ui.updateStoryElements) {
				UI.setStoryElements();
			}

			/*
				Last second post-processing for accessibility and other things.

				TODO: Perhaps this should be limited to the incoming passage and, if so,
				      maybe before its contents are added to the DOM?
			*/
			UI.patchOutlines(true); // initially hide outlines
			jQuery("#story")
				// add `link-external` to all `href` bearing `<a>` elements which don't have it
				.find("a[href]:not(.link-external)")
					.addClass("link-external")
					.end()
				// add `tabindex=0` to all interactive elements which don't have it
				.find("a,link,button,input,select,textarea")
					.not("[tabindex]")
						.attr("tabindex", 0);

			/*
				Handle autosaves.
			*/
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
					&& passage.tags.some(function (t) { return config.saves.autosave.contains(t); })
				) {
					Save.autosave.save();
				}
				break;
			}

			return incoming;
		}
	},

	marshal : {
		value : function () {
			/*
				Gather required core properties.
			*/
			var historyObj = {
				delta : History.deltaEncode(this.history),
				index : this.activeIndex
			};

			/*
				Gather optional core properties.
			*/
			if (this.expired !== 0) {
				historyObj.expired = this.expired;
			}
			if (this.expiredLast !== "") {
				historyObj.last = this.expiredLast;
			}
			if (this.expiredUnique !== "") {
				historyObj.unique = this.expiredUnique;
			}

			/*
				Gather optional miscellaneous properties.
			*/
			if (this.hasOwnProperty("prng")) {
				historyObj.seed = this.prng.seed;
			}

			return historyObj;
		}
	},

	unmarshal : {
		value : function (historyObj) {
			if (historyObj == null) { // lazy equality for null
				throw new Error("History.prototype.unmarshal historyObj parameter is null or undefined");
			}
			if (!historyObj.hasOwnProperty("delta") || historyObj.delta.length === 0) {
				throw new Error("History.prototype.unmarshal history object has no history or history is empty");
			}
			if (!historyObj.hasOwnProperty("index")) {
				throw new Error("History.prototype.unmarshal history object has no index property");
			}

			/*
				Restore required core properties.
			*/
			this.history = History.deltaDecode(historyObj.delta);
			this.activeIndex = historyObj.index;

			/*
				Restore optional core properties.
			*/
			if (historyObj.hasOwnProperty("expired")) {
				this.expired = historyObj.expired;
			}
			if (historyObj.hasOwnProperty("last")) {
				this.expiredLast = historyObj.last;
			}
			if (historyObj.hasOwnProperty("unique")) {
				this.expiredUnique = historyObj.unique;
			}

			/*
				Restore optional miscellaneous properties.
			*/
			if (this.hasOwnProperty("prng") && historyObj.hasOwnProperty("seed")) {
				this.prng.seed = historyObj.seed;
			}

			/*
				Activate the current state (do this only after all properties have been restored).
			*/
			this.setActiveState(this.activeIndex);
		}
	},

	random : {
		value : function () {
			if (DEBUG) { console.log("[<History>.random()]"); }
			return this.prng ? this.prng.random() : Math.random();
		}
	}
});

// Setup the History static methods
Object.defineProperties(History, {
	State : {
		value : Object.defineProperty({}, "create", {
			value : function (title, variables) {
				return {
					title     : title == null ? "" : String(title),       // lazy equality for null
					variables : variables == null ? {} : clone(variables) // lazy equality for null
				};
			}
		})
	},

	marshalToSave : {
		value : function () {
			if (DEBUG) { console.log("[History.marshalToSave()]"); }

			/*
				Gather required core properties.
			*/
			var historyObj = {
				history : clone(state.history),
				index   : state.activeIndex
			};

			/*
				Gather optional core properties.
			*/
			if (state.expired !== 0) {
				historyObj.expired = state.expired;
			}
			if (state.expiredLast !== "") {
				historyObj.last = state.expiredLast;
			}
			if (state.expiredUnique !== "") {
				historyObj.unique = state.expiredUnique;
			}

			/*
				Gather optional miscellaneous properties.
			*/
			if (state.hasOwnProperty("prng")) {
				historyObj.seed = state.prng.seed;
			}

			return historyObj;
		}
	},

	unmarshalFromSave : {
		value : function (historyObj) {
			if (DEBUG) { console.log("[History.unmarshalFromSave()]"); }

			if (historyObj == null) { // lazy equality for null
				throw new Error("history object is null or undefined");
			}
			if (!historyObj.hasOwnProperty("history") || historyObj.history.length === 0) {
				throw new Error("history object has no history or history is empty");
			}
			if (!historyObj.hasOwnProperty("index")) {
				throw new Error("history object has no index property");
			}

			/*
				Cache the current history's seedable PRNG state.
			*/
			var hasPRNG = state.hasOwnProperty("prng");

			/*
				Reset the history.
			*/
			state = new History();

			/*
				Restore optional miscellaneous properties.
			*/
			if (hasPRNG) {
				History.initPRNG(historyObj.hasOwnProperty("seed") ? historyObj.seed : null);
			}

			/*
				Restore required core properties.
			*/
			state.history = clone(historyObj.history);
			state.activeIndex = historyObj.index;

			/*
				Restore optional core properties.
			*/
			if (historyObj.hasOwnProperty("expired")) {
				state.expired = historyObj.expired;
			}
			if (historyObj.hasOwnProperty("last")) {
				state.expiredLast = historyObj.last;
			}
			if (historyObj.hasOwnProperty("unique")) {
				state.expiredUnique = historyObj.unique;
			}

			/*
				Activate the current state (do this only after all properties have been restored).
			*/
			state.setActiveState(state.activeIndex);

			/*
				Display the active passage.
			*/
			state.show();
		}
	},

	deltaEncode : {
		value : function (hist) {
			if (!Array.isArray(hist)) {
				return null;
			}
			if (hist.length === 0) {
				return [];
			}

			var delta = [ clone(hist[0]) ];
			for (var i = 1, iend = hist.length; i < iend; ++i) {
				delta.push(Util.diff(hist[i - 1], hist[i]));
			}
			return delta;
		}
	},

	deltaDecode : {
		value : function (delta) {
			if (!Array.isArray(delta)) {
				return null;
			}
			if (delta.length === 0) {
				return [];
			}

			var hist = [ clone(delta[0]) ];
			for (var i = 1, iend = delta.length; i < iend; ++i) {
				hist.push(Util.patch(hist[i - 1], delta[i]));
			}
			return hist;
		}
	},

	initPRNG : {
		value : function (seed, useEntropy) {
			if (DEBUG) { console.log("[History.initPRNG()]"); }

			if (!state.isEmpty()) { // TODO: alternatively, we could check for the presence of `state.active.init`
				throw new Error("History.initPRNG must be called during initialization,"
					+ " within either a script section (Twine 1: a script-tagged passage,"
					+ " Twine 2: Story JavaScript) or the StoryInit special passage");
			}

			state.prng = new SeedablePRNG(seed, useEntropy);
			state.active.pull = state.prng.pull;
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
			for (var i = 0; i < this.tags.length; ++i) {
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
					+ '</span>').replace(/%passage%/g, Util.escape(this.title));
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
			if (config.passages.descriptions != null) { // lazy equality for null
				switch (typeof config.passages.descriptions) {
				case "boolean":
					if (config.passages.descriptions) {
						return this.title;
					}
					break;
				case "object":
					if (config.passages.descriptions.hasOwnProperty(this.title)) {
						return config.passages.descriptions[this.title];
					}
					break;
				case "function":
					var result = config.passages.descriptions.call(this);
					if (result) {
						return result;
					}
					break;
				default:
					throw new TypeError("config.passages.descriptions must be a boolean, object, or function");
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
			// check for image passage transclusion
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
			var passage = insertElement(null, "div", this.domId, "passage");
			passage.setAttribute("data-passage", this.title);

			// add classes (generated from tags) to the passage and <body>
			for (var i = 0; i < this.classes.length; ++i) {
				document.body.classList.add(this.classes[i]);
				passage.classList.add(this.classes[i]);
			}

			// execute pre-render tasks
			Object.keys(prerender).forEach(function (task) {
				if (typeof prerender[task] === "function") {
					prerender[task].call(this, passage, task);
				}
			}, this);

			// wikify the PassageHeader passage, if it exists, into the passage element
			if (tale.has("PassageHeader")) {
				new Wikifier(passage, tale.get("PassageHeader").processText());
			}

			// wikify the passage into its element
			new Wikifier(passage, this.processText());

			// wikify the PassageFooter passage, if it exists, into the passage element
			if (tale.has("PassageFooter")) {
				new Wikifier(passage, tale.get("PassageFooter").processText());
			}

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

	this._title   = "";
	this._domId   = "";
	this.passages = {};
	this.styles   = [];
	this.scripts  = [];
	this.widgets  = [];

	var	nodes = document.getElementById("store-area").childNodes;
	var	el, name, tags, passage;

	if (TWINE1) {
		config.passages.start = "Start"; // set the default starting passage title
		var	storyStylesheet,
			storyScript;
		for (var i = 0; i < nodes.length; ++i) {
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
			} else if (name === "StoryJavaScript") {
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
			// We cannot Wikify and then grab the text content here as parts of the `Wikifier`
			// depend on `tale` (being an instance of `Tale`), which we're in the process of
			// instantiating now.  Chicken <-> Egg.
			this.title = this.passages.StoryTitle.text.trim();
		} else {
			throw new Error("cannot find the StoryTitle special passage");
		}
	} else {
		config.passages.start = null; // no default starting passage title
		var startNode = nodes[0].hasAttribute("startnode") ? nodes[0].getAttribute("startnode") : "";
		nodes = nodes[0].childNodes;
		for (var i = 0; i < nodes.length; ++i) { // eslint-disable-line no-redeclare
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
					config.passages.start = name;
				}

				if (tags.contains("widget")) {
					this.widgets.push(passage);
				} else {
					this.passages[name] = passage;
				}
				break;
			}
		}

		this.title = "{{STORY_NAME}}";
	}

	// update instance reference in the `SugarCube` global object
	window.SugarCube[instanceName || "tale"] = this;
}

// Setup the Tale prototype
Object.defineProperties(Tale.prototype, {
	// getters/setters
	title : {
		get : function () {
			return this._title;
		},
		set : function (title) {
			if (title == null || title === "") { // lazy equality for null
				throw new Error("story title cannot be null or empty");
			}
			document.title = this._title = title;
			this._domId = Util.slugify(title);
		}
	},

	domId : {
		get : function () {
			return this._domId;
		}
	},

	// methods
	init : {
		value : function () {
			// This exists for things which must be done during initialization, but
			// which cannot be done within the constructor for whatever reason.
			if (TWINE1) {
				var buf = document.createElement("div");
				new Wikifier(buf, this.passages.StoryTitle.processText().trim());
				this.title = buf.textContent.trim();
			}
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
				var what = typeof title;
				throw new TypeError("Tale.prototype.has title parameter cannot be " + (what === "object" ? "an " + what : "a " + what));
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
				var what = typeof title;
				throw new TypeError("Tale.prototype.get title parameter cannot be " + (what === "object" ? "an " + what : "a " + what));
			}
		}
	},

	lookup : {
		value : function (key, value, sortKey) {
			if (!sortKey) { sortKey = "title"; }

			var	pnames  = Object.keys(this.passages),
				results = [];
			for (var i = 0; i < pnames.length; ++i) {
				var passage = this.passages[pnames[i]];
				if (passage.hasOwnProperty(key)) {
					switch (typeof passage[key]) {
					case "undefined":
						/* no-op */
						break;
					case "object":
						// currently, we assume that the only properties which are objects
						// will be either arrays or array-like-objects
						for (var j = 0, jend = passage[key].length; j < jend; ++j) {
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
	}
});

