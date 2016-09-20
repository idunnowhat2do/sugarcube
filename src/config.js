/***********************************************************************************************************************
 *
 * config.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var Config = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const Config = Object.seal({
		/*
			General properties.
		*/
		debug                 : false,
		addVisitedLinkClass   : false,
		cleanupWikifierOutput : false,
		loadDelay             : 0,

		/*
			State history properties.
		*/
		history : Object.seal({
			controls  : true,
			maxStates : 100,

			// Die if deprecated `Config.history` properties are accessed.
			get mode()  { _throwHistoryModeError(); },
			set mode(_) { _throwHistoryModeError(); },
			get tracking()  { _throwHistoryTrackingError(); },
			set tracking(_) { _throwHistoryTrackingError(); }
		}),

		/*
			Macros properties.
		*/
		macros : Object.seal({
			ifAssignmentError : true,
			maxLoopIterations : 1000
		}),

		/*
			Passages properties.
		*/
		passages : Object.seal({
			descriptions  : undefined,
			displayTitles : false,
			start         : undefined, // set by `Story.load()`
			transitionOut : undefined
		}),

		/*
			Saves properties.
		*/
		saves : Object.seal({
			autoload  : undefined,
			autosave  : undefined,
			id        : 'untitled-story',
			isAllowed : undefined,
			onLoad    : undefined,
			onSave    : undefined,
			slots     : 8,
			version   : undefined
		}),

		/*
			UI properties.
		*/
		ui : Object.seal({
			stowBarInitially    : false,
			updateStoryElements : true
		}),

		/*
			Transition properties.
		*/
		transitionEndEventName : (() => {
			const
				teMap  = new Map([
					['transition',       'transitionend'],
					['MSTransition',     'msTransitionEnd'],
					['WebkitTransition', 'webkitTransitionEnd'],
					['MozTransition',    'transitionend']
				]),
				teKeys = [...teMap.keys()],
				el     = document.createElement('div');

			for (let i = 0; i < teKeys.length; ++i) {
				if (el.style[teKeys[i]] !== undefined) {
					return teMap.get(teKeys[i]);
				}
			}

			return '';
		})()
	});

	function _throwHistoryModeError() {
		throw new Error('Config.history.mode has been deprecated and is no longer used by SugarCube, please remove it from your code');
	}

	function _throwHistoryTrackingError() {
		throw new Error('Config.history.tracking has been deprecated, use Config.history.maxStates instead');
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Config;
})();
