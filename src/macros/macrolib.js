/***********************************************************************************************************************
 *
 * macros/macrolib.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Config, DebugView, Engine, Has, L10n, LoadScreen, Macro, Scripting, SimpleAudio, State, Story, TempState,
	       TempVariables, Util, Wikifier, postdisplay, prehistory, storage, toStringOrDefault
*/

(() => {
	'use strict';

	/*******************************************************************************************************************
	 * Utility Functions.
	 ******************************************************************************************************************/
	function _createWidgetArgsWrapperHandler(widgetArgs, content, callback, passage) {
		return function () {
			if (content || typeof callback === 'function') {
				let argsCache;
				/*
					There's no catch clause because this try/finally is here simply to ensure that
					proper cleanup is done in the event that an exception is thrown during the
					`Wikifier.wikifyEval()` call.
				*/
				try {
					// Setup the `$args` variable, caching the existing value if necessary.
					if (typeof widgetArgs !== 'undefined') {
						if (State.variables.hasOwnProperty('args')) {
							argsCache = State.variables.args;
						}

						State.variables.args = widgetArgs;
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
					// Teardown the `$args` variable, restoring the cached value if necessary.
					if (typeof widgetArgs !== 'undefined') {
						if (typeof argsCache !== 'undefined') {
							State.variables.args = argsCache;
						}
						else {
							delete State.variables.args;
						}
					}
				}
			}

			// Play the given passage, if any.
			if (passage != null) { // lazy equality for null
				Engine.play(passage);
			}
		};
	}


	/*******************************************************************************************************************
	 * Variables Macros.
	 ******************************************************************************************************************/
	/*
		<<set>>
	*/
	Macro.add('set', {
		skipArgs : true,

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no expression specified');
			}

			try {
				Scripting.evalJavaScript(this.args.full);
			}
			catch (ex) {
				return this.error(`bad evaluation: ${ex.message}`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});

	/*
		<<unset>>
	*/
	Macro.add('unset', {
		skipArgs : true,

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no story/temporary variable list specified');
			}

			const re = new RegExp(
				`(?:(State\\.variables)|(TempVariables))\\.(${Wikifier.textPrimitives.identifier})`,
				'g'
			);
			let match;

			while ((match = re.exec(this.args.full)) !== null) {
				const
					store = match[1] ? State.variables : TempVariables,
					name  = match[3];

				if (store.hasOwnProperty(name)) {
					delete store[name];
				}
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});

	/*
		<<remember>>
	*/
	Macro.add('remember', {
		skipArgs : true,

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no expression specified');
			}

			try {
				Scripting.evalJavaScript(this.args.full);
			}
			catch (ex) {
				return this.error(`bad evaluation: ${ex.message}`);
			}

			const
				remember = storage.get('remember') || {},
				re       = new RegExp(`State\\.variables\\.(${Wikifier.textPrimitives.identifier})`, 'g');
			let
				match;

			while ((match = re.exec(this.args.full)) !== null) {
				const name = match[1];
				remember[name] = State.variables[name];
			}

			if (!storage.set('remember', remember)) {
				return this.error(`unknown error, cannot remember: ${this.args.raw}`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		},

		init() {
			const remember = storage.get('remember');

			if (remember) {
				Object.keys(remember).forEach(name => State.variables[name] = remember[name]);
			}
		}
	});

	/*
		<<forget>>
	*/
	Macro.add('forget', {
		skipArgs : true,

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no story variable list specified');
			}

			const
				remember = storage.get('remember'),
				re       = new RegExp(`State\\.variables\\.(${Wikifier.textPrimitives.identifier})`, 'g');
			let
				match,
				needStore = false;

			while ((match = re.exec(this.args.full)) !== null) {
				const name = match[1];

				if (State.variables.hasOwnProperty(name)) {
					delete State.variables[name];
				}

				if (remember && remember.hasOwnProperty(name)) {
					needStore = true;
					delete remember[name];
				}
			}

			if (needStore && !storage.set('remember', remember)) {
				return this.error('unknown error, cannot update remember store');
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});


	/*******************************************************************************************************************
	 * Scripting Macros.
	 ******************************************************************************************************************/
	/*
		<<run>>
	*/
	Macro.add('run', 'set'); // add <<run>> as an alias of <<set>>

	/*
		<<script>>
	*/
	Macro.add('script', {
		skipArgs : true,
		tags     : null,

		handler() {
			const output = document.createDocumentFragment();

			try {
				Scripting.evalJavaScript(this.payload[0].contents, output);

				// Custom debug view setup.
				if (Config.debug) {
					this.createDebugView(
						this.name,
						`${this.source + this.payload[0].contents}<</${this.name}>>`
					);
				}
			}
			catch (ex) {
				return this.error(
					`bad evaluation: ${ex.message}`,
					`${this.source + this.payload[0].contents}<</${this.name}>>`
				);
			}

			if (output.hasChildNodes()) {
				this.output.appendChild(output);
			}
		}
	});


	/*******************************************************************************************************************
	 * Display Macros.
	 ******************************************************************************************************************/
	/*
		<<display>>
	*/
	Macro.add('display', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no passage specified');
			}

			let passage;

			if (typeof this.args[0] === 'object') {
				// Argument was in wiki link syntax.
				passage = this.args[0].link;
			}
			else {
				// Argument was simply the passage name.
				passage = this.args[0];
			}

			if (!Story.has(passage)) {
				return this.error(`passage "${passage}" does not exist`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			passage = Story.get(passage);
			let $el;

			if (this.args[1]) {
				$el = jQuery(document.createElement(this.args[1]))
					.addClass(`${passage.domId} macro-${this.name}`)
					.attr('data-passage', passage.title)
					.appendTo(this.output);
			}
			else {
				$el = jQuery(this.output);
			}

			$el.wiki(passage.processText());
		}
	});

	/*
		<<nobr>>
	*/
	Macro.add('nobr', {
		skipArgs : true,
		tags     : null,

		handler() {
			/*
				Wikify the contents, after removing all leading & trailing newlines and compacting
				all internal sequences of newlines into single spaces.
			*/
			new Wikifier(this.output, this.payload[0].contents.replace(/^\n+|\n+$/g, '').replace(/\n+/g, ' '));
		}
	});

	/*
		<<print>>, <<=>>, & <<->>
	*/
	Macro.add(['print', '=', '-'], {
		skipArgs : true,

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no expression specified');
			}

			try {
				const result = toStringOrDefault(Scripting.evalJavaScript(this.args.full), null);

				if (result !== null) {
					new Wikifier(this.output, this.name === '-' ? Util.escape(result) : result);
				}
			}
			catch (ex) {
				return this.error(`bad evaluation: ${ex.message}`);
			}
		}
	});

	/*
		<<silently>>
	*/
	Macro.add('silently', {
		skipArgs : true,
		tags     : null,

		handler() {
			const frag = document.createDocumentFragment();
			new Wikifier(frag, this.payload[0].contents.trim());

			if (Config.debug) {
				// Custom debug view setup.
				this.debugView.modes({ hidden : true });
				this.output.appendChild(frag);
			}
			else {
				// Discard the output, unless there were errors.
				const errList = [...frag.querySelectorAll('.error')].map(errEl => errEl.textContent);

				if (errList.length > 0) {
					return this.error(
						`error${errList.length === 1 ? '' : 's'} within contents (${errList.join('; ')})`,
						`${this.source + this.payload[0].contents}<</${this.name}>>`
					);
				}
			}
		}
	});


	/*******************************************************************************************************************
	 * Control Macros.
	 ******************************************************************************************************************/
	/*
		<<if>>, <<elseif>>, & <<else>>
	*/
	Macro.add('if', {
		skipArgs : true,
		tags     : ['elseif', 'else'],

		handler() {
			let i = 0;

			try {
				const
					evalJavaScript = Scripting.evalJavaScript,
					len            = this.payload.length;
				let
					success = false;

				for (/* empty */; i < len; ++i) {
					// Sanity checks.
					/* eslint-disable prefer-template */
					switch (this.payload[i].name) {
					case 'else':
						if (i + 1 !== len) {
							return this.error('<<else>> must be the final clause');
						}
						if (this.payload[i].args.raw.length > 0) {
							if (/^\s*if\b/i.test(this.payload[i].args.raw)) {
								return this.error(`whitespace is not allowed between the "else" and "if" in <<elseif>> clause${i > 0 ? ' (#' + i + ')' : ''}`);
							}

							return this.error(`<<else>> does not accept a conditional expression (perhaps you meant to use <<elseif>>), invalid: ${this.payload[i].args.raw}`);
						}
						break;

					default:
						if (this.payload[i].args.full.length === 0) {
							return this.error(`no conditional expression specified for <<${this.payload[i].name}>> clause${i > 0 ? ' (#' + i + ')' : ''}`);
						}
						else if (
							   Config.macros.ifAssignmentError
							&& /[^!=&^|<>*/%+-]=[^=]/.test(this.payload[i].args.full)
						) {
							return this.error(`assignment operator found within <<${this.payload[i].name}>> clause${i > 0 ? ' (#' + i + ')' : ''} (perhaps you meant to use an equality operator: ==, ===, eq, is), invalid: ${this.payload[i].args.raw}`);
						}
						break;
					}
					/* eslint-enable prefer-template */

					// Custom debug view setup for the current clause.
					if (Config.debug) {
						this
							.createDebugView(this.payload[i].name, this.payload[i].source)
							.modes({ nonvoid : false });
					}

					// Conditional test.
					if (this.payload[i].name === 'else' || !!evalJavaScript(this.payload[i].args.full)) {
						success = true;
						new Wikifier(this.output, this.payload[i].contents);
						break;
					}
					else if (Config.debug) {
						// Custom debug view setup for a failed conditional.
						this.debugView.modes({
							hidden  : true,
							invalid : true
						});
					}
				}

				// Custom debug view setup for the remaining clauses.
				if (Config.debug) {
					for (++i; i < len; ++i) {
						this
							.createDebugView(this.payload[i].name, this.payload[i].source)
							.modes({
								nonvoid : false,
								hidden  : true,
								invalid : true
							});
					}

					/*
						Fake a debug view for `<</if>>`.  We do this to aid the checking of nesting
						and as a quick indicator of if any of the clauses matched.
					*/
					this
						.createDebugView(`/${this.name}`, `<</${this.name}>>`)
						.modes({
							nonvoid : false,
							hidden  : !success,
							invalid : !success
						});
				}
			}
			catch (ex) {
				return this.error(`bad conditional expression in <<${i === 0 ? 'if' : 'elseif'}>> clause${i > 0 ? ' (#' + i + ')' : ''}: ${ex.message}`); // eslint-disable-line prefer-template
			}
		}
	});

	/*
		<<switch>>, <<case>>, & <<default>>
	*/
	Macro.add('switch', {
		skipArg0 : true,
		tags     : ['case', 'default'],

		handler() {
			if (this.args.full.length === 0) {
				return this.error('no expression specified');
			}

			const len = this.payload.length;
			let result;

			// if (len === 1 || !this.payload.some(p => p.name === 'case')) {
			if (len === 1) {
				return this.error('no cases specified');
			}

			try {
				result = Scripting.evalJavaScript(this.args.full);
			}
			catch (ex) {
				return this.error(`bad evaluation: ${ex.message}`);
			}

			const
				debugView = this.debugView; // cache it now, to be modified later
			let
				i       = 1,
				success = false;

			// Initial debug view setup for `<<switch>>`.
			if (Config.debug) {
				debugView
					.modes({
						nonvoid : false,
						hidden  : true
					});
			}

			for (/* empty */; i < len; ++i) {
				// Sanity checks.
				switch (this.payload[i].name) {
				case 'default':
					if (i + 1 !== len) {
						return this.error('<<default>> must be the final case');
					}
					if (this.payload[i].args.length > 0) {
						return this.error(`<<default>> does not accept values, invalid: ${this.payload[i].args.raw}`);
					}
					break;

				default:
					if (this.payload[i].args.length === 0) {
						return this.error(`no value(s) specified for <<${this.payload[i].name}>> (#${i})`);
					}
					break;
				}

				// Custom debug view setup for the current case.
				if (Config.debug) {
					this
						.createDebugView(this.payload[i].name, this.payload[i].source)
						.modes({ nonvoid : false });
				}

				// Case test(s).
				if (this.payload[i].name === 'default' || this.payload[i].args.some(val => val === result)) {
					success = true;
					new Wikifier(this.output, this.payload[i].contents);
					break;
				}
				else if (Config.debug) {
					// Custom debug view setup for a failed case.
					this.debugView.modes({
						hidden  : true,
						invalid : true
					});
				}
			}

			// Custom debug view setup for the remaining cases.
			if (Config.debug) {
				for (++i; i < len; ++i) {
					this
						.createDebugView(this.payload[i].name, this.payload[i].source)
						.modes({
							nonvoid : false,
							hidden  : true,
							invalid : true
						});
				}

				/*
					Finalize the debug view for `<<switch>>` and fake a debug view for `<</switch>>`.
					We do both as a quick indicator of if any of the cases matched and the latter
					to aid the checking of nesting.
				*/
				debugView
					.modes({
						nonvoid : false,
						hidden  : true, // !success,
						invalid : !success
					});
				this
					.createDebugView(`/${this.name}`, `<</${this.name}>>`)
					.modes({
						nonvoid : false,
						hidden  : true, // !success,
						invalid : !success
					});
			}
		}
	});

	/*
		<<for>>, <<break>>, & <<continue>>
	*/
	Macro.add('for', {
		skipArgs : true,
		tags     : null,

		handler() {
			const
				evalJavaScript = Scripting.evalJavaScript,
				payload        = this.payload[0].contents.replace(/\n$/, '');
			let
				init,
				condition = this.args.full.trim(),
				post,
				first     = true,
				safety    = Config.macros.maxLoopIterations;

			if (condition.length === 0) {
				condition = true;
			}
			else if (condition.indexOf(';') !== -1) {
				const parts = condition.match(/^([^;]*?)\s*;\s*([^;]*?)\s*;\s*([^;]*?)$/);

				if (parts !== null) {
					init      = parts[1];
					condition = parts[2];
					post      = parts[3];
				}
				else {
					return this.error('invalid 3-part syntax, format: init ; condition ; post');
				}
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			try {
				TempState.break = null;

				if (init) {
					try {
						evalJavaScript(init);
					}
					catch (ex) {
						return this.error(`bad init expression: ${ex.message}`);
					}
				}

				while (evalJavaScript(condition)) {
					if (--safety < 0) {
						return this.error(`exceeded configured maximum loop iterations (${Config.macros.maxLoopIterations})`);
					}

					new Wikifier(this.output, first ? payload.replace(/^\n/, '') : payload);

					if (first) {
						first = false;
					}

					if (TempState.break != null) { // lazy equality for null
						if (TempState.break === 1) {
							TempState.break = null;
						}
						else if (TempState.break === 2) {
							TempState.break = null;
							break;
						}
					}

					if (post) {
						try {
							evalJavaScript(post);
						}
						catch (ex) {
							return this.error(`bad post expression: ${ex.message}`);
						}
					}
				}
			}
			catch (ex) {
				return this.error(`bad conditional expression: ${ex.message}`);
			}
			finally {
				TempState.break = null;
			}
		}
	});
	Macro.add(['break', 'continue'], {
		skipArgs : true,

		handler() {
			if (this.contextHas(ctx => ctx.name === 'for')) {
				TempState.break = this.name === 'continue' ? 1 : 2;
			}
			else {
				return this.error('must only be used in conjunction with its parent macro <<for>>');
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});


	/*******************************************************************************************************************
	 * Interactive Macros.
	 ******************************************************************************************************************/
	/*
		<<button>> & <<link>>
	*/
	Macro.add(['button', 'link'], {
		tags : null,

		handler() {
			if (this.args.length === 0) {
				return this.error(`no ${this.name === 'button' ? 'button' : 'link'} text specified`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.createDebugView(
					this.name,
					`${this.source + this.payload[0].contents}<</${this.name}>>`
				);
			}

			const
				$link      = jQuery(document.createElement(this.name === 'button' ? 'button' : 'a')),
				widgetArgs = (() => {
					let wargs;

					if (
						   State.variables.hasOwnProperty('args')
						&& this.contextHas(ctx => ctx.self.isWidget)
					) {
						wargs = State.variables.args;
					}

					return wargs;
				})();
			let
				passage;

			if (typeof this.args[0] === 'object') {
				if (this.args[0].isImage) {
					// Argument was in wiki image syntax.
					const $image = jQuery(document.createElement('img'))
						.attr('src', this.args[0].source)
						.appendTo($link);

					if (this.args[0].hasOwnProperty('passage')) {
						$image.attr('data-passage', this.args[0].passage);
					}

					if (this.args[0].hasOwnProperty('title')) {
						$image.attr('title', this.args[0].title);
					}

					if (this.args[0].hasOwnProperty('align')) {
						$image.attr('align', this.args[0].align);
					}

					if (this.args[0].hasOwnProperty('link')) {
						passage = this.args[0].link;
					}

					passage = this.args[0].link;
				}
				else {
					// Argument was in wiki link syntax.
					$link.append(document.createTextNode(this.args[0].text));
					passage = this.args[0].link;
				}
			}
			else {
				// Argument was simply the link text.
				$link.wiki(this.args[0]);
				passage = this.args.length > 1 ? this.args[1] : undefined;
			}

			if (passage != null) { // lazy equality for null
				$link.attr('data-passage', passage);

				if (Story.has(passage)) {
					$link.addClass('link-internal');

					if (Config.addVisitedLinkClass && State.hasPlayed(passage)) {
						$link.addClass('link-visited');
					}
				}
				else {
					$link.addClass('link-broken');
				}
			}
			else {
				$link.addClass('link-internal');
			}

			$link
				.addClass(`macro-${this.name}`)
				.ariaClick({
					namespace : '.macros',
					one       : passage != null // lazy equality for null
				}, _createWidgetArgsWrapperHandler(
					widgetArgs,
					this.payload[0].contents.trim(),
					null,
					passage
				))
				.appendTo(this.output);
		}
	});

	/*
		<<checkbox>>
	*/
	Macro.add('checkbox', {
		handler() {
			if (this.args.length < 3) {
				const errors = [];
				if (this.args.length < 1) { errors.push('story variable name'); }
				if (this.args.length < 2) { errors.push('unchecked value'); }
				if (this.args.length < 3) { errors.push('checked value'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			/*
				Try to ensure that we receive the story variable's name (incl. sigil), not its value.
			*/
			if (typeof this.args[0] !== 'string' || this.args[0].trim()[0] !== '$') {
				return this.error(`story variable name "${this.args[0]}" is missing its sigil ($)`);
			}

			const
				varName      = this.args[0].trim(),
				varId        = Util.slugify(varName),
				uncheckValue = this.args[1],
				checkValue   = this.args[2],
				el           = document.createElement('input');

			/*
				Setup and append the input element to the output buffer.
			*/
			jQuery(el)
				.attr({
					id       : `${this.name}-${varId}`,
					name     : `${this.name}-${varId}`,
					type     : 'checkbox',
					tabindex : 0 // for accessiblity
				})
				.addClass(`macro-${this.name}`)
				.on('change', function () {
					Wikifier.setValue(varName, this.checked ? checkValue : uncheckValue);
				})
				.appendTo(this.output);

			/*
				Set the story variable and input element to the appropriate value and state, as requested.
			*/
			if (this.args.length > 3 && this.args[3] === 'checked') {
				el.checked = true;
				Wikifier.setValue(varName, checkValue);
			}
			else {
				Wikifier.setValue(varName, uncheckValue);
			}
		}
	});

	/*
		<<linkappend>>, <<linkprepend>>, & <<linkreplace>>
	*/
	Macro.add(['linkappend', 'linkprepend', 'linkreplace'], {
		tags : null,

		handler() {
			if (this.args.length === 0) {
				return this.error('no link text specified');
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.createDebugView(
					this.name,
					`${this.source + this.payload[0].contents}<</${this.name}>>`
				);
			}

			const
				$link      = jQuery(document.createElement('a')),
				$insert    = jQuery(document.createElement('span')),
				transition = this.args.length > 1 && /^(?:transition|t8n)$/.test(this.args[1]),
				widgetArgs = (() => {
					let wargs;

					if (
						   State.variables.hasOwnProperty('args')
						&& this.contextHas(ctx => ctx.self.isWidget)
					) {
						wargs = State.variables.args;
					}

					return wargs;
				})();

			$link
				.wiki(this.args[0])
				.addClass(`link-internal macro-${this.name}`)
				.ariaClick({
					namespace : '.macros',
					one       : true
				}, _createWidgetArgsWrapperHandler(
					widgetArgs,
					null,
					() => {
						if (this.name === 'linkreplace') {
							$link.remove();
						}
						else {
							$link
								.wrap(`<span class="macro-${this.name}"></span>`)
								.replaceWith(() => $link.html());
						}

						if (this.payload[0].contents !== '') {
							const frag = document.createDocumentFragment();
							new Wikifier(frag, this.payload[0].contents);
							$insert.append(frag);
						}

						if (transition) {
							setTimeout(() => $insert.removeClass(`macro-${this.name}-in`), Engine.minDomActionDelay);
						}
					}
				))
				.appendTo(this.output);

			$insert.addClass(`macro-${this.name}-insert`);

			if (transition) {
				$insert.addClass(`macro-${this.name}-in`);
			}

			if (this.name === 'linkprepend') {
				$insert.insertBefore($link);
			}
			else {
				$insert.insertAfter($link);
			}
		}
	});

	/*
		<<radiobutton>>
	*/
	Macro.add('radiobutton', {
		handler() {
			if (this.args.length < 2) {
				const errors = [];
				if (this.args.length < 1) { errors.push('story variable name'); }
				if (this.args.length < 2) { errors.push('checked value'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			/*
				Try to ensure that we receive the story variable's name (incl. sigil), not its value.
			*/
			if (typeof this.args[0] !== 'string' || this.args[0].trim()[0] !== '$') {
				return this.error(`story variable name "${this.args[0]}" is missing its sigil ($)`);
			}

			const
				varName    = this.args[0].trim(),
				varId      = Util.slugify(varName),
				checkValue = this.args[1],
				el         = document.createElement('input');

			/*
				Setup and initialize the group counter.
			*/
			if (!TempState.hasOwnProperty(this.name)) {
				TempState[this.name] = {};
				TempState[this.name][varId] = 0;
			}

			/*
				Setup and append the input element to the output buffer.
			*/
			jQuery(el)
				.attr({
					id       : `${this.name}-${varId}-${TempState[this.name][varId]++}`,
					name     : `${this.name}-${varId}`,
					type     : 'radio',
					tabindex : 0 // for accessiblity
				})
				.addClass(`macro-${this.name}`)
				.on('change', function () {
					if (this.checked) {
						Wikifier.setValue(varName, checkValue);
					}
				})
				.appendTo(this.output);

			/*
				Set the story variable to the checked value and the input element to checked, if requested.
			*/
			if (this.args.length > 2 && this.args[2] === 'checked') {
				el.checked = true;
				Wikifier.setValue(varName, checkValue);
			}
		}
	});

	/*
		<<textarea>>
	*/
	Macro.add('textarea', {
		handler() {
			if (this.args.length < 2) {
				const errors = [];
				if (this.args.length < 1) { errors.push('story variable name'); }
				if (this.args.length < 2) { errors.push('default value'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			/*
				Try to ensure that we receive the story variable's name (incl. sigil), not its value.
			*/
			if (typeof this.args[0] !== 'string' || this.args[0].trim()[0] !== '$') {
				return this.error(`story variable name "${this.args[0]}" is missing its sigil ($)`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			const
				varName      = this.args[0].trim(),
				varId        = Util.slugify(varName),
				defaultValue = this.args[1],
				autofocus    = this.args[2] === 'autofocus',
				el           = document.createElement('textarea');

			/*
				Setup and append the textarea element to the output buffer.
			*/
			jQuery(el)
				.attr({
					id       : `${this.name}-${varId}`,
					name     : `${this.name}-${varId}`,
					rows     : 4,
					// cols     : 68, // instead of setting "cols" we set the `min-width` in CSS
					tabindex : 0 // for accessiblity
				})
				.addClass(`macro-${this.name}`)
				.on('change', function () {
					Wikifier.setValue(varName, this.value);
				})
				.appendTo(this.output);

			/*
				Set the story variable and textarea element to the default value.
			*/
			Wikifier.setValue(varName, defaultValue);
			// Ideally, we should be setting the `.defaultValue` property here, but IE doesn't support
			// it, so we have to use `.textContent`, which is equivalent to `.defaultValue` anyway.
			el.textContent = defaultValue;

			/*
				Autofocus the textarea element, if requested.
			*/
			if (autofocus) {
				// Set the element's "autofocus" attribute.
				el.setAttribute('autofocus', 'autofocus');

				// Setup a single-use post-display task to autofocus the element.
				postdisplay[`#autofocus:${el.id}`] = task => {
					setTimeout(() => el.focus(), Engine.minDomActionDelay);
					delete postdisplay[task]; // single-use task
				};
			}
		}
	});

	/*
		<<textbox>>
	*/
	Macro.add('textbox', {
		handler() {
			if (this.args.length < 2) {
				const errors = [];
				if (this.args.length < 1) { errors.push('story variable name'); }
				if (this.args.length < 2) { errors.push('default value'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			/*
				Try to ensure that we receive the story variable's name (incl. sigil), not its value.
			*/
			if (typeof this.args[0] !== 'string' || this.args[0].trim()[0] !== '$') {
				return this.error(`story variable name "${this.args[0]}" is missing its sigil ($)`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			const
				varName      = this.args[0].trim(),
				varId        = Util.slugify(varName),
				defaultValue = this.args[1],
				el           = document.createElement('input');
			let
				autofocus = false,
				passage;

			if (this.args.length > 3) {
				passage   = this.args[2];
				autofocus = this.args[3] === 'autofocus';
			}
			else if (this.args.length > 2) {
				if (this.args[2] === 'autofocus') {
					autofocus = true;
				}
				else {
					passage = this.args[2];
				}
			}

			/*
				Setup and append the input element to the output buffer.
			*/
			jQuery(el)
				.attr({
					id       : `${this.name}-${varId}`,
					name     : `${this.name}-${varId}`,
					type     : 'text',
					tabindex : 0 // for accessiblity
				})
				.addClass(`macro-${this.name}`)
				.on('change', function () {
					Wikifier.setValue(varName, this.value);
				})
				.on('keypress', function (ev) {
					// If Return/Enter is pressed, set the story variable and, optionally, forward to another passage.
					if (ev.which === 13) { // 13 is Return/Enter
						ev.preventDefault();
						Wikifier.setValue(varName, this.value);

						if (passage != null) { // lazy equality for null
							Engine.play(passage);
						}
					}
				})
				.appendTo(this.output);

			/*
				Set the story variable and input element to the default value.
			*/
			Wikifier.setValue(varName, defaultValue);
			el.value = defaultValue;

			/*
				Autofocus the input element, if requested.
			*/
			if (autofocus) {
				// Set the element's "autofocus" attribute.
				el.setAttribute('autofocus', 'autofocus');

				// Setup a single-use post-display task to autofocus the element.
				postdisplay[`#autofocus:${el.id}`] = task => {
					setTimeout(() => el.focus(), Engine.minDomActionDelay);
					delete postdisplay[task]; // single-use task
				};
			}
		}
	});

	/*
		NOTE: This macro is deprecated.

		<<click>>
	*/
	Macro.add('click', 'link'); // add <<click>> as an alias of <<link>>


	/*******************************************************************************************************************
	 * Links Macros.
	 ******************************************************************************************************************/
	/*
		<<actions>>
	*/
	Macro.add('actions', {
		handler() {
			const $list = jQuery(document.createElement('ul'))
				.addClass(this.name)
				.appendTo(this.output);

			if (!State.variables['#actions']) {
				State.variables['#actions'] = {};
			}

			for (let i = 0; i < this.args.length; ++i) {
				let
					passage,
					text,
					$image,
					setFn;

				if (typeof this.args[i] === 'object') {
					if (this.args[i].isImage) {
						// Argument was in wiki image syntax.
						$image = jQuery(document.createElement('img'))
							.attr('src', this.args[i].source);

						if (this.args[i].hasOwnProperty('passage')) {
							$image.attr('data-passage', this.args[i].passage);
						}

						if (this.args[i].hasOwnProperty('title')) {
							$image.attr('title', this.args[i].title);
						}

						if (this.args[i].hasOwnProperty('align')) {
							$image.attr('align', this.args[i].align);
						}

						passage = this.args[i].link;
						setFn   = this.args[i].setFn;
					}
					else {
						// Argument was in wiki link syntax.
						text    = this.args[i].text;
						passage = this.args[i].link;
						setFn   = this.args[i].setFn;
					}
				}
				else {
					// Argument was simply the passage name.
					text = passage = this.args[i];
				}

				if (
					   State.variables['#actions'].hasOwnProperty(passage)
					&& State.variables['#actions'][passage]
				) {
					continue;
				}

				jQuery(Wikifier.createInternalLink(
					jQuery(document.createElement('li')).appendTo($list),
					passage,
					null,
					((passage, fn) => () => {
						State.variables['#actions'][passage] = true;

						if (typeof fn === 'function') {
							fn();
						}
					})(passage, setFn)
				))
					.addClass(`macro-${this.name}`)
					.append($image || document.createTextNode(text));
			}
		}
	});

	/*
		<<back>> & <<return>>
	*/
	Macro.add(['back', 'return'], {
		handler() {
			/* legacy */
			if (this.args.length > 1) {
				return this.error('too many arguments specified, check the documentation for details');
			}
			/* /legacy */

			let
				momentIndex = -1,
				passage,
				text,
				$image;

			if (this.args.length === 1) {
				if (typeof this.args[0] === 'object') {
					if (this.args[0].isImage) {
						// Argument was in wiki image syntax.
						$image = jQuery(document.createElement('img'))
							.attr('src', this.args[0].source);

						if (this.args[0].hasOwnProperty('passage')) {
							$image.attr('data-passage', this.args[0].passage);
						}

						if (this.args[0].hasOwnProperty('title')) {
							$image.attr('title', this.args[0].title);
						}

						if (this.args[0].hasOwnProperty('align')) {
							$image.attr('align', this.args[0].align);
						}

						if (this.args[0].hasOwnProperty('link')) {
							passage = this.args[0].link;
						}
					}
					else {
						// Argument was in wiki link syntax.
						if (this.args[0].count === 1) {
							// Simple link syntax: `[[...]]`.
							passage = this.args[0].link;
						}
						else {
							// Pretty link syntax: `[[...|...]]`.
							text    = this.args[0].text;
							passage = this.args[0].link;
						}
					}
				}
				else if (this.args.length === 1) {
					// Argument was simply the link text.
					text = this.args[0];
				}
			}

			if (passage == null) { // lazy equality for null
				/*
					Find the index and title of the most recent moment whose title does not match
					that of the active (present) moment's.
				*/
				for (let i = State.length - 2; i >= 0; --i) {
					if (State.history[i].title !== State.passage) {
						momentIndex = i;
						passage = State.history[i].title;
						break;
					}
				}

				// If we failed to find a passage and we're `<<return>>`, fallback to `State.expired`.
				if (passage == null && this.name === 'return') { // lazy equality for null
					for (let i = State.expired.length - 1; i >= 0; --i) {
						if (State.expired[i] !== State.passage) {
							passage = State.expired[i];
							break;
						}
					}
				}
			}
			else {
				if (!Story.has(passage)) {
					return this.error(`passage "${passage}" does not exist`);
				}

				if (this.name === 'back') {
					/*
						Find the index of the most recent moment whose title matches that of the
						specified passage.
					*/
					for (let i = State.length - 2; i >= 0; --i) {
						if (State.history[i].title === passage) {
							momentIndex = i;
							break;
						}
					}

					if (momentIndex === -1) {
						return this.error(`cannot find passage "${passage}" in the current story history`);
					}
				}
			}

			if (passage == null) { // lazy equality for null
				return this.error('cannot find passage');
			}

			// if (this.name === "back" && momentIndex === -1) {
			// 	// no-op; we're already at the first passage in the current story history
			// 	return;
			// }

			let $el;

			if (this.name !== 'back' || momentIndex !== -1) {
				$el = jQuery(document.createElement('a'))
					.addClass('link-internal')
					.ariaClick({ one : true }, this.name === 'return'
						? () => Engine.play(passage)
						: () => Engine.goTo(momentIndex));
			}
			else {
				$el = jQuery(document.createElement('span'))
					.addClass('link-disabled');
			}

			$el
				.addClass(`macro-${this.name}`)
				.append($image || document.createTextNode(text || L10n.get(`macro${this.name.toUpperFirst()}Text`)))
				.appendTo(this.output);
		}
	});

	/*
		<<choice>>
	*/
	Macro.add('choice', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no passage specified');
			}

			const
				choiceId = State.passage;
			let
				passage,
				text,
				$image,
				setFn;

			if (this.args.length === 1) {
				if (typeof this.args[0] === 'object') {
					if (this.args[0].isImage) {
						// Argument was in wiki image syntax.
						$image = jQuery(document.createElement('img'))
							.attr('src', this.args[0].source);

						if (this.args[0].hasOwnProperty('passage')) {
							$image.attr('data-passage', this.args[0].passage);
						}

						if (this.args[0].hasOwnProperty('title')) {
							$image.attr('title', this.args[0].title);
						}

						if (this.args[0].hasOwnProperty('align')) {
							$image.attr('align', this.args[0].align);
						}

						passage = this.args[0].link;
						setFn   = this.args[0].setFn;
					}
					else {
						// Argument was in wiki link syntax.
						text    = this.args[0].text;
						passage = this.args[0].link;
						setFn   = this.args[0].setFn;
					}
				}
				else {
					// Argument was simply the passage name.
					text = passage = this.args[0];
				}
			}
			else {
				// Yes, the arguments are backwards.
				passage  = this.args[0];
				text = this.args[1];
			}

			if (!State.variables.hasOwnProperty('#choice')) {
				State.variables['#choice'] = {};
			}
			else if (
				   State.variables['#choice'].hasOwnProperty(choiceId)
				&& State.variables['#choice'][choiceId]
			) {
				jQuery(document.createElement('span'))
					.addClass(`link-disabled macro-${this.name}`)
					.attr('tabindex', -1)
					.append($image || document.createTextNode(text))
					.appendTo(this.output);
				return;
			}

			jQuery(Wikifier.createInternalLink(this.output, passage, null, () => {
				State.variables['#choice'][choiceId] = true;
				if (typeof setFn === 'function') {
					setFn();
				}
			}))
				.addClass(`macro-${this.name}`)
				.append($image || document.createTextNode(text));
		}
	});


	/*******************************************************************************************************************
	 * DOM Macros.
	 ******************************************************************************************************************/
	/*
		<<addclass>> & <<toggleclass>>
	*/
	Macro.add(['addclass', 'toggleclass'], {
		handler() {
			if (this.args.length < 2) {
				const errors = [];
				if (this.args.length < 1) { errors.push('selector'); }
				if (this.args.length < 2) { errors.push('class names'); }
				return this.error(`no ${errors.join(' or ')} specified`);
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			switch (this.name) {
			case 'addclass':
				$targets.addClass(this.args[1].trim());
				break;

			case 'toggleclass':
				$targets.toggleClass(this.args[1].trim());
				break;
			}
		}
	});

	/*
		<<removeclass>>
	*/
	Macro.add('removeclass', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no selector specified');
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			if (this.args.length > 1) {
				$targets.removeClass(this.args[1].trim());
			}
			else {
				$targets.removeClass();
			}
		}
	});

	/*
		<<copy>>
	*/
	Macro.add('copy', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no selector specified');
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			jQuery(this.output).append($targets.html());
		}
	});

	/*
		<<append>>, <<prepend>>, & <<replace>>
	*/
	Macro.add(['append', 'prepend', 'replace'], {
		tags : null,

		handler() {
			if (this.args.length === 0) {
				return this.error('no selector specified');
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			if (this.payload[0].contents !== '') {
				const frag = document.createDocumentFragment();
				new Wikifier(frag, this.payload[0].contents);

				switch (this.name) {
				case 'replace':
					$targets.empty();
					/* falls through */

				case 'append':
					$targets.append(frag);
					break;

				case 'prepend':
					$targets.prepend(frag);
					break;
				}
			}
			else if (this.name === 'replace') {
				$targets.empty();
			}
		}
	});

	/*
		<<remove>>
	*/
	Macro.add('remove', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no selector specified');
			}

			const $targets = jQuery(this.args[0]);

			if ($targets.length === 0) {
				return this.error(`no elements matched the selector "${this.args[0]}"`);
			}

			$targets.remove();
		}
	});


	/*******************************************************************************************************************
	 * Audio Macros.
	 ******************************************************************************************************************/
	if (Has.audio) {
		/*
			<<audio>>
		*/
		Macro.add('audio', {
			handler() {
				if (this.args.length < 2) {
					const errors = [];
					if (this.args.length < 1) { errors.push('track ID'); }
					if (this.args.length < 2) { errors.push('actions'); }
					return this.error(`no ${errors.join(' or ')} specified`);
				}

				const
					tracks   = Macro.get('cacheaudio').tracks,
					groupIds = [':all', ':looped', ':muted', ':paused', ':playing'],
					id       = String(this.args[0]).trim();

				if (!groupIds.includes(id) && !tracks.hasOwnProperty(id)) {
					return this.error(`track "${id}" does not exist`);
				}

				const
					args  = this.args.slice(1);
				let
					action,
					volume,
					mute,
					time,
					loop,
					fadeTo,
					fadeOver = 5,
					passage,
					raw;

				// Process arguments.
				while (args.length > 0) {
					const arg = args.shift();

					switch (arg) {
					case 'play':
					case 'pause':
					case 'stop':
						action = arg;
						break;

					case 'fadein':
						action = 'fade';
						fadeTo = 1;
						break;

					case 'fadeout':
						action = 'fade';
						fadeTo = 0;
						break;

					case 'fadeto':
						if (args.length === 0) {
							return this.error('fadeto missing required level value');
						}

						action = 'fade';
						raw = args.shift();
						fadeTo = Number.parseFloat(raw);

						if (Number.isNaN(fadeTo) || !Number.isFinite(fadeTo)) {
							return this.error(`cannot parse fadeto: ${raw}`);
						}
						break;

					case 'fadeoverto':
						if (args.length < 2) {
							const errors = [];
							if (args.length < 1) { errors.push('seconds'); }
							if (args.length < 2) { errors.push('level'); }
							return this.error(`fadeoverto missing required ${errors.join(' and ')} value${errors.length > 1 ? 's' : ''}`);
						}

						action = 'fade';
						raw = args.shift();
						fadeOver = Number.parseFloat(raw);

						if (Number.isNaN(fadeOver) || !Number.isFinite(fadeOver)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}

						raw = args.shift();
						fadeTo = Number.parseFloat(raw);

						if (Number.isNaN(fadeTo) || !Number.isFinite(fadeTo)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}
						break;

					case 'volume':
						if (args.length === 0) {
							return this.error('volume missing required level value');
						}

						raw = args.shift();
						volume = Number.parseFloat(raw);

						if (Number.isNaN(volume) || !Number.isFinite(volume)) {
							return this.error(`cannot parse volume: ${raw}`);
						}
						break;

					case 'mute':
					case 'unmute':
						mute = arg === 'mute';
						break;

					case 'time':
						if (args.length === 0) {
							return this.error('time missing required seconds value');
						}

						raw = args.shift();
						time = Number.parseFloat(raw);

						if (Number.isNaN(time) || !Number.isFinite(time)) {
							return this.error(`cannot parse time: ${raw}`);
						}
						break;

					case 'loop':
					case 'unloop':
						loop = arg === 'loop';
						break;

					case 'goto':
						if (args.length === 0) {
							return this.error('goto missing required passage title');
						}

						raw = args.shift();

						if (typeof raw === 'object') {
							// Argument was in wiki link syntax.
							passage = raw.link;
						}
						else {
							// Argument was simply the passage name.
							passage = raw;
						}

						if (!Story.has(passage)) {
							return this.error(`passage "${passage}" does not exist`);
						}
						break;

					default:
						return this.error(`unknown action: ${arg}`);
					}
				}

				let selected;

				switch (id) {
				case ':all':     selected = Object.keys(tracks); break;
				case ':looped':  selected = Object.keys(tracks).filter(id => tracks[id].isLooped()); break;
				case ':muted':   selected = Object.keys(tracks).filter(id => tracks[id].isMuted()); break;
				case ':paused':  selected = Object.keys(tracks).filter(id => tracks[id].isPaused()); break;
				case ':playing': selected = Object.keys(tracks).filter(id => tracks[id].isPlaying()); break;
				default:         selected = [id]; break;
				}

				try {
					selected.forEach(id => {
						const audio = tracks[id];

						if (volume != null) { // lazy equality for null
							audio.volume = volume;
						}

						if (time != null) { // lazy equality for null
							audio.time = time;
						}

						if (mute != null) { // lazy equality for null
							audio.mute = mute;
						}

						if (loop != null) { // lazy equality for null
							audio.loop = loop;
						}

						if (passage != null) { // lazy equality for null
							audio.one('end', () => Engine.play(passage)); // execute the callback once only
						}

						switch (action) {
						case 'play':
							audio.play();
							break;

						case 'pause':
							audio.pause();
							break;

						case 'stop':
							audio.stop();
							break;

						case 'fade':
							audio.fadeWithDuration(fadeOver, fadeTo);
							break;
						}
					});

					// Custom debug view setup.
					if (Config.debug) {
						this.createDebugView();
					}
				}
				catch (ex) {
					return this.error(`error executing audio action: ${ex.message}`);
				}
			}
		});

		/*
			<<cacheaudio track_id source_list>>
		*/
		Macro.add('cacheaudio', {
			tracks : {},

			handler() {
				if (this.args.length < 2) {
					const errors = [];
					if (this.args.length < 1) { errors.push('track ID'); }
					if (this.args.length < 2) { errors.push('sources'); }
					return this.error(`no ${errors.join(' or ')} specified`);
				}

				const
					id      = String(this.args[0]).trim(),
					badIdRe = /^:|\s/; // cannot start with a colon or contain whitespace

				if (badIdRe.test(id)) {
					return this.error(`invalid track ID "${id}": track IDs may not start with a colon or contain whitespace`);
				}

				const formatRe = /^format:\s*([\w-]+)\s*;\s*(\S.*)$/i;
				let track;

				try {
					track = SimpleAudio.create(this.args.slice(1).map(url => {
						const match = formatRe.exec(url);
						return match === null ? url : {
							format : match[1],
							src    : match[2]
						};
					}));
				}
				catch (ex) {
					return this.error(`error during track initialization for "${id}": ${ex.message}`);
				}

				// If in Test Mode and no supported sources were specified, return an error.
				if (Config.debug && !track.hasSource()) {
					return this.error(`no supported audio sources found for "${id}"`);
				}

				const tracks = this.self.tracks;

				// If a track by the given ID already exists, destroy it.
				if (tracks.hasOwnProperty(id)) {
					tracks[id].destroy();
				}

				/*
					Add the audio to the tracks cache.  We do this even if no valid sources were
					found to suppress errors for players.  The above Test Mode error should
					suffice for authors.
				*/
				tracks[id] = track;

				// Custom debug view setup.
				if (Config.debug) {
					this.createDebugView();
				}
			}
		});

		/*
			<<createplaylist list_id>>
				<<track track_id action_list>>
				…
			<</createplaylist>>
		*/
		Macro.add('createplaylist', {
			tags  : ['track'],
			lists : {},

			handler() {
				if (this.args.length === 0) {
					return this.error('no list ID specified');
				}

				const playlist = Macro.get('playlist');

				if (playlist.from !== null && playlist.from !== 'createplaylist') {
					return this.error('a playlist has already been defined with <<setplaylist>>');
				}

				const
					tracks  = Macro.get('cacheaudio').tracks,
					listId  = String(this.args[0]).trim(),
					badIdRe = /^:|\s/; // cannot start with a colon or contain whitespace

				if (badIdRe.test(listId)) {
					return this.error(`invalid list ID "${listId}": list IDs may not start with a colon or contain whitespace`);
				}

				if (this.payload.length === 1) {
					return this.error('no tracks defined via <<track>>');
				}

				// Initial debug view setup for `<<createplaylist>>`.
				if (Config.debug) {
					this.debugView
						.modes({
							nonvoid : false,
							hidden  : true
						});
				}

				const list = SimpleAudio.createList();

				for (let i = 1, len = this.payload.length; i < len; ++i) {
					if (this.payload[i].args.length < 2) {
						const errors = [];
						if (this.payload[i].args.length < 1) { errors.push('track ID'); }
						if (this.payload[i].args.length < 2) { errors.push('actions'); }
						return this.error(`no ${errors.join(' or ')} specified`);
					}

					const id = String(this.payload[i].args[0]).trim();

					if (!tracks.hasOwnProperty(id)) {
						return this.error(`track "${id}" does not exist`);
					}

					const
						args = this.payload[i].args.slice(1);
					let
						copy   = false,
						// rate,
						volume;

					// Process arguments.
					while (args.length > 0) {
						const arg = args.shift();
						let raw; // eslint-disable-line prefer-const

						switch (arg) {
						case 'copy':
							copy = true;
							break;

						case 'rate':
							if (args.length > 0) {
								args.shift();
							}
							break;
						// case 'rate':
						// 	if (args.length === 0) {
						// 		return this.error('rate missing required speed value');
						// 	}
						//
						// 	raw = args.shift();
						// 	rate = Number.parseFloat(raw);
						//
						// 	if (Number.isNaN(rate) || !Number.isFinite(rate)) {
						// 		return this.error(`cannot parse rate: ${raw}`);
						// 	}
						// 	break;

						case 'volume':
							if (args.length === 0) {
								return this.error('volume missing required level value');
							}

							raw = args.shift();
							volume = Number.parseFloat(raw);

							if (Number.isNaN(volume) || !Number.isFinite(volume)) {
								return this.error(`cannot parse volume: ${raw}`);
							}
							break;

						default:
							return this.error(`unknown action: ${arg}`);
						}
					}

					const track = tracks[id];
					list.add({
						copy,
						// rate,
						track,
						volume : volume != null ? volume : track.volume
					});

					// Custom debug view setup for the current `<<track>>`.
					if (Config.debug) {
						this
							.createDebugView(this.payload[i].name, this.payload[i].source)
							.modes({
								nonvoid : false,
								hidden  : true
							});
					}
				}

				const lists = this.self.lists;

				// If a playlist by the given ID already exists, destroy it.
				if (lists.hasOwnProperty(listId)) {
					lists[listId].destroy();
				}

				// Add the new playlist to the cache.
				lists[listId] = list;

				// Lock `<<playlist>>` into our syntax.
				if (playlist.from === null) {
					playlist.from = 'createplaylist';
				}

				// Custom fake debug view setup for `<</createplaylist>>`.
				this
					.createDebugView(`/${this.name}`, `<</${this.name}>>`)
					.modes({
						nonvoid : false,
						hidden  : true
					});
			}
		});

		/*
			<<masteraudio action_list>>
		*/
		Macro.add('masteraudio', {
			handler() {
				if (this.args.length === 0) {
					return this.error('no actions specified');
				}

				const
					args = this.args.slice(0);
				let
					stop   = false,
					mute,
					volume;

				// Process arguments.
				while (args.length > 0) {
					const arg = args.shift();
					let raw; // eslint-disable-line prefer-const

					switch (arg) {
					case 'stop':
						stop = true;
						break;

					case 'mute':
					case 'unmute':
						mute = arg === 'mute';
						break;

					case 'volume':
						if (args.length === 0) {
							return this.error('volume missing required level value');
						}

						raw = args.shift();
						volume = Number.parseFloat(raw);

						if (Number.isNaN(volume) || !Number.isFinite(volume)) {
							return this.error(`cannot parse volume: ${raw}`);
						}
						break;

					default:
						return this.error(`unknown action: ${arg}`);
					}
				}

				try {
					if (mute != null) { // lazy equality for null
						SimpleAudio.mute = mute;
					}

					if (volume != null) { // lazy equality for null
						SimpleAudio.volume = volume;
					}

					if (stop) {
						SimpleAudio.stop();
					}

					// Custom debug view setup.
					if (Config.debug) {
						this.createDebugView();
					}
				}
				catch (ex) {
					return this.error(`error executing master audio action: ${ex.message}`);
				}
			}
		});

		/*
			<<playlist list_id action_list>>  ← <<createplaylist>> syntax
			<<playlist action_list>>          ← <<setplaylist>> syntax
		*/
		Macro.add('playlist', {
			from : null,

			handler() {
				const from = this.self.from;

				if (from === null) {
					return this.error('no playlists have been created');
				}

				let list, args;

				if (from === 'createplaylist') {
					if (this.args.length < 2) {
						const errors = [];
						if (this.args.length < 1) { errors.push('list ID'); }
						if (this.args.length < 2) { errors.push('actions'); }
						return this.error(`no ${errors.join(' or ')} specified`);
					}

					const
						lists = Macro.get('createplaylist').lists,
						id    = String(this.args[0]).trim();

					if (!lists.hasOwnProperty(id)) {
						return this.error(`playlist "${id}" does not exist`);
					}

					list = lists[id];
					args = this.args.slice(1);
				}
				else {
					if (this.args.length === 0) {
						return this.error('no actions specified');
					}

					list = Macro.get('setplaylist').list;
					args = this.args.slice(0);
				}

				let
					action,
					volume,
					mute,
					loop,
					shuffle,
					fadeTo,
					fadeOver = 5,
					raw;

				// Process arguments.
				while (args.length > 0) {
					const arg = args.shift();

					switch (arg) {
					case 'play':
					case 'pause':
					case 'stop':
					case 'skip':
						action = arg;
						break;

					case 'fadein':
						action = 'fade';
						fadeTo = 1;
						break;

					case 'fadeout':
						action = 'fade';
						fadeTo = 0;
						break;

					case 'fadeto':
						if (args.length === 0) {
							return this.error('fadeto missing required level value');
						}

						action = 'fade';
						raw = args.shift();
						fadeTo = Number.parseFloat(raw);

						if (Number.isNaN(fadeTo) || !Number.isFinite(fadeTo)) {
							return this.error(`cannot parse fadeto: ${raw}`);
						}
						break;

					case 'fadeoverto':
						if (args.length < 2) {
							const errors = [];
							if (args.length < 1) { errors.push('seconds'); }
							if (args.length < 2) { errors.push('level'); }
							return this.error(`fadeoverto missing required ${errors.join(' and ')} value${errors.length > 1 ? 's' : ''}`);
						}

						action = 'fade';
						raw = args.shift();
						fadeOver = Number.parseFloat(raw);

						if (Number.isNaN(fadeOver) || !Number.isFinite(fadeOver)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}

						raw = args.shift();
						fadeTo = Number.parseFloat(raw);

						if (Number.isNaN(fadeTo) || !Number.isFinite(fadeTo)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}
						break;

					case 'volume':
						if (args.length === 0) {
							return this.error('volume missing required level value');
						}

						raw = args.shift();
						volume = Number.parseFloat(raw);

						if (Number.isNaN(volume) || !Number.isFinite(volume)) {
							return this.error(`cannot parse volume: ${raw}`);
						}
						break;

					case 'mute':
					case 'unmute':
						mute = arg === 'mute';
						break;

					case 'loop':
					case 'unloop':
						loop = arg === 'loop';
						break;

					case 'shuffle':
					case 'unshuffle':
						shuffle = arg === 'shuffle';
						break;

					default:
						return this.error(`unknown action: ${arg}`);
					}
				}

				try {
					if (volume != null) { // lazy equality for null
						list.volume = volume;
					}

					if (mute != null) { // lazy equality for null
						list.mute = mute;
					}

					if (loop != null) { // lazy equality for null
						list.loop = loop;
					}

					if (shuffle != null) { // lazy equality for null
						list.shuffle = shuffle;
					}

					switch (action) {
					case 'play':
						list.play();
						break;

					case 'pause':
						list.pause();
						break;

					case 'stop':
						list.stop();
						break;

					case 'skip':
						list.skip();
						break;

					case 'fade':
						list.fadeWithDuration(fadeOver, fadeTo);
						break;
					}

					// Custom debug view setup.
					if (Config.debug) {
						this.createDebugView();
					}
				}
				catch (ex) {
					return this.error(`error playing audio: ${ex.message}`);
				}
			}
		});

		/*
			<<removeplaylist list_id>>
		*/
		Macro.add('removeplaylist', {
			handler() {
				if (this.args.length === 0) {
					return this.error('no list ID specified');
				}

				const
					lists = Macro.get('createplaylist').lists,
					id    = String(this.args[0]).trim();

				if (!lists.hasOwnProperty(id)) {
					return this.error(`playlist "${id}" does not exist`);
				}

				lists[id].destroy();
				delete lists[id];

				// Custom debug view setup.
				if (Config.debug) {
					this.createDebugView();
				}
			}
		});

		/*
			<<waitforaudio>>
		*/
		Macro.add('waitforaudio', {
			skipArgs : true,
			queue    : [],

			handler() {
				const queue = this.self.queue;

				if (queue.length > 0) {
					return;
				}

				function processQueue() {
					if (queue.length === 0) {
						return LoadScreen.unlock();
					}

					const nextTrack = queue.shift();

					if (nextTrack.hasData()) {
						return processQueue();
					}

					nextTrack
						.one('canplay.waitforaudio error.waitforaudio', function () { // do not use an arrow function
							jQuery(this).off('.waitforaudio');
							processQueue();
						})
						.load();
				}

				this.self.fillQueue(queue);

				if (queue.length > 0) {
					LoadScreen.lock();
					processQueue();
				}
			},

			fillQueue(queue) {
				// Gather all tracks from `<<cacheaudio>>`.
				const tracks = Macro.get('cacheaudio').tracks;
				Object.keys(tracks).forEach(id => queue.push(tracks[id]));

				// Gather copied tracks from `<<createplaylist>>`.
				const lists = Macro.get('createplaylist').lists;
				Object.keys(lists)
					.map(id => lists[id].tracks)
					.flatten()
					.filter(trackObj => trackObj.copy)
					.forEach(trackObj => queue.push(trackObj.track));

				/*
					Gather all tracks from `<<setplaylist>>`, since they're all copies.

					NOTE: `<<setplaylist>>` is deprecated, so don't assume that it exists.
				*/
				if (Macro.has('setplaylist')) {
					const list = Macro.get('setplaylist').list;

					if (list !== null) {
						list.tracks.forEach(trackObj => queue.push(trackObj.track));
					}
				}
			}
		});

		/*
			NOTE: This macro is deprecated.

			<<setplaylist track_id_list>>
		*/
		Macro.add('setplaylist', {
			list : null,

			handler() {
				if (this.args.length === 0) {
					return this.error('no track ID(s) specified');
				}

				const playlist = Macro.get('playlist');

				if (playlist.from !== null && playlist.from !== 'setplaylist') {
					return this.error('playlists have already been defined with <<createplaylist>>');
				}

				const
					self   = this.self,
					tracks = Macro.get('cacheaudio').tracks;

				// If a playlist already exists, destroy it.
				if (self.list !== null) {
					self.list.destroy();
				}

				// Create the new playlist.
				self.list = SimpleAudio.createList();

				for (let i = 0; i < this.args.length; ++i) {
					const id = this.args[i];

					if (!tracks.hasOwnProperty(id)) {
						return this.error(`track "${id}" does not exist`);
					}

					self.list.add(tracks[id]);
				}

				// Lock `<<playlist>>` into our syntax.
				if (playlist.from === null) {
					playlist.from = 'setplaylist';
				}

				// Custom debug view setup.
				if (Config.debug) {
					this.createDebugView();
				}
			}
		});

		/*
			NOTE: This macro is deprecated.

			<<stopallaudio>>
		*/
		Macro.add('stopallaudio', {
			skipArgs : true,

			handler() {
				const tracks = Macro.get('cacheaudio').tracks;
				Object.keys(tracks).forEach(id => tracks[id].stop());

				// Custom debug view setup.
				if (Config.debug) {
					this.createDebugView();
				}
			}
		});
	}
	else {
		/* The HTML5 <audio> API appears to be missing or disabled, setup no-op macros. */
		Macro.add([
			'audio',
			'cacheaudio',
			'createplaylist',
			'masteraudio',
			'playlist',
			'removeplaylist',
			'waitforaudio',

			// Deprecated.
			'setplaylist',
			'stopallaudio'
		], {
			skipArgs : true,

			handler() { /* empty */ }
		});
	}


	/*******************************************************************************************************************
	 * Miscellaneous Macros.
	 ******************************************************************************************************************/
	/*
		<<goto>>
	*/
	Macro.add('goto', {
		handler() {
			if (this.args.length === 0) {
				return this.error('no passage specified');
			}

			let passage;

			if (typeof this.args[0] === 'object') {
				// Argument was in wiki link syntax.
				passage = this.args[0].link;
			}
			else {
				// Argument was simply the passage name.
				passage = this.args[0];
			}

			if (!Story.has(passage)) {
				return this.error(`passage "${passage}" does not exist`);
			}

			/*
				Call `Engine.play()`.

				NOTE: This does not terminate the current Wikifier call chain, though, ideally,
				      it probably should.  Doing so would not be trivial, however, and there's
				      also the question of whether that behavior would be unwanted by users, who
				      are used to the current behavior from similar macros and constructs.
			*/
			setTimeout(() => Engine.play(passage), Engine.minDomActionDelay);
		}
	});

	/*
		<<timed>> & <<next>>
	*/
	Macro.add('timed', {
		tags   : ['next'],
		timers : new Set(),

		handler() {
			if (this.args.length === 0) {
				return this.error('no time value specified in <<timed>>');
			}

			const items = [];

			try {
				items.push({
					name    : this.name,
					source  : this.source,
					delay   : Math.max(Engine.minDomActionDelay, Util.fromCssTime(this.args[0])),
					content : this.payload[0].contents
				});
			}
			catch (ex) {
				return this.error(`${ex.message} in <<timed>>`);
			}

			if (this.payload.length > 1) {
				let i;

				try {
					let len;

					for (i = 1, len = this.payload.length; i < len; ++i) {
						items.push({
							name   : this.payload[i].name,
							source : this.payload[i].source,
							delay  : this.payload[i].args.length === 0
								? items[items.length - 1].delay
								: Math.max(Engine.minDomActionDelay, Util.fromCssTime(this.payload[i].args[0])),
							content : this.payload[i].contents
						});
					}
				}
				catch (ex) {
					return this.error(`${ex.message} in <<next>> (#${i})`);
				}
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			// Register the timer and, possibly, a cleanup task.
			this.self.registerTimeout(
				jQuery(document.createElement('span'))
					.addClass(`macro-${this.name}`)
					.appendTo(this.output),
				items,
				this.args.length > 1 && /^(?:transition|t8n)$/.test(this.args[1])
			);
		},

		registerTimeout($output, items, transition) {
			const
				turnId   = State.turns,
				timers   = this.timers;
			let
				timerId  = null,
				nextItem = items.shift();

			const worker = function () {
				/*
					1. Bookkeeping.
				*/
				timers.delete(timerId);

				if (turnId !== State.turns) {
					return;
				}

				/*
					2. Set the current item and setup the next worker, if any.
				*/
				const curItem = nextItem;

				if ((nextItem = items.shift()) != null) { // lazy equality for null
					timerId = setTimeout(worker, nextItem.delay);
					timers.add(timerId);
				}

				/*
					3. Wikify the content last to reduce temporal drift.
				*/
				const frag = document.createDocumentFragment();
				new Wikifier(frag, curItem.content);

				/*
					4. Output.
				*/
				// Custom debug view setup for `<<next>>`.
				if (Config.debug && curItem.name === 'next') {
					$output = jQuery((new DebugView( // eslint-disable-line no-param-reassign
						$output[0],
						'macro',
						curItem.name,
						curItem.source
					)).output);
				}

				if (transition) {
					$output = jQuery(document.createElement('span')) // eslint-disable-line no-param-reassign
						.addClass('macro-timed-insert macro-timed-in')
						.appendTo($output);
				}

				$output.append(frag);

				if (transition) {
					setTimeout(() => $output.removeClass('macro-timed-in'), Engine.minDomActionDelay);
				}
			};

			// Setup the timeout.
			timerId = setTimeout(worker, nextItem.delay);
			timers.add(timerId);

			// Setup a single-use `prehistory` task to remove pending timers.
			if (!prehistory.hasOwnProperty('#timed-timers-cleanup')) {
				prehistory['#timed-timers-cleanup'] = task => {
					timers.forEach(timerId => clearTimeout(timerId)); // eslint-disable-line no-shadow
					timers.clear();
					delete prehistory[task]; // single-use task
				};
			}
		}
	});

	/*
		<<repeat>> & <<stop>>
	*/
	Macro.add('repeat', {
		tags   : null,
		timers : new Set(),

		handler() {
			if (this.args.length === 0) {
				return this.error('no time value specified');
			}

			let	delay;

			try {
				delay = Math.max(Engine.minDomActionDelay, Util.fromCssTime(this.args[0]));
			}
			catch (ex) {
				return this.error(ex.message);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ block : true });
			}

			// Register the timer and, possibly, a cleanup task.
			this.self.registerInterval(
				jQuery(document.createElement('span'))
					.addClass(`macro-${this.name}`)
					.appendTo(this.output),
				this.payload[0].contents,
				delay,
				this.args.length > 1 && /^(?:transition|t8n)$/.test(this.args[1])
			);
		},

		registerInterval($output, content, delay, transition) {
			const
				turnId  = State.turns,
				timers  = this.timers;
			let
				timerId = null;

			// Setup the interval.
			timerId = setInterval(() => {
				// Terminate the timer if the turn IDs do not match.
				if (turnId !== State.turns) {
					clearInterval(timerId);
					timers.delete(timerId);
					return;
				}

				let timerIdCache;
				/*
					There's no catch clause because this try/finally is here simply to ensure that
					proper cleanup is done in the event that an exception is thrown during the
					`Wikifier` call.
				*/
				try {
					TempState.break = null;

					// Setup the `repeatTimerId` value, caching the existing value, if necessary.
					if (TempState.hasOwnProperty('repeatTimerId')) {
						timerIdCache = TempState.repeatTimerId;
					}
					TempState.repeatTimerId = timerId;

					// Wikify the content.
					const frag = document.createDocumentFragment();
					new Wikifier(frag, content);

					if (transition) {
						$output = jQuery(document.createElement('span')) // eslint-disable-line no-param-reassign
							.addClass('macro-repeat-insert macro-repeat-in')
							.appendTo($output);
					}

					$output.append(frag);

					if (transition) {
						setTimeout(() => $output.removeClass('macro-repeat-in'), Engine.minDomActionDelay);
					}
				}
				finally {
					// Teardown the `repeatTimerId` property, restoring the cached value, if necessary.
					if (typeof timerIdCache !== 'undefined') {
						TempState.repeatTimerId = timerIdCache;
					}
					else {
						delete TempState.repeatTimerId;
					}

					TempState.break = null;
				}
			}, delay);
			timers.add(timerId);

			// Setup a single-use `prehistory` task to remove pending timers.
			if (!prehistory.hasOwnProperty('#repeat-timers-cleanup')) {
				prehistory['#repeat-timers-cleanup'] = task => {
					timers.forEach(timerId => clearInterval(timerId));
					timers.clear();
					delete prehistory[task]; // single-use task
				};
			}
		}
	});
	Macro.add('stop', {
		skipArgs : true,

		handler() {
			if (!TempState.hasOwnProperty('repeatTimerId')) {
				return this.error('must only be used in conjunction with its parent macro <<repeat>>');
			}

			const
				timers  = Macro.get('repeat').timers,
				timerId = TempState.repeatTimerId;
			clearInterval(timerId);
			timers.delete(timerId);
			TempState.break = 2;

			// Custom debug view setup.
			if (Config.debug) {
				this.debugView.modes({ hidden : true });
			}
		}
	});

	/*
		<<widget>>
	*/
	Macro.add('widget', {
		tags : null,

		handler() {
			if (this.args.length === 0) {
				return this.error('no widget name specified');
			}

			const widgetName = this.args[0];

			if (Macro.has(widgetName)) {
				if (!Macro.get(widgetName).isWidget) {
					return this.error(`cannot clobber existing macro "${widgetName}"`);
				}

				// Delete the existing widget.
				Macro.delete(widgetName);
			}

			try {
				Macro.add(widgetName, {
					isWidget : true,
					handler  : (function (contents) {
						return function () {
							let argsCache;

							try {
								// Setup the `$args` variable, caching the existing value if necessary.
								if (State.variables.hasOwnProperty('args')) {
									argsCache = State.variables.args;
								}

								State.variables.args = [];

								for (let i = 0, len = this.args.length; i < len; ++i) {
									State.variables.args[i] = this.args[i];
								}

								State.variables.args.raw = this.args.raw;
								State.variables.args.full = this.args.full;

								// Setup the error trapping variables.
								const
									resFrag = document.createDocumentFragment(),
									errList = [];

								// Wikify the widget contents.
								new Wikifier(resFrag, contents);

								// Carry over the output, unless there were errors.
								Array.from(resFrag.querySelectorAll('.error')).forEach(errEl => {
									errList.push(errEl.textContent);
								});

								if (errList.length === 0) {
									this.output.appendChild(resFrag);
								}
								else {
									return this.error(`error${errList.length > 1 ? 's' : ''} within widget contents (${errList.join('; ')})`);
								}
							}
							catch (ex) {
								return this.error(`cannot execute widget: ${ex.message}`);
							}
							finally {
								// Teardown the `$args` variable, restoring the cached value if necessary.
								if (typeof argsCache !== 'undefined') {
									State.variables.args = argsCache;
								}
								else {
									delete State.variables.args;
								}
							}
						};
					})(this.payload[0].contents)
				});

				// Custom debug view setup.
				if (Config.debug) {
					this.createDebugView(
						this.name,
						`${this.source + this.payload[0].contents}<</${this.name}>>`
					);
				}
			}
			catch (ex) {
				return this.error(`cannot create widget macro "${widgetName}": ${ex.message}`);
			}
		}
	});
})();
