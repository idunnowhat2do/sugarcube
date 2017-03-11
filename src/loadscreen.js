/***********************************************************************************************************************
 *
 * loadscreen.js
 *
 * Copyright © 2016–2017 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Config, Engine */

var LoadScreen = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Locks collection.
	const _locks = new Set();

	// Auto-incrementing lock ID.
	let _autoId = 0;


	/*******************************************************************************************************************
	 * readystatechange Event.
	 ******************************************************************************************************************/
	/*
		Setup a `readystatechange` handler for hiding/showing the loading screen.
	*/
	jQuery(document).on('readystatechange.SugarCube', () => {
		if (DEBUG) { console.log(`[SugarCube/readystatechange()] document.readyState: "${document.readyState}"`); }

		if (_locks.size > 0) {
			return;
		}

		const $html = jQuery(document.documentElement);

		/*
			The value of `document.readyState` may be: 'loading' -> 'interactive' -> 'complete'.
			Though, to reach this point, it must already be in, at least, the 'interactive' state.
		*/
		if (document.readyState === 'complete') {
			if ($html.hasClass('init-loading')) {
				if (Config.loadDelay > 0) {
					// TODO: Maybe check `_locks.size` before removing the load screen in the callback?
					setTimeout(
						() => $html.removeClass('init-loading'),
						Math.max(Engine.minDomActionDelay, Config.loadDelay)
					);
				}
				else {
					$html.removeClass('init-loading');
				}
			}
		}
		else {
			$html.addClass('init-loading');
		}
	});


	/*******************************************************************************************************************
	 * LoadScreen Functions.
	 ******************************************************************************************************************/
	/**
		Hide the loading screen.
	**/
	function loadScreenHide() {
		jQuery(document.documentElement).removeClass('init-loading');
	}

	/**
		Show the loading screen.
	**/
	function loadScreenShow() {
		jQuery(document.documentElement).addClass('init-loading');
	}

	/**
		Returns a new lock ID after locking and showing the loading screen.
	**/
	function loadScreenLock() {
		++_autoId;
		_locks.add(_autoId);
		loadScreenShow();
		return _autoId;
	}

	/**
		Remove the lock associated with the given lock ID and, if no locks remain,
		trigger a `readystatechange` event.
	**/
	function loadScreenUnlock(id) {
		if (id == null) { // lazy equality for null
			throw new Error('LoadScreen.unlock called with a null or undefined ID');
		}

		if (_locks.has(id)) {
			_locks.delete(id);
		}

		if (_locks.size === 0) {
			jQuery(document).trigger('readystatechange');
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		hide   : { value : loadScreenHide },
		show   : { value : loadScreenShow },
		lock   : { value : loadScreenLock },
		unlock : { value : loadScreenUnlock }
	}));
})();
