/***********************************************************************************************************************
 *
 * sugarcube.js
 *
 * Copyright © 2013–2017 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Alert, Browser, Config, Dialog, DebugView, Engine, Has, SimpleStore, L10n, Macro, Passage, Save,
	       Scripting, Setting, SimpleAudio, State, Story, UI, Util, Wikifier
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
var
	// Temporary state object.
	TempState = {},

	// Temporary _variables object.
	TempVariables = {},

	// Legacy macros object.
	macros = {},

	// Post-display task callbacks object.
	postdisplay = {},

	// Post-render task callbacks object.
	postrender = {},

	// Pre-display task callbacks object.
	predisplay = {},

	// Pre-history task callbacks object.
	prehistory = {},

	// Pre-render task callbacks object.
	prerender = {},

	// Session storage manager object.
	session = null,

	// Settings object.
	settings = {},

	// Setup object.
	setup = {},

	// Persistant storage manager object.
	storage = null;

/*
	Legacy aliases.
*/
var
	browser = Browser,
	config  = Config,
	has     = Has,
	History = State,
	state   = State,
	tale    = Story;
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

			The ordering of the code in this function is important, so be careful when mucking around with it.
		*/

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
			TempVariables,
			UI,
			Util,
			Wikifier,
			macros,
			session,
			settings,
			setup,
			storage,
			version
		};

		if (DEBUG) { console.log('[SugarCube/main()] Startup complete; story ready.'); }
	}
	catch (ex) {
		jQuery(document).off('readystatechange.SugarCube');
		return Alert.fatal(null, ex.message, ex);
	}
});
