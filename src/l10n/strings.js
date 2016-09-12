/***********************************************************************************************************************
 *
 * l10n/strings.js
 *
 * Copyright © 2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* eslint-disable max-len, prefer-template */

/*
	The capitalization and punctuation used within the default replacement strings is
	deliberate, especially within the error strings.  Translators would do well to keep
	their translations similar.

	Replacement patterns have the format `%NAME%` (e.g. %identity%), where NAME is the
	name of the associated property within either the `l10nStrings` table or a specifed
	overrides table.  During replacement, patterns are replaced recursively, so
	replacement strings may contain patterns whose replacements contain other patterns.
	Because replacement is recursive, care must be taken to ensure infinite loops are
	not created—the system will detect an infinite loop and throw an error.
*/
var l10nStrings = { // eslint-disable-line no-unused-vars, no-var
	/*
		General.
	*/
	identity : 'game',
	aborting : 'Aborting',
	cancel   : 'Cancel',
	close    : 'Close',
	ok       : 'OK',

	/*
		Errors.
	*/
	errorTitle              : 'Error',
	errorNonexistentPassage : 'the passage "%passage%" does not exist', // `passage` is supplied locally
	errorSaveMissingData    : "save is missing required data. Either you've loaded a file which is not a save or the save has become corrupted",
	errorSaveIdMismatch     : 'save is from the wrong %identity%',

	/*
		Warnings.
	*/
	warningDegraded : 'Apologies! Your browser either lacks some of the capabilities required by this %identity% or has disabled them, so this %identity% is running in a degraded mode. You may be able to continue, but some parts may not work properly.\n\nThe former may, probably, be solved by upgrading your browser. The latter may be solved by loosening its security restrictions' + (window.location.protocol === 'file:' ? ' or, perhaps, by viewing this %identity% via the HTTP protocol.' : '.'),

	/*
		Debug View.
	*/
	debugViewTitle  : 'Debug View',
	debugViewToggle : 'Toggle the debug view',

	/*
		UI bar.
	*/
	uiBarToggle   : 'Toggle the UI bar',
	uiBarBackward : 'Go backward within the %identity% history',
	uiBarForward  : 'Go forward within the %identity% history',
	uiBarJumpto   : 'Jump to a specific point within the %identity% history',

	/*
		Jump To.
	*/
	jumptoTitle       : 'Jump To',
	jumptoTurn        : 'Turn',
	jumptoUnavailable : 'No jump points currently available\u2026',

	/*
		Saves.
	*/
	savesTitle       : 'Saves',
	savesDisallowed  : 'Saving has been disallowed on this passage.',
	savesEmptySlot   : '— slot empty —',
	savesIncapable   : 'Apologies! Your browser either lacks the capabilities required to support saves or has disabled them, so saves have been disabled for this session.<br><br>The former may, probably, be solved by <a href="http://browsehappy.com/" target="_blank">upgrading your browser</a>. The latter may be solved by loosening its security restrictions' + (window.location.protocol === 'file:' ? ' or, perhaps, by viewing this %identity% via the HTTP protocol.' : '.'),
	savesLabelAuto   : 'Autosave',
	savesLabelDelete : 'Delete',
	savesLabelExport : 'Save to Disk\u2026',
	savesLabelImport : 'Load from Disk\u2026',
	savesLabelLoad   : 'Load',
	savesLabelClear  : 'Delete All',
	savesLabelSave   : 'Save',
	savesLabelSlot   : 'Slot',
	savesSavedOn     : 'Saved on',
	savesUnavailable : 'No save slots found\u2026',
	savesUnknownDate : 'unknown',

	/*
		Settings.
	*/
	settingsTitle : 'Settings',
	settingsOff   : 'Off',
	settingsOn    : 'On',
	settingsReset : 'Reset to Defaults',

	/*
		Restart.
	*/
	restartTitle  : 'Restart',
	restartPrompt : 'Are you sure that you want to restart? Unsaved progress will be lost.',

	/*
		Share.
	*/
	shareTitle : 'Share',

	/*
		Alert.
	*/
	/* none */

	/*
		Autoload.
	*/
	autoloadTitle  : 'Autoload',
	autoloadCancel : 'Go to start',
	autoloadOk     : 'Load autosave',
	autoloadPrompt : 'An autosave exists. Load it now or go to the start?',

	/*
		Macros.
	*/
	macroBackText   : 'Back',
	macroReturnText : 'Return'
};
