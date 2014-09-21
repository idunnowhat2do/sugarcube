/***********************************************************************************************************************
** [Begin main.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Error Handling Setup]
***********************************************************************************************************************/
function technicalAlert(where, mesg, error) {
	var errMesg = "Apologies! A technical problem has occurred. You may be able to continue, but some parts may not work properly.";
	// use lazy equality on these null checks
	if (where != null || mesg != null) {
		errMesg += "\n\nError";
		if (where != null) {
			errMesg += " [" + where + "]";
		}
		errMesg += ": " + ((mesg != null) ? mesg.replace(/^Error:\s+/, "") : "unknown error") + ".";
		if (error && error.stack) {
			errMesg += "\n\nStack Trace:\n" + error.stack;
		}
	}
	window.alert(errMesg);
}

if (!DEBUG) {
	window.onerror = function (mesg, url, lineNum, colNum, error) {
		technicalAlert(null, mesg, error);
	};
}


/***********************************************************************************************************************
** [Initialization]
***********************************************************************************************************************/
window.SugarCube = {}; // will contain exported identifiers, also allows scripts to detect if they're running in SugarCube (e.g. "SugarCube" in window)

var version = Object.freeze({
	// data properties
	title      : "SugarCube",
	major      : "{{BUILD_MAJOR}}",
	minor      : "{{BUILD_MINOR}}",
	patch      : "{{BUILD_PATCH}}",
	prerelease : "{{BUILD_PRERELEASE}}",
	build      : "{{BUILD_BUILD}}",
	date       : new Date("{{BUILD_DATE}}"),
	/* legacy */
	extensions : {},
	/* /legacy */

	// method properties
	toString : function() {
		return this.major + "." + this.minor + "." + this.patch
			+ (this.prerelease ? "-" + this.prerelease : "") + "+" + this.build;
	},
	short : function() {
		return this.title + " (v" + this.major + "." + this.minor + "." + this.patch
			+ (this.prerelease ? "-" + this.prerelease : "") + ")";
	},
	long : function() {
		return this.title + " v" + this.toString() + " (" + this.date.toUTCString() + ")";
	}
});

/* deprecated */
// History prototype mode enumeration
var HistoryMode = Object.freeze({ Hash : History.Modes.Hash, Window : History.Modes.Window, Session : History.Modes.Session });
var modes = Object.freeze({ hashTag : History.Modes.Hash, windowHistory : History.Modes.Window, sessionHistory : History.Modes.Session });
/* /deprecated */

// Runtime object (internal use only)
var runtime = Object.defineProperties({}, {
	flags : {
		value : {
			HistoryPRNG : {
				isEnabled  : false,
				isMathPRNG : false
			}
		}
	},
	temp : {
		writable : true,
		value    : {}
	}
});

// Capabilities object
var has = {
	// javascript capability properties
	defineProperty           : (typeof Object.defineProperty === "function"),
	getOwnPropertyDescriptor : (typeof Object.getOwnPropertyDescriptor === "function"),

	// browser api capability properties
	pushState      : (("history" in window) && ("pushState" in window.history) && ("state" in window.history)),
	// the try/catch and length property access here is required due to a monumentally stupid
	// Firefox bug [ #748620; https://bugzilla.mozilla.org/show_bug.cgi?id=748620 ]
	// the try/catch is also required due to the iOS browser core throwing on setItem() calls when in private mode
	localStorage   : (("localStorage" in window) && (function (wls) {
		try {
			if (wls != null && wls.length >= 0) { // use lazy equality on null check
				var tkey = "SugarCube/WLS/Test";
				wls.setItem(tkey, "42");
				if (wls.getItem(tkey) !== "42") return false;
				wls.removeItem(tkey);
				return true;
			}
			return false;
		} catch (e) { return false; }
	}(window.localStorage))),
	sessionStorage : (("sessionStorage" in window) && (function (wss) {
		try {
			if (wss != null && wss.length >= 0) { // use lazy equality on null check
				var tkey = "SugarCube/WSS/Test";
				wss.setItem(tkey, "42");
				if (wss.getItem(tkey) !== "42") return false;
				wss.removeItem(tkey);
				return true;
			}
			return false;
		} catch (e) { return false; }
	}(window.sessionStorage))),
	// it's probably safe to assume the existence of Blob by the existence of File
	fileAPI        : (("File" in window) && ("FileList" in window) && ("FileReader" in window))
};

// Browser object
var browser          = { userAgent : navigator.userAgent.toLowerCase() };
browser.isGecko      = (navigator && navigator.product === "Gecko" && !/webkit|trident/.test(browser.userAgent));
browser.isIE         = (/msie|trident/.test(browser.userAgent) && !browser.userAgent.contains("opera"));
browser.ieVersion    = (function () {
	var ieVer = /(?:msie\s+|rv:)(\d{1,2}\.\d)/.exec(browser.userAgent);
	return ieVer ? +ieVer[1] : 0;
}());
// opera <= 12: "opera/9.80 (windows nt 6.1; wow64) presto/2.12.388 version/12.16"
// opera >= 15: "mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/28.0.1500.52 safari/537.36 opr/15.0.1147.130"
browser.isOpera      = (browser.userAgent.contains("opera")) || (browser.userAgent.contains(" opr/"));
browser.operaVersion = (function () {
	var re     = new RegExp((/applewebkit|chrome/.test(browser.userAgent) ? "opr" : "version") + "\\/(\\d{1,2}\\.\\d+)"),
		oprVer = re.exec(browser.userAgent);
	return oprVer ? +oprVer[1] : 0;
}());
browser.isMobile     = {
	any        : function () { return (browser.isMobile.Android || browser.isMobile.BlackBerry || browser.isMobile.iOS || browser.isMobile.Windows); },
	Android    : (/android/.test(browser.userAgent)),
	BlackBerry : (/blackberry/.test(browser.userAgent)),
	iOS        : (/ip(?:hone|ad|od)/.test(browser.userAgent)),
	Windows    : (/iemobile/.test(browser.userAgent))
};

// Config object (author/developer use)
var config = {
	/* deprecated */
	// capability properties
	hasPushState      : has.pushState,
	hasLocalStorage   : has.localStorage,
	hasSessionStorage : has.sessionStorage,
	hasFileAPI        : has.fileAPI,
	/* /deprecated */

	/* deprecated */
	// basic browser detection
	userAgent : browser.userAgent,
	browser   : browser,
	/* /deprecated */

	// general option properties
	addVisitedLinkClass  : false,
	displayPassageTitles : false,
	loadDelay            : 0,
	startPassage         : "Start",
	updatePageElements   : true,

	// history option properties
	disableHistoryControls : false,
	disableHistoryTracking : false,
	historyMode            : (has.pushState ? (has.sessionStorage ? History.Modes.Session : History.Modes.Window) : History.Modes.Hash),

	// transition properties
	passageTransitionOut   : null,
	transitionEndEventName : (function () {
		var teMap  = {
				"transition"       : "transitionend",
				"MSTransition"     : "msTransitionEnd",
				"WebkitTransition" : "webkitTransitionEnd",
				"MozTransition"    : "transitionend"
			},
			teKeys = Object.keys(teMap),
			el     = document.createElement("div");
		for (var i = 0, iend = teKeys.length; i < iend; i++) {
			if (el.style[teKeys[i]] !== undefined) {
				return teMap[teKeys[i]];
			}
		}
		return "";
	}()),

	// macros option properties
	macros : {
		maxLoopIterations : 1000
	},

	// saves option properties
	saves : {
		autosave  : undefined,
		id        : "untitled-story",
		isAllowed : undefined,
		onLoad    : undefined,
		onSave    : undefined,
		slots     : 8
	},

	// error messages properties
	errorName : "game",
	errors    : { /* see below */ }
};
config.errors = {
	savesNotAllowed : "Saving has been disallowed on this passage.",
	upgradeBrowser  : "Apologies! Your web browser lacks capabilities that this " + config.errorName + " requires. Please consider upgrading it or switching to a more modern web browser."
};
// adjust these based on the specific browser used
config.hasFileAPI = has.fileAPI = (has.fileAPI && !browser.isMobile.any() && (!browser.isOpera || browser.operaVersion >= 15));

var formatter = null, // Wikifier formatters
	macros    = {},   // macros manager
	tale      = {},   // story manager
	state     = {},   // history manager
	storage   = {},   // persistant storage manager
	session   = {},   // session manager
	options   = {},   // options variable store
	setup     = {};   // author setup variable store

var testPlay   = "START_AT", // Twine 1.4+ "Test Play From Here" feature variable
	prerender  = {},         // Twine 1.4+ pre-render task callbacks
	postrender = {};         // Twine 1.4+ post-render task callbacks

/**
 * Main function, entry point for story startup
 */
$(document).ready(function () {
	if (DEBUG) { console.log("[main()]"); }

	/**
	 * WARNING!
	 * 
	 * The ordering of the code in this function is important, so be careful
	 * when mucking around with it.
	 */

	// instantiate the wikifier formatters and macro objects, as well as the standard macro library
	// these must be done before any passages are processed
	formatter = new WikiFormatter(Wikifier.formatters);
	macros    = new Macros();
	addStandardMacros();

	// instantiate the tale, state, storage, and session objects
	tale    = new Tale();
	state   = new History();
	storage = new KeyValueStore("localStorage", tale.domId);
	session = new KeyValueStore("sessionStorage", tale.domId);

	// set the default saves ID
	config.saves.id = tale.domId;

	// initialize the user interface (this must be done before script passages)
	UISystem.init();

	// setup for story stylesheets, scripts, and widgets (in that order)
	var styles = tale.lookup("tags", "stylesheet");
	for (var i = 0; i < styles.length; i++) {
		addStyle(styles[i].text);
	}
	var scripts = tale.lookup("tags", "script");
	for (var i = 0; i < scripts.length; i++) {
		try {
			eval(scripts[i].text);
		} catch (e) {
			var errMesg = e.message;
			if (e.name === "TypeError" && /read[\s-]only/.test(e.message)) {
				var errMatch = /([\"\'])([^\1]+)\1/.exec(e.message);
				if (errMatch && errMatch[2]) {
					if (macros.has(errMatch[2])) {
						// this case is unlikely to ever happen, but might as well leave it in
						errMesg = "cannot clobber protected macro <<" + errMatch[2] + ">>";
					} else if (macros.hasOwnProperty(errMatch[2])) {
						errMesg = 'cannot clobber macros API method "' + errMatch[2] + '"';
					}
				}
			}
			technicalAlert(scripts[i].title, errMesg);
		}
	}
	var widgets = tale.lookup("tags", "widget");
	for (var i = 0; i < widgets.length; i++) {
		try {
			Wikifier.wikifyEval(widgets[i].processText());
		} catch (e) {
			technicalAlert(widgets[i].title, e.message);
		}
	}

	// initialize the save system (this must be done after script passages and before state initialization)
	SaveSystem.init();

	// call macros' "early" init functions
	macros.init();

	// initialize our state
	state.init(); // this could take a while, so do it late

	// call macros' "late" init functions
	macros.lateInit();

	// start the user interface
	UISystem.start();

	// lastly, export identifiers for debugging purposes
	window.SugarCube = {
		version    : version,
		runtime    : runtime,
		has        : has,
		browser    : browser,
		config     : config,
		setup      : setup,
		storage    : storage,
		session    : session,
		macros     : macros,
		tale       : tale,
		state      : state,
		Wikifier   : Wikifier,
		Util       : Util,
		History    : History,
		SaveSystem : SaveSystem,
		UISystem   : UISystem
	};
});


/***********************************************************************************************************************
** [End main.js]
***********************************************************************************************************************/
