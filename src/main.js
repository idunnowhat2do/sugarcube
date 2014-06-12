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

window.onerror = function (mesg, url, lineNum, colNum, error) {
	technicalAlert(null, mesg, error);
};


/***********************************************************************************************************************
** [Initialization]
***********************************************************************************************************************/
window.SugarCube = {};  // will contain exported identifiers, also allows scripts to detect if they're running in SugarCube ("SugarCube" in window)

var version = Object.freeze({
	title      : "SugarCube",
	major      : 1,
	minor      : 0,
	revision   : 0,
	build      : "{{BUILD_ID}}",
	date       : new Date("{{BUILD_DATE}}"),
	extensions : {},
	toString   : function() { return this.title + " " + this.major + "." + this.minor + "." + this.revision + "." + this.build + " (" + this.date.toLocaleDateString() + ")"; }
});

// SugarCube History prototype modes
var Modes = Object.freeze({
	HashTag        : 1,
	WindowHistory  : 2,
	SessionHistory : 3
});
/* legacy kludge */
var modes = Object.freeze({ hashTag: Modes.HashTag, windowHistory: Modes.WindowHistory, sessionHistory: Modes.SessionHistory });
/* /legacy kludge */

// SugarCube runtime object (internal use only)
var runtime = Object.defineProperties({}, {
	flags: {
		value: {
			HistoryPRNG: {
				isEnabled:        false,
				replacedMathPRNG: false
			}
		}
	},
	temp: {
		writable: true,
		value: {}
	}
});

// SugarCube config (author/developer use)
var config = {
	// capability properties
	hasPushState      : (("history" in window) && ("pushState" in window.history)),
	// the try/catch and length property access here is required due to a monumentally stupid
	// Firefox bug [ #748620; https://bugzilla.mozilla.org/show_bug.cgi?id=748620 ]
	// the try/catch is also required due to the iOS browser core throwing on setItem() calls when in private mode
	hasLocalStorage   : (("localStorage" in window) && (function (wls) { try { if (wls != null && wls.length >= 0) { var tkey = "SugarCube_storage_test"; wls.setItem(tkey, true); wls.removeItem(tkey); return true; } return false; } catch (e) { return false; } }(window.localStorage))),  // use lazy equality on null check
	hasSessionStorage : (("sessionStorage" in window) && (function (wss) { try { if (wss != null && wss.length >= 0) { var tkey = "SugarCube_storage_test"; wss.setItem(tkey, true); wss.removeItem(tkey); return true; } return false; } catch (e) { return false; } }(window.sessionStorage))),  // use lazy equality on null check
	hasFileAPI        : (("File" in window) && ("FileReader" in window) && ("Blob" in window)),

	// basic browser detection
	userAgent : navigator.userAgent.toLowerCase(),
	browser   : {},

	// general option properties
	displayPassageTitles : false,
	loadDelay            : 0,
	startPassage         : "Start",
	updatePageElements   : true,

	// history option properties
	disableHistoryControls : false,
	disableHistoryTracking : false,
	historyMode            : Modes.HashTag,

	// macros option properties
	macros: {
		maxLoopIterations: 1000
	},

	// saves option properties
	saves: {
		autosave  : undefined,
		id        : "untitled-story",
		isAllowed : undefined,
		onLoad    : undefined,
		onSave    : undefined,
		slots     : 8
	},

	// error messages properties
	errorName : "game",
	errors    : {}
};
config.transitionEndEventName = (function () { var teMap = { "transition": "transitionend", "MSTransition": "msTransitionEnd", "WebkitTransition": "webkitTransitionEnd", "MozTransition": "transitionend" }, el = document.createElement("div"); for (var tName in teMap) { if (el.style[tName] !== undefined) { return teMap[tName]; } } return ""; }());
config.errors = {
	savesNotAllowed : "Saving has been disallowed on this passage.",
	upgradeBrowser  :  "Apologies! Your web browser lacks capabilities that this " + config.errorName + " requires. Please consider upgrading it or switching to a more modern web browser."
};
config.browser = {
	isGecko      : (navigator && navigator.product === "Gecko" && !/webkit|trident/.test(config.userAgent)),
	isIE         : (/msie|trident/.test(config.userAgent) && !config.userAgent.contains("opera")),
	ieVersion    : (function () { var ieVer = /(?:msie\s+|rv:)(\d{1,2}\.\d)/.exec(config.userAgent); return ieVer ? +ieVer[1] : 0; }()),
	// opera <= 12: "opera/9.80 (windows nt 6.1; wow64) presto/2.12.388 version/12.16"
	// opera >= 15: "mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/28.0.1500.52 safari/537.36 opr/15.0.1147.130"
	isOpera      : (config.userAgent.contains("opera")) || (config.userAgent.contains(" opr/")),
	operaVersion : (function () { var re = new RegExp((/applewebkit|chrome/.test(config.userAgent) ? "opr" : "version") + "\\/(\\d{1,2}\\.\\d+)"), oprVer = re.exec(config.userAgent); return oprVer ? +oprVer[1] : 0; }()),
	isMobile: {
		any        : function () { return (config.browser.isMobile.Android || config.browser.isMobile.BlackBerry || config.browser.isMobile.iOS || config.browser.isMobile.Windows); },
		Android    : (/android/.test(config.userAgent)),
		BlackBerry : (/blackberry/.test(config.userAgent)),
		iOS        : (/ip(?:hone|ad|od)/.test(config.userAgent)),
		Windows    : (/iemobile/.test(config.userAgent))
	}
};
// adjust these based on the specific browser used
config.historyMode = (config.hasPushState ? ((config.browser.isIE || config.browser.isMobile.iOS) && !config.hasSessionStorage ? Modes.WindowHistory : Modes.SessionHistory) : Modes.HashTag);
config.hasFileAPI = config.hasFileAPI && !config.browser.isMobile.any() && (!config.browser.isOpera || config.browser.operaVersion >= 15);

var formatter = null,  // Wikifier formatters
	macros    = {},    // macros manager
	tale      = {},    // story manager
	state     = {},    // history manager
	storage   = {},    // persistant storage manager
	session   = {},    // session manager
	options   = {},    // options variable store
	setup     = {};    // author setup variable store

var testPlay,          // Twine 1.4+ "Test Play From Here" feature variable
	prerender  = {},   // Twine 1.4+ pre-render task callbacks
	postrender = {};   // Twine 1.4+ post-render task callbacks

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
				if (errMatch) {
					if (errMatch[2] && macros.has(errMatch[2])) {
						errMesg = "cannot clobber protected macro <<" + errMatch[2] + ">>";
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

	// initialize the user interface
	UISystem.init();

	// call macros' "early" init functions
	macros.init();

	// execute the StoryInit passage
	if (tale.has("StoryInit")) {
		try {
			Wikifier.wikifyEval(tale.get("StoryInit").text);
		} catch (e) {
			technicalAlert("StoryInit", e.message);
		}
	}

	// finalize the config.disableHistoryControls setting before initializing our state
	//   n.b. we do this here to give the author every opportunity to modify config.disableHistoryTracking during setup
	if (config.disableHistoryTracking) {
		config.disableHistoryControls = true;
	}

	// initialize our state
	state.init();  // this could take a while, so do it late

	// call macros' "late" init functions
	macros.lateInit();

	// lastly, export identifiers for debugging purposes
	window.SugarCube = {
		version    : version,
		config     : config,
		setup      : setup,
		runtime    : runtime,
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
** [Save System]
***********************************************************************************************************************/
var SaveSystem = {
	_bad: false,
	_max: -1,
	init: function () {
		function appendSlots(array, num) {
			for (var i = 0; i < num; i++) {
				array.push(null);
			}
			return array;
		}
		/* legacy kludges */
		function convertOldSave(saveObj) {
			saveObj.state = {
				mode    : saveObj.mode,
				history : saveObj.data
			};
			delete saveObj.mode;
			delete saveObj.data;
		}
		/* /legacy kludges */

		if (DEBUG) { console.log("[SaveSystem.init()]"); }

		if (config.saves.slots < 0) { config.saves.slots = 0; }
		if (storage.store === null) { return false; }

		// create and store the saves object, if it doesn't exist
		if (!storage.hasItem("saves")) {
			storage.setItem("saves", {
				autosave : null,
				slots    : appendSlots([], config.saves.slots)
			});
		}

		// retrieve the saves object
		var saves = storage.getItem("saves");
		if (saves === null) {
			SaveSystem._bad = true;
			return false;
		}

		/* legacy kludges */
		// convert an old saves array into a new saves object
		if (Array.isArray(saves)) {
			saves = {
				autosave : null,
				slots    : saves
			};
			storage.setItem("saves", saves);
		}
		/* /legacy kludges */

		// handle the author changing the number of save slots
		if (config.saves.slots !== saves.slots.length) {
			if (config.saves.slots < saves.slots.length) {
				// attempt to decrease the number of slots; this will only compact
				// the slots array, by removing empty slots, no saves will be deleted
				saves.slots.reverse();
				saves.slots = saves.slots.filter(function (val, i, aref) {
					if (val === null && this.count > 0) {
						this.count--;
						return false;
					}
					return true;
				}, { count: saves.slots.length - config.saves.slots });
				saves.slots.reverse();
			} else if (config.saves.slots > saves.slots.length) {
				// attempt to increase the number of slots
				appendSlots(saves.slots, config.saves.slots - saves.slots.length);
			}
			storage.setItem("saves", saves);
		}

		/* legacy kludges */
		// convert old-style saves
		var needSave = false;
		if (
			   saves.autosave !== null
			&& saves.autosave.hasOwnProperty("data")
			&& !saves.autosave.hasOwnProperty("state")
		) {
			convertOldSave(saves.autosave);
			needSave = true;
		}
		for (var i = 0; i < saves.slots.length; i++) {
			if (
				   saves.slots[i] !== null
				&& saves.slots[i].hasOwnProperty("data")
				&& !saves.slots[i].hasOwnProperty("state")
			) {
				convertOldSave(saves.slots[i]);
				needSave = true;
			}
		}
		if (needSave) { storage.setItem("saves", saves); }
		/* /legacy kludges */

		SaveSystem._max = saves.slots.length - 1;

		return true;
	},
	length: function () {
		return SaveSystem._max + 1;
	},
	OK: function () {
		return SaveSystem.autosaveOK() || SaveSystem.slotsOK();
	},
	autosaveOK: function () {
		return !SaveSystem._bad && typeof config.saves.autosave !== "undefined";
	},
	slotsOK: function () {
		return !SaveSystem._bad && SaveSystem._max !== -1;
	},
	hasAuto: function () {
		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (saves.autosave === null) { return false; }

		return true;
	},
	getAuto: function () {
		var saves = storage.getItem("saves");
		if (saves === null) { return null; }

		return saves.autosave;
	},
	loadAuto: function () {
		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (saves.autosave === null) { return false; }

		return SaveSystem.unmarshal(saves.autosave);
	},
	saveAuto: function (title, metadata) {
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			return false;
		}

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }

		saves.autosave = SaveSystem.marshal();
		saves.autosave.title = title || tale.get(state.active.title).excerpt();
		saves.autosave.date = Date.now();
		if (metadata != null) { saves.autosave.metadata = metadata; }  // use lazy equality

		return storage.setItem("saves", saves);
	},
	deleteAuto: function () {
		var saves = storage.getItem("saves");
		if (saves === null) { return false; }

		saves.autosave = null;

		return storage.setItem("saves", saves);
	},
	isEmpty: function () {
		return SaveSystem.count() === 0;
	},
	count: function () {
		if (!SaveSystem.slotsOK()) { return 0; }

		var saves = storage.getItem("saves");
		if (saves === null) { return 0; }

		var count = 0;
		for (var i = 0; i < saves.slots.length; i++) { if (saves.slots[i] !== null) { count++; } }

		return count;
	},
	has: function (slot) {
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }
		if (saves.slots[slot] === null) { return false; }

		return true;
	},
	get: function (slot) {
		if (slot < 0 || slot > SaveSystem._max) { return null; }

		var saves = storage.getItem("saves");
		if (saves === null) { return null; }
		if (slot > saves.slots.length) { return null; }

		return saves.slots[slot];
	},
	load: function (slot) {
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }
		if (saves.slots[slot] === null) { return false; }

		return SaveSystem.unmarshal(saves.slots[slot]);
	},
	save: function (slot, title, metadata) {
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			UISystem.alert(config.errors.savesNotAllowed);
			return false;
		}
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }

		saves.slots[slot] = SaveSystem.marshal();
		saves.slots[slot].title = title || tale.get(state.active.title).excerpt();
		saves.slots[slot].date = Date.now();
		if (metadata != null) { saves.slots[slot].metadata = metadata; }  // use lazy equality

		return storage.setItem("saves", saves);
	},
	delete: function (slot) {
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }

		saves.slots[slot] = null;

		return storage.setItem("saves", saves);
	},
	purge: function () {
		storage.removeItem("saves");
		return SaveSystem.init();
	},
	exportSave: function () {
		if (DEBUG) { console.log("[SaveSystem.exportSave()]"); }

		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			UISystem.alert(config.errors.savesNotAllowed);
			return;
		}

		var saveName = tale.domId + ".save",
			saveObj  = LZString.compressToBase64(Util.serialize(SaveSystem.marshal()));

		saveAs(new Blob([saveObj], { type: "text/plain;charset=UTF-8" }), saveName);
	},
	importSave: function (event) {
		if (DEBUG) { console.log("[SaveSystem.importSave()]"); }

		var file   = event.target.files[0],
			reader = new FileReader();

		// capture the file information once the load is finished
		$(reader).load(function(file) {
			return function(evt) {
				if (DEBUG) { console.log('    > loaded: ' + escape(file.name) + '; payload: ' + evt.target.result); }

				if (!evt.target.result) { return; }

				var saveObj;
				try {
					saveObj = (/\.json$/i.test(file.name) || /^\{/.test(evt.target.result))
						? JSON.parse(evt.target.result)
						: Util.deserialize(LZString.decompressFromBase64(evt.target.result));
				} catch (e) { /* noop, the unmarshal() method will handle the error */ }
				SaveSystem.unmarshal(saveObj);
			};
		}(file));

		// initiate the file load
		reader.readAsText(file);
	},
	marshal: function () {
		if (DEBUG) { console.log("[SaveSystem.marshal()]"); }

		var saveObj = {
			id:    config.saves.id,
			state: History.marshal()
		};
		if (config.saves.version) {
			saveObj.version = config.saves.version;
		}

		if (typeof config.saves.onSave === "function") {
			config.saves.onSave(saveObj);
		}

		return saveObj;
	},
	unmarshal: function (saveObj) {
		if (DEBUG) { console.log("[SaveSystem.unmarshal()]"); }

		try {
			if (!saveObj || !saveObj.hasOwnProperty("id") || !saveObj.hasOwnProperty("state")) {
				if (!saveObj || !saveObj.hasOwnProperty("mode") || !saveObj.hasOwnProperty("id") || !saveObj.hasOwnProperty("data")) {
					throw new Error("Save is missing required data.  Either you've loaded a file which isn't a save, or the save has become corrupted");
				} else {
					throw new Error("Old-style saves seen in SaveSystem.unmarshal()");
				}
			}

			if (typeof config.saves.onLoad === "function") {
				config.saves.onLoad(saveObj);
			}

			if (saveObj.id !== config.saves.id) {
				throw new Error("Save is from the wrong " + config.errorName);
			}

			// restore the state
			History.unmarshal(saveObj.state);
		} catch (e) {
			UISystem.alert(e.message + ".\n\nAborting load.");
			return false;
		}

		return true;
	}
};


/***********************************************************************************************************************
** [UI System]
***********************************************************************************************************************/
var UISystem = {
	_overlay: null,
	_body: null,
	_closer: null,
	init: function () {
		if (DEBUG) { console.log("[UISystem.init()]"); }

		var html   = $(document.documentElement),
			target;

		// add UI dialog elements to <body>
		UISystem._overlay = insertElement(document.body, "div", "ui-overlay", "ui-close");
		UISystem._body = insertElement(document.body, "div", "ui-body");
		UISystem._closer = insertElement(document.body, "a", "ui-body-close", "ui-close");
		insertText(UISystem._closer, "\ue002");

		// setup for the non-passage page elements
		if (tale.has("StoryCaption")) {
			document.getElementById("story-caption").style.display = "block";
		}
		if (tale.has("StoryMenu") || tale.has("MenuStory")) {
			document.getElementById("menu-story").style.display = "block";
		}
		setPageElement("story-title", "StoryTitle", tale.title);
		UISystem.setPageElements();

		// setup Saves menu
		UISystem.addClickHandler("#menu-saves", null, function () { UISystem.buildSaves(); });

		// setup Rewind menu
		target = $("#menu-rewind");
		if (!config.disableHistoryTracking && tale.lookup("tags", "bookmark").length > 0) {
			target.css({ display: "block" });
			UISystem.addClickHandler(target.find("a"), null, function () { UISystem.buildRewind(); });
		} else {
			target.remove();
		}

		// setup Restart menu
		UISystem.addClickHandler("#menu-restart", null, function () { UISystem.buildRestart(); });

		// setup Options menu
		target = $("#menu-options");
		if (tale.has("MenuOptions") && tale.get("MenuOptions").text.trim() !== "") {
			target.css({ display: "block" });
			UISystem.addClickHandler(target.find("a"), null, function () { UISystem.buildOptions(); });
		} else {
			target.remove();
		}

		// setup Share menu
		target = $("#menu-share");
		if (tale.has("MenuShare") && tale.get("MenuShare").text.trim() !== "") {
			target.css({ display: "block" });
			UISystem.addClickHandler(target.find("a"), null, function () { UISystem.buildShare(); });
		} else {
			target.remove();
		}

		// handle the loading screen
		if (document.readyState === "complete") {
			html.removeClass("init-loading");
		}
		document.addEventListener("readystatechange", function () {
			if (DEBUG) { console.log("**** document.readyState: " + document.readyState + "  (on: readystatechange)"); }
			// readyState can be: "loading", "interactive", or "complete"
			if (document.readyState === "complete") {
				if (DEBUG) { console.log('---- removing class "init-loading" (in ' + config.loadDelay + 'ms)'); }
				if (config.loadDelay > 0) {
					setTimeout(function () { html.removeClass("init-loading"); }, config.loadDelay);
				} else {
					html.removeClass("init-loading");
				}
			} else {
				if (DEBUG) { console.log('++++ adding class "init-loading"'); }
				html.addClass("init-loading");
			}
		}, false);
	},
	setPageElements: function () {
		if (DEBUG) { console.log("[UISystem.setPageElements()]"); }
		// setup for the non-passage page elements
		setPageElement("story-banner",   "StoryBanner");
		setPageElement("story-subtitle", "StorySubtitle");
		setPageElement("story-author",   "StoryAuthor");
		setPageElement("story-caption",  "StoryCaption");
		setPageElement("menu-story",     ["StoryMenu", "MenuStory"]);
	},
	buildSaves: function () {
		function createActionItem(bId, bClass, bText, bAction) {
			var li = document.createElement("li");
			var btn = document.createElement("button");
			btn.id = "saves-" + bId;
			if (bClass) { btn.className = bClass; }
			btn.innerHTML = bText;
			$(btn).click(bAction);
			li.appendChild(btn);
			return li;
		}
		function createSaveList() {
			function createButton(bId, bClass, bText, bSlot, bAction) {
				var btn = document.createElement("button");
				btn.id = "saves-" + bId + "-" + bSlot;
				if (bClass) { btn.className = bClass; }
				btn.classList.add(bId);
				btn.innerHTML = bText;
				$(btn).click(function (i) {
					return function () { bAction(i); };
				}(bSlot));
				return btn;
			}

			var saves = storage.getItem("saves");
			if (saves === null) { return false; }

			var tbody  = document.createElement("tbody"),
				tr,
				tdSlot,
				tdLoad,
				tdDesc,
				tdDele;
			var tdLoadBtn, tdDescTxt, tdDeleBtn;

			if (SaveSystem.autosaveOK()) {
				tr     = document.createElement("tr"),
				tdSlot = document.createElement("td"),
				tdLoad = document.createElement("td"),
				tdDesc = document.createElement("td"),
				tdDele = document.createElement("td");

				//tdSlot.appendChild(document.createTextNode("\u25c6"));
				tdDescTxt = document.createElement("b");
				tdDescTxt.innerHTML = "A";
				tdSlot.appendChild(tdDescTxt);

				if (saves.autosave && saves.autosave.state.mode === config.historyMode) {
					tdLoadBtn = document.createElement("button");
					tdLoadBtn.id = "saves-load-autosave";
					tdLoadBtn.classList.add("load");
					tdLoadBtn.classList.add("ui-close");
					tdLoadBtn.innerHTML = "Load";
					$(tdLoadBtn).click(SaveSystem.loadAuto);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createTextNode(saves.autosave.title);
					tdDesc.appendChild(tdDescTxt);
					tdDesc.appendChild(document.createElement("br"));
					tdDescTxt = document.createElement("small");
					tdDescTxt.innerHTML = "Autosaved (" + new Date(saves.autosave.date).toLocaleString() + ")";
					tdDesc.appendChild(tdDescTxt);

					tdDeleBtn = document.createElement("button");
					tdDeleBtn.id = "saves-delete-autosave";
					tdDeleBtn.classList.add("delete");
					tdDeleBtn.innerHTML = "Delete";
					$(tdDeleBtn).click(function () {
						SaveSystem.deleteAuto();
						UISystem.buildSaves();  // rebuild the saves menu
					});
					tdDele.appendChild(tdDeleBtn);
				} else {
					tdDescTxt = document.createElement("i");
					tdDescTxt.innerHTML = "(autosave slot empty)";
					tdDesc.appendChild(tdDescTxt);
					tdDesc.classList.add("empty");
				}

				tr.appendChild(tdSlot);
				tr.appendChild(tdLoad);
				tr.appendChild(tdDesc);
				tr.appendChild(tdDele);
				tbody.appendChild(tr);
			}
			for (var i = 0; i < saves.slots.length; i++) {
				tr     = document.createElement("tr"),
				tdSlot = document.createElement("td"),
				tdLoad = document.createElement("td"),
				tdDesc = document.createElement("td"),
				tdDele = document.createElement("td");

				tdSlot.appendChild(document.createTextNode(i+1));

				if (saves.slots[i] && saves.slots[i].state.mode === config.historyMode) {
					tdLoadBtn = createButton("load", "ui-close", "Load", i, SaveSystem.load);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createTextNode(saves.slots[i].title);
					tdDesc.appendChild(tdDescTxt);
					tdDesc.appendChild(document.createElement("br"));
					tdDescTxt = document.createElement("small");
					if (saves.slots[i].date) {
						tdDescTxt.innerHTML = "Saved (" + new Date(saves.slots[i].date).toLocaleString() + ")";
					} else {
						tdDescTxt.innerHTML = "Saved (<i>unknown</i>)";
					}
					tdDesc.appendChild(tdDescTxt);

					tdDeleBtn = createButton("delete", null, "Delete", i, function (i) {
						SaveSystem.delete(i);
						UISystem.buildSaves();  // rebuild the saves menu
					});
					tdDele.appendChild(tdDeleBtn);
				} else {
					tdLoadBtn = createButton("save", "ui-close", "Save", i, SaveSystem.save);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createElement("i");
					tdDescTxt.innerHTML = "(save slot empty)";
					tdDesc.appendChild(tdDescTxt);
					tdDesc.classList.add("empty");
				}

				tr.appendChild(tdSlot);
				tr.appendChild(tdLoad);
				tr.appendChild(tdDesc);
				tr.appendChild(tdDele);
				tbody.appendChild(tr);
			}
			var table = document.createElement("table");
			table.id = "saves-list";
			table.appendChild(tbody);
			return table;
		}
		function createSavesImport() {
			var el    = document.createElement("div"),
				label = document.createElement("div"),
				input = document.createElement("input");

			// add label
			label.id = "saves-import-label";
			label.appendChild(document.createTextNode("Select a save file to load:"));
			el.appendChild(label);

			// add file input
			input.type = "file";
			input.id   = "saves-import-file";
			input.name = "saves-import-file";
			$(input).change(function (evt) {
				SaveSystem.importSave(evt);
				UISystem.close();
			});
			el.appendChild(input);

			return el;
		}

		if (DEBUG) { console.log("[UISystem.buildSaves()]"); }

		var dialog  = UISystem._body,
			list,
			btnBar,
			savesOK = SaveSystem.OK();

		$(dialog)
			.empty()
			.addClass("saves");

		if (savesOK) {
			// add saves list
			list = createSaveList();
			if (!list) {
				list = document.createElement("div");
				list.id = "saves-list"
				list.innerHTML = "<i>No save slots found</i>";
			}
			dialog.appendChild(list);
		}

		// add action list (export, import, and purge) and import input
		if (savesOK || config.hasFileAPI) {
			btnBar = document.createElement("div");
			list = document.createElement("ul");
			if (config.hasFileAPI) {
				list.appendChild(createActionItem("export", "ui-close", "Save to Disk\u2026", SaveSystem.exportSave));
				list.appendChild(createActionItem("import", null, "Load from Disk\u2026", function (evt) {
					if (!document.getElementById("saves-import-file")) {
						dialog.appendChild(createSavesImport());
					}
				}));
			}
			if (savesOK) {
				list.appendChild(createActionItem("purge", null, "Purge Save Slots", function (evt) {
					SaveSystem.purge();
					UISystem.buildSaves();  // rebuild the saves menu
				}));
			}
			btnBar.appendChild(list);
			dialog.appendChild(btnBar);
			return true;
		} else {
			UISystem.alert("Apologies! Your browser either lacks some of the capabilities required to support saves or has disabled them.\n\nThe former may be solved by updating it to a newer version or by switching to a more modern browser.\n\nThe latter may be solved by loosening its security restrictions or, perhaps, by viewing the " + config.errorName + " via the HTTP protocol.");
			return false;
		}
	},
	buildRewind: function () {
		if (DEBUG) { console.log("[UISystem.buildRewind()]"); }

		var dialog   = UISystem._body,
			hasItems = false;

		$(dialog)
			.empty()
			.addClass("rewind");

		for (var i = 0, len = state.length - 1; i < len; i++) {
			var passage = tale.get(state.history[i].title);
			if (passage && passage.tags.contains("bookmark")) {
				var el = document.createElement("div");
				el.classList.add("ui-close");
				$(el).click(function () {
					var p = i;
					if (config.historyMode === Modes.SessionHistory) {
						return function () {
							if (DEBUG) { console.log("[rewind:click() @sessionHistory]"); }

							// necessary?
							document.title = tale.title;

							// regenerate the state history suid
							state.regenerateSuid();

							// push the history states in order
							if (config.disableHistoryControls) {
								if (DEBUG) { console.log("    > pushing: " + p + " (" + state.history[p].title + ")"); }

								// load the state into the window history
								History.replaceWindowState(
									{ suid: state.suid, sidx: state.history[p].sidx },
									(config.displayPassageTitles && state.history[p].title !== config.startPassage)
										? tale.title + ": " + state.history[p].title
										: tale.title
								);
							} else {
								for (var i = 0, end = p; i <= end; i++) {
									if (DEBUG) { console.log("    > pushing: " + i + " (" + state.history[i].title + ")"); }

									// load the state into the window history
									History.addWindowState(
										{ suid: state.suid, sidx: state.history[i].sidx },
										(config.displayPassageTitles && state.history[i].title !== config.startPassage)
											? tale.title + ": " + state.history[i].title
											: tale.title
									);
								}
							}

							var windowState = History.getWindowState();
							if (windowState.sidx < state.top.sidx) {
								if (DEBUG) { console.log("    > stacks out of sync; popping " + (state.top.sidx - windowState.sidx) + " states to equalize"); }
								// stack ids are out of sync, pop our stack until
								// we're back in sync with the window.history
								state.pop(state.top.sidx - windowState.sidx);
							}

							// activate the current top
							state.activate(state.top);

							// display the passage
							state.display(state.active.title, null, "replace");
						};
					} else if (config.historyMode === Modes.WindowHistory) {
						return function () {
							if (DEBUG) { console.log("[rewind:click() @windowHistory]"); }

							// necessary?
							document.title = tale.title;

							// push the history states in order
							if (!config.disableHistoryControls) {
								for (var i = 0, end = p; i <= end; i++) {
									if (DEBUG) { console.log("    > pushing: " + i + " (" + state.history[i].title + ")"); }

									// load the state into the window history
									var stateObj = { history: state.history.slice(0, i + 1) };
									if (state.hasOwnProperty("prng")) {
										stateObj.rseed = state.prng.seed;
									}
									History.addWindowState(
										stateObj,
										(config.displayPassageTitles && state.history[i].title !== config.startPassage)
											? tale.title + ": " + state.history[i].title
											: tale.title
									);
								}
							}

							// stack ids are out of sync, pop our stack until
							// we're back in sync with the window.history
							state.pop(state.length - (p + 1));

							// activate the current top
							state.activate(state.top);

							// display the passage
							state.display(state.active.title, null, "replace");
						};
					} else {
						return function () {
							if (!config.disableHistoryControls) {
								window.location.hash = state.history[p].hash;
							} else {
								session.setItem("activeHash", state.history[p].hash);
								window.location.reload();
							}
						};
					}
				}());
				el.innerHTML = passage.excerpt();
				dialog.appendChild(el);
				hasItems = true;
			}
		}
		if (!hasItems) {
			var el = document.createElement("div");
			el.innerHTML = "<i>No passages available</i>";
			dialog.appendChild(el);
		}
	},
	buildRestart: function () {
		if (DEBUG) { console.log("[UISystem.buildRestart()]"); }

		var dialog = UISystem._body;

		$(dialog)
			.empty()
			.addClass("dialog restart")
			.append('<p>Are you sure that you want to restart?  Unsaved progress will be lost.</p><ul><li><button id="restart-ok" class="ui-close">OK</button></li><li><button id="restart-cancel" class="ui-close">Cancel</button></li></ul>');

		// add an additional click handler for the OK button
		$("#ui-body #restart-ok").click(function () {
			state.restart();
		});

		return true;
	},
	buildOptions: function () {
		if (DEBUG) { console.log("[UISystem.buildOptions()]"); }

		var dialog = UISystem._body;

		$(dialog)
			.empty()
			.addClass("dialog options");
		new Wikifier(dialog, tale.get("MenuOptions").processText().trim());

		return true;
	},
	buildShare: function () {
		if (DEBUG) { console.log("[UISystem.buildShare()]"); }

		var dialog = UISystem._body;

		$(dialog)
			.empty()
			.addClass("share");
		new Wikifier(dialog, tale.get("MenuShare").processText().trim());
		$("br", dialog).remove();

		return true;
	},
	alert: function (message, options, closeFunc) {
		var dialog = UISystem._body;

		$(dialog)
			.empty()
			.addClass("dialog alert")
			.append('<p>' + message + '</p><ul><li><button id="alert-ok" class="ui-close">OK</button></li></ul>');

		// show the dialog
		UISystem.show(options, closeFunc);
	},
	restart: function () {
		// build the dialog
		UISystem.buildRestart();

		// show the dialog
		UISystem.show();
	},
	isOpen: function () {
		return document.body.classList.contains("ui-open");
	},
	addClickHandler: function (target, options, startFunc, doneFunc, closeFunc) {
		$(target).click(function (evt) {
			evt.preventDefault();  // does not prevent bound events, only default actions (e.g. href links)

			// call the start function
			if (typeof startFunc === "function") { startFunc(evt); }

			// show the dialog
			UISystem.show(options, closeFunc);

			// call the done function
			if (typeof doneFunc === "function") { doneFunc(evt); }
		});
	},
	show: function (options, closeFunc) {
		options = $.extend({ top: 50, opacity: 0.8 }, options);

		// stop the body from scrolling and setup the delegated UI close handler
		$(document.body)
			.addClass("ui-open")
			.on("click.uisystem-close", ".ui-close", closeFunc, UISystem.close);

		// display the overlay
		$(UISystem._overlay)
			//.addClass("ui-close")
			.css({ display: "block", opacity: 0 })
			.fadeTo(200, options.opacity);

		// display the dialog
		var position = UISystem.calcPositionalProperties(options.top);
		$(UISystem._body)
			.css($.extend({ display: "block", opacity: 0 }, position.dialog))
			.fadeTo(200, 1);
		$(UISystem._closer)
			.css($.extend({ display: "block", opacity: 0 }, position.closer))
			.fadeTo(50, 1);

		// add the UI resize handler
		$(window)
			.on("resize.uisystem", null, options.top, $.debounce(40, UISystem.resizeHandler));
	},
	close: function (evt) {
		// pretty much reverse the actions taken in UISystem.show()
		$(window)
			.off("resize.uisystem");
		$(UISystem._body)
			.css({
				display : "none",
				opacity : 0,
				left    : "",
				right   : "",
				top     : "",
				bottom  : ""
			})
			.removeClass()
			.empty();  // .empty() here will break static menus
		$(UISystem._closer)
			.css({
				display : "none",
				opacity : 0,
				right   : "",
				top     : ""
			});
		/*
		$(UISystem._overlay)
			.css({
				display : "none",
				opacity : 0
			})
			.fadeOut(200)
			.removeClass();
		*/
		$(UISystem._overlay)
			.fadeOut(200);
			//.removeClass();
		$(document.body)
			.off("click.uisystem-close")
			.removeClass("ui-open");

		// call the given "on close" callback function, if any
		if (evt && typeof evt.data === "function") { evt.data(evt); }
	},
	resizeHandler: function (evt) {
		var dialog = $(UISystem._body),
			closer = $(UISystem._closer),
			topPos = (evt && typeof evt.data !== "undefined") ? evt.data : 50;

		if (dialog.css("display") === "block") {
			// stow the dialog and unset its positional properties (this is important!)
			dialog.css({ display: "none", left: "", right: "", top: "", bottom: "" });
			closer.css({ display: "none", right: "", top: "" });

			// restore the dialog with its new positional properties
			var position = UISystem.calcPositionalProperties(topPos);
			dialog.css($.extend({ display: "block" }, position.dialog));
			closer.css($.extend({ display: "block" }, position.closer));
		}
	},
	calcPositionalProperties: function (topPos) {
		if (typeof topPos === "undefined") { topPos = 50; }

		var parent    = $(window),
			dialog    = $(UISystem._body),
			dialogPos = { left: "", right: "", top: "", bottom: "" },
			closer    = $(UISystem._closer),
			closerPos = { right: "", top: "" },
			horzSpace = parent.width() - dialog.outerWidth(true),
			vertSpace = parent.height() - dialog.outerHeight(true);

		if (horzSpace <= 32) {
			dialogPos.left = dialogPos.right = 16;
		} else {
			dialogPos.left = dialogPos.right = ~~(horzSpace / 2);
		}
		if (vertSpace <= 32) {
			dialogPos.top = dialogPos.bottom = 16;
		} else {
			if ((vertSpace / 2) > topPos) {
				dialogPos.top = topPos;
			} else {
				dialogPos.top = dialogPos.bottom = ~~(vertSpace / 2);
			}
		}

		closerPos.right = (dialogPos.right - closer.outerWidth(true) + 6) + "px";
		closerPos.top = (dialogPos.top - closer.outerHeight(true) + 6) + "px";
		for (var p in dialogPos) {
			if (dialogPos[p] !== "") {
				dialogPos[p] += "px";
			}
		}

		return { dialog: dialogPos, closer: closerPos };
	}
};


/***********************************************************************************************************************
** [End main.js]
***********************************************************************************************************************/
