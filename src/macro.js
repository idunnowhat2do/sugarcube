/***********************************************************************************************************************
 *
 * macro.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global DebugView, Wikifier, clone, config, evalJavaScript, macros, throwError */

var Macro = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	var
		/*
			Core properties.
		*/
		_macros = {},
		_tags   = {};


	/*******************************************************************************************************************
	 * Macros Functions
	 ******************************************************************************************************************/
	function macrosAdd(name, def, deep) {
		if (Array.isArray(name)) {
			name.forEach(function (n) { macrosAdd(n, def, deep); });
			return;
		}

		if (macrosHas(name)) {
			throw new Error("cannot clobber existing macro <<" + name + ">>");
		} else if (tagsHas(name)) {
			throw new Error("cannot clobber child tag <<" + name + ">> of parent macro"
				+ (_tags[name].length === 1 ? '' : 's') + " <<" + _tags[name].join(">>, <<") + ">>");
		}

		try {
			if (typeof def === "object") {
				// Add the macro definition.
				_macros[name] = deep ? clone(def) : def;
			} else {
				// Add the macro alias.
				if (macrosHas(def)) {
					_macros[name] = deep ? clone(_macros[def]) : _macros[def];
				} else {
					throw new Error("cannot create alias of nonexistent macro <<" + def + ">>");
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
		} catch (e) {
			if (e.name === "TypeError") {
				throw new Error("cannot clobber protected macro <<" + name + ">>");
			} else {
				throw new Error("unknown error when attempting to add macro <<" + name + ">>: [" + e.name + "] "
					+ e.message);
			}
		}

		// Tags post-processing.
		if (_macros[name].hasOwnProperty("tags")) {
			if (_macros[name].tags == null) { // lazy equality for null
				tagsRegister(name);
			} else if (Array.isArray(_macros[name].tags)) {
				tagsRegister(name, _macros[name].tags);
			} else {
				throw new Error('bad value for "tags" property of macro <<' + name + ">>");
			}
		}
	}

	function macrosDelete(name) {
		if (Array.isArray(name)) {
			name.forEach(function (n) { macrosDelete(n); });
			return;
		}

		if (macrosHas(name)) {
			// Tags pre-processing.
			if (_macros[name].hasOwnProperty("tags")) {
				tagsUnregister(name);
			}

			try {
				// Remove the macro definition.
				Object.defineProperty(_macros, name, { writable : true });
				delete _macros[name];
			} catch (e) {
				throw new Error("unknown error removing macro <<" + name + ">>: " + e.message);
			}
		} else if (tagsHas(name)) {
			throw new Error("cannot remove child tag <<" + name + ">> of parent macro <<" + _tags[name] + ">>");
		}
	}

	function macrosIsEmpty() {
		return Object.keys(_macros).length === 0;
	}

	function macrosHas(name) {
		return _macros.hasOwnProperty(name);
	}

	function macrosGet(name) {
		var macro = null;
		if (macrosHas(name) && typeof _macros[name].handler === "function") {
			macro = _macros[name];
		/* legacy macro support */
		} else if (macros.hasOwnProperty(name) && typeof macros[name].handler === "function") {
			macro = macros[name];
		/* /legacy macro support */
		}
		return macro;
	}

	function macrosInit(handler) { // eslint-disable-line no-unused-vars
		handler = handler || "init";
		Object.keys(_macros).forEach(function (name) {
			if (typeof _macros[name][handler] === "function") {
				_macros[name][handler].call(_macros[name], name);
			}
		});
		/* legacy macro support */
		Object.keys(macros).forEach(function (name) {
			if (typeof macros[name][handler] === "function") {
				macros[name][handler].call(macros[name], name);
			}
		});
		/* /legacy macro support */
	}


	/*******************************************************************************************************************
	 * Tags Functions
	 ******************************************************************************************************************/
	function tagsRegister(parent, bodyTags) {
		if (!parent) {
			throw new Error("no parent specified");
		}

		if (!Array.isArray(bodyTags)) {
			bodyTags = [];
		}

		var	endTags = [ "/" + parent, "end" + parent ], // automatically create the closing tags
			allTags = [].concat(endTags, bodyTags);

		for (var i = 0; i < allTags.length; ++i) {
			var tag = allTags[i];
			if (macrosHas(tag)) {
				throw new Error("cannot register tag for an existing macro");
			}
			if (tagsHas(tag)) {
				if (!_tags[tag].contains(parent)) {
					_tags[tag].push(parent);
					_tags[tag].sort();
				}
			} else {
				_tags[tag] = [ parent ];
			}
		}
	}

	function tagsUnregister(parent) {
		if (!parent) {
			throw new Error("no parent specified");
		}

		Object.keys(_tags).forEach(function (tag) {
			var i = _tags[tag].indexOf(parent);
			if (i !== -1) {
				if (_tags[tag].length === 1) {
					delete _tags[tag];
				} else {
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
	 * Exports
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
		evalStatements : { value : evalJavaScript } // External (see: utility/helperfunctions.js).
	}));

})();


var MacroContext = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	/*******************************************************************************************************************
	 * Constructor
	 ******************************************************************************************************************/
	function MacroContext(context) {
		context = Object.assign({
			parent  : null,
			macro   : null,
			name    : "",
			args    : null,
			payload : null,
			parser  : null,
			source  : ""
		}, context);
		if (context.macro === null || context.name === "" || context.parser === null) {
			throw new TypeError("context object missing required properties");
		}
		Object.defineProperties(this, {
			parent : {
				value : context.parent
			},
			self : {
				value : context.macro
			},
			name : {
				value : context.name
			},
			args : {
				value : context.args
			},
			payload : {
				value : context.payload
			},
			source : {
				value : context.source
			},
			parser : {
				value : context.parser
			},
			_output : {
				value : context.parser.output
			},
			_debugView : {
				writable : true,
				value    : null
			},
			_debugViewEnabled : {
				writable : true,
				value    : config.debug
			}
		});
	}


	/*******************************************************************************************************************
	 * Prototype
	 ******************************************************************************************************************/
	Object.defineProperties(MacroContext.prototype, {
		contextHas : {
			value : function (filter) {
				var context = this;
				while ((context = context.parent) !== null) {
					if (filter(context)) {
						return true;
					}
				}
				return false;
			}
		},

		contextSelect : {
			value : function (filter) {
				var	context = this;
				while ((context = context.parent) !== null) {
					if (filter(context)) {
						return context;
					}
				}
				return null;
			}
		},

		contextSelectAll : {
			value : function (filter) {
				var	context = this,
					result  = [];
				while ((context = context.parent) !== null) {
					if (filter(context)) {
						result.push(context);
					}
				}
				return result;
			}
		},

		createDebugView : {
			value : function (name, title) {
				this._debugView = new DebugView(
					this._output,
					"macro",
					name ? name : this.name,
					title ? title : this.source
				);
				if (this.payload !== null && this.payload.length > 0) {
					this._debugView.modes({ nonvoid : true });
				}
				this._debugViewEnabled = true;
				return this._debugView;
			}
		},

		removeDebugView : {
			value : function () {
				if (this._debugView !== null) {
					this._debugView.remove();
					this._debugView = null;
				}
				this._debugViewEnabled = false;
			}
		},

		debugView : {
			get : function () {
				if (this._debugViewEnabled) {
					return this._debugView !== null ? this._debugView : this.createDebugView();
				}
				return null;
			}
		},

		output : {
			get : function () {
				return this._debugViewEnabled ? this.debugView.output : this._output;
			}
		},

		error : {
			value : function (message, title) {
				return throwError(this._output, "<<" + this.name + ">>: " + message, title ? title : this.source);
			}
		}
	});


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return MacroContext; // export the constructor

})();

