/***********************************************************************************************************************
** [Begin capabilities.js]
***********************************************************************************************************************/

var
	// Capabilities object
	has = {
		// javascript capability properties
		defineProperty           : (typeof Object.defineProperty === "function"),
		getOwnPropertyDescriptor : (typeof Object.getOwnPropertyDescriptor === "function"),

		// browser API capability properties
		pushState : (("history" in window) && ("pushState" in window.history) && ("state" in window.history)),

		// the extended Web Storage testing is required by implementation bugs in various browsers
		//   notably: Firefox bug #748620 [https://bugzilla.mozilla.org/show_bug.cgi?id=748620]
		//            and the iOS browser core throwing on setItem() calls when in private mode
		localStorage : (("localStorage" in window) && (function (store) {
			try {
				if (store != null && store.length >= 0) { // use lazy equality on null check
					var	tkey = "SugarCube.localStorage.test",
						tval = "1701 Guilty Scott";
					store.setItem(tkey, tval);
					if (store.getItem(tkey) === tval) {
						store.removeItem(tkey);
						return true;
					}
				}
				return false;
			} catch (e) {
				return false;
			}
		}(window.localStorage))),
		sessionStorage : (("sessionStorage" in window) && (function (store) {
			try {
				if (store != null && store.length >= 0) { // use lazy equality on null check
					var	tkey = "SugarCube.sessionStorage.test",
						tval = "1701 Guilty Scott";
					store.setItem(tkey, tval);
					if (store.getItem(tkey) === tval) {
						store.removeItem(tkey);
						return true;
					}
				}
				return false;
			} catch (e) {
				return false;
			}
		}(window.sessionStorage))),

		indexedDB : ("indexedDB" in window),

		// it's probably safe to assume the existence of Blob by the existence of File
		fileAPI : (("File" in window) && ("FileList" in window) && ("FileReader" in window))
	},

	// Browser object
	browser = {
		userAgent : navigator.userAgent.toLowerCase()
	};

// fill in the Browser object
browser.isGecko   = (navigator && navigator.product === "Gecko" && !/webkit|trident/.test(browser.userAgent));
browser.isIE      = (/msie|trident/.test(browser.userAgent) && !browser.userAgent.contains("opera"));
browser.ieVersion = (function () {
	var	ver = /(?:msie\s+|rv:)(\d{1,2}\.\d)/.exec(browser.userAgent);
	return ver ? +ver[1] : 0;
}());
// opera <= 12: "opera/9.80 (windows nt 6.1; wow64) presto/2.12.388 version/12.16"
// opera >= 15: "mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/28.0.1500.52 safari/537.36 opr/15.0.1147.130"
browser.isOpera      = (browser.userAgent.contains("opera")) || (browser.userAgent.contains(" opr/"));
browser.operaVersion = (function () {
	var	re  = new RegExp((/applewebkit|chrome/.test(browser.userAgent) ? "opr" : "version") + "\\/(\\d{1,2}\\.\\d+)"),
		ver = re.exec(browser.userAgent);
	return ver ? +ver[1] : 0;
}());
browser.isMobile = {
	any        : function () {
		return (browser.isMobile.Android || browser.isMobile.BlackBerry || browser.isMobile.iOS || browser.isMobile.Windows);
	},
	Android    : (/android/.test(browser.userAgent)),
	BlackBerry : (/blackberry/.test(browser.userAgent)),
	iOS        : (/ip(?:hone|ad|od)/.test(browser.userAgent)),
	Windows    : (/iemobile/.test(browser.userAgent))
};

// adjustments based on the specific browser used
has.fileAPI = (has.fileAPI && !browser.isMobile.any() && (!browser.isOpera || browser.operaVersion >= 15));


/***********************************************************************************************************************
** [End capabilities.js]
***********************************************************************************************************************/
