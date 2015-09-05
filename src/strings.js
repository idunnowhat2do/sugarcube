/***********************************************************************************************************************
 *
 * strings.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

/* eslint-disable max-len */
/*
	Notes:

	1. The capitalization and punctuation used herein is deliberate, especially within the error strings.
	2. The replacement patterns (%…%) are only supported for the strings in which they can be found
	   herein.  During replacement, all instances of the patterns are replaced, so, where they are
	   found, they may be used as many times as desired.
*/
var	strings = { // eslint-disable-line no-unused-vars
		// identity
		identity : "game",

		// general
		aborting : "Aborting",
		cancel   : "Cancel",
		close    : "Close",
		ok       : "OK",

		// errors
		errors : {
			title              : "Error",
			nonexistentPassage : 'the passage "%passage%" does not exist',
			saveMissingData    : "save is missing required data. Either you've loaded a file which is not a save or the save has become corrupted",
			saveIdMismatch     : "save is from the wrong %identity%"
		},

		// warnings
		warnings : {
			degraded : 'Apologies! Your browser either lacks some of the capabilities required by this %identity% or has disabled them, so this %identity% is running in a degraded mode. You may be able to continue, but some parts may not work properly.\n\nThe former may, probably, be solved by upgrading your browser. The latter may be solved by loosening its security restrictions' + (window.location.protocol === "file:" ? " or, perhaps, by viewing this %identity% via the HTTP protocol." : ".")
		},

		// ui-bar
		uiBar : {
			toggle : "Hide/show the UI bar"
		},

		// saves
		saves : {
			title       : "Saves",
			disallowed  : "Saving has been disallowed on this passage.",
			emptySlot   : "— slot empty —",
			incapable   : 'Apologies! Your browser either lacks the capabilities required to support saves or has disabled them, so saves have been disabled for this session.<br><br>The former may, probably, be solved by <a href="http://browsehappy.com/" target="_blank">upgrading your browser</a>. The latter may be solved by loosening its security restrictions' + (window.location.protocol === "file:" ? " or, perhaps, by viewing this %identity% via the HTTP protocol." : "."),
			labelAuto   : "Autosave",
			labelDelete : "Delete",
			labelExport : "Save to Disk\u2026",
			labelImport : "Load from Disk\u2026",
			labelLoad   : "Load",
			labelClear  : "Delete All",
			labelSave   : "Save",
			labelSlot   : "Slot",
			savedOn     : "Saved on",
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

		// rewind
		rewind : {
			title       : "Rewind",
			turn        : "Turn",
			unavailable : "No rewind points available\u2026"
		},

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
			prompt : "An autosave exists. Load it now or go to the start?"
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

