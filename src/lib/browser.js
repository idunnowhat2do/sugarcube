/***********************************************************************************************************************
 *
 * lib/browser.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var Browser = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/* eslint-disable max-len */
	const ua = {
		userAgent : navigator.userAgent.toLowerCase()
	};

	ua.isGecko = navigator && navigator.product === 'Gecko' && !/webkit|trident/.test(ua.userAgent);

	ua.isIE      = /msie|trident/.test(ua.userAgent) && !ua.userAgent.includes('opera');
	ua.ieVersion = (() => {
		const ver = /(?:msie\s+|rv:)(\d{1,2}\.\d)/.exec(ua.userAgent);
		return ver ? Number([1]) : 0;
	})();

	// opera <= 12: "opera/9.80 (windows nt 6.1; wow64) presto/2.12.388 version/12.16"
	// opera >= 15: "mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/28.0.1500.52 safari/537.36 opr/15.0.1147.130"
	ua.isOpera      = ua.userAgent.includes('opera') || ua.userAgent.includes(' opr/');
	ua.operaVersion = (() => {
		const
			re  = new RegExp(`${/applewebkit|chrome/.test(ua.userAgent) ? 'opr' : 'version'}\\/(\\d{1,2}\\.\\d+)`),
			ver = re.exec(ua.userAgent);
		return ver ? Number(ver[1]) : 0;
	})();

	ua.isMobile = Object.freeze({
		Android    : /android/.test(ua.userAgent),
		BlackBerry : /blackberry/.test(ua.userAgent),
		iOS        : /ip(?:hone|ad|od)/.test(ua.userAgent),
		Windows    : /iemobile/.test(ua.userAgent),

		any() {
			const is = ua.isMobile;
			return is.Android || is.BlackBerry || is.iOS || is.Windows;
		}
	});

	// Module Exports.
	return Object.freeze(ua);
	/* eslint-enable max-len */
})();
