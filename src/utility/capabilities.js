/***********************************************************************************************************************
 *
 * utility/capabilities.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var
	/*
		Browser object.
	*/
	Browser = Object.freeze((function () { // eslint-disable-line no-unused-vars
		"use strict";
		/* eslint-disable max-len */
		var ua = {
			userAgent : navigator.userAgent.toLowerCase()
		};

		ua.isGecko = navigator && navigator.product === "Gecko" && !/webkit|trident/.test(ua.userAgent);

		ua.isIE      = /msie|trident/.test(ua.userAgent) && !ua.userAgent.contains("opera");
		ua.ieVersion = (function () {
			var ver = /(?:msie\s+|rv:)(\d{1,2}\.\d)/.exec(ua.userAgent);
			return ver ? +ver[1] : 0;
		})();

		// opera <= 12: "opera/9.80 (windows nt 6.1; wow64) presto/2.12.388 version/12.16"
		// opera >= 15: "mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/28.0.1500.52 safari/537.36 opr/15.0.1147.130"
		ua.isOpera      = ua.userAgent.contains("opera") || ua.userAgent.contains(" opr/");
		ua.operaVersion = (function () {
			var	re  = new RegExp((/applewebkit|chrome/.test(ua.userAgent) ? "opr" : "version") + "\\/(\\d{1,2}\\.\\d+)"),
				ver = re.exec(ua.userAgent);
			return ver ? +ver[1] : 0;
		})();

		ua.isMobile = Object.freeze({
			any        : function () { var m = ua.isMobile; return m.Android || m.BlackBerry || m.iOS || m.Windows; },
			Android    : /android/.test(ua.userAgent),
			BlackBerry : /blackberry/.test(ua.userAgent),
			iOS        : /ip(?:hone|ad|od)/.test(ua.userAgent),
			Windows    : /iemobile/.test(ua.userAgent)
		});

		return ua;
		/* eslint-enable max-len */
	})()),

	/*
		Capabilities object.
	*/
	Has = Object.freeze((function () { // eslint-disable-line no-unused-vars
		"use strict";

		function webStorageIsOK(store) {
			try {
				if (store != null && store.length >= 0) { // lazy equality for null
					var	tkey = "SugarCube.WebStorage.test",
						tval = "1701 Guilty Scott";
					store.setItem(tkey, tval);
					if (store.getItem(tkey) === tval) {
						store.removeItem(tkey);
						return true;
					}
				}
			} catch (e) { /* no-op */ }
			return false;
		}

		return {
			/*
				The extended Web Storage testing is required by implementation bugs in various
				browsers.

				Notably: Firefox bug #748620 [https://bugzilla.mozilla.org/show_bug.cgi?id=748620]
				         and the iOS browser core throwing on setItem() calls when in private mode
			*/
			localStorage   : "localStorage" in window && webStorageIsOK(window.localStorage),
			sessionStorage : "sessionStorage" in window && webStorageIsOK(window.sessionStorage),

			/*
				It's probably safe to assume the existence of Blob by the existence of File.
			*/
			fileAPI : "File" in window && "FileList" in window && "FileReader" in window
				&& !Browser.isMobile.any() && (!Browser.isOpera || Browser.operaVersion >= 15),

			audio : typeof document.createElement("audio").canPlayType === "function"
		};
	})());

/* legacy */
/*
	Create legacy aliases for `browser` and `has`.
*/
var
	browser = Browser, // eslint-disable-line no-unused-vars
	has     = Has;     // eslint-disable-line no-unused-vars
/* /legacy */

