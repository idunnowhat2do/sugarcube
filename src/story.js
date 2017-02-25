/***********************************************************************************************************************
 *
 * story.js
 *
 * Copyright © 2013–2017 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Alert, Config, Passage, Scripting, Util, Wikifier, addStyle */

var Story = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Map of normal passages.
	const _passages = {};

	// List of style passages.
	const _styles = [];

	// List of script passages.
	const _scripts = [];

	// List of widget passages.
	const _widgets = [];

	// Story title.
	let _title = '';

	// Story IFID.
	let _ifId = '';

	// DOM-compatible ID.
	let _domId = '';


	/*******************************************************************************************************************
	 * Story Functions.
	 ******************************************************************************************************************/
	function storyLoad() {
		if (DEBUG) { console.log('[Story/storyLoad()]'); }

		const validationCodeTags = [
			'widget'
		];
		const validationNoCodeTagPassages = [
			'PassageDone',
			'PassageFooter',
			'PassageHeader',
			'PassageReady',
			'StoryAuthor',
			'StoryBanner',
			'StoryCaption',
			'StoryInit',
			'StoryMenu',
			'StoryShare',
			'StorySubtitle'
		];

		function validateStartingPassage(passage) {
			if (passage.tags.includesAny(validationCodeTags)) {
				throw new Error(`starting passage "${passage.title}" contains illegal tags; invalid: "${passage.tags.filter(tag => validationCodeTags.includes(tag)).sort().join('", "')}"`);
			}
		}

		function validateSpecialPassages(passage) {
			if (validationNoCodeTagPassages.includes(passage.title) && passage.tags.includesAny(validationCodeTags)) {
				throw new Error(`special passage "${passage.title}" contains illegal tags; invalid: "${passage.tags.filter(tag => validationCodeTags.includes(tag)).sort().join('", "')}"`);
			}
		}

		// For Twine 1.
		if (TWINE1) {
			/*
				Additional Twine 1 validation setup.
			*/
			validationCodeTags.unshift('script', 'stylesheet');
			validationNoCodeTagPassages.push('StoryTitle');

			function validateTwine1CodePassages(passage) {
				const codeTags  = [...validationCodeTags];
				const foundTags = [];

				passage.tags.forEach(tag => {
					if (codeTags.includes(tag)) {
						foundTags.push(...codeTags.delete(tag));
					}
				});

				if (foundTags.length > 1) {
					throw new Error(`code passage "${passage.title}" contains multiple code tags; invalid: "${foundTags.sort().join('", "')}"`);
				}
			}

			/*
				Set the default starting passage.
			*/
			Config.passages.start = (() => {
				/*
					Handle the Twine 1.4+ Test Play From Here feature.

					NOTE: Do not change the quote style around the START_AT replacement target,
					      as the Twine 1 pattern which matches it depends upon double quotes.
				*/
				const testPlay = "START_AT"; // eslint-disable-line quotes

				if (testPlay !== '') {
					if (DEBUG) { console.log(`\tTest play; starting passage: "${testPlay}"`); }

					Config.debug = true;
					return testPlay;
				}

				// In the absence of a `testPlay` value, return 'Start'.
				return 'Start';
			})();

			/*
				Process the passages, excluding any tagged 'Twine.private' or 'annotation'.
			*/
			jQuery('#store-area')
				.children(':not([tags~="Twine.private"],[tags~="annotation"])')
				.each(function () {
					const $this   = jQuery(this);
					const passage = new Passage($this.attr('tiddler'), this);

					// Special cases.
					if (passage.title === Config.passages.start) {
						validateStartingPassage(passage);
						_passages[passage.title] = passage;
					}
					else if (passage.tags.includes('stylesheet')) {
						validateTwine1CodePassages(passage);
						_styles.push(passage);
					}
					else if (passage.tags.includes('script')) {
						validateTwine1CodePassages(passage);
						_scripts.push(passage);
					}
					else if (passage.tags.includes('widget')) {
						validateTwine1CodePassages(passage);
						_widgets.push(passage);
					}

					// All other passages.
					else {
						validateSpecialPassages(passage);
						_passages[passage.title] = passage;
					}
				});

			/*
				Set the story title or throw an exception.
			*/
			if (_passages.hasOwnProperty('StoryTitle')) {
				const buf = document.createDocumentFragment();
				new Wikifier(buf, _passages.StoryTitle.processText().trim());
				_storySetTitle(buf.textContent.trim());
			}
			else {
				throw new Error('cannot find the "StoryTitle" special passage');
			}

			/*
				Set the default saves ID (must be done after the call to `_storySetTitle()`).
			*/
			Config.saves.id = Story.domId;
		}

		// For Twine 2.
		else {
			const $storydata = jQuery('#store-area>tw-storydata');
			const startNode  = $storydata.attr('startnode') || '';

			/*
				Set the default starting passage.
			*/
			Config.passages.start = null; // no default in Twine 2

			/*
				Process story options.

				NOTE: Currently, the only option of interest to us is 'debug' (it may be the
				      only one period), so we simply use `<RegExp>.test()` to check for it.
			*/
			Config.debug = /\bdebug\b/.test($storydata.attr('options'));

			/*
				Process stylesheet passages.
			*/
			$storydata
				.children('style') // alternatively: '[type="text/twine-css"]' or '#twine-user-stylesheet'
				.each(function (i) {
					_styles.push(new Passage(`tw-user-style-${i}`, this));
				});

			/*
				Process script passages.
			*/
			$storydata
				.children('script') // alternatively: '[type="text/twine-javascript"]' or '#twine-user-script'
				.each(function (i) {
					_scripts.push(new Passage(`tw-user-script-${i}`, this));
				});

			/*
				Process normal passages, excluding any tagged 'Twine.private' or 'annotation'.
			*/
			$storydata
				.children('tw-passagedata:not([tags~="Twine.private"],[tags~="annotation"])')
				.each(function () {
					const $this   = jQuery(this);
					const pid     = $this.attr('pid') || '';
					const passage = new Passage($this.attr('name'), this);

					// Special cases.
					if (pid === startNode && startNode !== '') {
						Config.passages.start = passage.title;
						validateStartingPassage(passage);
						_passages[passage.title] = passage;
					}
					else if (passage.tags.includes('widget')) {
						_widgets.push(passage);
					}

					// All other passages.
					else {
						validateSpecialPassages(passage);
						_passages[passage.title] = passage;
					}
				});

			/*
				Get the story IFID.
			*/
			_ifId = $storydata.attr('ifid');

			/*
				Set the story title.

				TODO: Maybe `$storydata.attr('name')` should be used instead of `'{{STORY_NAME}}'`?
			*/
			_storySetTitle(Util.unescape('{{STORY_NAME}}'));

			/*
				Set the default saves ID (must be done after the call to `_storySetTitle()`).

				NOTE: If not for the requirement to support Twine 1/Twee, we could use the
				      story's IFID attribute here.
			*/
			Config.saves.id = Story.domId;
		}
	}

	function storyInit() {
		if (DEBUG) { console.log('[Story/storyInit()]'); }

		/*
			Add the story styles.
		*/
		for (let i = 0; i < _styles.length; ++i) {
			addStyle(_styles[i].text);
		}

		/*
			Evaluate the story scripts.
		*/
		for (let i = 0; i < _scripts.length; ++i) {
			try {
				Scripting.evalJavaScript(_scripts[i].text);
			}
			catch (ex) {
				Alert.error(_scripts[i].title, typeof ex === 'object' ? ex.message : ex);
			}
		}

		/*
			Process the story widgets.
		*/
		for (let i = 0; i < _widgets.length; ++i) {
			try {
				Wikifier.wikifyEval(_widgets[i].processText());
			}
			catch (ex) {
				Alert.error(_widgets[i].title, typeof ex === 'object' ? ex.message : ex);
			}
		}
	}

	function _storySetTitle(title) {
		if (title == null || title === '') { // lazy equality for null
			throw new Error('story title cannot be null or empty');
		}

		document.title = _title = Util.unescape(title);
		_domId = Util.slugify(_title);
	}

	function storyTitle() {
		return _title;
	}

	function storyDomId() {
		return _domId;
	}

	function storyIfId() {
		return _ifId;
	}


	/*******************************************************************************************************************
	 * Passage Functions.
	 ******************************************************************************************************************/
	function passagesHas(title) {
		let type = typeof title;

		switch (type) {
		// Valid types.
		case 'number':
		case 'string':
			{
				const id = String(title);
				return _passages.hasOwnProperty(id);
			}

		// Invalid types.  We do the extra processing just to make a nicer error.
		case 'boolean':
		case 'function':
			type = `a ${type}`;
			break;

		case 'undefined':
			/* no-op */
			break;

		default: // 'object'
			if (title === null) {
				type = 'null';
			}
			else {
				type = `an ${type}`;
			}
			break;
		}

		throw new TypeError(`Story.has title parameter cannot be ${type}`);
	}

	function passagesGet(title) {
		let type = typeof title;

		switch (type) {
		// Valid types.
		case 'number':
		case 'string':
			{
				const id = String(title);
				return _passages.hasOwnProperty(id) ? _passages[id] : new Passage(id || '(unknown)');
			}

		// Invalid types.  We do the extra processing just to make a nicer error.
		case 'boolean':
		case 'function':
			type = `a ${type}`;
			break;

		case 'undefined':
			/* no-op */
			break;

		default: // 'object'
			if (title === null) {
				type = 'null';
			}
			else {
				type = `an ${type}`;
			}
			break;
		}

		throw new TypeError(`Story.get title parameter cannot be ${type}`);
	}

	function passagesLookup(key, value, sortKey = 'title') {
		const pnames  = Object.keys(_passages);
		const results = [];

		for (let i = 0; i < pnames.length; ++i) {
			const passage = _passages[pnames[i]];

			if (passage.hasOwnProperty(key)) {
				switch (typeof passage[key]) {
				case 'undefined':
					/* no-op */
					break;

				case 'object':
					// Currently, we assume that the only properties which are objects will
					// either be arrays or array-like-objects.
					for (let j = 0, jend = passage[key].length; j < jend; ++j) {
						/* eslint-disable eqeqeq */
						if (passage[key][j] == value) { // lazy equality, since null & undefined are both possible
							results.push(passage);
							break;
						}
						/* eslint-enable eqeqeq */
					}
					break;

				default:
					/* eslint-disable eqeqeq */
					if (passage[key] == value) { // lazy equality, since null & undefined are both possible
						results.push(passage);
					}
					/* eslint-enable eqeqeq */
					break;
				}
			}
		}

		/* eslint-disable eqeqeq, no-nested-ternary, max-len */
		results.sort((a, b) => a[sortKey] == b[sortKey] ? 0 : a[sortKey] < b[sortKey] ? -1 : +1); // lazy equality for null
		/* eslint-enable eqeqeq, no-nested-ternary, max-len */

		return results;
	}

	function passagesLookupWith(filter, sortKey = 'title') {
		if (typeof filter !== 'function') {
			throw new Error('Story.lookupWith filter parameter must be a function');
		}

		const pnames  = Object.keys(_passages);
		const results = [];

		for (let i = 0; i < pnames.length; ++i) {
			const passage = _passages[pnames[i]];

			if (filter(passage)) {
				results.push(passage);
			}
		}

		/* eslint-disable eqeqeq, no-nested-ternary, max-len */
		results.sort((a, b) => a[sortKey] == b[sortKey] ? 0 : a[sortKey] < b[sortKey] ? -1 : +1); // lazy equality for null
		/* eslint-enable eqeqeq, no-nested-ternary, max-len */

		return results;
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Passage Containers.

			TODO: These should probably have getters, rather than being exported directly.
		*/
		passages : { value : _passages },
		styles   : { value : _styles },
		scripts  : { value : _scripts },
		widgets  : { value : _widgets },

		/*
			Story Functions.
		*/
		load  : { value : storyLoad },
		init  : { value : storyInit },
		title : { get : storyTitle }, // a setter is probably not required here
		domId : { get : storyDomId },
		ifId  : { get : storyIfId },

		/*
			Passage Functions.
		*/
		has        : { value : passagesHas },
		get        : { value : passagesGet },
		lookup     : { value : passagesLookup },
		lookupWith : { value : passagesLookupWith }
	}));
})();
