/***********************************************************************************************************************
 *
 * save.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global History, UI, config, escape, saveAs, state, storage, strings, tale */

var Save = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	var
		_slotsUBound = -1;


	/*******************************************************************************************************************
	 * Initialization
	 ******************************************************************************************************************/
	function init() {
		/* legacy kludges */
		function convertOldSave(saveObj) {
			if (saveObj.hasOwnProperty("data") && !saveObj.hasOwnProperty("state")) {
				saveObj.state = {
					mode  : saveObj.mode,
					delta : History.deltaEncodeHistory(saveObj.data)
				};
				delete saveObj.mode;
				delete saveObj.data;
			} else if (saveObj.hasOwnProperty("state") && !saveObj.state.hasOwnProperty("delta")) {
				saveObj.state.delta = History.deltaEncodeHistory(saveObj.state.history);
				delete saveObj.state.history;
			}
		}
		/* /legacy kludges */

		if (DEBUG) { console.log("[Save.init()]"); }

		if (config.saves.slots < 0) {
			config.saves.slots = 0;
		}

		// get the saves object
		var	saves   = savesObjGet(),
			updated = false;

		/* legacy kludges */
		// convert an old saves array into a new saves object
		if (Array.isArray(saves)) {
			saves = {
				autosave : null,
				slots    : saves
			};
			updated = true;
		}
		/* /legacy kludges */

		// handle the author changing the number of save slots
		if (config.saves.slots !== saves.slots.length) {
			if (config.saves.slots < saves.slots.length) {
				// attempt to decrease the number of slots; this will only compact
				// the slots array, by removing empty slots, no saves will be deleted
				saves.slots.reverse();
				saves.slots = saves.slots.filter(function (val) {
					if (val === null && this.count > 0) {
						this.count--;
						return false;
					}
					return true;
				}, { count : saves.slots.length - config.saves.slots });
				saves.slots.reverse();
			} else if (config.saves.slots > saves.slots.length) {
				// attempt to increase the number of slots
				_appendSlots(saves.slots, config.saves.slots - saves.slots.length);
			}
			updated = true;
		}

		/* legacy kludges */
		// convert old-style saves
		if (saves.autosave !== null) {
			if (!saves.autosave.hasOwnProperty("state") || !saves.autosave.state.hasOwnProperty("delta")) {
				convertOldSave(saves.autosave);
				updated = true;
			}
		}
		for (var i = 0; i < saves.slots.length; i++) {
			if (saves.slots[i] !== null) {
				if (!saves.slots[i].hasOwnProperty("state") || !saves.slots[i].state.hasOwnProperty("delta")) {
					convertOldSave(saves.slots[i]);
					updated = true;
				}
			}
		}
		/* /legacy kludges */

		// if the saves object was updated, then update the store
		if (updated) {
			_savesObjSave(saves);
		}

		_slotsUBound = saves.slots.length - 1;

		return true;
	}


	/*******************************************************************************************************************
	 * Saves Object
	 ******************************************************************************************************************/
	function savesObjCreate() {
		return {
			autosave : null,
			slots    : _appendSlots([], config.saves.slots)
		};
	}

	function savesObjGet() {
		var saves = storage.get("saves");
		return saves === null ? savesObjCreate() : saves;
	}

	function savesObjClear() {
		storage.delete("saves");
		return true;
	}


	/*******************************************************************************************************************
	 * General
	 ******************************************************************************************************************/
	function ok() {
		return autosaveOK() || slotsOK();
	}


	/*******************************************************************************************************************
	 * Autosave
	 ******************************************************************************************************************/
	function autosaveOK() {
		return typeof config.saves.autosave !== "undefined";
	}

	function autosaveHas() {
		var saves = savesObjGet();
		if (saves.autosave === null) {
			return false;
		}
		return true;
	}

	function autosaveGet() {
		var saves = savesObjGet();
		return saves.autosave;
	}

	function autosaveLoad() {
		var saves = savesObjGet();
		if (saves.autosave === null) {
			return false;
		}
		return _unmarshal(saves.autosave);
	}

	function autosaveSave(title, metadata) {
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			return false;
		}

		var saves = savesObjGet();
		saves.autosave = _marshal();
		saves.autosave.title = title || tale.get(state.active.title).description();
		saves.autosave.date = Date.now();
		if (metadata != null) { // lazy equality for null
			saves.autosave.metadata = metadata;
		}
		return _savesObjSave(saves);
	}

	function autosaveDelete() {
		var saves = savesObjGet();
		saves.autosave = null;
		return _savesObjSave(saves);
	}


	/*******************************************************************************************************************
	 * Slots
	 ******************************************************************************************************************/
	function slotsOK() {
		return _slotsUBound !== -1;
	}

	function slotsLength() {
		return _slotsUBound + 1;
	}

	function slotsCount() {
		if (!slotsOK()) {
			return 0;
		}

		var	saves = savesObjGet(),
			count = 0;
		for (var i = 0; i < saves.slots.length; i++) {
			if (saves.slots[i] !== null) {
				count++;
			}
		}
		return count;
	}

	function slotsIsEmpty() {
		return slotsCount() === 0;
	}

	function slotsHas(slot) {
		if (slot < 0 || slot > _slotsUBound) {
			return false;
		}

		var saves = savesObjGet();
		if (slot >= saves.slots.length || saves.slots[slot] === null) {
			return false;
		}
		return true;
	}

	function slotsGet(slot) {
		if (slot < 0 || slot > _slotsUBound) {
			return null;
		}

		var saves = savesObjGet();
		if (slot >= saves.slots.length) {
			return null;
		}
		return saves.slots[slot];
	}

	function slotsLoad(slot) {
		if (slot < 0 || slot > _slotsUBound) {
			return false;
		}

		var saves = savesObjGet();
		if (slot >= saves.slots.length || saves.slots[slot] === null) {
			return false;
		}
		return _unmarshal(saves.slots[slot]);
	}

	function slotsSave(slot, title, metadata) {
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			UI.alert(strings.saves.disallowed);
			return false;
		}
		if (slot < 0 || slot > _slotsUBound) {
			return false;
		}

		var saves = savesObjGet();
		if (slot >= saves.slots.length) {
			return false;
		}
		saves.slots[slot] = _marshal();
		saves.slots[slot].title = title || tale.get(state.active.title).description();
		saves.slots[slot].date = Date.now();
		if (metadata != null) { // lazy equality for null
			saves.slots[slot].metadata = metadata;
		}
		return _savesObjSave(saves);
	}

	function slotsDelete(slot) {
		if (slot < 0 || slot > _slotsUBound) {
			return false;
		}

		var saves = savesObjGet();
		if (slot >= saves.slots.length) {
			return false;
		}
		saves.slots[slot] = null;
		return _savesObjSave(saves);
	}


	/*******************************************************************************************************************
	 * Disk
	 ******************************************************************************************************************/
	function exportSave() {
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			UI.alert(strings.saves.disallowed);
			return;
		}

		var	saveName = tale.domId + ".save",
			saveObj  = LZString.compressToBase64(JSON.stringify(_marshal()));
		saveAs(new Blob([saveObj], { type : "text/plain;charset=UTF-8" }), saveName);
	}

	function importSave(event) {
		var	file   = event.target.files[0],
			reader = new FileReader();

		// add the handler that will capture the file information once the load is finished
		jQuery(reader).on("load", function (evt) {
			if (!evt.target.result) {
				return;
			}

			var saveObj;
			try {
				saveObj = JSON.parse(
					/\.json$/i.test(file.name) || /^\{/.test(evt.target.result)
						? evt.target.result
						: LZString.decompressFromBase64(evt.target.result)
				);
			} catch (e) { /* no-op, _unmarshal() will handle the error */ }
			_unmarshal(saveObj);
		});

		// initiate the file load
		reader.readAsText(file);
	}


	/*******************************************************************************************************************
	 * Private
	 ******************************************************************************************************************/
	function _appendSlots(array, num) {
		for (var i = 0; i < num; i++) {
			array.push(null);
		}
		return array;
	}

	function _savesObjSave(saves) {
		//return storage.set("saves", saves);
		var	isSlotsEmpty = true;
		for (var i = 0; i < saves.slots.length; i++) {
			if (saves.slots[i] !== null) {
				isSlotsEmpty = false;
				break;
			}
		}
		if (saves.autosave === null && isSlotsEmpty) {
			storage.delete("saves");
			return true;
		}
		return storage.set("saves", saves);
	}

	function _marshal() {
		var saveObj = {
			id    : config.saves.id,
			state : History.marshalToSave()
		};
		if (config.saves.version) {
			saveObj.version = config.saves.version;
		}

		if (typeof config.saves.onSave === "function") {
			config.saves.onSave(saveObj);
		}

		// delta encode the state history
		saveObj.state.delta = History.deltaEncodeHistory(saveObj.state.history);
		delete saveObj.state.history;

		return saveObj;
	}

	function _unmarshal(saveObj) {
		if (DEBUG) { console.log("[Save/_unmarshal()]"); }

		try {
			if (!saveObj || !saveObj.hasOwnProperty("id") || !saveObj.hasOwnProperty("state")) {
				throw new Error("save is missing required data."
					+ " Either you've loaded a file which is not a save or the save has become corrupted");
			}

			// delta decode the state history
			saveObj.state.history = History.deltaDecodeHistory(saveObj.state.delta);
			delete saveObj.state.delta;

			if (typeof config.saves.onLoad === "function") {
				config.saves.onLoad(saveObj);
			}

			if (saveObj.id !== config.saves.id) {
				throw new Error("save is from the wrong " + strings.identity);
			}

			// restore the state
			History.unmarshalFromSave(saveObj.state); // may also throw exceptions
		} catch (e) {
			UI.alert(e.message[0].toUpperCase() + e.message.slice(1) + ".</p><p>" + strings.aborting + ".");
			return false;
		}

		return true;
	}


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		// Initialization
		init     : { value : init },
		// Save Object
		get      : { value : savesObjGet },
		clear    : { value : savesObjClear },
		// General
		ok       : { value : ok },
		// Disk
		export   : { value : exportSave },
		import   : { value : importSave },
		// Autosave
		autosave : {
			value : Object.freeze(Object.defineProperties({}, {
				ok     : { value : autosaveOK },
				has    : { value : autosaveHas },
				get    : { value : autosaveGet },
				load   : { value : autosaveLoad },
				save   : { value : autosaveSave },
				delete : { value : autosaveDelete }
			}))
		},
		// Slots
		slots : {
			value : Object.freeze(Object.defineProperties({}, {
				ok      : { value : slotsOK },
				length  : { value : slotsLength },
				isEmpty : { value : slotsIsEmpty },
				count   : { value : slotsCount },
				has     : { value : slotsHas },
				get     : { value : slotsGet },
				load    : { value : slotsLoad },
				save    : { value : slotsSave },
				delete  : { value : slotsDelete }
			}))
		}
	}));

}());

