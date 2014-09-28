/***********************************************************************************************************************
** [Begin savesystem.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [SaveSystem API]
***********************************************************************************************************************/
var SaveSystem = Object.defineProperties({}, {
	// data members
	_bad : {
		writable : true,
		value    : false
	},
	_max : {
		writable : true,
		value    : -1
	},

	// static methods
	init : {
		value : function () {
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

			if (config.saves.slots < 0) {
				config.saves.slots = 0;
			}
			if (storage.store === null) {
				return false;
			}

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
		}
	},

	length : {
		value : function () {
			return SaveSystem._max + 1;
		}
	},

	OK : {
		value : function () {
			return SaveSystem.autosaveOK() || SaveSystem.slotsOK();
		}
	},

	autosaveOK : {
		value : function () {
			return !SaveSystem._bad && typeof config.saves.autosave !== "undefined";
		}
	},

	slotsOK : {
		value : function () {
			return !SaveSystem._bad && SaveSystem._max !== -1;
		}
	},

	hasAuto : {
		value : function () {
			var saves = storage.getItem("saves");
			if (saves === null || saves.autosave === null) {
				return false;
			}
			return true;
		}
	},

	getAuto : {
		value : function () {
			var saves = storage.getItem("saves");
			if (saves === null) {
				return null;
			}
			return saves.autosave;
		}
	},

	loadAuto : {
		value : function () {
			var saves = storage.getItem("saves");
			if (saves === null || saves.autosave === null) {
				return false;
			}
			return SaveSystem.unmarshal(saves.autosave);
		}
	},

	saveAuto : {
		value : function (title, metadata) {
			if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
				return false;
			}

			var saves = storage.getItem("saves");
			if (saves === null) {
				return false;
			}
			saves.autosave = SaveSystem.marshal();
			saves.autosave.title = title || tale.get(state.active.title).excerpt();
			saves.autosave.date = Date.now();
			if (metadata != null) { // use lazy equality
				saves.autosave.metadata = metadata;
			}
			return storage.setItem("saves", saves);
		}
	},

	deleteAuto : {
		value : function () {
			var saves = storage.getItem("saves");
			if (saves === null) {
				return false;
			}
			saves.autosave = null;
			return storage.setItem("saves", saves);
		}
	},

	isEmpty : {
		value : function () {
			return SaveSystem.count() === 0;
		}
	},

	count : {
		value : function () {
			if (!SaveSystem.slotsOK()) {
				return 0;
			}

			var saves = storage.getItem("saves");
			if (saves === null) {
				return 0;
			}
			var count = 0;
			for (var i = 0; i < saves.slots.length; i++) {
				if (saves.slots[i] !== null) {
					count++;
				}
			}
			return count;
		}
	},

	has : {
		value : function (slot) {
			if (slot < 0 || slot > SaveSystem._max) {
				return false;
			}

			var saves = storage.getItem("saves");
			if (saves === null || slot > saves.slots.length || saves.slots[slot] === null) {
				return false;
			}
			return true;
		}
	},

	get : {
		value : function (slot) {
			if (slot < 0 || slot > SaveSystem._max) {
				return null;
			}

			var saves = storage.getItem("saves");
			if (saves === null || slot > saves.slots.length) {
				return null;
			}
			return saves.slots[slot];
		}
	},

	load : {
		value : function (slot) {
			if (slot < 0 || slot > SaveSystem._max) {
				return false;
			}

			var saves = storage.getItem("saves");
			if (saves === null || slot > saves.slots.length || saves.slots[slot] === null) {
				return false;
			}
			return SaveSystem.unmarshal(saves.slots[slot]);
		}
	},

	save : {
		value : function (slot, title, metadata) {
			if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
				UISystem.alert(config.errors.savesNotAllowed);
				return false;
			}
			if (slot < 0 || slot > SaveSystem._max) {
				return false;
			}

			var saves = storage.getItem("saves");
			if (saves === null || slot > saves.slots.length) {
				return false;
			}
			saves.slots[slot] = SaveSystem.marshal();
			saves.slots[slot].title = title || tale.get(state.active.title).excerpt();
			saves.slots[slot].date = Date.now();
			if (metadata != null) { // use lazy equality
				saves.slots[slot].metadata = metadata;
			}
			return storage.setItem("saves", saves);
		}
	},

	delete : {
		value : function (slot) {
			if (slot < 0 || slot > SaveSystem._max) {
				return false;
			}

			var saves = storage.getItem("saves");
			if (saves === null || slot > saves.slots.length) {
				return false;
			}
			saves.slots[slot] = null;
			return storage.setItem("saves", saves);
		}
	},

	purge : {
		value : function () {
			storage.removeItem("saves");
			return SaveSystem.init();
		}
	},

	exportSave : {
		value : function () {
			if (DEBUG) { console.log("[SaveSystem.exportSave()]"); }

			if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed()) {
				UISystem.alert(config.errors.savesNotAllowed);
				return;
			}

			var saveName = tale.domId + ".save",
				saveObj  = LZString.compressToBase64(JSON.stringify(SaveSystem.marshal()));

			saveAs(new Blob([saveObj], { type : "text/plain;charset=UTF-8" }), saveName);
		}
	},

	importSave : {
		value : function (event) {
			if (DEBUG) { console.log("[SaveSystem.importSave()]"); }

			var file   = event.target.files[0],
				reader = new FileReader();

			// capture the file information once the load is finished
			$(reader).load(function(file) {
				return function(evt) {
					if (DEBUG) { console.log('    > loaded: ' + escape(file.name) + '; payload: ' + evt.target.result); }

					if (!evt.target.result) {
						return;
					}

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
		}
	},

	marshal : {
		value : function () {
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
		}
	},

	unmarshal : {
		value : function (saveObj) {
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
	}
});


/***********************************************************************************************************************
** [End savesystem.js]
***********************************************************************************************************************/
