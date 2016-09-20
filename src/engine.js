/***********************************************************************************************************************
 *
 * engine.js
 *
 * Copyright © 2015–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Alert, Config, DebugView, LoadScreen, Save, State, Story, TempVariables:true, UI, Wikifier, postdisplay,
	       predisplay, prehistory
*/

var Engine = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const
		// Minimum delay for DOM actions (in milliseconds).
		minDomActionDelay = 40;

	let
		// Current state of the engine (values: 'idle', 'playing', 'rendering').
		_state = 'idle',

		// Last time `enginePlay()` was called (in milliseconds).
		_lastPlay = null,

		// Cache of the debug view for the StoryInit special passage.
		_storyInitDebugView = null;


	/*******************************************************************************************************************
	 * Engine Functions.
	 ******************************************************************************************************************/
	function engineStart() {
		if (DEBUG) { console.log('[Engine/engineStart()]'); }

		/*
			Execute the StoryInit special passage.
		*/
		if (Story.has('StoryInit')) {
			try {
				const debugBuffer = Wikifier.wikifyEval(Story.get('StoryInit').text);

				if (Config.debug) {
					const debugView = new DebugView(
						document.createDocumentFragment(),
						'special',
						'StoryInit',
						'StoryInit'
					);
					debugView.modes({ hidden : true });
					debugView.append(debugBuffer);
					_storyInitDebugView = debugView.output;
				}
			}
			catch (ex) {
				Alert.error('StoryInit', ex.message);
			}
		}

		/*
			Finalize various `Config` properties here, before any passages are displayed.

			We do this here to give authors every opportunity to modify these properties.
		*/
		Config.history.maxStates = Math.max(0, Config.history.maxStates);

		if (!Number.isSafeInteger(Config.history.maxStates)) {
			// TODO: Maybe this should throw instead?
			Config.history.maxStates = 100;
		}

		if (Config.history.maxStates === 1) {
			Config.history.controls = false;
		}

		if (Config.debug) {
			DebugView.init();
		}

		/*
			Attempt to restore an active session.  Failing that, attempt to autoload the autosave,
			if requested.  Failing that, display the starting passage.
		*/
		if (Config.passages.start == null) { // lazy equality for null
			throw new Error('starting passage not selected');
		}

		if (!Story.has(Config.passages.start)) {
			throw new Error(`starting passage ("${Config.passages.start}") not found`);
		}

		if (State.restore()) {
			engineShow();
		}
		else {
			let loadStart = true;

			switch (typeof Config.saves.autoload) {
			case 'boolean':
				if (Config.saves.autoload && Save.autosave.ok() && Save.autosave.has()) {
					if (DEBUG) { console.log(`\tattempting autoload: "${Save.autosave.get().title}"`); }

					loadStart = !Save.autosave.load();
				}
				break;
			case 'string':
				if (Config.saves.autoload === 'prompt' && Save.autosave.ok() && Save.autosave.has()) {
					loadStart = false;
					UI.buildDialogAutoload();
					UI.open();
				}
				break;
			case 'function':
				if (Save.autosave.ok() && Save.autosave.has() && !!Config.saves.autoload()) {
					if (DEBUG) { console.log(`\tattempting autoload: "${Save.autosave.get().title}"`); }

					loadStart = !Save.autosave.load();
				}
				break;
			}

			if (loadStart) {
				if (DEBUG) { console.log(`\tstarting passage: "${Config.passages.start}"`); }

				enginePlay(Config.passages.start);
			}
		}
	}

	/**
		Restarts the story.
	**/
	function engineRestart() {
		if (DEBUG) { console.log('[Engine/engineRestart()]'); }

		/*
			Show the loading screen to hide any unsightly rendering shenanigans during the
			page reload.
		*/
		LoadScreen.show();

		/*
			Scroll the window to the top.

			This is required by most browsers for the starting passage or it will remain at
			whatever its current scroll position is after the page reload.  We do it generally,
			rather than only for the currently set starting passage, since the starting passage
			may be dynamically manipulated.
		*/
		window.scroll(0, 0);

		/*
			Delete the active session and reload the page.
		*/
		State.reset();
		window.location.reload();
	}

	/**
		Returns the current state of the engine.
	**/
	function engineState() {
		return _state;
	}

	/**
		Returns the last time `enginePlay()` was called (in milliseconds).
	**/
	function engineLastPlay() {
		return _lastPlay;
	}

	/**
		Activate the moment at the given index within the state history and show it.
	**/
	function engineGoTo(idx) {
		const succeded = State.goTo(idx);

		if (succeded) {
			engineShow();
		}

		return succeded;
	}

	/**
		Activate the moment at the given offset from the active moment within the state history
		and show it.
	**/
	function engineGo(offset) {
		const succeded = State.go(offset);

		if (succeded) {
			engineShow();
		}

		return succeded;
	}

	/**
		Go to the moment which directly precedes the active moment and show it.
	**/
	function engineBackward() {
		return engineGo(-1);
	}

	/**
		Go to the moment which directly follows the active moment and show it.
	**/
	function engineForward() {
		return engineGo(1);
	}

	/**
		Renders and displays the active (present) moment's associated passage without adding
		a new moment to the history.
	**/
	function engineShow() {
		return enginePlay(State.passage, true);
	}

	/**
		Renders and displays the passage referenced by the given title, optionally without
		adding a new moment to the history.
	**/
	function enginePlay(title, noHistory) {
		if (DEBUG) { console.log(`[Engine/enginePlay(title: "${title}", noHistory: ${noHistory})]`); }

		/*
			Update the engine state.
		*/
		_state = 'playing';

		/*
			Reset the temporary state and variables objects.
		*/
		TempState = {}; // eslint-disable-line no-undef
		TempVariables = {};

		// We must also update the `window.SugarCube` debugging references.
		// window.SugarCube.TempState = TempState;
		window.SugarCube.TempVariables = TempVariables;

		/*
			Debug view setup.
		*/
		let passageReadyOutput, passageDoneOutput;

		/*
			Retrieve the passage by the given title.

			NOTE: The `title` parameter may be empty, a string, or a number (though using a
			      number as reference to a numeric title should be discouraged), so after
			      loading the passage, always refer to `passage.title` and never the `title`
			      parameter.
		*/
		const passage = Story.get(title);

		/*
			Execute the pre-history tasks.
		*/
		Object.keys(prehistory).forEach(function (task) {
			if (typeof prehistory[task] === 'function') {
				prehistory[task].call(this, task);
			}
		}, passage);

		/*
			Create a new entry in the history.
		*/
		if (!noHistory) {
			State.create(passage.title);
		}

		/*
			Clear `<body>` classes, then execute the `PassageReady` passage and `predisplay` tasks.
		*/
		if (document.body.className) {
			document.body.className = '';
		}

		Object.keys(predisplay).forEach(function (task) {
			if (typeof predisplay[task] === 'function') {
				predisplay[task].call(this, task);
			}
		}, passage);

		if (Story.has('PassageReady')) {
			try {
				passageReadyOutput = Wikifier.wikifyEval(Story.get('PassageReady').text);
			}
			catch (ex) {
				Alert.error('PassageReady', ex.message);
			}
		}

		/*
			Update the engine state.
		*/
		_state = 'rendering';

		/*
			Render the incoming passage and add it to the page.
		*/
		const
			$incoming = jQuery(passage.render()),
			passages  = document.getElementById('passages');

		if (passages.hasChildNodes()) {
			if (
				/* eslint-disable no-extra-parens */
				   typeof Config.passages.transitionOut === 'number'
				|| (
					   typeof Config.passages.transitionOut === 'string'
					&& Config.passages.transitionOut !== ''
					&& Config.transitionEndEventName !== ''
				)
				/* eslint-enable no-extra-parens */
			) {
				[...passages.childNodes].forEach(outgoing => {
					const $outgoing = jQuery(outgoing);

					if (outgoing.nodeType === Node.ELEMENT_NODE && $outgoing.hasClass('passage')) {
						if ($outgoing.hasClass('passage-out')) {
							return;
						}

						$outgoing
							.attr('id', `out-${$outgoing.attr('id')}`)
							.addClass('passage-out');

						if (typeof Config.passages.transitionOut === 'string') {
							$outgoing.on(Config.transitionEndEventName, ev => {
								if (ev.originalEvent.propertyName === Config.passages.transitionOut) {
									$outgoing.remove();
								}
							});
						}
						else {
							setTimeout(() => $outgoing.remove(),
								Math.max(minDomActionDelay, Config.passages.transitionOut));
						}
					}
					else {
						$outgoing.remove();
					}
				});
			}
			else {
				jQuery(passages).empty();
			}
		}
		$incoming
			.addClass('passage-in')
			.appendTo(passages);
		setTimeout(() => $incoming.removeClass('passage-in'), minDomActionDelay);

		/*
			Set the document title.
		*/
		document.title = Config.passages.displayTitles && passage.title !== Config.passages.start
			? `${passage.title} | ${Story.title}`
			: Story.title;

		/*
			Scroll the window to the top.
		*/
		window.scroll(0, 0);

		/*
			Update the engine state.
		*/
		_state = 'playing';

		/*
			Execute the `PassageDone` passage and `postdisplay` tasks, then update the non-passage
			page elements, if enabled.
		*/
		if (Story.has('PassageDone')) {
			try {
				passageDoneOutput = Wikifier.wikifyEval(Story.get('PassageDone').text);
			}
			catch (ex) {
				Alert.error('PassageDone', ex.message);
			}
		}

		Object.keys(postdisplay).forEach(function (task) {
			if (typeof postdisplay[task] === 'function') {
				postdisplay[task].call(this, task);
			}
		}, passage);

		if (Config.ui.updateStoryElements) {
			UI.setStoryElements();
		}

		/*
			Add the completed debug views for `StoryInit`, `PassageReady`, and `PassageDone`
			to the incoming passage element.
		*/
		if (Config.debug) {
			let debugView;

			// Prepend the `PassageReady` debug view.
			if (passageReadyOutput != null) { // lazy equality for null
				debugView = new DebugView(
					document.createDocumentFragment(),
					'special',
					'PassageReady',
					'PassageReady'
				);
				debugView.modes({ hidden : true });
				debugView.append(passageReadyOutput);
				$incoming.prepend(debugView.output);
			}

			// Append the `PassageDone` debug view.
			if (passageDoneOutput != null) { // lazy equality for null
				debugView = new DebugView(
					document.createDocumentFragment(),
					'special',
					'PassageDone',
					'PassageDone'
				);
				debugView.modes({ hidden : true });
				debugView.append(passageDoneOutput);
				$incoming.append(debugView.output);
			}

			// Prepend the cached `StoryInit` debug view, if we're showing the first moment/turn.
			if (State.turns === 1 && _storyInitDebugView != null) { // lazy equality for null
				$incoming.prepend(_storyInitDebugView);
			}
		}

		/*
			Update the last display time.
		*/
		_lastPlay = Date.now();

		/*
			Last second post-processing for accessibility and other things.
		*/
		UI.hideOutlines(); // initially hide outlines
		jQuery('#story')
			// Add `link-external` to all `href` bearing `<a>` elements which don't have it.
			.find('a[href]:not(.link-external)')
				.addClass('link-external')
				.end()
			// Add `tabindex=0` to all interactive elements which don't have it.
			.find('a,link,button,input,select,textarea')
				.not('[tabindex]')
					.attr('tabindex', 0);

		/*
			Handle autosaves.
		*/
		switch (typeof Config.saves.autosave) {
		case 'boolean':
			if (Config.saves.autosave) {
				Save.autosave.save();
			}
			break;
		case 'string':
			if (passage.tags.includes(Config.saves.autosave)) {
				Save.autosave.save();
			}
			break;
		case 'object':
			if (
				   Array.isArray(Config.saves.autosave)
				&& passage.tags.some(tag => Config.saves.autosave.includes(tag))
			) {
				Save.autosave.save();
			}
			break;
		}

		/*
			Reset the engine state.
		*/
		_state = 'idle';

		// TODO: Let this return the jQuery wrapped element, rather than just the element.
		return $incoming[0];
	}


	/*******************************************************************************************************************
	 * Legacy Functions.
	 ******************************************************************************************************************/
	/**
		[DEPRECATED] Play the given passage, optionally without altering the history.
	**/
	function engineDisplay(title, link, option) {
		if (DEBUG) { console.log('[Engine/engineDisplay()]'); }

		let noHistory = false;

		// Process the option parameter.
		switch (option) {
		case undefined:
			/* no-op */
			break;

		case 'replace':
		case 'back':
			noHistory = true;
			break;

		default:
			throw new Error(`Engine.display option parameter called with obsolete value "${option}"; please notify the developer`);
		}

		enginePlay(title, noHistory);
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Constants.
		*/
		minDomActionDelay : { value : minDomActionDelay },

		/*
			Core Functions.
		*/
		start    : { value : engineStart },
		restart  : { value : engineRestart },
		state    : { get : engineState },
		lastPlay : { get : engineLastPlay },
		goTo     : { value : engineGoTo },
		go       : { value : engineGo },
		backward : { value : engineBackward },
		forward  : { value : engineForward },
		show     : { value : engineShow },
		play     : { value : enginePlay },

		/*
			Legacy Functions.
		*/
		display : { value : engineDisplay }
	}));
})();
