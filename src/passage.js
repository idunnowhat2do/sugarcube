/***********************************************************************************************************************
 *
 * passage.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Config, L10n, Story, Util, Wikifier, convertBreaks, postrender, prerender */

var Passage = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	let
		_tagsToSkip,
		_twine1Unescape;

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
			_twine1EscapesRe    = /(?:\\n|\\t|\\s|\\|\r)/g,
			_hasTwine1EscapesRe = new RegExp(_twine1EscapesRe.source), // to drop the global flag
			_twine1EscapesMap   = Object.freeze({
				'\\n' : '\n',
				'\\t' : '\t',
				'\\s' : '\\',
				'\\'  : '\\',
				'\r'  : ''
			});

		_twine1Unescape = function (str) {
			if (str == null) { // lazy equality for null
				return '';
			}

			const val = String(str);
			return val && _hasTwine1EscapesRe.test(val)
				? val.replace(_twine1EscapesRe, esc => _twine1EscapesMap[esc])
				: val;
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
				},

				// Passage excerpt.  Used by the `description()` method.
				_excerpt : {
					writable : true,
					value    : null
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

							NOTE: The `this.tags` array is already sorted and unique, so we only
							      need to filter and map here.
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
				const passage = Util.escape(this.title);
				return `<span class="error" title="${passage}">${L10n.get('errorTitle')}: ${L10n.get('errorNonexistentPassage', { passage })}</span>`;
			}

			// For Twine 1
			if (TWINE1) {
				return _twine1Unescape(this.element.textContent);
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

			// Initialize the excerpt cache from the raw passage text, if necessary.
			if (this._excerpt === null) {
				this._excerpt = Passage.getExcerptFromText(this.text);
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
			if (DEBUG) { console.log(`[<Passage: "${this.title}">.render()]`); }

			// Create and setup the new passage element.
			const passageEl = document.createElement('div');
			jQuery(passageEl)
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
					prerender[task].call(this, passageEl, task);
				}
			});

			// Wikify the PassageHeader passage, if it exists, into the passage element.
			if (Story.has('PassageHeader')) {
				new Wikifier(passageEl, Story.get('PassageHeader').processText());
			}

			// Wikify the passage into its element.
			new Wikifier(passageEl, this.processText());

			// Wikify the PassageFooter passage, if it exists, into the passage element.
			if (Story.has('PassageFooter')) {
				new Wikifier(passageEl, Story.get('PassageFooter').processText());
			}

			// Convert breaks to paragraphs within the output passage.
			if (Config.cleanupWikifierOutput) {
				convertBreaks(passageEl);
			}

			// Execute post-render tasks.
			Object.keys(postrender).forEach(task => {
				if (typeof postrender[task] === 'function') {
					postrender[task].call(this, passageEl, task);
				}
			});

			// Update the excerpt cache to reflect the rendered text.
			this._excerpt = Passage.getExcerptFromNode(passageEl);

			return passageEl;
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
					.replace(/'{2}|\/{2}|_{2}|@{2}/g, '')
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
