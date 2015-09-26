/***********************************************************************************************************************
 *
 * sugarcube.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global History, KeyValueStore, Macro, Passage, Save, Setting, Tale, UI, Util, Wikifier, addStyle, browser,
	       fatalAlert, has, strings, technicalAlert
*/

/*
	Global SugarCube object which contains exported identifiers for debugging.  This also allows
	scripts to easily detect whether they're running in SugarCube (e.g. `"SugarCube" in window`).
*/
window.SugarCube = {};

/*
	Version object.
*/
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

/*
	Runtime object (internal use only).
*/
var	runtime = Object.defineProperties({}, {
		temp : {
			writable : true,
			value    : {}
		}
	});

/*
	Config object (author/developer use).
*/
var	config = Object.seal({
		/*
			General properties.
		*/
		addVisitedLinkClass   : false,
		cleanupWikifierOutput : false,
		loadDelay             : 0,

		/*
			History properties.
		*/
		history : Object.seal({
			controls  : true,
			maxStates : 100
		}),

		/*
			Macros properties.
		*/
		macros : Object.seal({
			ifAssignmentError : true,
			maxLoopIterations : 1000
		}),

		/*
			Passages properties.
		*/
		passages : Object.seal({
			descriptions  : undefined,
			displayTitles : false,
			start         : undefined, // set by the `Tale()` constructor
			transitionOut : undefined
		}),

		/*
			Saves properties.
		*/
		saves : Object.seal({
			autoload  : undefined,
			autosave  : undefined,
			id        : "untitled-story",
			isAllowed : undefined,
			onLoad    : undefined,
			onSave    : undefined,
			slots     : 8
		}),

		/*
			UI properties.
		*/
		ui : Object.seal({
			stowBarInitially    : false,
			updateStoryElements : true
		}),

		// transition properties
		transitionEndEventName : (function () {
			var	teMap  = {
					"transition"       : "transitionend",
					"MSTransition"     : "msTransitionEnd",
					"WebkitTransition" : "webkitTransitionEnd",
					"MozTransition"    : "transitionend"
				},
				teKeys = Object.keys(teMap),
				el     = document.createElement("div");
			for (var i = 0; i < teKeys.length; ++i) {
				if (el.style[teKeys[i]] !== undefined) {
					return teMap[teKeys[i]];
				}
			}
			return "";
		})()
	});

/*
	Variables.
*/
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
	The main function, which is the entry point for story startup.
*/
jQuery(function () {
	if (DEBUG) { console.log("[main()]"); }

	/*
		[WARNING!]

		The ordering of the code in this function is important, so be careful when mucking around with it.
	*/
	try {

		/*
			Normalize the document.
		*/
		if (document.normalize) {
			document.normalize();
		}

		/*
			Instantiate the tale, state, storage, and session objects.
		*/
		tale = new Tale();
		tale.init();
		state   = new History();
		storage = new KeyValueStore("webStorage", true, tale.domId); // params: driverType, persist, storageId
		session = new KeyValueStore("webStorage", false, tale.domId);

		/*
			Set the default saves ID.

			n.b. If not for the requirement to support Twine 1/Twee, we could use stories'
			     IFID attribute here.
		*/
		config.saves.id = tale.domId;

		/*
			Initialize the user interface (this must be done before script passages).
		*/
		UI.init();

		/*
			Alert players when their browser is degrading required capabilities.
		*/
		if (!session.has("rcWarn") && storage.name === "cookie") {
			session.set("rcWarn", 1);
			window.alert(strings.warnings.degraded.replace(/%identity%/g, strings.identity)); // eslint-disable-line no-alert
		}

		/*
			Add the story styles.
		*/
		for (var i = 0; i < tale.styles.length; ++i) {
			addStyle(tale.styles[i].text);
		}

		/*
			Evaluate the story scripts.
		*/
		for (var i = 0; i < tale.scripts.length; ++i) { // eslint-disable-line no-redeclare
			try {
				eval(tale.scripts[i].text); // eslint-disable-line no-eval
			} catch (e) {
				technicalAlert(tale.scripts[i].title, e.message);
			}
		}

		/*
			Process the story widgets.
		*/
		for (var i = 0; i < tale.widgets.length; ++i) { // eslint-disable-line no-redeclare
			try {
				Wikifier.wikifyEval(tale.widgets[i].processText());
			} catch (e) {
				technicalAlert(tale.widgets[i].title, e.message);
			}
		}

		/*
			Initialize the save system (this must be done after script passages and before state initialization).
		*/
		Save.init();

		/*
			Initialize the setting system.
		*/
		Setting.init();

		/*
			Call macros' init methods.
		*/
		Macro.init();

		/*
			Initialize our state.
		*/
		state.init(); // this could take a while, so do it late

		/*
			[DEPRECATED] Call macros' "late" init methods.
		*/
		//Macro.init("lateInit");

		/*
			Start the user interface.
		*/
		UI.start();

	} catch (e) {
		return fatalAlert(null, e.message);
	}

	/*
		Finally, export identifiers for debugging purposes.
	*/
	window.SugarCube = {
		History  : History,
		Macro    : Macro,
		Passage  : Passage,
		Save     : Save,
		Setting  : Setting,
		Tale     : Tale,
		UI       : UI,
		Util     : Util,
		Wikifier : Wikifier,
		browser  : browser,
		config   : config,
		has      : has,
		macros   : macros,
		runtime  : runtime,
		session  : session,
		settings : settings,
		setup    : setup,
		state    : state,
		storage  : storage,
		tale     : tale,
		version  : version
	};
});

