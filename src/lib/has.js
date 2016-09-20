/***********************************************************************************************************************
 *
 * lib/has.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Browser */

var Has = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	function webStorageIsOK(store) {
		try {
			if (store != null && store.length >= 0) { // lazy equality for null
				const
					tkey = 'SugarCube.WebStorage.test',
					tval = '1701 Guilty Scott';

				store.setItem(tkey, tval);

				if (store.getItem(tkey) === tval) {
					store.removeItem(tkey);
					return true;
				}
			}
		}
		catch (ex) { /* no-op */ }

		return false;
	}

	// Module Exports.
	return Object.freeze({
		audio : typeof document.createElement('audio').canPlayType === 'function',

		/*
			It's probably safe to assume the existence of `Blob` by the existence of `File`.
		*/
		fileAPI : 'File' in window && 'FileList' in window && 'FileReader' in window
			&& !Browser.isMobile.any() && (!Browser.isOpera || Browser.operaVersion >= 15),

		geolocation : 'geolocation' in navigator
			&& typeof navigator.geolocation.getCurrentPosition === 'function'
			&& typeof navigator.geolocation.watchPosition === 'function',

		/*
			The extended Web Storage testing (`webStorageIsOK()`) is required by implementation
			bugs in various browsers.

			Caveats by browser:
				Firefox bug #748620 [https://bugzilla.mozilla.org/show_bug.cgi?id=748620].

				The iOS browser core will throw an exception on `setItem()` calls when in
				private browsing mode.
		*/
		localStorage   : 'localStorage' in window && webStorageIsOK(window.localStorage),
		sessionStorage : 'sessionStorage' in window && webStorageIsOK(window.sessionStorage)
	});
})();
