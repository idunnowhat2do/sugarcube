/***********************************************************************************************************************
 *
 * sugarcube.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Browser, Has, KeyValueStore, Macro, Passage, Save, Setting, State, Story, UI, Util, Wikifier, fatalAlert,
	       strings
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
			State history properties.
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
			start         : undefined, // set by `Story.init()`
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
			slots     : 8,
			version   : undefined
		}),

		/*
			UI properties.
		*/
		ui : Object.seal({
			stowBarInitially    : false,
			updateStoryElements : true
		}),

		/*
			Transition properties.
		*/
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
	Internal variables, mostly for use by story authors.
*/
/* eslint-disable no-unused-vars */
var	macros      = {},    // legacy macros object
	tale        = Story, // legacy story manager object (alias for `Story`)
	state       = State, // legacy state manager object (alias for `State`)
	storage     = {},    // persistant storage manager object
	session     = {},    // session storage manager object
	settings    = {},    // settings object
	setup       = {},    // setup object
	prehistory  = {},    // pre-history task callbacks object
	predisplay  = {},    // pre-display task callbacks object
	postdisplay = {},    // post-display task callbacks object
	prerender   = {},    // pre-render task callbacks object
	postrender  = {};    // post-render task callbacks object
/* eslint-enable no-unused-vars */

/**
	The main function, which is the entry point for the story.
**/
jQuery(function () {
	if (DEBUG) { console.log("[SugarCube/main()]"); }

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
			Initialize the story (this must be done before most anything else).
		*/
		Story.init();

		/*
			Instantiate the storage and session objects.
		*/
		storage = new KeyValueStore("webStorage", true, Story.domId); // params: driverType, persist, storageId
		session = new KeyValueStore("webStorage", false, Story.domId);

		/*
			Set the default saves ID.

			n.b. If not for the requirement to support Twine 1/Twee, we could use stories'
			     IFID attribute here.
		*/
		config.saves.id = Story.domId;

		/*
			Initialize the user interface (this must be done before story startup, specifically before user scripts).
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
			Start the story (largely load the user styles, scripts, and widgets).
		*/
		Story.start();

		/*
			Initialize the save system (this must be done after story startup, but before state initialization).
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
			Initialize the state (this should be done as late as possible, but before UI startup).
		*/
		State.init();

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
		Browser  : Browser,
		Has      : Has,
		Macro    : Macro,
		Passage  : Passage,
		Save     : Save,
		Setting  : Setting,
		State    : State,
		Story    : Story,
		UI       : UI,
		Util     : Util,
		Wikifier : Wikifier,
		config   : config,
		macros   : macros,
		runtime  : runtime,
		session  : session,
		settings : settings,
		setup    : setup,
		storage  : storage,
		version  : version
	};
});
