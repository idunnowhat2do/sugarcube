/***********************************************************************************************************************
 *
 * sugarcube.js
 *
 * Copyright © 2013–2017 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Alert, Browser, Config, Dialog, DebugView, Engine, Has, LoadScreen, SimpleStore, L10n, Macro, Passage,
	       Save, Scripting, Setting, SimpleAudio, State, Story, UI, UIBar, Util, Wikifier
*/
/* eslint-disable no-var */

/*
	Version object.
*/
var version = Object.freeze({
	title      : 'SugarCube',
	major      : '{{BUILD_VERSION_MAJOR}}',
	minor      : '{{BUILD_VERSION_MINOR}}',
	patch      : '{{BUILD_VERSION_PATCH}}',
	prerelease : '{{BUILD_VERSION_PRERELEASE}}',
	build      : '{{BUILD_VERSION_BUILD}}',
	date       : new Date('{{BUILD_VERSION_DATE}}'),
	/* legacy */
	extensions : {},
	/* /legacy */

	toString() {
		'use strict';

		const prerelease = this.prerelease ? `-${this.prerelease}` : '';
		return `${this.major}.${this.minor}.${this.patch}${prerelease}+${this.build}`;
	},

	short() {
		'use strict';

		const prerelease = this.prerelease ? `-${this.prerelease}` : '';
		return `${this.title} (v${this.major}.${this.minor}.${this.patch}${prerelease})`;
	},

	long() {
		'use strict';

		return `${this.title} v${this.toString()} (${this.date.toUTCString()})`;
	}
});

/* eslint-disable no-unused-vars */
/*
	Internal variables.
*/
// Temporary state object.
var TempState = {};

// Legacy macros object.
var macros = {};

// Post-display task callbacks object.
var postdisplay = {};

// Post-render task callbacks object.
var postrender = {};

// Pre-display task callbacks object.
var predisplay = {};

// Pre-history task callbacks object.
var prehistory = {};

// Pre-render task callbacks object.
var prerender = {};

// Session storage manager object.
var session = null;

// Settings object.
var settings = {};

// Setup object.
var setup = {};

// Persistant storage manager object.
var storage = null;

/*
	Legacy aliases.
*/
var browser       = Browser;
var config        = Config;
var has           = Has;
var History       = State;
var state         = State;
var tale          = Story;
var TempVariables = State.temporary;
/* eslint-enable no-unused-vars */

/*
	Global `SugarCube` object.  Allows scripts to detect if they're running in SugarCube by
	testing for the object (e.g. `"SugarCube" in window`) and contains exported identifiers
	for debugging purposes.
*/
window.SugarCube = {};

/*
	Main function, entry point for the story.
*/
jQuery(() => {
	'use strict';

	try {
		if (DEBUG) { console.log('[SugarCube/main()] Document loaded; beginning startup.'); }

		/*
			WARNING!

			The ordering of the code within this function is critically important,
			so be careful when mucking around with it.
		*/

		// Acquire an initial lock for and initialize the loading screen.
		const lockId = LoadScreen.lock();
		LoadScreen.init();

		// Normalize the document.
		if (document.normalize) {
			document.normalize();
		}

		// Load the story data (must be done before most anything else).
		Story.load();

		// Instantiate the storage and session objects.
		// NOTE: `SimpleStore.create(storageId, persistent)`
		storage = SimpleStore.create(Story.domId, true);
		session = SimpleStore.create(Story.domId, false);

		// Initialize the user interface (must be done before story initialization, specifically before scripts).
		Dialog.init();
		UI.init();
		UIBar.init();

		// Initialize the story (largely load the user styles, scripts, and widgets).
		Story.init();

		// Initialize the localization (must be done after story initialization).
		L10n.init();

		// Alert when the browser is degrading required capabilities (must be done after localization initialization).
		if (!session.has('rcWarn') && storage.name === 'cookie') {
			/* eslint-disable no-alert */
			session.set('rcWarn', 1);
			window.alert(L10n.get('warningNoWebStorage'));
			/* eslint-enable no-alert */
		}

		// Initialize the saves (must be done after story initialization, but before engine start).
		Save.init();

		// Initialize the settings.
		Setting.init();

		// Initialize the macros.
		Macro.init();

		// Start the engine (should be done as late as possible, but before UI startup).
		Engine.start();

		// Start the user interface.
		UI.start();
		UIBar.start();

		// Finally, export identifiers for debugging purposes.
		window.SugarCube = {
			Browser,
			Config,
			Dialog,
			DebugView,
			Engine,
			Has,
			L10n,
			Macro,
			Passage,
			Save,
			Scripting,
			Setting,
			SimpleAudio,
			State,
			Story,
			UI,
			UIBar,
			Util,
			Wikifier,
			macros,
			session,
			settings,
			setup,
			storage,
			version
		};

		// Release the loading screen lock.
		LoadScreen.unlock(lockId);

		if (DEBUG) { console.log('[SugarCube/main()] Startup complete; story ready.'); }
	}
	catch (ex) {
		LoadScreen.clear();
		return Alert.fatal(null, ex.message, ex);
	}
});
