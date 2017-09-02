/***********************************************************************************************************************

	markup/parserlib.js

	Copyright © 2013–2017 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global Config, DebugView, Engine, Macro, MacroContext, Patterns, Scripting, State, Story, Wikifier,
	       toStringOrDefault, throwError
*/
/* eslint "no-param-reassign": [ 2, { "props" : false } ] */

(() => {
	'use strict';

	/*******************************************************************************************************************
		Parsers.
	*******************************************************************************************************************/
	Wikifier.Parser.add({
		name       : 'quoteByBlock',
		profiles   : ['block'],
		match      : '^<<<\\n',
		terminator : '^<<<\\n',

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			w.subWikify(
				jQuery(document.createElement('blockquote'))
					.appendTo(w.output)
					.get(0),
				this.terminator
			);
		}
	});

	Wikifier.Parser.add({
		name       : 'quoteByLine',
		profiles   : ['block'],
		match      : '^>+',
		lookahead  : /^>+/gm,
		terminator : '\\n',

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			const destStack = [w.output];
			let curLevel = 0;
			let newLevel = w.matchLength;
			let matched;
			let i;

			do {
				if (newLevel > curLevel) {
					for (i = curLevel; i < newLevel; ++i) {
						destStack.push(
							jQuery(document.createElement('blockquote'))
								.appendTo(destStack[destStack.length - 1])
								.get(0)
						);
					}
				}
				else if (newLevel < curLevel) {
					for (i = curLevel; i > newLevel; --i) {
						destStack.pop();
					}
				}

				curLevel = newLevel;
				w.subWikify(destStack[destStack.length - 1], this.terminator);
				jQuery(document.createElement('br')).appendTo(destStack[destStack.length - 1]);

				this.lookahead.lastIndex = w.nextMatch;

				const match = this.lookahead.exec(w.source);

				matched = match && match.index === w.nextMatch;

				if (matched) {
					newLevel = match[0].length;
					w.nextMatch += match[0].length;
				}
			} while (matched);
		}
	});

	Wikifier.Parser.add({
		name        : 'macro',
		profiles    : ['core'],
		match       : '<<',
		lookahead   : new RegExp(`<<(/?${Patterns.macroName})(?:\\s*)((?:(?:"(?:\\\\.|[^"\\\\])*")|(?:'(?:\\\\.|[^'\\\\])*')|(?:\\[(?:[<>]?[Ii][Mm][Gg])?\\[[^\\r\\n]*?\\]\\]+)|[^>]|(?:>(?!>)))*)>>`, 'gm'),
		argsPattern : [
			'(``)',                                             // 1=Empty backticks
			'`((?:\\\\.|[^`\\\\])+)`',                          // 2=Backticked, non-empty
			'(""|\'\')',                                        // 3=Empty quotes
			'("(?:\\\\.|[^"\\\\])+")',                          // 4=Double quoted, non-empty
			"('(?:\\\\.|[^'\\\\])+')",                          // 5=Single quoted, non-empty
			'(\\[(?:[<>]?[Ii][Mm][Gg])?\\[[^\\r\\n]*?\\]\\]+)', // 6=Double square-bracketed
			'([^`"\'\\s]+)',                                    // 7=Barewords
			'(`|"|\')'                                          // 8=Unterminated backticks and quotes
		].join('|'),
		working : { source : '', name : '', arguments : '', index : 0 }, // the working parse object
		context : null, // last execution context object (top-level macros, hierarchically, have a null context)

		handler(w) {
			const matchStart = this.lookahead.lastIndex = w.matchStart;

			if (this.parseTag(w)) {
				/*
					If `parseBody()` is called below, it will modify the current working
					values, so we must cache them now.
				*/
				const nextMatch = w.nextMatch;
				const source    = this.working.source;
				const name      = this.working.name;
				const rawArgs   = this.working.arguments;
				let macro;

				try {
					macro = Macro.get(name);

					if (macro) {
						let payload = null;

						if (macro.hasOwnProperty('tags')) {
							payload = this.parseBody(w, macro);

							if (!payload) {
								w.nextMatch = nextMatch; // we must reset `w.nextMatch` here, as `parseBody()` modifies it
								return throwError(
									w.output,
									`cannot find a closing tag for macro <<${name}>>`,
									`${w.source.slice(matchStart, w.nextMatch)}\u2026`
								);
							}
						}

						if (typeof macro.handler === 'function') {
							const args = !payload
								? this.createArgs(
									rawArgs,
									   macro.hasOwnProperty('skipArgs') && !!macro.skipArgs
									|| macro.hasOwnProperty('skipArg0') && !!macro.skipArg0
								)
								: payload[0].args;

							/*
								New-style macros.
							*/
							if (macro.hasOwnProperty('_MACRO_API')) {
								/*
									Add the macro's execution context to the context chain.
								*/
								this.context = new MacroContext({
									parent : this.context,
									macro,
									name,
									args,
									payload,
									parser : w,
									source
								});

								/*
									Call the handler.

									NOTE: There's no catch clause here because this try/finally exists solely
									      to ensure that the execution context is properly restored in the
									      event that an uncaught exception is thrown during the handler call.
								*/
								try {
									macro.handler.call(this.context);
								}
								finally {
									this.context = this.context.parent;
								}
							}

							/*
								Old-style macros.
							*/
							else {
								const prevRawArgs = w._rawArgs;
								w._rawArgs = rawArgs; // cache the raw arguments for use by `Wikifier.rawArgs()` & `Wikifier.fullArgs()`
								macro.handler(w.output, name, args, w, payload);
								w._rawArgs = prevRawArgs;
							}
						}
						else {
							return throwError(
								w.output,
								`macro <<${name}>> handler function ${macro.hasOwnProperty('handler') ? 'is not a function' : 'does not exist'}`,
								w.source.slice(matchStart, w.nextMatch)
							);
						}
					}
					else if (Macro.tags.has(name)) {
						const tags = Macro.tags.get(name);
						return throwError(
							w.output,
							`child tag <<${name}>> was found outside of a call to its parent macro${tags.length === 1 ? '' : 's'} <<${tags.join('>>, <<')}>>`,
							w.source.slice(matchStart, w.nextMatch)
						  );
					}
					else {
						return throwError(w.output, `macro <<${name}>> does not exist`, w.source.slice(matchStart, w.nextMatch));
					}
				}
				catch (ex) {
					return throwError(
						w.output,
						`cannot execute ${macro && macro.isWidget ? 'widget' : 'macro'} <<${name}>>: ${ex.message}`,
						w.source.slice(matchStart, w.nextMatch)
					);
				}
				finally {
					this.working.source    = '';
					this.working.name      = '';
					this.working.arguments = '';
					this.working.index     = 0;
				}
			}
			else {
				w.outputText(w.output, w.matchStart, w.nextMatch);
			}
		},

		parseTag(w) {
			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart && match[1]) {
				w.nextMatch = this.lookahead.lastIndex;

				this.working.source    = w.source.slice(match.index, this.lookahead.lastIndex);
				this.working.name      = match[1];
				this.working.arguments = match[2];
				this.working.index     = match.index;

				return true;
			}

			return false;
		},

		parseBody(w, macro) {
			const openTag  = this.working.name;
			const closeTag = `/${openTag}`;
			const closeAlt = `end${openTag}`;
			const bodyTags = Array.isArray(macro.tags) ? macro.tags : false;
			const payload  = [];
			const skipArgs = macro.hasOwnProperty('skipArgs') && macro.skipArgs;
			const skipArg0 = macro.hasOwnProperty('skipArg0') && macro.skipArg0;
			let end          = -1;
			let opened       = 1;
			let curSource    = this.working.source;
			let curTag       = this.working.name;
			let curArgument  = this.working.arguments;
			let contentStart = w.nextMatch;

			while ((w.matchStart = w.source.indexOf(this.match, w.nextMatch)) !== -1) {
				if (!this.parseTag(w)) {
					this.lookahead.lastIndex = w.nextMatch = w.matchStart + this.match.length;
					continue;
				}

				const tagSource = this.working.source;
				const tagName   = this.working.name;
				const tagArgs   = this.working.arguments;
				const tagBegin  = this.working.index;
				const tagEnd    = w.nextMatch;

				switch (tagName) {
				case openTag:
					++opened;
					break;

				case closeAlt:
				case closeTag:
					--opened;
					break;

				default:
					if (opened === 1 && bodyTags) {
						for (let i = 0, iend = bodyTags.length; i < iend; ++i) {
							if (tagName === bodyTags[i]) {
								payload.push({
									source    : curSource,
									name      : curTag,
									arguments : curArgument,
									args      : this.createArgs(
										curArgument,
										skipArgs || payload.length === 0 && skipArg0
									),
									contents : w.source.slice(contentStart, tagBegin)
								});
								curSource    = tagSource;
								curTag       = tagName;
								curArgument  = tagArgs;
								contentStart = tagEnd;
							}
						}
					}
					break;
				}

				if (opened === 0) {
					payload.push({
						source    : curSource,
						name      : curTag,
						arguments : curArgument,
						args      : this.createArgs(
							curArgument,
							skipArgs || payload.length === 0 && skipArg0
						),
						contents : w.source.slice(contentStart, tagBegin)
					});
					end = tagEnd;
					break;
				}
			}

			if (end !== -1) {
				w.nextMatch = end;
				return payload;
			}

			return null;
		},

		createArgs(rawArgsString, skipArgs) {
			const args = skipArgs ? [] : this.parseArgs(rawArgsString);

			// Extend the args array with the raw and full argument strings.
			Object.defineProperties(args, {
				raw : {
					value : rawArgsString
				},
				full : {
					value : Scripting.parse(rawArgsString)
				}
			});

			return args;
		},

		parseArgs(rawArgsString) {
			/*
				`this.argsPattern` capture groups:
					1=Empty backticks
					2=Backticked, non-empty
					3=Empty quotes
					4=Double quoted, non-empty
					5=Single quoted, non-empty
					6=Double square-bracketed
					7=Barewords
					8=Unterminated backticks and quotes
			*/
			const argsRe  = new RegExp(this.argsPattern, 'gm');
			const args    = [];
			const varTest = new RegExp(`^${Patterns.variable}`);
			let match;

			while ((match = argsRe.exec(rawArgsString)) !== null) {
				let arg;

				// Empty backticks.
				if (match[1]) {
					arg = undefined;
				}

				// Backticked, non-empty.
				else if (match[2]) {
					arg = match[2]; // the pattern excludes the backticks, so this is just the expression

					// Evaluate the expression.
					try {
						arg = Scripting.evalTwineScript(arg);
					}
					catch (ex) {
						throw new Error(`unable to parse macro argument "${arg}": ${ex.message}`);
					}
				}

				// Empty quotes.
				else if (match[3]) {
					arg = '';
				}

				// Double quoted, non-empty.
				else if (match[4]) {
					arg = match[4];

					// Evaluate the string to handle escaped characters.
					try {
						arg = Scripting.evalJavaScript(arg);
					}
					catch (ex) {
						throw new Error(`unable to parse macro argument '${arg}': ${ex.message}`);
					}
				}

				// Single quoted, non-empty.
				else if (match[5]) {
					arg = match[5];

					// Evaluate the string to handle escaped characters.
					try {
						arg = Scripting.evalJavaScript(arg);
					}
					catch (ex) {
						throw new Error(`unable to parse macro argument "${arg}": ${ex.message}`);
					}
				}

				// Double square-bracketed.
				else if (match[6]) {
					arg = match[6];

					const markup = Wikifier.helpers.parseSquareBracketedMarkup({
						source     : arg,
						matchStart : 0
					});

					if (markup.hasOwnProperty('error')) {
						throw new Error(`unable to parse macro argument "${arg}": ${markup.error}`);
					}

					if (markup.pos < arg.length) {
						throw new Error(`unable to parse macro argument "${arg}": unexpected character(s) "${arg.slice(markup.pos)}" (pos: ${markup.pos})`);
					}

					// Convert to a link or image object.
					if (markup.isLink) {
						// .isLink, [.text], [.forceInternal], .link, [.setter]
						arg = { isLink : true };
						arg.count    = markup.hasOwnProperty('text') ? 2 : 1;
						arg.link     = Wikifier.helpers.evalPassageId(markup.link);
						arg.text     = markup.hasOwnProperty('text') ? Wikifier.helpers.evalText(markup.text) : arg.link;
						arg.external = !markup.forceInternal && Wikifier.isExternalLink(arg.link);
						arg.setFn    = markup.hasOwnProperty('setter')
							? Wikifier.helpers.createShadowSetterCallback(Scripting.parse(markup.setter))
							: null;
					}
					else if (markup.isImage) {
						// .isImage, [.align], [.title], .source, [.forceInternal], [.link], [.setter]
						arg = (source => {
							const imgObj = {
								source,
								isImage : true
							};

							// Check for Twine 1.4 Base64 image passage transclusion.
							if (source.slice(0, 5) !== 'data:' && Story.has(source)) {
								const passage = Story.get(source);

								if (passage.tags.includes('Twine.image')) {
									imgObj.source  = passage.text;
									imgObj.passage = passage.title;
								}
							}

							return imgObj;
						})(Wikifier.helpers.evalPassageId(markup.source));

						if (markup.hasOwnProperty('align')) {
							arg.align = markup.align;
						}

						if (markup.hasOwnProperty('title')) {
							arg.title = Wikifier.helpers.evalText(markup.title);
						}

						if (markup.hasOwnProperty('link')) {
							arg.link     = Wikifier.helpers.evalPassageId(markup.link);
							arg.external = !markup.forceInternal && Wikifier.isExternalLink(arg.link);
						}

						arg.setFn = markup.hasOwnProperty('setter')
							? Wikifier.helpers.createShadowSetterCallback(Scripting.parse(markup.setter))
							: null;
					}
				}

				// Barewords.
				else if (match[7]) {
					arg = match[7];

					// A variable, so substitute its value.
					if (varTest.test(arg)) {
						arg = Wikifier.getValue(arg);
					}

					// Property access on the settings or setup objects, so try to evaluate it.
					else if (/^(?:settings|setup)[.[]/.test(arg)) {
						try {
							arg = Scripting.evalTwineScript(arg);
						}
						catch (ex) {
							throw new Error(`unable to parse macro argument "${arg}": ${ex.message}`);
						}
					}

					// Null literal, so convert it into null.
					else if (arg === 'null') {
						arg = null;
					}

					// Undefined literal, so convert it into undefined.
					else if (arg === 'undefined') {
						arg = undefined;
					}

					// Boolean true literal, so convert it into boolean true.
					else if (arg === 'true') {
						arg = true;
					}

					// Boolean false literal, so convert it into boolean false.
					else if (arg === 'false') {
						arg = false;
					}

					// Attempt to convert it into a number, in case it's a numeric literal.
					else {
						const argAsNum = Number(arg);

						if (!Number.isNaN(argAsNum)) {
							arg = argAsNum;
						}
					}
				}

				// Unterminated backticks and quotes.
				else if (match[8]) {
					let what;

					switch (match[8]) {
					case '`':
						what = 'backtick expression';
						break;

					case '"':
						what = 'double quoted string';
						break;

					case "'":
						what = 'single quoted string';
						break;
					}

					throw new Error(`unterminated ${what} in macro argument string`);
				}

				args.push(arg);
			}

			return args;
		}
	});

	Wikifier.Parser.add({
		name     : 'prettyLink',
		profiles : ['core'],
		match    : '\\[\\[[^[]',

		handler(w) {
			const markup = Wikifier.helpers.parseSquareBracketedMarkup(w);

			if (markup.hasOwnProperty('error')) {
				w.outputText(w.output, w.matchStart, w.nextMatch);
				return;
			}

			w.nextMatch = markup.pos;

			// text=(text), forceInternal=(~), link=link, setter=(setter)
			const link  = Wikifier.helpers.evalPassageId(markup.link);
			const text  = markup.hasOwnProperty('text') ? Wikifier.helpers.evalText(markup.text) : link;
			const setFn = markup.hasOwnProperty('setter')
				? Wikifier.helpers.createShadowSetterCallback(Scripting.parse(markup.setter))
				: null;

			// Debug view setup.
			const output = (Config.debug
				? new DebugView(w.output, 'wiki-link', '[[link]]', w.source.slice(w.matchStart, w.nextMatch))
				: w
			).output;

			if (markup.forceInternal || !Wikifier.isExternalLink(link)) {
				Wikifier.createInternalLink(output, link, text, setFn);
			}
			else {
				Wikifier.createExternalLink(output, link, text);
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'urlLink',
		profiles : ['core'],
		match    : Patterns.url,

		handler(w) {
			w.outputText(Wikifier.createExternalLink(w.output, w.matchText), w.matchStart, w.nextMatch);
		}
	});

	Wikifier.Parser.add({
		name     : 'image',
		profiles : ['core'],
		match    : '\\[[<>]?[Ii][Mm][Gg]\\[',

		handler(w) {
			const markup = Wikifier.helpers.parseSquareBracketedMarkup(w);

			if (markup.hasOwnProperty('error')) {
				w.outputText(w.output, w.matchStart, w.nextMatch);
				return;
			}

			w.nextMatch = markup.pos;

			// Debug view setup.
			let	debugView;

			if (Config.debug) {
				debugView = new DebugView(
					w.output,
					'wiki-image',
					markup.hasOwnProperty('link') ? '[img[][link]]' : '[img[]]',
					w.source.slice(w.matchStart, w.nextMatch)
				);
				debugView.modes({ block : true });
			}

			// align=(left|right), title=(title), source=source, forceInternal=(~), link=(link), setter=(setter)
			const setFn = markup.hasOwnProperty('setter')
				? Wikifier.helpers.createShadowSetterCallback(Scripting.parse(markup.setter))
				: null;
			let el     = (Config.debug ? debugView : w).output;
			let source;

			if (markup.hasOwnProperty('link')) {
				const link = Wikifier.helpers.evalPassageId(markup.link);

				if (markup.forceInternal || !Wikifier.isExternalLink(link)) {
					el = Wikifier.createInternalLink(el, link, null, setFn);
				}
				else {
					el = Wikifier.createExternalLink(el, link);
				}

				el.classList.add('link-image');
			}

			el = jQuery(document.createElement('img'))
				.appendTo(el)
				.get(0);
			source = Wikifier.helpers.evalPassageId(markup.source);

			// Check for image passage transclusion.
			if (source.slice(0, 5) !== 'data:' && Story.has(source)) {
				const passage = Story.get(source);

				if (passage.tags.includes('Twine.image')) {
					el.setAttribute('data-passage', passage.title);
					source = passage.text;
				}
			}

			el.src = source;

			if (markup.hasOwnProperty('title')) {
				el.title = Wikifier.helpers.evalText(markup.title);
			}

			if (markup.hasOwnProperty('align')) {
				el.align = markup.align;
			}
		}
	});

	Wikifier.Parser.add({
		name      : 'monospacedByBlock',
		profiles  : ['block'],
		match     : '^\\{\\{\\{\\n',
		lookahead : /^\{\{\{\n((?:^[^\n]*\n)+?)(^\}\}\}$\n?)/gm,

		handler(w) {
			this.lookahead.lastIndex = w.matchStart;

			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart) {
				jQuery(document.createElement('pre'))
					.text(match[1])
					.appendTo(w.output);
				w.nextMatch = this.lookahead.lastIndex;
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'formatByChar',
		profiles : ['core'],
		match    : "''|//|__|\\^\\^|~~|==|\\{\\{\\{",

		handler(w) {
			switch (w.matchText) {
			case "''":
				w.subWikify(jQuery(document.createElement('strong')).appendTo(w.output).get(0), "''");
				break;

			case '//':
				w.subWikify(jQuery(document.createElement('em')).appendTo(w.output).get(0), '//');
				break;

			case '__':
				w.subWikify(jQuery(document.createElement('u')).appendTo(w.output).get(0), '__');
				break;

			case '^^':
				w.subWikify(jQuery(document.createElement('sup')).appendTo(w.output).get(0), '\\^\\^');
				break;

			case '~~':
				w.subWikify(jQuery(document.createElement('sub')).appendTo(w.output).get(0), '~~');
				break;

			case '==':
				w.subWikify(jQuery(document.createElement('s')).appendTo(w.output).get(0), '==');
				break;

			case '{{{':
				{
					const lookahead = /\{\{\{((?:.|\n)*?)\}\}\}/gm;

					lookahead.lastIndex = w.matchStart;

					const match = lookahead.exec(w.source);

					if (match && match.index === w.matchStart) {
						jQuery(document.createElement('code'))
							.text(match[1])
							.appendTo(w.output);
						w.nextMatch = lookahead.lastIndex;
					}
				}
				break;
			}
		}
	});

	Wikifier.Parser.add({
		name        : 'customStyle',
		profiles    : ['core'],
		match       : '@@',
		terminator  : '@@',
		blockRegExp : /\s*\n/gm,

		handler(w) {
			const css = Wikifier.helpers.inlineCss(w);

			this.blockRegExp.lastIndex = w.nextMatch; // must follow the call to `inlineCss()`

			const blockMatch = this.blockRegExp.exec(w.source);
			const blockLevel = blockMatch && blockMatch.index === w.nextMatch;
			const $el        = jQuery(document.createElement(blockLevel ? 'div' : 'span'))
				.appendTo(w.output);

			if (css.classes.length === 0 && css.id === '' && Object.keys(css.styles).length === 0) {
				$el.addClass('marked');
			}
			else {
				css.classes.forEach(className => $el.addClass(className));

				if (css.id !== '') {
					$el.attr('id', css.id);
				}

				$el.css(css.styles);
			}

			if (blockLevel) {
				// Skip the leading and, if it exists, trailing newlines.
				w.nextMatch += blockMatch[0].length;
				w.subWikify($el[0], `\\n?${this.terminator}`);
			}
			else {
				w.subWikify($el[0], this.terminator);
			}
		}
	});

	Wikifier.Parser.add({
		name      : 'verbatimText',
		profiles  : ['core'],
		match     : '"{3}|<nowiki>',
		lookahead : /(?:"{3}((?:.|\n)*?)"{3})|(?:<nowiki>((?:.|\n)*?)<\/nowiki>)/gm,

		handler(w) {
			this.lookahead.lastIndex = w.matchStart;

			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart) {
				jQuery(document.createElement('span'))
					.addClass('verbatim')
					.text(match[1] || match[2])
					.appendTo(w.output);
				w.nextMatch = this.lookahead.lastIndex;
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'horizontalRule',
		profiles : ['core'],
		match    : '^----+$\\n?|<hr\\s*/?>\\n?',

		handler(w) {
			jQuery(document.createElement('hr')).appendTo(w.output);
		}
	});

	Wikifier.Parser.add({
		name     : 'emdash',
		profiles : ['core'],
		match    : '--',

		handler(w) {
			jQuery(document.createTextNode('\u2014')).appendTo(w.output);
		}
	});

	Wikifier.Parser.add({
		name     : 'doubleDollarSign',
		profiles : ['core'],
		match    : '\\${2}', // eslint-disable-line no-template-curly-in-string

		handler(w) {
			jQuery(document.createTextNode('$')).appendTo(w.output);
		}
	});

	Wikifier.Parser.add({
		/*
			Supported syntax:
				$variable
				$variable.property
				$variable[numericIndex]
				$variable["property"]
				$variable['property']
				$variable[$indexOrPropertyVariable]
		*/
		name     : 'nakedVariable',
		profiles : ['core'],
		match    : `${Patterns.variable}(?:(?:\\.${Patterns.identifier})|(?:\\[\\d+\\])|(?:\\["(?:\\\\.|[^"\\\\])+"\\])|(?:\\['(?:\\\\.|[^'\\\\])+'\\])|(?:\\[${Patterns.variable}\\]))*`,

		handler(w) {
			const result = toStringOrDefault(Wikifier.getValue(w.matchText), null);

			if (result === null) {
				jQuery(document.createTextNode(w.matchText)).appendTo(w.output);
			}
			else {
				new Wikifier(
					(Config.debug
						? new DebugView(w.output, 'variable', w.matchText, w.matchText) // Debug view setup.
						: w
					).output,
					result
				);
			}
		}
	});

	Wikifier.Parser.add({
		name       : 'heading',
		profiles   : ['block'],
		match      : '^!{1,6}',
		terminator : '\\n',

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			w.subWikify(
				jQuery(document.createElement(`h${w.matchLength}`)).appendTo(w.output).get(0),
				this.terminator
			);
		}
	});

	Wikifier.Parser.add({
		name           : 'table',
		profiles       : ['block'],
		match          : '^\\|(?:[^\\n]*)\\|(?:[fhck]?)$',
		lookahead      : /^\|([^\n]*)\|([fhck]?)$/gm,
		rowTerminator  : '\\|(?:[cfhk]?)$\\n?',
		cellPattern    : '(?:\\|([^\\n\\|]*)\\|)|(\\|[cfhk]?$\\n?)',
		cellTerminator : '(?:\\u0020*)\\|',
		rowTypes       : { c : 'caption', f : 'tfoot', h : 'thead', '' : 'tbody' }, // eslint-disable-line id-length

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			const table       = jQuery(document.createElement('table')).appendTo(w.output).get(0);
			const prevColumns = [];
			let curRowType    = null;
			let $rowContainer = null;
			let rowCount      = 0;
			let matched;

			w.nextMatch = w.matchStart;

			do {
				this.lookahead.lastIndex = w.nextMatch;

				const match = this.lookahead.exec(w.source);

				matched = match && match.index === w.nextMatch;

				if (matched) {
					const nextRowType = match[2];

					if (nextRowType === 'k') {
						table.className = match[1];
						w.nextMatch += match[0].length + 1;
					}
					else {
						if (nextRowType !== curRowType) {
							curRowType = nextRowType;
							$rowContainer = jQuery(document.createElement(this.rowTypes[nextRowType]))
								.appendTo(table);
						}

						if (curRowType === 'c') {
							$rowContainer.css('caption-side', rowCount === 0 ? 'top' : 'bottom');
							w.nextMatch += 1;
							w.subWikify($rowContainer[0], this.rowTerminator);
						}
						else {
							this.rowHandler(
								w,
								jQuery(document.createElement('tr'))
									.appendTo($rowContainer)
									.get(0),
								prevColumns
							);
						}

						++rowCount;
					}
				}
			} while (matched);
		},

		rowHandler(w, rowEl, prevColumns) {
			const cellRegExp = new RegExp(this.cellPattern, 'gm');
			let col         = 0;
			let curColCount = 1;
			let matched;

			do {
				cellRegExp.lastIndex = w.nextMatch;

				const cellMatch = cellRegExp.exec(w.source);

				matched = cellMatch && cellMatch.index === w.nextMatch;

				if (matched) {
					if (cellMatch[1] === '~') {
						const last = prevColumns[col];

						if (last) {
							++last.rowCount;
							last.$element
								.attr('rowspan', last.rowCount)
								.css('vertical-align', 'middle');
						}

						w.nextMatch = cellMatch.index + cellMatch[0].length - 1;
					}
					else if (cellMatch[1] === '>') {
						++curColCount;
						w.nextMatch = cellMatch.index + cellMatch[0].length - 1;
					}
					else if (cellMatch[2]) {
						w.nextMatch = cellMatch.index + cellMatch[0].length;
						break;
					}
					else {
						++w.nextMatch;

						const css = Wikifier.helpers.inlineCss(w);
						let spaceLeft  = false;
						let spaceRight = false;
						let $cell;

						while (w.source.substr(w.nextMatch, 1) === ' ') {
							spaceLeft = true;
							++w.nextMatch;
						}

						if (w.source.substr(w.nextMatch, 1) === '!') {
							$cell = jQuery(document.createElement('th')).appendTo(rowEl);
							++w.nextMatch;
						}
						else {
							$cell = jQuery(document.createElement('td')).appendTo(rowEl);
						}

						prevColumns[col] = {
							rowCount : 1,
							$element : $cell
						};

						if (curColCount > 1) {
							$cell.attr('colspan', curColCount);
							curColCount = 1;
						}

						w.subWikify($cell[0], this.cellTerminator);

						if (w.matchText.substr(w.matchText.length - 2, 1) === ' ') {
							spaceRight = true;
						}

						css.classes.forEach(className => $cell.addClass(className));

						if (css.id !== '') {
							$cell.attr('id', css.id);
						}

						if (spaceLeft && spaceRight) {
							css.styles['text-align'] = 'center';
						}
						else if (spaceLeft) {
							css.styles['text-align'] = 'right';
						}
						else if (spaceRight) {
							css.styles['text-align'] = 'left';
						}

						$cell.css(css.styles);

						w.nextMatch = w.nextMatch - 1;
					}

					++col;
				}
			} while (matched);
		}
	});

	Wikifier.Parser.add({
		name       : 'list',
		profiles   : ['block'],
		match      : '^(?:(?:\\*+)|(?:#+))',
		lookahead  : /^(?:(\*+)|(#+))/gm,
		terminator : '\\n',

		handler(w) {
			if (!Wikifier.helpers.hasBlockContext(w.output.childNodes)) {
				jQuery(w.output).append(document.createTextNode(w.matchText));
				return;
			}

			w.nextMatch = w.matchStart;

			const destStack = [w.output];
			let curType  = null;
			let curLevel = 0;
			let matched;
			let i;

			do {
				this.lookahead.lastIndex = w.nextMatch;

				const match = this.lookahead.exec(w.source);

				matched = match && match.index === w.nextMatch;

				if (matched) {
					const newType  = match[2] ? 'ol' : 'ul';
					const newLevel = match[0].length;

					w.nextMatch += match[0].length;

					if (newLevel > curLevel) {
						for (i = curLevel; i < newLevel; ++i) {
							destStack.push(
								jQuery(document.createElement(newType))
									.appendTo(destStack[destStack.length - 1])
									.get(0)
							);
						}
					}
					else if (newLevel < curLevel) {
						for (i = curLevel; i > newLevel; --i) {
							destStack.pop();
						}
					}
					else if (newLevel === curLevel && newType !== curType) {
						destStack.pop();
						destStack.push(
							jQuery(document.createElement(newType))
								.appendTo(destStack[destStack.length - 1])
								.get(0)
						);
					}

					curLevel = newLevel;
					curType = newType;
					w.subWikify(
						jQuery(document.createElement('li'))
							.appendTo(destStack[destStack.length - 1])
							.get(0),
						this.terminator
					);
				}
			} while (matched);
		}
	});

	Wikifier.Parser.add({
		name      : 'html',
		profiles  : ['core'],
		match     : '<[Hh][Tt][Mm][Ll]>',
		lookahead : /<[Hh][Tt][Mm][Ll]>((?:.|\n)*?)<\/[Hh][Tt][Mm][Ll]>/gm,

		handler(w) {
			this.lookahead.lastIndex = w.matchStart;

			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart) {
				w.nextMatch = this.lookahead.lastIndex;

				jQuery(document.createDocumentFragment())
					.append(match[1])
					.appendTo(w.output);
			}
		}
	});

	Wikifier.Parser.add({
		name      : 'commentByBlock',
		profiles  : ['core'],
		match     : '(?:/(?:%|\\*))|(?:<!--)',
		lookahead : /(?:\/(%|\*)(?:(?:.|\n)*?)\1\/)|(?:<!--(?:(?:.|\n)*?)-->)/gm,

		handler(w) {
			this.lookahead.lastIndex = w.matchStart;

			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart) {
				w.nextMatch = this.lookahead.lastIndex;
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'lineContinuation',
		profiles : ['core'],

		// NOTE: The end-of-line pattern must come first.
		match : `\\\\${Patterns.spaceNoTerminator}*(?:\\n|$)|(?:^|\\n)${Patterns.spaceNoTerminator}*\\\\`,

		handler(w) {
			w.nextMatch = w.matchStart + w.matchLength;
		}
	});

	Wikifier.Parser.add({
		name     : 'lineBreak',
		profiles : ['core'],
		match    : '\\n|<br\\s*/?>',

		handler(w) {
			if (!w.options.nobr) {
				jQuery(document.createElement('br')).appendTo(w.output);
			}
		}
	});

	Wikifier.Parser.add({
		name     : 'htmlCharacterReference',
		profiles : ['core'],
		match    : '(?:(?:&#?[0-9A-Za-z]{2,8};|.)(?:&#?(?:x0*(?:3[0-6][0-9A-Fa-f]|1D[C-Fc-f][0-9A-Fa-f]|20[D-Fd-f][0-9A-Fa-f]|FE2[0-9A-Fa-f])|0*(?:76[89]|7[7-9][0-9]|8[0-7][0-9]|761[6-9]|76[2-7][0-9]|84[0-3][0-9]|844[0-7]|6505[6-9]|6506[0-9]|6507[0-1]));)+|&#?[0-9A-Za-z]{2,8};)',

		handler(w) {
			jQuery(document.createDocumentFragment())
				.append(w.matchText)
				.appendTo(w.output);
		}
	});

	Wikifier.Parser.add({
		name     : 'xmlProlog',
		profiles : ['core'],
		match    : '<\\?[Xx][Mm][Ll][^>]*\\?>',

		handler(w) {
			w.nextMatch = w.matchStart + w.matchLength;
		}
	});

	Wikifier.Parser.add({
		name      : 'svg',
		profiles  : ['core'],
		match     : '<[Ss][Vv][Gg][^>]*>',
		lookahead : /(<[Ss][Vv][Gg][^>]*>(?:.|\n)*?<\/[Ss][Vv][Gg]>)/gm,

		handler(w) {
			this.lookahead.lastIndex = w.matchStart;

			const match = this.lookahead.exec(w.source);

			if (match && match.index === w.matchStart) {
				w.nextMatch = this.lookahead.lastIndex;

				jQuery(document.createDocumentFragment())
					.append(match[1])
					.appendTo(w.output);
			}
		}
	});

	Wikifier.Parser.add({
		/*
			NOTE: This formatter MUST come after any formatter which handles HTML
			tag-like constructs—e.g. 'verbatimText', 'horizontalRule', 'html',
			'lineBreak', 'xmlProlog', and 'svg'.
		*/
		name         : 'htmlTag',
		profiles     : ['core'],
		match        : '<\\w+(?:\\s+[^\\u0000-\\u001F\\u007F-\\u009F\\s"\'>\\/=]+(?:\\s*=\\s*(?:"[^"]*?"|\'[^\']*?\'|[^\\s"\'=<>`]+))?)*\\s*\\/?>',
		tagPattern   : '<(\\w+)',
		voidElements : ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr'],
		nobrElements : ['colgroup', 'datalist', 'dl', 'figure', 'ol', 'optgroup', 'select', 'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul'],

		handler(w) {
			const tagMatch = new RegExp(this.tagPattern).exec(w.matchText);
			const tag      = tagMatch && tagMatch[1];
			const tagName  = tag && tag.toLowerCase();

			if (tagName) {
				const isVoid = this.voidElements.includes(tagName) || w.matchText.endsWith('/>');
				const isNobr = this.nobrElements.includes(tagName);
				let terminator;
				let terminatorMatch;

				if (!isVoid) {
					terminator = `<\\/${tagName}\\s*>`;

					const terminatorRegExp = new RegExp(terminator, 'gim'); // ignore case during match

					terminatorRegExp.lastIndex = w.matchStart;
					terminatorMatch = terminatorRegExp.exec(w.source);
				}

				if (isVoid || terminatorMatch) {
					let output    = w.output;
					let el        = document.createElement(w.output.tagName);
					let debugView;

					el.innerHTML = w.matchText;

					while (el.firstChild) {
						el = el.firstChild;
					}

					if (el.hasAttribute('data-passage')) {
						this.processDataAttributes(el);

						// Debug view setup.
						if (Config.debug) {
							debugView = new DebugView(
								w.output,
								`html-${tagName}`,
								tagName,
								w.matchText
							);
							debugView.modes({
								block   : tagName === 'img',
								nonvoid : terminatorMatch
							});
							output = debugView.output;
						}
					}

					if (terminatorMatch) {
						w.subWikify(el, terminator, {
							ignoreTerminatorCase : true,
							nobr                 : isNobr
						});

						/*
							Debug view modification.  If the current element has any debug
							view descendants who have "block" mode set, then set its debug
							view to the same.  It just makes things look a bit nicer.
						*/
						if (debugView && jQuery(el).find('.debug.block').length > 0) {
							debugView.modes({ block : true });
						}
					}

					output.appendChild(el);
				}
				else {
					throwError(w.output, `HTML tag "${tag}" is not closed`, `${w.matchText}\u2026`);
				}
			}
		},

		processDataAttributes(el) {
			let passage = el.getAttribute('data-passage');

			if (passage == null) { // lazy equality for null
				return;
			}

			const evaluated = Wikifier.helpers.evalPassageId(passage);

			if (evaluated !== passage) {
				passage = evaluated;
				el.setAttribute('data-passage', evaluated);
			}

			if (passage !== '') {
				if (el.tagName.toUpperCase() === 'IMG') {
					// Handle image passage transclusion.
					if (passage.slice(0, 5) !== 'data:' && Story.has(passage)) {
						passage = Story.get(passage);

						if (passage.tags.includes('Twine.image')) {
							el.src = passage.text.trim();
						}
					}
				}
				else {
					let setter = el.getAttribute('data-setter');
					let setFn;

					if (setter != null) { // lazy equality for null
						setter = String(setter).trim();

						if (setter !== '') {
							setFn = Wikifier.helpers.createShadowSetterCallback(Scripting.parse(setter));
						}
					}

					if (Story.has(passage)) {
						el.classList.add('link-internal');

						if (Config.addVisitedLinkClass && State.hasPlayed(passage)) {
							el.classList.add('link-visited');
						}
					}
					else {
						el.classList.add('link-broken');
					}

					jQuery(el).ariaClick({ one : true }, function () {
						if (typeof setFn === 'function') {
							setFn.call(this);
						}

						Engine.play(passage);
					});
				}
			}
		}
	});
})();
/* eslint-enable max-len */
