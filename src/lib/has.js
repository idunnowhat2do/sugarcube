/***********************************************************************************************************************

	lib/has.js

	Copyright © 2013–2017 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* global Browser */

var Has = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*
		NOTE: The aggressive try/catch feature tests are necessitated by implementation
		      bugs in various browsers.
	*/

	// HTML5 Audio Element API Test
	const hasAudioElement = (() => {
		try {
			return typeof document.createElement('audio').canPlayType === 'function';
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// File API Test
	const hasFile = (() => {
		try {
			return 'Blob' in window &&
				'File' in window &&
				'FileList' in window &&
				'FileReader' in window &&
				!Browser.isMobile.any() &&
				(!Browser.isOpera || Browser.operaVersion >= 15);
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// Geolocation API Test
	const hasGeolocation = (() => {
		try {
			return 'geolocation' in navigator &&
				typeof navigator.geolocation.getCurrentPosition === 'function' &&
				typeof navigator.geolocation.watchPosition === 'function';
		}
		catch (ex) { /* no-op */ }

		return false;
	})();

	// Performance API Test
	const hasPerformance = (() => {
		try {
			return 'performance' in window &&
				typeof window.performance.now === 'function';
		}
		catch (ex) { /* no-op */ }

		return false;
	})();


	// Module Exports.
	return Object.freeze({
		audio       : hasAudioElement,
		fileAPI     : hasFile,
		geolocation : hasGeolocation,
		performance : hasPerformance
	});
})();
