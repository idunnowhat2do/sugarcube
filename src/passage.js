/***********************************************************************************************************************
 *
 * passage.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Config, Story, Util, Wikifier, convertBreaks, postrender, prerender, strings */

var Passage = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	let
		_tagsToSkip,
		_unescapeTwine1Chars;

	/*
		Tags which should not be transformed into classes:
			debug      → special tag
			nobr       → special tag
			passage    → the default class
			script     → special tag (only in Twine 1)
			stylesheet → special tag (only in Twine 1)
			twine.*    → special tag
			widget     → special tag
	*/
	// For Twine 1
	if (TWINE1) {
		_tagsToSkip = /^(?:debug|nobr|passage|script|stylesheet|widget|twine\..*)$/i;
	}
	// For Twine 2
	else {
		_tagsToSkip = /^(?:debug|nobr|passage|widget|twine\..*)$/i;
	}

	// For Twine 1
	if (TWINE1) {
		/*
			Returns a decoded version of the passed Twine 1 passage store encoded string.
		*/
		const
			_escapedTwine1CharsRe    = /(?:\\n|\\t|\\s|\\|\r)/g,
			_hasEscapedTwine1CharsRe = new RegExp(_escapedTwine1CharsRe.source), // to drop the global flag
			_escapedTwine1CharsMap   = Object.freeze({
				'\\n' : '\n',
				'\\t' : '\t',
				'\\s' : '\\',
				'\\'  : '\\',
				'\r'  : ''
			});

		_unescapeTwine1Chars = function (str) {
			if (str == null) { // lazy equality for null
				return '';
			}

			const s = String(str);
			return s && _hasEscapedTwine1CharsRe.test(s)
				? s.replace(_escapedTwine1CharsRe, c => _escapedTwine1CharsMap[c])
				: s;
		};
	}


	/*******************************************************************************************************************
	 * Passage Class.
	 ******************************************************************************************************************/
	class Passage {
		constructor(title, el) {
			Object.defineProperties(this, {
				// Passage title/ID.
				title : {
					value : Util.unescape(title)
				},

				// Passage data element (within the story data element; i.e. T1: '[tiddler]', T2: 'tw-passagedata').
				element : {
					value : el || null
				},

				// Passage tags array (sorted and unique).
				tags : {
					value : Object.freeze(el && el.hasAttribute('tags')
						? el.getAttribute('tags')
							.trim()
							.splitOrEmpty(/\s+/)
							.sort()
							.filter((tag, i, aref) => i === 0 || aref[i - 1] !== tag)
						: [])
				}
			});

			// Properties dependant on the above set.
			Object.defineProperties(this, {
				// Passage DOM-compatible ID.
				domId : {
					value : `passage-${Util.slugify(this.title)}`
				},

				// Passage classes array (sorted and unique).
				classes : {
					value : Object.freeze(this.tags.length === 0 ? [] : (() =>
						/*
							Return the sorted list of unique classes.

							n.b. The `this.tags` array is already sorted and unique, so we only need
							     to filter and map here.
						*/
						this.tags
							.filter(tag => !_tagsToSkip.test(tag))
							.map(tag => Util.slugify(tag))
					)())
				}
			});
		}

		// Getters.
		get className() {
			return this.classes.join(' ');
		}

		get text() {
			if (this.element == null) { // lazy equality for null
				return (
					  '<span class="error" title="%passage%">'
					+ `${strings.errors.title}: ${strings.errors.nonexistentPassage}`
					+ '</span>'
				).replace(/%passage%/g, Util.escape(this.title));
			}

			// For Twine 1
			if (TWINE1) {
				return _unescapeTwine1Chars(this.element.textContent);
			}
			// For Twine 2
			else {
				return this.element.textContent.replace(/\r/g, '');
			}
		}

		description() {
			const descriptions = Config.passages.descriptions;

			if (descriptions != null) { // lazy equality for null
				switch (typeof descriptions) {
				case 'boolean':
					if (descriptions) {
						return this.title;
					}
					break;

				case 'object':
					if (descriptions instanceof Map && descriptions.has(this.title)) {
						return descriptions.get(this.title);
					}
					else if (descriptions.hasOwnProperty(this.title)) {
						return descriptions[this.title];
					}
					break;

				case 'function':
					{
						const result = descriptions.call(this);

						if (result) {
							return result;
						}
					}
					break;

				default:
					throw new TypeError('Config.passages.descriptions must be a boolean, object, or function');
				}
			}

			if (this._excerpt == null) { // lazy equality for null
				return Passage.getExcerptFromText(this.text);
			}

			return this._excerpt;
		}

		processText() {
			let processed = this.text;

			// Handle the `nobr` tag.
			if (this.tags.includes('nobr')) {
				// Remove all leading & trailing newlines and compact all internal sequences
				// of newlines into single spaces.
				processed = processed.replace(/^\n+|\n+$/g, '').replace(/\n+/g, ' ');
			}

			// Handle image passage transclusion.
			if (this.tags.includes('Twine.image')) {
				processed = `[img[${processed}]]`;
			}

			return processed;
		}

		render() {
			if (DEBUG) { console.log(`[<Passage>.render()] title: \`${this.title}\``); }

			// Create and setup the new passage element.
			const passage = document.createElement('div');
			jQuery(passage)
				.attr({
					id             : this.domId,
					'data-passage' : this.title,
					'data-tags'    : this.tags.join(' ')
				})
				.addClass(`passage ${this.className}`);

			// Add the passage's classes to the <body>.
			jQuery(document.body).addClass(this.className);

			// Execute pre-render tasks.
			Object.keys(prerender).forEach(task => {
				if (typeof prerender[task] === 'function') {
					prerender[task].call(this, passage, task);
				}
			});

			// Wikify the PassageHeader passage, if it exists, into the passage element.
			if (Story.has('PassageHeader')) {
				new Wikifier(passage, Story.get('PassageHeader').processText());
			}

			// Wikify the passage into its element.
			new Wikifier(passage, this.processText());

			// Wikify the PassageFooter passage, if it exists, into the passage element.
			if (Story.has('PassageFooter')) {
				new Wikifier(passage, Story.get('PassageFooter').processText());
			}

			// Convert breaks to paragraphs within the output passage.
			if (Config.cleanupWikifierOutput) {
				convertBreaks(passage);
			}

			// Execute post-render tasks.
			Object.keys(postrender).forEach(task => {
				if (typeof postrender[task] === 'function') {
					postrender[task].call(this, passage, task);
				}
			});

			// Create/update the excerpt cache to reflect the rendered text.
			if (!this.hasOwnProperty('_excerpt')) {
				Object.defineProperty(this, '_excerpt', {
					configurable : true,
					writable     : true,
					value        : ''
				});
			}
			this._excerpt = Passage.getExcerptFromNode(passage);

			return passage;
		}

		static getExcerptFromNode(node, count) {
			if (!node.hasChildNodes()) {
				return '';
			}

			let excerpt = node.textContent.trim();

			if (excerpt !== '') {
				const excerptRe = new RegExp(`(\\S+(?:\\s+\\S+){0,${count > 0 ? count - 1 : 7}})`);
				excerpt = excerpt
					// Compact whitespace.
					.replace(/\s+/g, ' ')
					// Attempt to match the excerpt regexp.
					.match(excerptRe);
			}

			return excerpt ? `${excerpt[1]}\u2026` : '\u2026'; // horizontal ellipsis
		}

		static getExcerptFromText(text, count) {
			if (text === '') {
				return '';
			}

			const
				excerptRe = new RegExp(`(\\S+(?:\\s+\\S+){0,${count > 0 ? count - 1 : 7}})`),
				excerpt   = text
					// Strip macro tags (replace with a space).
					.replace(/<<.*?>>/g, ' ')
					// Strip html tags (replace with a space).
					.replace(/<.*?>/g, ' ')
					// The above might have left problematic whitespace, so trim.
					.trim()
					// Strip wiki tables.
					.replace(/^\s*\|.*\|.*?$/gm, '')
					// Strip wiki images.
					.replace(/\[[<>]?img\[[^\]]*\]\]/g, '')
					// Clean wiki links, i.e. remove all but the link text.
					.replace(/\[\[([^|\]]*)(?:|[^\]]*)?\]\]/g, '$1')
					// Clean wiki !headings.
					.replace(/^\s*!+(.*?)$/gm, '$1')
					// Clean wiki bold/italic/underline/highlight formatting.
					.replace(/\'{2}|\/{2}|_{2}|@{2}/g, '')
					// A final trim.
					.trim()
					// Compact whitespace.
					.replace(/\s+/g, ' ')
					// Attempt to match the excerpt regexp.
					.match(excerptRe);
			return excerpt ? `${excerpt[1]}\u2026` : '\u2026'; // horizontal ellipsis
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Passage;
})();
