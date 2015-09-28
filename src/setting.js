/***********************************************************************************************************************
 *
 * setting.js
 *
 * Copyright © 2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global settings:true, storage */

var Setting = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	var
		/*
			Core properties.
		*/
		_definitions = [],

		/*
			Setup the Types enumeration (not really, but close enough).
		*/
		Types = Object.freeze({
			Toggle : 0,
			List   : 1
		});


	/*******************************************************************************************************************
	 * Settings Functions
	 ******************************************************************************************************************/
	function settingsInit() {
		/* legacy */
		// attempt to migrate an existing `options` store to `settings`
		if (storage.has("options")) {
			var old = storage.get("options");
			if (old !== null) {
				window.SugarCube.settings = settings = Object.assign(settingsCreate(), old);
			}
			settingsSave();
			storage.delete("options");
		}
		/* /legacy */

		// load existing settings
		settingsLoad();

		// execute onInit callbacks
		_definitions.forEach(function (definition) {
			if (definition.hasOwnProperty("onInit")) {
				var	thisp = {
						name    : definition.name,
						value   : settings[definition.name],
						default : definition.default
					};
				if (definition.hasOwnProperty("list")) {
					thisp.list = definition.list;
				}
				definition.onInit.call(thisp);
			}
		});
	}

	function _settingsAllAtDefault() {
		if (Object.keys(settings).length > 0) {
			return !_definitions.some(function (definition) {
				return settings[definition.name] !== definition.default;
			});
		}
		return true;
	}

	function settingsCreate() {
		return Object.create(null);
	}

	function settingsSave() {
		if (Object.keys(settings).length === 0 || _settingsAllAtDefault()) {
			storage.delete("settings");
			return true;
		}
		return storage.set("settings", settings);
	}

	function settingsLoad() {
		var loadedSettings = settingsCreate(),
			fromStorage    = storage.get("settings");

		// load the defaults
		_definitions.forEach(function (definition) {
			settings[definition.name] = definition.default;
		});

		// load from storage
		if (fromStorage !== null) {
			window.SugarCube.settings = settings = Object.assign(loadedSettings, fromStorage);
		}
	}

	function settingsClear() {
		window.SugarCube.settings = settings = settingsCreate();
		return settingsSave();
	}

	function settingsReset(name) {
		if (arguments.length === 0) {
			settingsClear();
			_definitions.forEach(function (definition) {
				settings[definition.name] = definition.default;
			});
		} else {
			if (name == null || !definitionsHas(name)) { // lazy equality for null
				throw new Error('nonexistent setting "' + name + '"');
			}
			settings[name] = definitionsGet(name).default;
		}
		return settingsSave();
	}


	/*******************************************************************************************************************
	 * Definitions Functions
	 ******************************************************************************************************************/
	function definitionsForEach(callback, thisp) {
		_definitions.forEach(callback, thisp);
	}

	function definitionsAdd(type, name, def) {
		if (arguments.length < 3) {
			var errors = [];
			if (arguments.length < 1) { errors.push("type"); }
			if (arguments.length < 2) { errors.push("name"); }
			if (arguments.length < 3) { errors.push("definition"); }
			throw new Error("missing parameters, no " + errors.join(" or ") + " specified");
		}
		if (typeof def !== "object") {
			throw new TypeError("definition parameter must be an object");
		}
		if (definitionsHas(name)) {
			throw new Error('cannot clobber existing setting "' + name + '"');
		}
		/*
			definition objects = {
				type     : (both:Setting.Types),
				name     : (both:string),
				label    : (both:string),
				default  : (toggle:boolean, list:[as array]), // if undefined (toggle:false, list:list[0])
				list     : (list:array),
				onInit   : (both:function),
				onChange : (both:function)
			}
		*/
		var definition = {
			type  : type,
			name  : name,
			label : def.label == null ? "" : String(def.label).trim() // lazy equality for null
		};
		switch (type) {
		case Types.Toggle:
			definition.default = !!def.default;
			break;
		case Types.List:
			if (!def.hasOwnProperty("list")) {
				throw new Error("no list specified");
			} else if (!Array.isArray(def.list)) {
				throw new TypeError("list must be an array");
			} else if (def.list.length === 0) {
				throw new Error("list must not be empty");
			}
			definition.list = Object.freeze(def.list);
			if (def.default == null) { // lazy equality for null
				definition.default = def.list[0];
			} else {
				var defaultIndex = def.list.indexOf(def.default);
				if (defaultIndex === -1) {
					throw new Error("list does not contain default");
				}
				definition.default = def.list[defaultIndex];
			}
			break;
		default:
			throw new Error("unknown Setting type: " + type);
		}
		if (typeof def.onInit === "function") {
			definition.onInit = Object.freeze(def.onInit);
		}
		if (typeof def.onChange === "function") {
			definition.onChange = Object.freeze(def.onChange);
		}
		_definitions.push(Object.freeze(definition));
	}

	function definitionsAddToggle(/* name, def */) {
		definitionsAdd.apply(this, [Types.Toggle].concat(Array.from(arguments)));
	}

	function definitionsAddList(/* name, def */) {
		definitionsAdd.apply(this, [Types.List].concat(Array.from(arguments)));
	}

	function definitionsIsEmpty() {
		return _definitions.length === 0;
	}

	function definitionsHas(name) {
		return _definitions.some(function (definition) {
			return definition.name === this;
		}, name);
	}

	function definitionsGet(name) {
		return _definitions.find(function (definition) {
			return definition.name === this;
		}, name);
	}

	function definitionsDelete(name) {
		if (definitionsHas(name)) {
			delete settings[name];
		}
		for (var i = 0; i < _definitions.length; ++i) {
			if (_definitions[i].name === name) {
				_definitions.splice(i, 1);
				definitionsDelete(name);
				break;
			}
		}
	}


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Enumerations.
		*/
		Types : { value : Types },

		/*
			Settings Functions.
		*/
		init   : { value : settingsInit },
		create : { value : settingsCreate },
		save   : { value : settingsSave },
		load   : { value : settingsLoad },
		clear  : { value : settingsClear },
		reset  : { value : settingsReset },

		/*
			Definitions Functions.
		*/
		forEach   : { value : definitionsForEach },
		add       : { value : definitionsAdd },
		addToggle : { value : definitionsAddToggle },
		addList   : { value : definitionsAddList },
		isEmpty   : { value : definitionsIsEmpty },
		has       : { value : definitionsHas },
		get       : { value : definitionsGet },
		delete    : { value : definitionsDelete }
	}));

})();

