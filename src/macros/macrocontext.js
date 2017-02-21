/***********************************************************************************************************************
 *
 * macros/macrocontext.js
 *
 * Copyright © 2013–2017 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Config, DebugView, Engine, State, Wikifier, throwError */

var MacroContext = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
	 * MacroContext Class.
	 ******************************************************************************************************************/
	class MacroContext {
		constructor(contextData) {
			const context = Object.assign({
				parent  : null,
				macro   : null,
				name    : '',
				args    : null,
				payload : null,
				parser  : null,
				source  : ''
			}, contextData);

			if (context.macro === null || context.name === '' || context.parser === null) {
				throw new TypeError('context object missing required properties');
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

				_shadow : {
					writable : true,
					value    : null
				},

				_debugView : {
					writable : true,
					value    : null
				},

				_debugViewEnabled : {
					writable : true,
					value    : Config.debug
				}
			});
		}

		get output() {
			return this._debugViewEnabled ? this.debugView.output : this._output;
		}

		get shadows() {
			const shadows = {};
			this.contextSelectAll(ctx => ctx._shadow)
				.reverse()
				.forEach(ctx => Object.assign(shadows, ctx._shadow));

			return shadows;
		}

		get debugView() {
			if (this._debugViewEnabled) {
				return this._debugView !== null ? this._debugView : this.createDebugView();
			}

			return null;
		}

		contextHas(filter) {
			let context = this;

			while ((context = context.parent) !== null) {
				if (filter(context)) {
					return true;
				}
			}

			return false;
		}

		contextSelect(filter) {
			let context = this;

			while ((context = context.parent) !== null) {
				if (filter(context)) {
					return context;
				}
			}

			return null;
		}

		contextSelectAll(filter) {
			const result  = [];
			let context = this;

			while ((context = context.parent) !== null) {
				if (filter(context)) {
					result.push(context);
				}
			}

			return result;
		}

		createShadow(keyOrObj, value) {
			const varCheckRe  = /^[$_]/;
			let assignObj;

			switch (typeof keyOrObj) {
			case 'string':
				if (!varCheckRe.test(keyOrObj)) {
					throw new TypeError(`keyOrObj parameter string "${keyOrObj}" does not start with a variable sigil`);
				}

				assignObj = { [keyOrObj] : value };
				break;

			case 'object':
				Object.keys(keyOrObj).forEach(key => {
					if (!varCheckRe.test(key)) {
						throw new TypeError(`keyOrObj parameter object key "${key}" does not start with a variable sigil`);
					}
				});

				assignObj = keyOrObj;
				break;

			default:
				throw new TypeError(`keyOrObj parameter must be a string or object; type: ${typeof keyOrObj}`);
			}

			if (!this._shadow) {
				this._shadow = {};
			}

			Object.assign(this._shadow, assignObj);
		}

		createShadowWrapperHandler(content, callback, passage) {
			const self = this;
			return function () {
				if (content || typeof callback === 'function') {
					const shadows     = self.shadows;
					const shadowNames = Object.keys(shadows);
					const valueCache  = shadowNames.length > 0 ? {} : null;
					const storyVarRe  = /^\$/;

					/*
						There's no catch clause because this try/finally is here simply to ensure that
						proper cleanup is done in the event that an exception is thrown during the
						`Wikifier.wikifyEval()` call.
					*/
					try {
						/*
							Cache the existing values of the variables to be shadowed and assign the
							shadow values.
						*/
						if (shadowNames.length > 0) {
							shadowNames.forEach(varName => {
								const store  = storyVarRe.test(varName) ? State.variables : State.temporary;
								const varKey = varName.slice(1);

								if (store.hasOwnProperty(varKey)) {
									valueCache[varKey] = store[varKey];
								}

								store[varKey] = shadows[varName];
							});
						}

						// Wikify the content, if any, and discard any output.
						if (content) {
							Wikifier.wikifyEval(content);
						}

						// Call the callback function, if any.
						if (typeof callback === 'function') {
							callback.call(this);
						}
					}
					finally {
						// Revert the variable shadowing.
						if (shadowNames.length > 0) {
							shadowNames.forEach(varName => {
								const store  = storyVarRe.test(varName) ? State.variables : State.temporary;
								const varKey = varName.slice(1);

								if (valueCache.hasOwnProperty(varKey)) {
									store[varKey] = valueCache[varKey];
								}
								else {
									delete store[varKey];
								}
							});
						}
					}
				}

				// Play the given passage, if any.
				if (passage != null) { // lazy equality for null
					Engine.play(passage);
				}
			};
		}

		createDebugView(name, title) {
			this._debugView = new DebugView(
				this._output,
				'macro',
				name ? name : this.name,
				title ? title : this.source
			);

			if (this.payload !== null && this.payload.length > 0) {
				this._debugView.modes({ nonvoid : true });
			}

			this._debugViewEnabled = true;
			return this._debugView;
		}

		removeDebugView() {
			if (this._debugView !== null) {
				this._debugView.remove();
				this._debugView = null;
			}

			this._debugViewEnabled = false;
		}

		error(message, title) {
			return throwError(this._output, `<<${this.name}>>: ${message}`, title ? title : this.source);
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return MacroContext;
})();
