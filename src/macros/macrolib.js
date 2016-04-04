/***********************************************************************************************************************
 *
 * macros/macrolib.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Config, AudioWrapper, DebugView, Engine, Has, Macro, Scripting, State, Story, TempState, TempVariables,
	       Util, Wikifier, postdisplay, prehistory, toStringOrDefault, storage, strings
*/

(() => {
	'use strict';

	/*******************************************************************************************************************
	 * Utility Functions.
	 ******************************************************************************************************************/
	function _getWikifyEvalHandler(content, widgetArgs, callback) {
		return function () {
			if (content !== '') {
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

					// Wikify the content and discard any output, unless there were errors.
					Wikifier.wikifyEval(content);
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

			// Call the given callback function, if any.
			if (typeof callback === 'function') {
				callback.call(this);
			}
		};
	}


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
					((p, fn) => () => {
						State.variables['#actions'][p] = true;
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
				.append($image || document.createTextNode(text || strings.macros[this.name].text))
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
			catch (e) {
				return this.error(`bad evaluation: ${e.message}`);
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
						if (this.payload[i].args.raw.length > 0) {
							if (/^\s*if\b/i.test(this.payload[i].args.raw)) {
								return this.error(
									  'whitespace is not allowed between the "else" and "if" in <<elseif>> clause'
									+ (i > 0 ? ' (#' + i + ')' : '')
								);
							}

							return this.error(
								  '<<else>> does not accept a conditional expression'
								+ ' (perhaps you meant to use <<elseif>>),'
								+ ` invalid: ${this.payload[i].args.raw}`
							);
						}
						break;

					default:
						if (this.payload[i].args.full.length === 0) {
							return this.error(
								  `no conditional expression specified for <<${this.payload[i].name}>> clause`
								+ (i > 0 ? ' (#' + i + ')' : '')
							);
						}
						else if (
							   Config.macros.ifAssignmentError
							&& /[^!=&^|<>*/%+-]=[^=]/.test(this.payload[i].args.full)
						) {
							return this.error(
								  `assignment operator found within <<${this.payload[i].name}>> clause`
								+ (i > 0 ? ' (#' + i + ')' : '')
								+ ' (perhaps you meant to use an equality operator: ==, ===, eq, is),'
								+ ` invalid: ${this.payload[i].args.raw}`
							);
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
			catch (e) {
				return this.error(`bad conditional expression in <<${i === 0 ? 'if' : 'elseif'}>> clause`
					+ `${i > 0 ? ' (#' + i + ')' : ''}: ${e.message}`); // eslint-disable-line prefer-template
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
					catch (e) {
						return this.error(`bad init expression: ${e.message}`);
					}
				}

				while (evalJavaScript(condition)) {
					if (--safety < 0) {
						return this.error('exceeded configured maximum loop iterations'
							+ ` (${Config.macros.maxLoopIterations})`);
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
						catch (e) {
							return this.error(`bad post expression: ${e.message}`);
						}
					}
				}
			}
			catch (e) {
				return this.error(`bad conditional expression: ${e.message}`);
			}
			finally {
				TempState.break = null;
			}
		}
	});
	Macro.add(['break', 'continue'], {
		skipArgs : true,

		handler() {
			if (this.contextHas(c => c.name === 'for')) {
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
			catch (e) {
				return this.error(`bad evaluation: ${e.message}`);
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
			catch (e) {
				return this.error(`bad evaluation: ${e.message}`);
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
			catch (e) {
				return this.error(
					`bad evaluation: ${e.message}`,
					`${this.source + this.payload[0].contents}<</${this.name}>>`
				);
			}

			if (output.hasChildNodes()) {
				this.output.appendChild(output);
			}
		}
	});


	/*******************************************************************************************************************
	 * Interactive Macros.
	 ******************************************************************************************************************/
	/*
		<<button>> & <<click>>
	*/
	Macro.add(['button', 'click'], {
		tags : null,

		handler() {
			if (this.args.length === 0) {
				return this.error(`no ${this.name === 'click' ? 'link' : 'button'} text specified`);
			}

			// Custom debug view setup.
			if (Config.debug) {
				this.createDebugView(
					this.name,
					`${this.source + this.payload[0].contents}<</${this.name}>>`
				);
			}

			const
				$el        = jQuery(document.createElement(this.name === 'click' ? 'a' : 'button')),
				widgetArgs = (() => {
					let wargs;
					if (
						   State.variables.hasOwnProperty('args')
						&& this.contextHas(c => c.self.isWidget)
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
						.appendTo($el);

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
					$el.append(document.createTextNode(this.args[0].text));
					passage = this.args[0].link;
				}
			}
			else {
				// Argument was simply the link text.
				$el.append(document.createTextNode(this.args[0]));
				passage = this.args.length > 1 ? this.args[1] : undefined;
			}

			if (passage != null) { // lazy equality for null
				$el.attr('data-passage', passage);
				if (Story.has(passage)) {
					$el.addClass('link-internal');
					if (Config.addVisitedLinkClass && State.has(passage)) {
						$el.addClass('link-visited');
					}
				}
				else {
					$el.addClass('link-broken');
				}
			}
			else {
				$el.addClass('link-internal');
			}

			$el
				.addClass(`macro-${this.name}`)
				.ariaClick({
					namespace : '.macros',
					one       : passage != null // lazy equality for null
				}, _getWikifyEvalHandler(
					this.payload[0].contents.trim(),
					widgetArgs,
					passage != null ? () => Engine.play(passage) : undefined // lazy equality for null
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
				.on('keypress', function (evt) {
					// If Return/Enter is pressed, set the story variable and, optionally, forward to another passage.
					if (evt.which === 13) { // 13 is Return/Enter
						evt.preventDefault();
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


	/*******************************************************************************************************************
	 * DOM (Classes) Macros.
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


	/*******************************************************************************************************************
	 * DOM (Content) Macros.
	 ******************************************************************************************************************/
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

			if (this.name === 'replace') {
				$targets.empty();
			}

			if (this.payload[0].contents !== '') {
				const frag = document.createDocumentFragment();
				new Wikifier(frag, this.payload[0].contents);

				switch (this.name) {
				case 'replace':
				case 'append':
					$targets.append(frag);
					break;

				case 'prepend':
					$targets.prepend(frag);
					break;
				}
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

				n.b. This does not terminate the current Wikifier call chain, though, ideally, it
				     probably should.  Doing so would not be trivial, however, and then there's the
				     question of whether that behavior would be unwanted by users, who are used to
				     the current behavior from similar macros and constructs.
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
			catch (e) {
				return this.error(`${e.message} in <<timed>>`);
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
				catch (e) {
					return this.error(`${e.message} in <<next>> (#${i})`);
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
			catch (e) {
				return this.error(e.message);
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
									return this.error(`error${errList.length > 1 ? 's' : ''} within`
										+ ` widget contents (${errList.join('; ')})`);
								}
							}
							catch (e) {
								return this.error(`cannot execute widget: ${e.message}`);
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
			catch (e) {
				return this.error(`cannot create widget macro "${widgetName}": ${e.message}`);
			}
		}
	});


	/*******************************************************************************************************************
	 * Audio Macros.
	 ******************************************************************************************************************/
	if (!Has.audio) {
		Macro.add(['audio', 'stopallaudio', 'cacheaudio', 'playlist', 'setplaylist'], {
			handler() { /* empty */ }
		});
	}
	else {
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
					tracks = Macro.get('cacheaudio').tracks,
					id     = this.args[0];

				if (!tracks.hasOwnProperty(id)) {
					return this.error(`no track by ID: ${id}`);
				}

				const
					audio = tracks[id],
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
						fadeTo = parseFloat(raw);

						if (isNaN(fadeTo) || !isFinite(fadeTo)) {
							return this.error(`cannot parse fadeto: ${raw}`);
						}
						break;

					case 'fadeoverto':
						if (args.length < 2) {
							const errors = [];
							if (args.length < 1) { errors.push('seconds'); }
							if (args.length < 2) { errors.push('level'); }
							return this.error(`fadeoverto missing required ${errors.join(' and ')}`
								+ ` value${errors.length > 1 ? 's' : ''}`);
						}

						action = 'fade';
						raw = args.shift();
						fadeOver = parseFloat(raw);

						if (isNaN(fadeOver) || !isFinite(fadeOver)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}

						raw = args.shift();
						fadeTo = parseFloat(raw);

						if (isNaN(fadeTo) || !isFinite(fadeTo)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}
						break;

					case 'volume':
						if (args.length === 0) {
							return this.error('volume missing required level value');
						}

						raw = args.shift();
						volume = parseFloat(raw);

						if (isNaN(volume) || !isFinite(volume)) {
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
						time = parseFloat(raw);

						if (isNaN(time) || !isFinite(time)) {
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

				try {
					if (volume != null) { // lazy equality for null
						audio.volume = volume;
					}

					if (time != null) { // lazy equality for null
						audio.time = time;
					}

					if (mute != null) { // lazy equality for null
						if (mute) {
							audio.mute();
						}
						else {
							audio.unmute();
						}
					}

					if (loop != null) { // lazy equality for null
						if (loop) {
							audio.loop();
						}
						else {
							audio.unloop();
						}
					}

					if (passage != null) { // lazy equality for null
						audio.oneEnd(() => Engine.play(passage)); // execute the callback once only
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
						if (audio.volume === fadeTo) {
							if (fadeTo === 0) {
								audio.volume = 1;
							}
							else if (fadeTo === 1) {
								audio.volume = 0;
							}
						}

						audio.fadeWithDuration(fadeOver, audio.volume, fadeTo);
						break;
					}

					// Custom debug view setup.
					if (Config.debug) {
						this.createDebugView();
					}
				}
				catch (e) {
					return this.error(`error playing audio: ${e.message}`);
				}
			}
		});

		/*
			<<stopallaudio>>
		*/
		Macro.add('stopallaudio', {
			handler() {
				const tracks = Macro.get('cacheaudio').tracks;
				Object.keys(tracks).forEach(id => tracks[id].stop());

				// Custom debug view setup.
				if (Config.debug) {
					this.createDebugView();
				}
			}
		});

		/*
			<<cacheaudio>>
		*/
		Macro.add('cacheaudio', {
			handler() {
				if (this.args.length < 2) {
					const errors = [];
					if (this.args.length < 1) { errors.push('track ID'); }
					if (this.args.length < 2) { errors.push('sources'); }
					return this.error(`no ${errors.join(' or ')} specified`);
				}

				const
					types   = this.self.types,
					canPlay = this.self.canPlay,
					/*
						Use `document.createElement("audio")` in favor of `new Audio()` as the
						latter is treated differently (i.e. unfavorably) in certain cases, chiefly
						in mobile browsers.
					*/
					audio   = document.createElement('audio'),
					id      = this.args[0],
					extRe   = this.self.extRe;

				for (let i = 1; i < this.args.length; ++i) {
					const
						url   = this.args[i],
						match = extRe.exec(url);

					if (match === null) {
						continue;
					}

					const
						ext  = match[1].toLowerCase(),
						type = types.hasOwnProperty(ext) ? types[ext] : `audio/${ext}`;

					// Determine and cache the `canPlay` status for the audio type.
					if (!canPlay.hasOwnProperty(type)) {
						// Some early implementations return 'no' instead of the empty string.
						canPlay[type] = audio.canPlayType(type).replace(/^no$/i, '') !== '';
					}

					if (canPlay[type]) {
						const source = document.createElement('source');
						source.src  = url;
						source.type = type;
						audio.appendChild(source);
					}
				}

				// If it contains any <source> elements, wrap the <audio> element and add it to the tracks.
				if (audio.hasChildNodes()) {
					audio.preload = 'auto';
					this.self.tracks[id] = new AudioWrapper(audio);
				}

				// Custom debug view setup.
				if (Config.debug) {
					this.createDebugView();
				}
			},

			extRe : /^.+?(?:\.([^\.\/\\]+?))$/,
			types : Object.freeze({
				/*
					Define the supported audio types via MIME-type (incl. the codecs property).

					n.b. Opera (Presto) will return a false-negative if the codecs value is quoted.
					     Opera (Blink) will return a false-negative for WAVE audio if the preferred
					     MIME-type of "audio/wave" is specified, instead "audio/wav" must be used.
				*/
				mp3  : 'audio/mpeg; codecs=mp3',
				ogg  : 'audio/ogg; codecs=vorbis',
				webm : 'audio/webm; codecs=vorbis',
				wav  : 'audio/wav; codecs=1'
			}),
			canPlay : {},
			tracks  : {}
		});

		/*
			<<playlist>>
		*/
		Macro.add('playlist', {
			handler() {
				if (this.args.length === 0) {
					return this.error('no actions specified');
				}

				const
					self = this.self,
					args = this.args.slice(0);
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
						fadeTo = parseFloat(raw);

						if (isNaN(fadeTo) || !isFinite(fadeTo)) {
							return this.error(`cannot parse fadeto: ${raw}`);
						}
						break;

					case 'fadeoverto':
						if (args.length < 2) {
							const errors = [];
							if (args.length < 1) { errors.push('seconds'); }
							if (args.length < 2) { errors.push('level'); }
							return this.error(`fadeoverto missing required ${errors.join(' and ')}`
								+ ` value${errors.length > 1 ? 's' : ''}`);
						}

						action = 'fade';
						raw = args.shift();
						fadeOver = parseFloat(raw);

						if (isNaN(fadeOver) || !isFinite(fadeOver)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}

						raw = args.shift();
						fadeTo = parseFloat(raw);

						if (isNaN(fadeTo) || !isFinite(fadeTo)) {
							return this.error(`cannot parse fadeoverto: ${raw}`);
						}
						break;

					case 'volume':
						if (args.length === 0) {
							return this.error('volume missing required level value');
						}

						raw = args.shift();
						volume = parseFloat(raw);

						if (isNaN(volume) || !isFinite(volume)) {
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
						self.setVolume(volume);
					}

					if (mute != null) { // lazy equality for null
						self.muted = mute;

						if (mute) {
							self.mute();
						}
						else {
							self.unmute();
						}
					}

					if (loop != null) { // lazy equality for null
						self.loop = loop;
					}

					if (shuffle != null) { // lazy equality for null
						self.shuffle = shuffle;
						self.buildList();
					}

					switch (action) {
					case 'play':
						self.play();
						break;

					case 'pause':
						self.pause();
						break;

					case 'stop':
						self.stop();
						break;

					case 'fade':
						if (self.volume === fadeTo) {
							if (fadeTo === 0) {
								self.setVolume(1);
							}
							else if (fadeTo === 1) {
								self.setVolume(0);
							}
						}

						self.fade(fadeOver, fadeTo);
						break;
					}

					// Custom debug view setup.
					if (Config.debug) {
						this.createDebugView();
					}
				}
				catch (e) {
					return this.error(`error playing audio: ${e.message}`);
				}
			},

			play() {
				if (this.list.length === 0) {
					this.buildList();
				}

				if (this.current === null || this.current.isEnded()) {
					this.next();
				}

				this.current.play();
			},

			pause() {
				if (this.current !== null) {
					this.current.pause();
				}
			},

			stop() {
				if (this.current !== null) {
					this.current.stop();
				}
			},

			fade(over, to) {
				if (this.list.length === 0) {
					this.buildList();
				}

				if (this.current === null || this.current.isEnded()) {
					this.next();
				}
				else {
					this.current.volume = this.volume;
				}

				this.current.fadeWithDuration(over, this.current.volume, to);
				this.volume = to; // kludgey, but necessary
			},

			mute() {
				if (this.current !== null) {
					this.current.mute();
				}
			},

			unmute() {
				if (this.current !== null) {
					this.current.unmute();
				}
			},

			next() {
				this.current = this.list.shift();
				this.current.volume = this.volume;
			},

			setVolume(vol) {
				this.volume = vol;

				if (this.current !== null) {
					this.current.volume = vol;
				}
			},

			onEnd() {
				const _this = Macro.get('playlist');

				if (_this.list.length === 0) {
					if (!_this.loop) {
						return;
					}

					_this.buildList();
				}

				_this.next();

				if (_this.muted) {
					_this.mute();
				}

				_this.current.play();
			},

			buildList() {
				this.list = this.tracks.slice(0);

				if (this.shuffle) {
					this.list.shuffle();

					// Try not to immediately replay the last track when shuffling.
					if (this.list.length > 1 && this.list[0] === this.current) {
						this.list.push(this.list.shift());
					}
				}
			},

			tracks  : [],
			list    : [],
			current : null,
			volume  : 1,
			muted   : false,
			loop    : true,
			shuffle : false
		});

		/*
			<<setplaylist>>
		*/
		Macro.add('setplaylist', {
			handler() {
				if (this.args.length === 0) {
					return this.error('no track ID(s) specified');
				}

				const
					tracks   = Macro.get('cacheaudio').tracks,
					playlist = Macro.get('playlist'),
					list     = [];

				for (let i = 0; i < this.args.length; ++i) {
					const id = this.args[i];

					if (!tracks.hasOwnProperty(id)) {
						return this.error(`no track by ID: ${id}`);
					}

					const track = tracks[id].clone();
					track.stop();
					track.unloop();
					track.unmute();
					track.volume = 1;
					jQuery(track.audio)
						.off('ended')
						.on('ended.macros:playlist', playlist.onEnd);
					list.push(track);
				}

				if (playlist.current !== null) {
					playlist.current.pause();
				}

				playlist.tracks  = list;
				playlist.list    = [];
				playlist.current = null;
				playlist.volume  = 1;
				playlist.muted   = false;
				playlist.loop    = true;
				playlist.shuffle = false;

				// Custom debug view setup.
				if (Config.debug) {
					this.createDebugView();
				}
			}
		});
	}
})();
