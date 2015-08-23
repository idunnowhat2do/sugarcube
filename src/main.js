/***********************************************************************************************************************
 *
 * main.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global History, KeyValueStore, Macro, Passage, Save, Setting, Tale, UI, Util, Wikifier, addStyle, browser,
	       fatalAlert, has, technicalAlert
*/

/*
	Global SugarCube object which contains exported identifiers for debugging.  This also allows
	scripts to detect whether they're running in SugarCube (e.g. `"SugarCube" in window`).
*/
window.SugarCube = {};

var	version = Object.freeze({
		// data properties
		title      : "SugarCube",
		major      : "{{BUILD_VERSION_MAJOR}}",
		minor      : "{{BUILD_VERSION_MINOR}}",
		patch      : "{{BUILD_VERSION_PATCH}}",
		prerelease : "{{BUILD_VERSION_PRERELEASE}}",
		build      : "{{BUILD_VERSION_BUILD}}",
		date       : new Date("{{BUILD_VERSION_DATE}}"),
		/* legacy */
		extensions : {},
		/* /legacy */

		// method properties
		toString : function () {
			return this.major + "." + this.minor + "." + this.patch
				+ (this.prerelease ? "-" + this.prerelease : "") + "+" + this.build;
		},
		short : function () {
			return this.title + " (v" + this.major + "." + this.minor + "." + this.patch
				+ (this.prerelease ? "-" + this.prerelease : "") + ")";
		},
		long : function () {
			return this.title + " v" + this.toString() + " (" + this.date.toUTCString() + ")";
		}
	});

// Runtime object (internal use only)
var	runtime = Object.defineProperties({}, {
		temp : {
			writable : true,
			value    : {}
		}
	});

// Config object (author/developer use)
var	config = {
		// general properties
		addVisitedLinkClass   : false,
		altPassageDescription : undefined,
		cleanupWikifierOutput : false,
		displayPassageTitles  : false,
		loadDelay             : 0,
		startingPassage       : undefined,
		updatePageElements    : true,

		// history properties
		history : {
			controls : true,
			mode     : has.pushState
				? has.sessionStorage ? History.Modes.Session : History.Modes.Window
				: History.Modes.Hash,
			tracking : true
		},

		// transition properties
		passageTransitionOut   : undefined,
		transitionEndEventName : (function () {
			var	teMap  = {
					"transition"       : "transitionend",
					"MSTransition"     : "msTransitionEnd",
					"WebkitTransition" : "webkitTransitionEnd",
					"MozTransition"    : "transitionend"
				},
				teKeys = Object.keys(teMap),
				el     = document.createElement("div");
			for (var i = 0; i < teKeys.length; i++) {
				if (el.style[teKeys[i]] !== undefined) {
					return teMap[teKeys[i]];
				}
			}
			return "";
		}()),

		// macros properties
		macros : {
			disableIfAssignmentError : false,
			maxLoopIterations        : 1000
		},

		// saves properties
		saves : {
			autoload  : undefined,
			autosave  : undefined,
			id        : "untitled-story",
			isAllowed : undefined,
			onLoad    : undefined,
			onSave    : undefined,
			slots     : 8
		},

		// UI properties
		ui : {
			stowBarInitially : false
		}
	};

/* eslint-disable no-unused-vars */
var	macros      = {}, // legacy macros object
	tale        = {}, // story manager
	state       = {}, // history manager
	storage     = {}, // persistant storage manager
	session     = {}, // session storage manager
	settings    = {}, // settings object
	setup       = {}, // setup object
	prehistory  = {}, // pre-history task callbacks object
	predisplay  = {}, // pre-display task callbacks object
	postdisplay = {}, // post-display task callbacks object
	prerender   = {}, // pre-render task callbacks object
	postrender  = {}; // post-render task callbacks object
/* eslint-enable no-unused-vars */

/**
	Main function, entry point for story startup
*/
jQuery(document).ready(function () {
	if (DEBUG) { console.log("[main()]"); }

	/*
		[WARNING!]
		The ordering of the code in this function is important, so be careful when mucking around with it.
	*/
	try {

		// normalize the document
		if (document.normalize) {
			document.normalize();
		}

		// instantiate the tale, state, storage, and session objects
		tale = new Tale();
		tale.init();
		state   = new History();
		storage = new KeyValueStore("webStorage", true, tale.domId); // params: driverName, persist, storageId
		session = new KeyValueStore("webStorage", false, tale.domId);

		// set the default saves ID
		config.saves.id = tale.domId;

		// initialize the user interface (this must be done before script passages)
		UI.init();

		// add the story styles
		for (var i = 0; i < tale.styles.length; i++) {
			addStyle(tale.styles[i].text);
		}

		// evaluate the story scripts
		for (var i = 0; i < tale.scripts.length; i++) { // eslint-disable-line no-redeclare
			try {
				eval(tale.scripts[i].text); // eslint-disable-line no-eval
			} catch (e) {
				technicalAlert(tale.scripts[i].title, e.message);
			}
		}

		// process the story widgets
		for (var i = 0; i < tale.widgets.length; i++) { // eslint-disable-line no-redeclare
			try {
				Wikifier.wikifyEval(tale.widgets[i].processText());
			} catch (e) {
				technicalAlert(tale.widgets[i].title, e.message);
			}
		}

		// initialize the save system (this must be done after script passages and before state initialization)
		Save.init();

		// initialize the setting system
		Setting.init();

		// call macros' init methods
		Macro.init();

		// initialize our state
		state.init(); // this could take a while, so do it late

		// call macros' "late" init methods
		//Macro.init("lateInit");

		// start the user interface
		UI.start();

	} catch (e) {
		return fatalAlert(null, e.message);
	}

	// lastly, export identifiers for debugging purposes
	window.SugarCube = {
		version  : version,
		runtime  : runtime,
		has      : has,
		browser  : browser,
		config   : config,
		setup    : setup,
		settings : settings,
		storage  : storage,
		session  : session,
		macros   : macros,
		tale     : tale,
		state    : state,
		Wikifier : Wikifier,
		Macro    : Macro,
		Util     : Util,
		History  : History,
		Passage  : Passage,
		Tale     : Tale,
		UI       : UI,
		Save     : Save,
		Setting  : Setting
	};
});

