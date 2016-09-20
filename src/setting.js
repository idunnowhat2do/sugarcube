/***********************************************************************************************************************
 *
 * setting.js
 *
 * Copyright © 2015–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global settings:true, storage */

var Setting = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const
		// Setting definition array.
		_definitions = [],

		// Setting control types object (pseudo-enumeration).
		Types = Object.freeze({
			Header : 0,
			Toggle : 1,
			List   : 2
		});


	/*******************************************************************************************************************
	 * Settings Functions.
	 ******************************************************************************************************************/
	function settingsInit() {
		if (DEBUG) { console.log('[Setting/settingsInit()]'); }

		/* legacy */
		// Attempt to migrate an existing `options` store to `settings`.
		if (storage.has('options')) {
			const old = storage.get('options');

			if (old !== null) {
				window.SugarCube.settings = settings = Object.assign(settingsCreate(), old);
			}

			settingsSave();
			storage.delete('options');
		}
		/* /legacy */

		// Load existing settings.
		settingsLoad();

		// Execute `onInit` callbacks.
		_definitions.forEach(def => {
			if (def.hasOwnProperty('onInit')) {
				const thisArg = {
					name    : def.name,
					value   : settings[def.name],
					default : def.default
				};

				if (def.hasOwnProperty('list')) {
					thisArg.list = def.list;
				}

				def.onInit.call(thisArg);
			}
		});
	}

	function settingsCreate() {
		return Object.create(null);
	}

	function settingsSave() {
		const savedSettings = settingsCreate();

		if (Object.keys(settings).length > 0) {
			_definitions
				.filter(def => def.type !== Types.Header && settings[def.name] !== def.default)
				.forEach(def => savedSettings[def.name] = settings[def.name]);
		}

		if (Object.keys(savedSettings).length === 0) {
			storage.delete('settings');
			return true;
		}

		return storage.set('settings', savedSettings);
	}

	function settingsLoad() {
		const
			defaultSettings = settingsCreate(),
			loadedSettings  = storage.get('settings') || settingsCreate();

		// Load the defaults.
		_definitions
			.filter(def => def.type !== Types.Header)
			.forEach(def => defaultSettings[def.name] = def.default);

		// Assign to the `settings` object while overwriting the defaults with the loaded settings.
		window.SugarCube.settings = settings = Object.assign(defaultSettings, loadedSettings);
	}

	function settingsClear() {
		window.SugarCube.settings = settings = settingsCreate();
		storage.delete('settings');
		return true;
	}

	function settingsReset(name) {
		if (arguments.length === 0) {
			settingsClear();
			settingsLoad();
		}
		else {
			if (name == null || !definitionsHas(name)) { // lazy equality for null
				throw new Error(`nonexistent setting "${name}"`);
			}

			const def = definitionsGet(name);

			if (def.type !== Types.Header) {
				settings[name] = def.default;
			}
		}

		return settingsSave();
	}


	/*******************************************************************************************************************
	 * Definitions Functions.
	 ******************************************************************************************************************/
	function definitionsForEach(callback, thisArg) {
		_definitions.forEach(callback, thisArg);
	}

	function definitionsAdd(type, name, def) {
		if (arguments.length < 3) {
			const errors = [];
			if (arguments.length < 1) { errors.push('type'); }
			if (arguments.length < 2) { errors.push('name'); }
			if (arguments.length < 3) { errors.push('definition'); }
			throw new Error(`missing parameters, no ${errors.join(' or ')} specified`);
		}

		if (typeof def !== 'object') {
			throw new TypeError('definition parameter must be an object');
		}

		if (definitionsHas(name)) {
			throw new Error(`cannot clobber existing setting "${name}"`);
		}

		/*
			Definition objects.
			{
				type     : (both:Setting.Types),
				name     : (both:string),
				label    : (both:string),
				default  : (toggle:boolean, list:[as array]), // if undefined (toggle:false, list:list[0])
				list     : (list:array),
				onInit   : (both:function),
				onChange : (both:function)
			}
		*/
		const definition = {
			type,
			name,
			label : def.label == null ? '' : String(def.label).trim() // lazy equality for null
		};

		switch (type) {
		case Types.Header:
			break;

		case Types.Toggle:
			definition.default = !!def.default;
			break;

		case Types.List:
			if (!def.hasOwnProperty('list')) {
				throw new Error('no list specified');
			}
			else if (!Array.isArray(def.list)) {
				throw new TypeError('list must be an array');
			}
			else if (def.list.length === 0) {
				throw new Error('list must not be empty');
			}

			definition.list = Object.freeze(def.list);

			if (def.default == null) { // lazy equality for null
				definition.default = def.list[0];
			}
			else {
				const defaultIndex = def.list.indexOf(def.default);

				if (defaultIndex === -1) {
					throw new Error('list does not contain default');
				}

				definition.default = def.list[defaultIndex];
			}
			break;

		default:
			throw new Error(`unknown Setting type: ${type}`);
		}

		if (typeof def.onInit === 'function') {
			definition.onInit = Object.freeze(def.onInit);
		}

		if (typeof def.onChange === 'function') {
			definition.onChange = Object.freeze(def.onChange);
		}

		_definitions.push(Object.freeze(definition));
	}

	function definitionsAddHeader(name, label) {
		definitionsAdd(Types.Header, name, { label });
	}

	function definitionsAddToggle(...args) {
		definitionsAdd(Types.Toggle, ...args);
	}

	function definitionsAddList(...args) {
		definitionsAdd(Types.List, ...args);
	}

	function definitionsIsEmpty() {
		return _definitions.length === 0;
	}

	function definitionsHas(name) {
		return _definitions.some(definition => definition.name === name);
	}

	function definitionsGet(name) {
		return _definitions.find(definition => definition.name === name);
	}

	function definitionsDelete(name) {
		if (definitionsHas(name)) {
			delete settings[name];
		}

		for (let i = 0; i < _definitions.length; ++i) {
			if (_definitions[i].name === name) {
				_definitions.splice(i, 1);
				definitionsDelete(name);
				break;
			}
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
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
		addHeader : { value : definitionsAddHeader },
		addToggle : { value : definitionsAddToggle },
		addList   : { value : definitionsAddList },
		isEmpty   : { value : definitionsIsEmpty },
		has       : { value : definitionsHas },
		get       : { value : definitionsGet },
		delete    : { value : definitionsDelete }
	}));
})();
