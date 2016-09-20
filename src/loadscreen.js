/***********************************************************************************************************************
 *
 * loadscreen.js
 *
 * Copyright © 2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Config, Engine */

var LoadScreen = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	let
		// Loading screen lock state.
		_locked = false;


	/*******************************************************************************************************************
	 * readystatechange Event.
	 ******************************************************************************************************************/
	/*
		Setup a `readystatechange` handler for hiding/showing the loading screen.
	*/
	jQuery(document).on('readystatechange.SugarCube', () => {
		if (DEBUG) { console.log(`[SugarCube/readystatechange()] document.readyState: "${document.readyState}"`); }

		if (_locked) {
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
					// TODO: Maybe check `_locked` before removing the load screen in the callback?
					setTimeout(() => $html.removeClass('init-loading'),
						Math.max(Engine.minDomActionDelay, Config.loadDelay));
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
		Lock and show the loading screen.
	**/
	function loadScreenLock() {
		_locked = true;
		loadScreenShow();
	}

	/**
		Unlock the loading screen and trigger a `readystatechange` event.
	**/
	function loadScreenUnlock() {
		_locked = false;
		jQuery(document).trigger('readystatechange');
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
