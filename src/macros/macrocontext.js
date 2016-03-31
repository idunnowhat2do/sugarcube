/***********************************************************************************************************************
 *
 * macros/macrocontext.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Config, DebugView, throwError */

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
			let   context = this;

			while ((context = context.parent) !== null) {
				if (filter(context)) {
					result.push(context);
				}
			}

			return result;
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
