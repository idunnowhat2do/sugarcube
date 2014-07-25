/***********************************************************************************************************************
** [Begin savesystem.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [SaveSystem API]
***********************************************************************************************************************/
var SaveSystem = {
	_bad : false,
	_max : -1,
	init : function () {
		function appendSlots(array, num) {
			for (var i = 0; i < num; i++) {
				array.push(null);
			}
			return array;
		}
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

		if (DEBUG) { console.log("[SaveSystem.init()]"); }

		if (config.saves.slots < 0) { config.saves.slots = 0; }
		if (storage.store === null) { return false; }

		// create and store the saves object, if it doesn't exist
		if (!storage.hasItem("saves")) {
			storage.setItem("saves", {
				autosave : null,
				slots    : appendSlots([], config.saves.slots)
			});
		}

		// retrieve the saves object
		var saves = storage.getItem("saves");
		if (saves === null) {
			SaveSystem._bad = true;
			return false;
		}

		/* legacy kludges */
		// convert an old saves array into a new saves object
		if (Array.isArray(saves)) {
			saves = {
				autosave : null,
				slots    : saves
			};
			storage.setItem("saves", saves);
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
				appendSlots(saves.slots, config.saves.slots - saves.slots.length);
			}
			storage.setItem("saves", saves);
		}

		/* legacy kludges */
		// convert old-style saves
		var needSave = false;
		if (saves.autosave !== null) {
			if (!saves.autosave.hasOwnProperty("state") || !saves.autosave.state.hasOwnProperty("delta")) {
				convertOldSave(saves.autosave);
				needSave = true;
			}
		}
		for (var i = 0; i < saves.slots.length; i++) {
			if (saves.slots[i] !== null) {
				if (!saves.slots[i].hasOwnProperty("state") || !saves.slots[i].state.hasOwnProperty("delta")) {
					convertOldSave(saves.slots[i]);
					needSave = true;
				}
			}
		}
		if (needSave) { storage.setItem("saves", saves); }
		/* /legacy kludges */

		SaveSystem._max = saves.slots.length - 1;

		return true;
	},
	length : function () {
		return SaveSystem._max + 1;
	},
	OK : function () {
		return SaveSystem.autosaveOK() || SaveSystem.slotsOK();
	},
	autosaveOK : function () {
		return !SaveSystem._bad && typeof config.saves.autosave !== "undefined";
	},
	slotsOK : function () {
		return !SaveSystem._bad && SaveSystem._max !== -1;
	},
	hasAuto : function () {
		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (saves.autosave === null) { return false; }

		return true;
	},
	getAuto : function () {
		var saves = storage.getItem("saves");
		if (saves === null) { return null; }

		return saves.autosave;
	},
	loadAuto : function () {
		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (saves.autosave === null) { return false; }

		return SaveSystem.unmarshal(saves.autosave);
	},
	saveAuto : function (title, metadata) {
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			return false;
		}

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }

		saves.autosave = SaveSystem.marshal();
		saves.autosave.title = title || tale.get(state.active.title).excerpt();
		saves.autosave.date = Date.now();
		if (metadata != null) { saves.autosave.metadata = metadata; }  // use lazy equality

		return storage.setItem("saves", saves);
	},
	deleteAuto : function () {
		var saves = storage.getItem("saves");
		if (saves === null) { return false; }

		saves.autosave = null;

		return storage.setItem("saves", saves);
	},
	isEmpty : function () {
		return SaveSystem.count() === 0;
	},
	count : function () {
		if (!SaveSystem.slotsOK()) { return 0; }

		var saves = storage.getItem("saves");
		if (saves === null) { return 0; }

		var count = 0;
		for (var i = 0; i < saves.slots.length; i++) { if (saves.slots[i] !== null) { count++; } }

		return count;
	},
	has : function (slot) {
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }
		if (saves.slots[slot] === null) { return false; }

		return true;
	},
	get : function (slot) {
		if (slot < 0 || slot > SaveSystem._max) { return null; }

		var saves = storage.getItem("saves");
		if (saves === null) { return null; }
		if (slot > saves.slots.length) { return null; }

		return saves.slots[slot];
	},
	load : function (slot) {
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }
		if (saves.slots[slot] === null) { return false; }

		return SaveSystem.unmarshal(saves.slots[slot]);
	},
	save : function (slot, title, metadata) {
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			UISystem.alert(config.errors.savesNotAllowed);
			return false;
		}
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }

		saves.slots[slot] = SaveSystem.marshal();
		saves.slots[slot].title = title || tale.get(state.active.title).excerpt();
		saves.slots[slot].date = Date.now();
		if (metadata != null) { saves.slots[slot].metadata = metadata; }  // use lazy equality

		return storage.setItem("saves", saves);
	},
	delete : function (slot) {
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }

		saves.slots[slot] = null;

		return storage.setItem("saves", saves);
	},
	purge : function () {
		storage.removeItem("saves");
		return SaveSystem.init();
	},
	exportSave : function () {
		if (DEBUG) { console.log("[SaveSystem.exportSave()]"); }

		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
			UISystem.alert(config.errors.savesNotAllowed);
			return;
		}

		var saveName = tale.domId + ".save",
			saveObj  = LZString.compressToBase64(JSON.stringify(SaveSystem.marshal()));

		saveAs(new Blob([saveObj], { type : "text/plain;charset=UTF-8" }), saveName);
	},
	importSave : function (event) {
		if (DEBUG) { console.log("[SaveSystem.importSave()]"); }

		var file   = event.target.files[0],
			reader = new FileReader();

		// capture the file information once the load is finished
		$(reader).load(function(file) {
			return function(evt) {
				if (DEBUG) { console.log('    > loaded: ' + escape(file.name) + '; payload: ' + evt.target.result); }

				if (!evt.target.result) { return; }

				var saveObj;
				try {
					saveObj = JSON.parse((/\.json$/i.test(file.name) || /^\{/.test(evt.target.result))
						? evt.target.result
						: LZString.decompressFromBase64(evt.target.result));
				} catch (e) { /* noop, the unmarshal() method will handle the error */ }
				SaveSystem.unmarshal(saveObj);
			};
		}(file));

		// initiate the file load
		reader.readAsText(file);
	},
	marshal : function () {
		if (DEBUG) { console.log("[SaveSystem.marshal()]"); }

		var saveObj = {
			id    : config.saves.id,
			state : History.marshal()
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
	},
	unmarshal : function (saveObj) {
		if (DEBUG) { console.log("[SaveSystem.unmarshal()]"); }

		try {
			if (!saveObj || !saveObj.hasOwnProperty("id") || !saveObj.hasOwnProperty("state")) {
				if (!saveObj || !saveObj.hasOwnProperty("mode") || !saveObj.hasOwnProperty("id") || !saveObj.hasOwnProperty("data")) {
					throw new Error("save is missing required data.  Either you've loaded a file which isn't a save, or the save has become corrupted");
				} else {
					throw new Error("old-style saves seen in SaveSystem.unmarshal()");
				}
			}

			// delta decode the state history
			saveObj.state.history = History.deltaDecodeHistory(saveObj.state.delta);
			delete saveObj.state.delta;

			if (typeof config.saves.onLoad === "function") {
				config.saves.onLoad(saveObj);
			}

			if (saveObj.id !== config.saves.id) {
				throw new Error("save is from the wrong " + config.errorName);
			}

			// restore the state
			History.unmarshal(saveObj.state);
		} catch (e) {
			UISystem.alert(e.message[0].toUpperCase() + e.message.slice(1) + ".\n\nAborting load.");
			return false;
		}

		return true;
	}
};


/***********************************************************************************************************************
** [End savesystem.js]
***********************************************************************************************************************/
