/***********************************************************************************************************************
 *
 * state.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global DebugView, Save, PRNGWrapper, Story, TempState:true, TempVariables:true, UI, Util, Wikifier, clone, config,
	       minDOMActionDelay, postdisplay, predisplay, prehistory, removeChildren, session, technicalAlert
*/

var State = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	var
		/*
			Core properties.
		*/
		_history       = [],             // History moment stack
		_active        = momentCreate(), // Currently active/played moment
		_activeIndex   = -1,             // Currently active/played moment index
		_expired       = 0,              // Total number of moment which have expired (i.e. fallen off the bottom of the stack)
		_expiredLast   = "",             // Title of the most recently expired moment
		_expiredUnique = "",             // Title of the most recently expired moment whose title does not match that of the bottom moment

		/*
			Miscellaneous properties.
		*/
		_lastPlay = null, // Last time `statePlay()` was called, in milliseconds
		_prng     = null, // [optional] Seedable PRNG object

		/*
			Temporary variables.
		*/
		_storyInitDebugView = null; // Cache of the debug view for the StoryInit special passage


	/*******************************************************************************************************************
	 * State Functions
	 ******************************************************************************************************************/
	/**
		Initializes the story state.
	**/
	function stateInit() {
		if (DEBUG) { console.log("[State/stateInit()]"); }

		/*
			Execute the StoryInit special passage.
		*/
		if (Story.has("StoryInit")) {
			try {
				var debugBuffer = Wikifier.wikifyEval(Story.get("StoryInit").text);
				if (config.debug) {
					var debugView = new DebugView(
						document.createDocumentFragment(),
						"special",
						"StoryInit",
						"StoryInit"
					);
					debugView.modes({ hidden : true });
					debugView.append(debugBuffer);
					_storyInitDebugView = debugView.output;
				}
			} catch (e) {
				technicalAlert("StoryInit", e.message);
			}
		}

		/*
			Die if deprecated `config.history` properties are seen.
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
		config.history.maxStates = Math.max(0, Number(config.history.maxStates));
		if (isNaN(config.history.maxStates) || !isFinite(config.history.maxStates)) {
			// TODO: Maybe this should throw instead?
			config.history.maxStates = 150;
		}
		if (config.history.maxStates === 1) {
			config.history.controls = false;
		}

		/*
			Finalize the `config.debug` property here, before any passages are displayed.

			n.b. We do this here to give authors every opportunity to modify the `config.debug` property.
		*/
		if (config.debug) {
			DebugView.init();
		}

		/*
			Attempt to restore an active session.  Failing that, attempt to autoload the autosave,
			if requested.  Failing that, display the starting passage.
		*/
		if (config.passages.start == null) { // lazy equality for null
			throw new Error("starting passage not selected");
		}
		if (!Story.has(config.passages.start)) {
			throw new Error('starting passage ("' + config.passages.start + '") not found');
		}
		if (!stateRestore()) {
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
				statePlay(config.passages.start);
			}
		}
	}

	/**
		Resets the story state.
	**/
	function stateReset() { // eslint-disable-line no-unused-vars
		if (DEBUG) { console.log("[State/stateReset()]"); }

		/*
			Core properties.
		*/
		_history       = [];
		_active        = momentCreate();
		_activeIndex   = -1;
		_expired       = 0;
		_expiredLast   = "";
		_expiredUnique = "";

		/*
			Miscellaneous properties.
		*/
		_lastPlay = null;
		_prng     = _prng === null ? null : new PRNGWrapper(_prng.seed, false);
	}

	/**
		Reinitializes the story state, forgetting the active session.
	**/
	function stateRestart() {
		if (DEBUG) { console.log("[State/stateRestart()]"); }

		/*
			Trigger the loading screen to hide any unsightly rendering shenanigans during
			the page reload.
		*/
		document.documentElement.classList.add("init-loading");

		/*
			Scroll the window to the top.

			This is required by most browsers for the starting passage or it will remain at
			whatever its current scroll position is after the page reload.

			We do it generally, rather than only for the currently set starting passage, since
			if the starting passage is being manipulated dynamically, the current passage may be
			the starting passage post-reload even if it is not now.
		*/
		window.scroll(0, 0);

		/*
			Delete the active session and reload the page.
		*/
		session.delete("state");
		window.location.reload();
	}

	/**
		Restores the story state from the active session.
	**/
	function stateRestore() {
		if (DEBUG) { console.log("[State/stateRestore()]"); }

		/*
			Attempt to restore an active session.
		*/
		if (session.has("state")) {
			/*
				Retrieve the session.
			*/
			var stateObj = session.get("state");
			if (DEBUG) { console.log("    > session state:", stateObj); }
			if (stateObj == null) { // lazy equality for null
				return false;
			}

			/*
				Restore the session.
			*/
			stateUnmarshal(stateObj);
			return true;
		}

		return false;
	}

	/**
		Returns the current story state marshaled into a serializable object.
	**/
	function stateMarshal(noDelta) {
		/*
			Gather core properties.
		*/
		var stateObj = {
			index : _activeIndex
		};
		if (noDelta) {
			stateObj.history = clone(_history);
		} else {
			stateObj.delta = historyDeltaEncode(_history);
		}
		if (_expired !== 0) {
			stateObj.expired = _expired;
		}
		if (_expiredLast !== "") {
			stateObj.last = _expiredLast;
		}
		if (_expiredUnique !== "") {
			stateObj.unique = _expiredUnique;
		}

		/*
			Gather miscellaneous properties.
		*/
		if (_prng !== null) {
			stateObj.seed = _prng.seed;
		}

		return stateObj;
	}

	/**
		Restores the story state from a marshaled story state serialization object.
	**/
	function stateUnmarshal(stateObj, noDelta) {
		if (stateObj == null) { // lazy equality for null
			throw new Error("state object is null or undefined");
		}
		if (
			   !stateObj.hasOwnProperty(noDelta ? "history" : "delta")
			|| stateObj[noDelta ? "history" : "delta"].length === 0
		) {
			throw new Error("state object has no history or history is empty");
		}
		if (!stateObj.hasOwnProperty("index")) {
			throw new Error("state object has no index");
		}
		if (_prng !== null && !stateObj.hasOwnProperty("seed")) {
			throw new Error("state object has no seed, but PRNG is enabled");
		}
		if (_prng === null && stateObj.hasOwnProperty("seed")) {
			throw new Error("state object has seed, but PRNG is disabled");
		}

		/*
			Restore core properties.
		*/
		_history       = noDelta ? clone(stateObj.history) : historyDeltaDecode(stateObj.delta);
		_activeIndex   = stateObj.index;
		_expired       = stateObj.hasOwnProperty("expired") ? stateObj.expired : 0;
		_expiredLast   = stateObj.hasOwnProperty("last")    ? stateObj.last    : "";
		_expiredUnique = stateObj.hasOwnProperty("unique")  ? stateObj.unique  : "";

		/*
			Restore miscellaneous properties.
		*/
		_lastPlay = null;
		if (stateObj.hasOwnProperty("seed")) {
			/*
				We only need to restore the PRNG's seed here as `momentActivate()` will handle
				fully restoring the PRNG to its proper state.
			*/
			_prng.seed = stateObj.seed;
		}

		/*
			Activate the current moment (do this only after all properties have been restored).
		*/
		momentActivate(_activeIndex);

		/*
			Play the active moment.
		*/
		stateShow();
	}

	/**
		Returns the current story state marshaled into a save-compatible serializable object.
	**/
	function stateMarshalForSave() {
		return stateMarshal(true);
	}

	/**
		Restores the story state from a marshaled save-compatible story state serialization object.
	**/
	function stateUnmarshalForSave(stateObj) {
		return stateUnmarshal(stateObj, true);
	}

	/**
		Returns the total number of expired moments.
	**/
	function stateExpired() {
		return _expired;
	}

	/**
		Returns the title of the most recently expired moment.
	**/
	function stateExpiredLast() {
		return _expiredLast;
	}

	/**
		Returns the title of the most recently expired moment whose title does not match
		that of the bottommost moment.
	**/
	function stateExpiredUnique() {
		return _expiredUnique;
	}

	/**
		Returns the elapsed time (in milliseconds) since the current moment was played.
	**/
	function stateLastPlay() {
		return _lastPlay;
	}


	/*******************************************************************************************************************
	 * Moment Functions
	 ******************************************************************************************************************/
	/**
		Returns a new moment object created from the given passage title and variables object.
	**/
	function momentCreate(title, variables) {
		return {
			title     : title == null ? "" : String(title),       // lazy equality for null
			variables : variables == null ? {} : clone(variables) // lazy equality for null
		};
	}

	/**
		Returns the active (present) moment.
	**/
	function momentActive() {
		return _active;
	}

	/**
		Returns the index within the history of the active (present) moment.
	**/
	function momentActiveIndex() {
		return _activeIndex;
	}

	/**
		Returns the title from the active (present) moment.
	**/
	function momentActiveTitle() {
		return _active.title;
	}

	/**
		Returns the variables from the active (present) moment.
	**/
	function momentActiveVariables() {
		return _active.variables;
	}

	/**
		Returns the active (present) moment after setting it to either the given moment object
		or the moment object at the given history index.  Additionally, updates the active session
		and triggers a history update event.
	**/
	function momentActivate(moment) {
		if (moment == null) { // lazy equality for null
			throw new Error("moment activation attempted with null or undefined");
		}

		/*
			Set the active moment.
		*/
		switch (typeof moment) {
		case "object":
			_active = clone(moment);
			break;

		case "number":
			if (historyIsEmpty()) {
				throw new Error("moment activation attempted with index on empty history");
			}
			if (moment < 0 || moment >= historySize()) {
				throw new RangeError("moment activation attempted with out-of-bounds index"
					+ "; need [0, " + (historySize() - 1) + "], got " + moment);
			}
			_active = clone(_history[moment]);
			break;

		default:
			throw new TypeError('moment activation attempted with a "' + typeof moment
				+ '"; must be an object or valid history stack index');
		}

		/*
			Restore the seedable PRNG.

			n.b. We cannot simply set `_prng.pull` to `_active.pull` as that would not
			     properly mutate the PRNG's internal state.

			TODO: I believe that seedrandom has been updated to expose its internal state in
			      various ways.  It may now be possible to use that to restore its internal
			      state, rather than having to unmarshal the PRNG every time.
		*/
		if (_prng !== null) {
			_prng = PRNGWrapper.unmarshal({
				seed : _prng.seed,
				pull : _active.pull
			});
		}

		/*
			Update the active session.
		*/
		session.set("state", stateMarshal());

		/*
			Trigger a global `tw:historyupdate` event.

			n.b. We do this here because setting a new active moment is a core component of,
			     virtually, all history updates.
		*/
		jQuery.event.trigger("tw:historyupdate");

		return _active;
	}


	/*******************************************************************************************************************
	 * History Functions
	 ******************************************************************************************************************/
	/**
		Returns the moment history.
	**/
	function historyGet() {
		return _history;
	}

	/**
		Returns the number of active history moments (past only).
	**/
	function historyLength() {
		return _activeIndex + 1;
	}

	/**
		Returns the total number of history moments (past + future).
	**/
	function historySize() {
		return _history.length;
	}

	/**
		Returns whether the history is empty.
	**/
	function historyIsEmpty() {
		return _history.length === 0;
	}

	/**
		Returns the topmost (most recent) moment from the history.
	**/
	function historyTop() {
		return _history.length !== 0 ? _history[_history.length - 1] : null;
	}

	/**
		Returns the bottommost (least recent) moment from the history.
	**/
	function historyBottom() {
		return _history.length !== 0 ? _history[0] : null;
	}

	/**
		Returns the moment at the given index from the history.
	**/
	function historyIndex(idx) {
		if (historyIsEmpty() || idx < 0 || idx > _activeIndex) {
			return null;
		}
		return _history[idx];
	}

	/**
		Returns the moment at the given offset from the active moment from the history.
	**/
	function historyPeek(at) {
		if (historyIsEmpty()) {
			return null;
		}
		at = 1 + (at ? Math.abs(at) : 0);
		if (at > historyLength()) {
			return null;
		}
		return _history[historyLength() - at];
	}

	/**
		Returns whether a moment with the given title exists within the history.
	**/
	function historyHas(title) {
		if (historyIsEmpty() || title == null || title === "") { // lazy equality for null
			return false;
		}

		for (var i = _activeIndex; i >= 0; --i) {
			if (_history[i].title === title) {
				return true;
			}
		}

		return false;
	}

	/**
		Pushes a new moment onto the history, discarding future moments if necessary.
	**/
	function historyPush(moment) {
		if (DEBUG) { console.log("[State/historyPush()]"); }

		/*
			TODO: It might be good to have some assertions about the moment in here.
		*/

		if (moment == null) { // lazy equality for null
			return historyLength();
		}

		/*
			If we're not at the top of the stack, discard the future moments.
		*/
		if (historyLength() < historySize()) {
			if (DEBUG) { console.log("    > non-top push; discarding " + (historySize() - historyLength()) + " future moments"); }
			_history.splice(historyLength(), historySize() - historyLength());
		}

		/*
			Push the new moment onto the history stack.
		*/
		_history.push(moment);
		if (_prng) {
			historyTop().pull = _prng.pull;
		}

		/*
			Truncate the history, if necessary, by discarding moments from the bottom.
		*/
		if (config.history.maxStates !== 0) {
			// Using `slice()` or `splice()` here would be difficult, as we need to set the
			// two expired passage name properties, so we use `shift()` within a loop.
			while (historySize() > config.history.maxStates) {
				_expiredLast = _history.shift().title;
				if (_expiredLast !== historyBottom().title) {
					_expiredUnique = _expiredLast;
				}
				++_expired;
			}
		}

		/*
			Activate the new top moment.
		*/
		_activeIndex = historySize() - 1;
		momentActivate(_activeIndex);

		return historyLength();
	}

	/**
		Activate and show the moment at the given index within the history.
	**/
	function historyGoTo(idx) {
		if (DEBUG) { console.log("[State/historyGoTo(" + idx + ")]"); }

		if (
			   idx == null /* lazy equality for null */
			|| idx < 0
			|| idx >= historySize()
			|| idx === _activeIndex
		) {
			return false;
		}

		_activeIndex = idx;
		momentActivate(_activeIndex);
		stateShow();

		return true;
	}

	/**
		Activate and show the moment at the given offset from the active moment within the history.
	**/
	function historyGo(offset) {
		if (DEBUG) { console.log("[State/historyGo(" + offset + ")]"); }

		if (offset == null || offset === 0) { // lazy equality for null
			return false;
		}

		return historyGoTo(_activeIndex + offset);
	}

	/**
		Activate and show the moment within the history which directly precedes the active moment.
	**/
	function historyBackward() {
		return historyGo(-1);
	}

	/**
		Activate and show the moment within the history which directly follows the active moment.
	**/
	function historyForward() {
		return historyGo(1);
	}

	/**
		Returns the delta encoded form of the given history array.
	**/
	function historyDeltaEncode(historyArr) {
		if (!Array.isArray(historyArr)) {
			return null;
		}
		if (historyArr.length === 0) {
			return [];
		}

		var delta = [ clone(historyArr[0]) ];
		for (var i = 1, iend = historyArr.length; i < iend; ++i) {
			delta.push(Util.diff(historyArr[i - 1], historyArr[i]));
		}
		return delta;
	}

	/**
		Returns a history array from the given delta encoded history array.
	**/
	function historyDeltaDecode(delta) {
		if (!Array.isArray(delta)) {
			return null;
		}
		if (delta.length === 0) {
			return [];
		}

		var historyArr = [ clone(delta[0]) ];
		for (var i = 1, iend = delta.length; i < iend; ++i) {
			historyArr.push(Util.patch(historyArr[i - 1], delta[i]));
		}
		return historyArr;
	}


	/*******************************************************************************************************************
	 * PRNG Functions
	 ******************************************************************************************************************/
	function prngInit(seed, useEntropy) {
		if (DEBUG) { console.log("[State/prngInit()]"); }

		if (!historyIsEmpty()) {
			var scriptSection;

			if (TWINE1) { // for Twine 1
				scriptSection = "a script-tagged passage";
			} else { // for Twine 2
				scriptSection = "the Story JavaScript";
			}

			throw new Error("State.initPRNG must be called during initialization, within either "
				+ scriptSection + " or the StoryInit special passage");
		}

		_prng = new PRNGWrapper(seed, useEntropy);
		_active.pull = _prng.pull;
	}

	function prngRandom() {
		if (DEBUG) { console.log("[State/prngRandom()]"); }
		return _prng ? _prng.random() : Math.random();
	}


	/*******************************************************************************************************************
	 * Legacy Functions
	 ******************************************************************************************************************/
	/*
		TODO: These methods do not belong in the `State` object.  They should be moved
		      elsewhere eventually.
	*/
	/* legacy */
	function stateDisplay(title, link, option) {
		if (DEBUG) { console.log("[State/stateDisplay()]"); }

		// Process the option parameter.
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
			throw new Error('State.display option parameter called with obsolete value "'
				+ option + '"; please notify the developer');
		}

		statePlay(title, noHistory);
	}
	/* /legacy */

	function stateShow() {
		return statePlay(_active.title, true);
	}

	function statePlay(title, noHistory) {
		if (DEBUG) { console.log("[State/statePlay()]"); }

		/*
			Reset the temporary state and variables objects.
		*/
		TempState = {};
		window.SugarCube.TempVariables = TempVariables = {}; // update the `window.SugarCube` debugging reference

		/*
			Debug view setup.
		*/
		var passageReadyOutput, passageDoneOutput;

		/*
			Retrieve the passage by the given title.

			n.b. The `title` parameter may be empty, a string, or a number (though using a number
			     as reference to a numeric title should be discouraged), so after loading the
			     passage, always refer to `passage.title` and never the `title` parameter.
		*/
		var passage = Story.get(title);

		/*
			Execute the pre-history tasks.
		*/
		Object.keys(prehistory).forEach(function (task) {
			if (typeof prehistory[task] === "function") {
				prehistory[task].call(this, task);
			}
		}, passage);

		/*
			Create a new entry in the history.
		*/
		if (!noHistory) {
			historyPush(momentCreate(passage.title, _active.variables));
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
		if (Story.has("PassageReady")) {
			try {
				passageReadyOutput = Wikifier.wikifyEval(Story.get("PassageReady").text);
			} catch (e) {
				technicalAlert("PassageReady", e.message);
			}
		}

		/*
			Render the incoming passage and update the last display time.
		*/
		var incoming = passage.render();
		_lastPlay = Date.now();

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
							}, Math.max(minDOMActionDelay, config.passages.transitionOut));
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
		}, minDOMActionDelay);

		/*
			Set the document title.
		*/
		document.title = config.passages.displayTitles && passage.title !== config.passages.start
			? passage.title + " | " + Story.title
			: Story.title;

		/*
			Scroll the window to the top.
		*/
		window.scroll(0, 0);

		/*
			Execute the `PassageDone` passage and `postdisplay` tasks, then update the non-passage
			page elements, if enabled.
		*/
		if (Story.has("PassageDone")) {
			try {
				passageDoneOutput = Wikifier.wikifyEval(Story.get("PassageDone").text);
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
			Add the completed debug views for `StoryInit`, `PassageReady`, and `PassageDone`
			to the incoming passage element.
		*/
		if (config.debug) {
			var debugView;

			// Prepend the `PassageReady` debug view.
			if (passageReadyOutput != null) { // lazy equality for null
				debugView = new DebugView(
					document.createDocumentFragment(),
					"special",
					"PassageReady",
					"PassageReady"
				);
				debugView.modes({ hidden : true });
				debugView.append(passageReadyOutput);
				jQuery(incoming).prepend(debugView.output);
			}

			// Append the `PassageDone` debug view.
			if (passageDoneOutput != null) { // lazy equality for null
				debugView = new DebugView(
					document.createDocumentFragment(),
					"special",
					"PassageDone",
					"PassageDone"
				);
				debugView.modes({ hidden : true });
				debugView.append(passageDoneOutput);
				jQuery(incoming).append(debugView.output);
			}

			// Prepend the cached `StoryInit` debug view, if we're showing the first moment/turn.
			if (historyLength() === 1 && _storyInitDebugView != null) { // lazy equality for null
				jQuery(incoming).prepend(_storyInitDebugView);
			}
		}


		/*
			Last second post-processing for accessibility and other things.

			TODO: Perhaps this should be limited to the incoming passage and, if so,
			      maybe before its contents are added to the DOM?
		*/
		UI.patchOutlines(true); // initially hide outlines
		jQuery("#story")
			// Add `link-external` to all `href` bearing `<a>` elements which don't have it.
			.find("a[href]:not(.link-external)")
				.addClass("link-external")
				.end()
			// Add `tabindex=0` to all interactive elements which don't have it.
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


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			State Functions.
		*/
		init             : { value : stateInit },
		restart          : { value : stateRestart },
		marshalForSave   : { value : stateMarshalForSave },
		unmarshalForSave : { value : stateUnmarshalForSave },
		expired          : { get : stateExpired },
		expiredLast      : { get : stateExpiredLast },
		expiredUnique    : { get : stateExpiredUnique },
		lastPlay         : { get : stateLastPlay },

		/*
			Moment Functions.
		*/
		active      : { get : momentActive },
		activeIndex : { get : momentActiveIndex },
		passage     : { get : momentActiveTitle },     // shortcut for `Story.active.title`
		variables   : { get : momentActiveVariables }, // shortcut for `Story.active.variables`

		/*
			History Functions.
		*/
		history     : { get : historyGet },
		length      : { get : historyLength },
		size        : { get : historySize },
		isEmpty     : { value : historyIsEmpty },
		top         : { value : historyTop },
		bottom      : { value : historyBottom },
		index       : { value : historyIndex },
		peek        : { value : historyPeek },
		has         : { value : historyHas },
		goTo        : { value : historyGoTo },
		go          : { value : historyGo },
		backward    : { value : historyBackward },
		forward     : { value : historyForward },
		deltaEncode : { value : historyDeltaEncode },
		deltaDecode : { value : historyDeltaDecode },

		/*
			PRNG Functions.
		*/
		initPRNG : { value : prngInit },
		random   : { value : prngRandom },

		/*
			Legacy Functions.
		*/
		display : { value : stateDisplay },
		show    : { value : stateShow },
		play    : { value : statePlay }
	}));

})();

/* legacy */
/*
	Create a legacy alias for `History`; the `state` alias is handled in `sugarcube.js`.
*/
var History = State; // eslint-disable-line no-unused-vars
/* /legacy */

