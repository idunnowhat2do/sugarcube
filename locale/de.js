/***********************************************************************************************************************

	de.js – Deutsch

	Localization by: Phil Strahl <phil@pixelprophecy.com>.

	Copyright © 2017 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

	For more information about the guidelines used to create this localization, see:
		http://www.motoslave.net/sugarcube/2/docs/localization.html

***********************************************************************************************************************/
(function () {
	/* General. */
	l10nStrings.identity = 'Spiel';
	l10nStrings.aborting = 'Vorzeitig abgebrochen';
	l10nStrings.cancel   = 'Abbrechen';
	l10nStrings.close    = 'Schließen';
	l10nStrings.ok       = 'OK';

	/* Errors. */
	l10nStrings.errorTitle              = 'Fehler';
	l10nStrings.errorNonexistentPassage = 'die Passage "{passage}" existiert nicht';
	l10nStrings.errorSaveMissingData    = 'Im Speicherstand fehlen notwendige Daten. Entweder ist die geladene Datei kein Speicherstand oder der Speicherstand ist korrupt';
	l10nStrings.errorSaveIdMismatch     = 'Speicherstand ist vom falschen {identity}';

	/* Warnings. */
	l10nStrings._warningGermanLacking = 'in ihrem Browser entweder deaktiviert oder nicht möglich';
	l10nStrings._warningOutroDegraded = ', darum läuft dieses {identity} in einem herabgesetzten Modus. Sie können zwar fortfahren, allerdings kann es sein, dass nicht alle Teile wie gewünscht funktionieren.';
	l10nStrings.warningNoWebStorage   = 'Das Web Storage API ist {_warningGermanLacking}{_warningOutroDegraded}';
	l10nStrings.warningDegraded       = 'Einige Features, die diese/s {identity} benötigt sind {_warningGermanLacking}{_warningOutroDegraded}';

	/* Debug View. */
	l10nStrings.debugViewTitle  = 'Fehlersuche-Ansicht';
	l10nStrings.debugViewToggle = 'Fehlersuche-Ansicht umschalten';

	/* UI bar. */
	l10nStrings.uiBarToggle   = 'Benutzeroberflächenleiste umschlaten';
	l10nStrings.uiBarBackward = 'Im {identity}-Ablauf zurück gehen';
	l10nStrings.uiBarForward  = 'Im {identity}-Ablauf nach vor gehen';
	l10nStrings.uiBarJumpto   = 'Zu einem bestimmten Punkt im {identity}-Ablauf springen';

	/* Jump To. */
	l10nStrings.jumptoTitle       = 'Springe zu';
	l10nStrings.jumptoTurn        = 'Zug';
	l10nStrings.jumptoUnavailable = 'Momentan sind keine Sprungmarken vorhanden\u2026';

	/* Saves. */
	l10nStrings.savesTitle       = 'Speicherstände';
	l10nStrings.savesDisallowed  = 'Speichern ist in dieser Passage nicht gestattet.';
	l10nStrings.savesEmptySlot   = '— Speicherslot leer —';
	l10nStrings.savesIncapable   = 'Die Möglichkeit zu Speichern ist {_warningGermanLacking}, darum ist die Speicherfunktion für diese Sitzung deaktiviert.';
	l10nStrings.savesLabelAuto   = 'Automatischer Speicherstand';
	l10nStrings.savesLabelDelete = 'Löschen';
	l10nStrings.savesLabelExport = 'Auf Datensträger speichern\u2026';
	l10nStrings.savesLabelImport = 'Von Datenträger laden\u2026';
	l10nStrings.savesLabelLoad   = 'Laden';
	l10nStrings.savesLabelClear  = 'Alle löschen';
	l10nStrings.savesLabelSave   = 'Speichern';
	l10nStrings.savesLabelSlot   = 'Slot';
	l10nStrings.savesSavedOn     = 'Gespeichert nach';
	l10nStrings.savesUnavailable = 'Keine Speicherstand-Slots gefunden\u2026';
	l10nStrings.savesUnknownDate = 'unbekannt';

	/* Settings. */
	l10nStrings.settingsTitle = 'Einstellungen';
	l10nStrings.settingsOff   = 'Aus';
	l10nStrings.settingsOn    = 'An';
	l10nStrings.settingsReset = 'Auf Standardwerte zurücksetzen';

	/* Restart. */
	l10nStrings.restartTitle  = 'Neustart';
	l10nStrings.restartPrompt = 'Sind sie sicher, dass Sie neu starten wollen? Ihr Fortschritt nach dem letzten Speichern geht verloren.';

	/* Share. */
	l10nStrings.shareTitle = 'Teilen';

	/* Autoload. */
	l10nStrings.autoloadTitle  = 'Automatisch laden';
	l10nStrings.autoloadCancel = 'Zum Start gehen';
	l10nStrings.autoloadOk     = 'Automatischen Speicherstand laden';
	l10nStrings.autoloadPrompt = 'Ein automatischer Speicherstand existiert bereits. Trotzdem laden oder zum Start gehen?';

	/* Macros. */
	l10nStrings.macroBackText   = 'Zurück';
	l10nStrings.macroReturnText = 'Return';
})();
