/***********************************************************************************************************************
 *
 * strings.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

/* eslint-disable max-len */
var	strings = { // eslint-disable-line no-unused-vars
		// general
		identity : "game",
		cancel   : "Cancel",
		close    : "Close",
		ok       : "OK",

		// ui-bar
		uiBar : {
			toggle  : "Hide/show the UI bar",
			credits : 'Made with <a href="http://twinery.org/" target="_blank" tabindex="-1">Twine</a> &amp; <a href="http://www.motoslave.net/sugarcube/" target="_blank" tabindex="-1">SugarCube</a>'
		},

		// saves
		saves : {
			title       : "Saves",
			disallowed  : "Saving has been disallowed on this passage.",
			diskLoad    : "Load from Disk\u2026",
			diskSave    : "Save to Disk\u2026",
			emptySlot   : "— slot empty —",
			importLabel : "Select a save file to load:",
			incapable   : 'Apologies! Your browser either lacks some of the capabilities required to support saves or has disabled them. The former can probably be solved by <a href="http://browsehappy.com/">upgrading your browser</a>. The latter may be solved by loosening its security restrictions or, perhaps, by viewing this %identity% via the HTTP protocol (if you are not already doing so).',
			labelAuto   : "Autosave",
			labelSlot   : "Slot",
			labelDelete : "Delete",
			labelLoad   : "Load",
			labelSave   : "Save",
			savedOn     : "Saved on",
			slotsPurge  : "Purge Slots",
			unavailable : "No save slots found\u2026",
			unknownDate : "unknown"
		},

		// settings
		settings : {
			title : "Settings",
			off   : "Off",
			on    : "On",
			reset : "Reset to Defaults"
		},

//		// rewind
//		rewind : {
//			title       : "Rewind",
//			turn        : "Turn",
//			unavailable : "No rewind points available\u2026"
//		},

		// restart
		restart : {
			title  : "Restart",
			prompt : "Are you sure that you want to restart? Unsaved progress will be lost."
		},

		// share
		share : {
			title : "Share"
		},

		// alert
		alert : {
		},

		// autosave autoload
		autoload : {
			title  : "Autoload",
			cancel : "Go to start",
			ok     : "Load autosave",
			prompt : "There's an existing autosave. Load it now or go to the start?"
		},

		// macros
		macros : {
			back : {
				text : "Back"
			},
			return : {
				text : "Return"
			}
		}
	};
/* eslint-enable max-len */

