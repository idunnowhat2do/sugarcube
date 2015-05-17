/***********************************************************************************************************************
 *
 * strings.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var	strings = {
		// general
		identity : "game",
		ok       : "OK",
		cancel   : "Cancel",

		// ui-bar
		uiBar : {
			credits : 'Made with <a href="http://twinery.org/" target="_blank">Twine</a> &amp; <a href="http://www.motoslave.net/sugarcube/" target="_blank">SugarCube</a>',
			toggle  : "Toggle the UI bar"
		},

		// saves
		saves : {
			title       : "Saves",
			disallowed  : "Saving has been disallowed on this passage.",
			importLabel : "Select a save file to load:",
			incapable   : "Apologies! Your browser either lacks some of the capabilities required to support saves or has disabled them. The former may be solved by updating it to a newer version or by switching to a more modern browser. The latter may be solved by loosening its security restrictions or, perhaps, by viewing this %identity% via the HTTP protocol.",
			unavailable : "No save slots found\u2026",
			slotEmpty   : "— slot empty —",
			slotSave    : "Save",
			slotLoad    : "Load",
			slotDelete  : "Del.",
			savedOn     : "Saved",
			unknownDate : "unknown",
			diskSave    : "Save to Disk\u2026",
			diskLoad    : "Load from Disk\u2026",
			slotsPurge  : "Purge Slots"
		},

		// settings
		settings : {
			title : "Settings",
			on    : "On",
			off   : "Off",
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
			title : "Share",
		},

		// alert
		alert : {
		},

		// autosave autoload
		autoload : {
			title  : "Autoload",
			prompt : "There's an existing autosave. Load it now or go to the start?",
			ok     : "Load autosave",
			cancel : "Go to start"
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

