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
		_controls = [],

		// Setup the Setting Types enumeration
		Types     = Object.freeze({
			Toggle : 0,
			List   : 1
		});


	/*******************************************************************************************************************
	 * Initialization
	 ******************************************************************************************************************/
	function init() {
		/* legacy */
		// attempt to migrate an existing `options` store to `settings`
		if (storage.hasItem("options")) {
			var old = storage.getItem("options");
			if (old !== null) {
				/*
				window.SugarCube.settings = settings = {};
				Object.keys(old).forEach(function (name) {
					settings[name] = old[name];
				});
				*/
				window.SugarCube.settings = settings = Object.assign(settingsCreate(), old);
			}
			settingsSave();
			storage.removeItem("options");
		}
		/* /legacy */

		settingsLoad();
	}


	/*******************************************************************************************************************
	 * Controls Manipulation Functions
	 ******************************************************************************************************************/
	function controlsList() {
		return _controls;
	}

	function controlsAdd(type, name, definition) {
		/*
			definition = {
				label    : (both:string),
				default  : (toggle:boolean) | (list:string/number), // system defaults: false or list[0],
				list     : (list:array),
				callback : (both:function)
			}
		 */
		if (arguments.length < 3) {
			var errors = [];
			if (arguments.length < 1) { errors.push("type"); }
			if (arguments.length < 2) { errors.push("name"); }
			if (arguments.length < 3) { errors.push("definition"); }
			throw new Error("missing parameters, no " + errors.join(" or ") + " specified");
		}
		if (typeof definition !== "object") {
			throw new Error("definition parameter must be an object");
		}
		if (controlsHas(name)) {
			throw new Error('cannot clobber existing setting "' + name + '"');
		}
		var control = {
			name  : name,
			type  : type,
			label : definition.label == null ? "" : String(definition.label).trim() // lazy equality for null
		};
		switch (type) {
		case Types.Toggle:
			control.default = !!definition.default;
			break;
		case Types.List:
			if (!definition.hasOwnProperty("list")) {
				throw new Error("no list specified");
			} else if (!Array.isArray(definition.list)) {
				throw new Error("list must be an array");
			} else if (definition.list.length === 0) {
				throw new Error("list must not be empty");
			}
			control.list = definition.list;
			if (definition.default == null) { // lazy equality for null
				control.default = definition.list[0];
			} else {
				var defaultIndex = definition.list.indexOf(definition.default);
				if (defaultIndex === -1) {
					throw new Error("list does not contain default");
				}
				control.default = definition.list[defaultIndex];
			}
			break;
		default:
			throw new Error("unknown Setting type: " + type);
		}
		if (typeof definition.callback === "function") {
			control.callback = definition.callback;
		}
		_controls.push(control);
	}

	function controlsAddToggle(name, label, defaultValue, callback) {
		controlsAdd(Types.Toggle, name, {
			label    : label,
			default  : !!defaultValue,
			callback : callback
		});
	}

	function controlsAddList(name, label, list, defaultValue, callback) {
		controlsAdd(Types.List, name, {
			label    : label,
			list     : list,
			default  : defaultValue,
			callback : callback
		});
	}

	function controlsIsEmpty() {
		return _controls.length === 0;
	}

	function controlsHas(name) {
		return _controls.some(function (control) {
			return control.name === this;
		}, name);
	}

	function controlsDelete(name) {
		for (var i = 0; i < _controls.length; i++) {
			if (_controls[i].name === name) {
				_controls.splice(i, 1);
				settingsDelete(name);
				break;
			}
		}
	}


	/*******************************************************************************************************************
	 * `settings` Object Manipulation Functions
	 ******************************************************************************************************************/
	function settingsCreate() {
		return Object.create(null);
	}

	function settingsSave() {
		return storage.setItem("settings", settings);
	}

	function settingsLoad() {
		var obj = storage.getItem("settings");
		if (obj !== null) {
			/*
			window.SugarCube.settings = settings = settingsCreate();
			Object.keys(obj).forEach(function (name) {
				settings[name] = obj[name];
			});
			*/
			window.SugarCube.settings = settings = Object.assign(settingsCreate(), obj);
		}
	}

	function settingsClear() {
		if (!storage.removeItem("settings")) {
			throw new Error("unknown error, cannot update settings store");
		}
		window.SugarCube.settings = settings = settingsCreate();
	}

	function settingsReset() {
		settingsClear();
		_controls.forEach(function (control) {
			settings[control.name] = control.default;
		});
	}

	function settingsHas(name) {
		return settings.hasOwnProperty(name);
	}

	function settingsGet(name) {
		return settings[name];
	}

	function settingsSet(name, value) {
		settings[name] = value;
	}

	function settingsDelete(name) {
		if (settingsHas(name)) {
			delete settings[name];
		}
	}


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		// Enumeration
		Types    : { value : Types },
		// Initialization
		init     : { value : init },
		// Controls Manipulation Functions
		controls : {
			value : Object.freeze(Object.defineProperties({}, {
				list      : { value : controlsList },
				add       : { value : controlsAdd },
				addToggle : { value : controlsAddToggle },
				addList   : { value : controlsAddList },
				isEmpty   : { value : controlsIsEmpty },
				has       : { value : controlsHas },
				delete    : { value : controlsDelete }
			}))
		},
		// `settings` Object Manipulation Functions
		create : { value : settingsCreate },
		save   : { value : settingsSave },
		load   : { value : settingsLoad },
		clear  : { value : settingsClear },
		reset  : { value : settingsReset },
		has    : { value : settingsHas },
		get    : { value : settingsGet },
		set    : { value : settingsSet },
		delete : { value : settingsDelete }
	}));

}());

