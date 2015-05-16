/***********************************************************************************************************************
 *
 * setting.js
 *
 * Copyright © 2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var Setting = (function () {
	"use strict";

	var
		controls = [],

		// Setup the Setting Types enumeration
		Types    = Object.freeze({
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
				window.SugarCube.settings = settings = {};
				Object.keys(old).forEach(function (name) {
					settings[name] = old[name];
				});
			}
			save();
			storage.removeItem("options");
		}
		/* /legacy */

		load();
	}


	/*******************************************************************************************************************
	 * Control Setup Functions
	 ******************************************************************************************************************/
	function addControl(type, name, definition) {
		/*
		 * definition = {
		 *     label    : (both:string),
		 *     default  : (toggle:boolean) | (list:string/number), // system defaults: false or list[0],
		 *     list     : (list:array),
		 *     callback : (both:function)
		 * }
		 */
		if (arguments.length < 3) {
			var errors = [];
			if (arguments.length < 1) { errors.push("type"); }
			if (arguments.length < 2) { errors.push("name"); }
			if (arguments.length < 3) { errors.push("definition"); }
			throw new Error("Setting.addControl missing parameters, no " + errors.join(" or ") + " specified");
		}
		if (typeof definition !== "object") {
			throw new Error("Setting.addControl definition parameter must be an object");
		}
		if (hasControl(name)) {
			throw new Error('cannot clobber existing setting "' + name + '"');
		}
		var control = {
			name  : name,
			type  : type,
			label : definition.label == null ? "" : String(definition.label).trim() // use lazy equality on null check
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
			if (definition.default == null) { // use lazy equality
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
		controls.push(control);
	}

	function addToggle(name, label, defaultValue, callback) {
		addControl(Types.Toggle, name, {
			label    : label,
			default  : !!defaultValue,
			callback : callback
		});
	}

	function addList(name, label, list, defaultValue, callback) {
		addControl(Types.List, name, {
			label    : label,
			list     : list,
			default  : defaultValue,
			callback : callback
		});
	}

	function removeControl(name) {
		for (var i = 0; i < controls.length; i++) {
			if (controls[i].name === name) {
				controls.splice(i, 1);
				remove(name);
				break;
			}
		}
	}

	function hasControl(name) {
		return controls.some(function (control) {
			return control.name === this;
		}, name);
	}

	function isEmpty() {
		return controls.length === 0;
	}


	/*******************************************************************************************************************
	 * `settings` Object Manipulation Functions
	 ******************************************************************************************************************/
	function save() {
		return storage.setItem("settings", settings);
	}

	function load() {
		var obj = storage.getItem("settings");
		if (obj !== null) {
			window.SugarCube.settings = settings = {};
			Object.keys(obj).forEach(function (name) {
				settings[name] = obj[name];
			});
		}
	}

	function clear() {
		if (!storage.removeItem("settings")) {
			throw new Error("unknown error, cannot update settings store");
		}
		window.SugarCube.settings = settings = {};
	}

	function reset() {
		clear();
		controls.forEach(function (control) {
			settings[control.name] = control.default;
		});
	}

	function has(name) {
		return settings.hasOwnProperty(name);
	}

	function get(name) {
		return settings[name];
	}

	function set(name, value) {
		settings[name] = value;
	}

	function remove(name) {
		if (has(name)) {
			delete settings[name];
		}
	}


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		controls      : { value : controls },
		Types         : { value : Types },
		// Initialization
		init          : { value : init },
		// Control Functions
		addControl    : { value : addControl },
		addToggle     : { value : addToggle },
		addList       : { value : addList },
		deleteControl : { value : removeControl },
		hasControl    : { value : hasControl },
		isEmpty       : { value : isEmpty },
		// `settings` Object Manipulation Functions
		save          : { value : save },
		load          : { value : load },
		clear         : { value : clear },
		reset         : { value : reset },
		has           : { value : has },
		get           : { value : get },
		set           : { value : set },
		delete        : { value : remove }
	}));

}());

