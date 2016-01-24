/***********************************************************************************************************************
 *
 * strings.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
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

		/*
			Identity.
		*/
		identity : "game",

		/*
			General.
		*/
		aborting : "Aborting",
		cancel   : "Cancel",
		close    : "Close",
		ok       : "OK",

		/*
			Errors.
		*/
		errors : {
			title              : "Error",
			nonexistentPassage : 'the passage "%passage%" does not exist',
			saveMissingData    : "save is missing required data. Either you've loaded a file which is not a save or the save has become corrupted",
			saveIdMismatch     : "save is from the wrong %identity%"
		},

		/*
			Warnings.
		*/
		warnings : {
			degraded : 'Apologies! Your browser either lacks some of the capabilities required by this %identity% or has disabled them, so this %identity% is running in a degraded mode. You may be able to continue, but some parts may not work properly.\n\nThe former may, probably, be solved by upgrading your browser. The latter may be solved by loosening its security restrictions' + (window.location.protocol === "file:" ? " or, perhaps, by viewing this %identity% via the HTTP protocol." : ".")
		},

		/*
			Debug View.
		*/
		debugView : {
			title  : "Debug View",
			toggle : "Toggle the debug view"
		},

		/*
			UI bar.
		*/
		uiBar : {
			toggle   : "Toggle the UI bar",
			backward : "Go backward within the %identity% history",
			forward  : "Go forward within the %identity% history",
			jumpto   : "Jump to a specific point within the %identity% history"
		},

		/*
			Jump To.
		*/
		jumpto : {
			title       : "Jump To",
			turn        : "Turn",
			unavailable : "No jump points currently available\u2026"
		},

		/*
			Saves.
		*/
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

		/*
			Settings.
		*/
		settings : {
			title : "Settings",
			off   : "Off",
			on    : "On",
			reset : "Reset to Defaults"
		},

		/*
			Restart.
		*/
		restart : {
			title  : "Restart",
			prompt : "Are you sure that you want to restart? Unsaved progress will be lost."
		},

		/*
			Share.
		*/
		share : {
			title : "Share"
		},

		/*
			Alert.
		*/
		alert : { /* empty*/ },

		/*
			Autoload.
		*/
		autoload : {
			title  : "Autoload",
			cancel : "Go to start",
			ok     : "Load autosave",
			prompt : "An autosave exists. Load it now or go to the start?"
		},

		/*
			Macros.
		*/
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

