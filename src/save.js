/***********************************************************************************************************************
 *
 * save.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global State, Story, UI, Util, config, escape, saveAs, storage, strings */

var Save = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	var
		/*
			Core properties.
		*/
		_slotsUBound = -1;


	/*******************************************************************************************************************
	 * Saves Functions
	 ******************************************************************************************************************/
	function savesInit() {
		if (DEBUG) { console.log("[Save/savesInit()]"); }

		// Disable save slots and the autosave when Web Storage is unavailable.
		if (storage.name === "cookie") {
			savesObjClear();
			config.saves.autosave = undefined;
			config.saves.slots = 0;
			return false;
		}

		if (config.saves.slots < 0) {
			config.saves.slots = 0;
		}

		// Get the saves object.
		var	saves   = savesObjGet(),
			updated = false;

		/* legacy */
		// Convert an ancient saves array into a new saves object.
		if (Array.isArray(saves)) {
			saves = {
				autosave : null,
				slots    : saves
			};
			updated = true;
		}
		/* /legacy */

		// Handle the author changing the number of save slots.
		if (config.saves.slots !== saves.slots.length) {
			if (config.saves.slots < saves.slots.length) {
				// Attempt to decrease the number of slots; this will only compact
				// the slots array, by removing empty slots, no saves will be deleted.
				saves.slots.reverse();
				saves.slots = saves.slots.filter(function (val) {
					if (val === null && this.count > 0) {
						--this.count;
						return false;
					}
					return true;
				}, { count : saves.slots.length - config.saves.slots });
				saves.slots.reverse();
			} else if (config.saves.slots > saves.slots.length) {
				// Attempt to increase the number of slots.
				_appendSlots(saves.slots, config.saves.slots - saves.slots.length);
			}
			updated = true;
		}

		/* legacy */
		// Convert old-style saves.
		var convertOldSave = function (saveObj) {
			if (saveObj.hasOwnProperty("data")) {
				delete saveObj.mode;
				saveObj.state = {
					delta : State.deltaEncode(saveObj.data)
				};
				delete saveObj.data;
			} else if (!saveObj.state.hasOwnProperty("delta")) {
				delete saveObj.state.mode;
				saveObj.state.delta = State.deltaEncode(saveObj.state.history);
				delete saveObj.state.history;
			} else if (!saveObj.state.hasOwnProperty("index")) {
				delete saveObj.state.mode;
			}
			saveObj.state.index = saveObj.state.delta.length - 1;
			if (saveObj.state.hasOwnProperty("rseed")) {
				saveObj.state.seed = saveObj.state.rseed;
				delete saveObj.state.rseed;
				saveObj.state.delta.forEach(function (v, i, delta) { // eslint-disable-line no-shadow
					if (delta[i].hasOwnProperty("rcount")) {
						delta[i].pull = delta[i].rcount;
						delete delta[i].rcount;
					}				
				});
			}
		};
		if (saves.autosave !== null) {
			if (
				   !saves.autosave.hasOwnProperty("state")
				|| !saves.autosave.state.hasOwnProperty("delta")
				|| !saves.autosave.state.hasOwnProperty("index")
				||  saves.autosave.state.hasOwnProperty("rseed")
			) {
				convertOldSave(saves.autosave);
				updated = true;
			}
		}
		for (var i = 0; i < saves.slots.length; ++i) {
			if (saves.slots[i] !== null) {
				if (
					   !saves.slots[i].hasOwnProperty("state")
					|| !saves.slots[i].state.hasOwnProperty("delta")
					|| !saves.slots[i].state.hasOwnProperty("index")
					||  saves.slots[i].state.hasOwnProperty("rseed")
				) {
					convertOldSave(saves.slots[i]);
					updated = true;
				}
			}
		}
		/* /legacy */

		/* legacy */
		// Remove save stores which are empty.
		if (_savesObjIsEmpty(saves)) {
			storage.delete("saves");
			updated = false;
		}
		/* /legacy */

		// If the saves object was updated, then update the store.
		if (updated) {
			_savesObjSave(saves);
		}

		_slotsUBound = saves.slots.length - 1;

		return true;
	}

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

	function savesOK() {
		return autosaveOK() || slotsOK();
	}


	/*******************************************************************************************************************
	 * Autosave Functions
	 ******************************************************************************************************************/
	function autosaveOK() {
		return storage.name !== "cookie" && typeof config.saves.autosave !== "undefined";
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
		saves.autosave.title = title || Story.get(State.passage).description();
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
	 * Slots Functions
	 ******************************************************************************************************************/
	function slotsOK() {
		return storage.name !== "cookie" && _slotsUBound !== -1;
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
		for (var i = 0; i < saves.slots.length; ++i) {
			if (saves.slots[i] !== null) {
				++count;
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
		saves.slots[slot].title = title || Story.get(State.passage).description();
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
	 * Disk Functions
	 ******************************************************************************************************************/
	function exportSave(filename) {
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			UI.alert(strings.saves.disallowed);
			return;
		}

		var	saveName = (filename == null ? Story.domId : Util.slugify(filename)) + ".save", // lazy equality for null
			saveObj  = LZString.compressToBase64(JSON.stringify(_marshal()));
		saveAs(new Blob([saveObj], { type : "text/plain;charset=UTF-8" }), saveName);
	}

	function importSave(event) {
		var	file   = event.target.files[0],
			reader = new FileReader();

		// Add the handler that will capture the file information once the load is finished.
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
			} catch (e) { /* no-op; `_unmarshal()` will handle the error */ }
			_unmarshal(saveObj);
		});

		// Initiate the file load.
		reader.readAsText(file);
	}


	/*******************************************************************************************************************
	 * Utility Functions
	 ******************************************************************************************************************/
	function _appendSlots(array, num) {
		for (var i = 0; i < num; ++i) {
			array.push(null);
		}
		return array;
	}

	function _savesObjIsEmpty(saves) {
		var	isSlotsEmpty = true;
		for (var i = 0; i < saves.slots.length; ++i) {
			if (saves.slots[i] !== null) {
				isSlotsEmpty = false;
				break;
			}
		}
		return saves.autosave === null && isSlotsEmpty;
	}

	function _savesObjSave(saves) {
		if (_savesObjIsEmpty(saves)) {
			storage.delete("saves");
			return true;
		}
		return storage.set("saves", saves);
	}

	function _marshal() {
		if (DEBUG) { console.log("[Save/_marshal()]"); }

		var saveObj = {
			id    : config.saves.id,
			state : State.marshalForSave()
		};
		if (config.saves.version) {
			saveObj.version = config.saves.version;
		}

		if (typeof config.saves.onSave === "function") {
			config.saves.onSave(saveObj);
		}

		// Delta encode the state history.
		saveObj.state.delta = State.deltaEncode(saveObj.state.history);
		delete saveObj.state.history;

		return saveObj;
	}

	function _unmarshal(saveObj) {
		if (DEBUG) { console.log("[Save/_unmarshal()]"); }

		try {
			if (!saveObj || !saveObj.hasOwnProperty("id") || !saveObj.hasOwnProperty("state")) {
				throw new Error(strings.errors.saveMissingData);
			}

			/* legacy */
			delete saveObj.state.mode;
			if (!saveObj.state.hasOwnProperty("index")) {
				saveObj.state.index = saveObj.state.delta.length - 1;
			}
			if (saveObj.state.hasOwnProperty("rseed")) {
				saveObj.state.seed = saveObj.state.rseed;
				delete saveObj.state.rseed;
				saveObj.state.delta.forEach(function (v, i, delta) {
					if (delta[i].hasOwnProperty("rcount")) {
						delta[i].pull = delta[i].rcount;
						delete delta[i].rcount;
					}				
				});
			}
			/* /legacy */

			// Delta decode the state history.
			saveObj.state.history = State.deltaDecode(saveObj.state.delta);
			delete saveObj.state.delta;

			if (typeof config.saves.onLoad === "function") {
				config.saves.onLoad(saveObj);
			}

			if (saveObj.id !== config.saves.id) {
				throw new Error(strings.errors.saveIdMismatch.replace(/%identity%/g, strings.identity));
			}

			// Restore the state.
			State.unmarshalForSave(saveObj.state); // may also throw exceptions
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
		/*
			Save Functions.
		*/
		init  : { value : savesInit },
		get   : { value : savesObjGet },
		clear : { value : savesObjClear },
		ok    : { value : savesOK },

		/*
			Autosave  Functions.
		*/
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

		/*
			Slots  Functions.
		*/
		slots : {
			value : Object.freeze(Object.defineProperties({}, {
				ok      : { value : slotsOK },
				length  : { get : slotsLength },
				isEmpty : { value : slotsIsEmpty },
				count   : { value : slotsCount },
				has     : { value : slotsHas },
				get     : { value : slotsGet },
				load    : { value : slotsLoad },
				save    : { value : slotsSave },
				delete  : { value : slotsDelete }
			}))
		},

		/*
			Disk Functions.
		*/
		export : { value : exportSave },
		import : { value : importSave }
	}));

})();

