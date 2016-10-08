/***********************************************************************************************************************
 *
 * macros/macro.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Patterns, Scripting, clone, macros */

var Macro = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const
		// Macro definitions.
		_macros = {},

		// Map of all macro tags and their parents (key: 'tag name' => value: ['list of parent names']).
		_tags   = {},

		// Valid macro name regular expression.
		_validNameRe = new RegExp(`^(?:${Patterns.macroName})$`);


	/*******************************************************************************************************************
	 * Macros Functions.
	 ******************************************************************************************************************/
	function macrosAdd(name, def, deep) {
		if (Array.isArray(name)) {
			name.forEach(name => macrosAdd(name, def, deep));
			return;
		}

		if (!_validNameRe.test(name)) {
			throw new Error(`invalid macro name "${name}"`);
		}

		if (macrosHas(name)) {
			throw new Error(`cannot clobber existing macro <<${name}>>`);
		}
		else if (tagsHas(name)) {
			throw new Error(`cannot clobber child tag <<${name}>> of parent macro${_tags[name].length === 1 ? '' : 's'} <<${_tags[name].join('>>, <<')}>>`);
		}

		try {
			if (typeof def === 'object') {
				// Add the macro definition.
				_macros[name] = deep ? clone(def) : def;
			}
			else {
				// Add the macro alias.
				if (macrosHas(def)) {
					_macros[name] = deep ? clone(_macros[def]) : _macros[def];
				}
				else {
					throw new Error(`cannot create alias of nonexistent macro <<${def}>>`);
				}
			}

			Object.defineProperty(_macros, name, { writable : false });

			/* legacy */
			/*
				Since `macrosGet()` may return legacy macros, we have to add a flag to (modern)
				API macros, so that the macro formatter will know how to call the macro.
			*/
			_macros[name]._MACRO_API = true;
			/* /legacy */
		}
		catch (ex) {
			if (ex.name === 'TypeError') {
				throw new Error(`cannot clobber protected macro <<${name}>>`);
			}
			else {
				throw new Error(`unknown error when attempting to add macro <<${name}>>: [${ex.name}] ${ex.message}`);
			}
		}

		// Tags post-processing.
		if (_macros[name].hasOwnProperty('tags')) {
			if (_macros[name].tags == null) { // lazy equality for null
				tagsRegister(name);
			}
			else if (Array.isArray(_macros[name].tags)) {
				tagsRegister(name, _macros[name].tags);
			}
			else {
				throw new Error(`bad value for "tags" property of macro <<${name}>>`);
			}
		}
	}

	function macrosDelete(name) {
		if (Array.isArray(name)) {
			name.forEach(name => macrosDelete(name));
			return;
		}

		if (macrosHas(name)) {
			// Tags pre-processing.
			if (_macros[name].hasOwnProperty('tags')) {
				tagsUnregister(name);
			}

			try {
				// Remove the macro definition.
				Object.defineProperty(_macros, name, { writable : true });
				delete _macros[name];
			}
			catch (ex) {
				throw new Error(`unknown error removing macro <<${name}>>: ${ex.message}`);
			}
		}
		else if (tagsHas(name)) {
			throw new Error(`cannot remove child tag <<${name}>> of parent macro <<${_tags[name]}>>`);
		}
	}

	function macrosIsEmpty() {
		return Object.keys(_macros).length === 0;
	}

	function macrosHas(name) {
		return _macros.hasOwnProperty(name);
	}

	function macrosGet(name) {
		let macro = null;

		if (macrosHas(name) && typeof _macros[name].handler === 'function') {
			macro = _macros[name];
		}
		/* legacy macro support */
		else if (macros.hasOwnProperty(name) && typeof macros[name].handler === 'function') {
			macro = macros[name];
		}
		/* /legacy macro support */

		return macro;
	}

	function macrosInit(handler = 'init') { // eslint-disable-line no-unused-vars
		Object.keys(_macros).forEach(name => {
			if (typeof _macros[name][handler] === 'function') {
				_macros[name][handler](name);
			}
		});

		/* legacy macro support */
		Object.keys(macros).forEach(name => {
			if (typeof macros[name][handler] === 'function') {
				macros[name][handler](name);
			}
		});
		/* /legacy macro support */
	}


	/*******************************************************************************************************************
	 * Tags Functions.
	 ******************************************************************************************************************/
	function tagsRegister(parent, bodyTags) {
		if (!parent) {
			throw new Error('no parent specified');
		}

		const
			endTags = [`/${parent}`, `end${parent}`], // automatically create the closing tags
			allTags = [].concat(endTags, Array.isArray(bodyTags) ? bodyTags : []);

		for (let i = 0; i < allTags.length; ++i) {
			const tag = allTags[i];

			if (macrosHas(tag)) {
				throw new Error('cannot register tag for an existing macro');
			}

			if (tagsHas(tag)) {
				if (!_tags[tag].includes(parent)) {
					_tags[tag].push(parent);
					_tags[tag].sort();
				}
			}
			else {
				_tags[tag] = [parent];
			}
		}
	}

	function tagsUnregister(parent) {
		if (!parent) {
			throw new Error('no parent specified');
		}

		Object.keys(_tags).forEach(tag => {
			const i = _tags[tag].indexOf(parent);

			if (i !== -1) {
				if (_tags[tag].length === 1) {
					delete _tags[tag];
				}
				else {
					_tags[tag].splice(i, 1);
				}
			}
		});
	}

	function tagsHas(name) {
		return _tags.hasOwnProperty(name);
	}

	function tagsGet(name) {
		return tagsHas(name) ? _tags[name] : null;
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Macro Functions.
		*/
		add     : { value : macrosAdd },
		delete  : { value : macrosDelete },
		isEmpty : { value : macrosIsEmpty },
		has     : { value : macrosHas },
		get     : { value : macrosGet },
		init    : { value : macrosInit },

		/*
			Tags Functions.
		*/
		tags : {
			value : Object.freeze(Object.defineProperties({}, {
				register   : { value : tagsRegister },
				unregister : { value : tagsUnregister },
				has        : { value : tagsHas },
				get        : { value : tagsGet }
			}))
		},

		/*
			Legacy Aliases.
		*/
		evalStatements : { value : (...args) => Scripting.evalJavaScript(...args) } // SEE: `markup/scripting.js`.
	}));
})();
