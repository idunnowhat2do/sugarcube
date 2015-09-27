/***********************************************************************************************************************
 *
 * story.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Passage, Util, Wikifier, addStyle, config, technicalAlert */

var Story = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	var
		// Private data members
		_title = "", // story title
		_domId = "", // DOM-compatible ID

		// Public passage containers
		passages = {}, // map of normal passages
		styles   = [], // list of style passages
		scripts  = [], // list of script passages
		widgets  = []; // list of widget passages


	/*******************************************************************************************************************
	 * Initialization & Startup
	 ******************************************************************************************************************/
	/*
		n.b. The `init()` method is done as a function expression assigned to a variable here,
		     rather than simply as a function definition, so that the build script's conditional
		     compilation feature can work.
	*/
	var init;
	if (TWINE1) { // for Twine 1

		init = function () {
			if (DEBUG) { console.log("[Story.init()|Twine 1]"); }

			/*
				Set the default starting passage title.
			*/
			config.passages.start = "Start";

			/*
				Process the passages, excluding any tagged "Twine.private" or "annotation".
			*/
			jQuery("#store-area")
				.children(':not([tags~="Twine.private"],[tags~="annotation"])')
				.each(function () {
					var
						$this   = jQuery(this),
						passage = new Passage($this.attr("tiddler"), this);

					if (passage.tags.contains("stylesheet")) {
						styles.push(passage);
					} else if (passage.tags.contains("script")) {
						scripts.push(passage);
					} else if (passage.tags.contains("widget")) {
						widgets.push(passage);
					} else {
						passages[passage.title] = passage;
					}
				});

			/*
				Set the story title or throw an exception.
			*/
			if (passages.hasOwnProperty("StoryTitle")) {
				var buf = document.createDocumentFragment();
				new Wikifier(buf, passages.StoryTitle.processText().trim());
				titleSet(buf.textContent.trim());
			} else {
				throw new Error("cannot find the StoryTitle special passage");
			}
		};

	} else { // for Twine 2

		init = function () { // eslint-disable-line no-redeclare
			if (DEBUG) { console.log("[Story.init()|Twine 2]"); }

			var	$storydata = jQuery("#store-area>tw-storydata"),
				startNode  = $storydata.attr("startnode") || "";

			/*
				Set the default starting passage title.
			*/
			config.passages.start = null; // no default in Twine 2

			/*
				Process stylesheet passages.
			*/
			$storydata
				.children("style") // alternatively: '[type="text/twine-css"]' or '#twine-user-stylesheet'
				.each(function (i) {
					styles.push(new Passage("tw-user-style-" + i, this));
				});

			/*
				Process script passages.
			*/
			$storydata
				.children("script") // alternatively: '[type="text/twine-javascript"]' or '#twine-user-script'
				.each(function (i) {
					scripts.push(new Passage("tw-user-script-" + i, this));
				});

			/*
				Process normal passages, excluding any tagged "Twine.private" or "annotation".
			*/
			$storydata
				.children('tw-passagedata:not([tags~="Twine.private"],[tags~="annotation"])')
				.each(function () {
					var
						$this   = jQuery(this),
						pid     = $this.attr("pid") || "",
						passage = new Passage($this.attr("name"), this);

					if (pid === startNode && startNode !== "") {
						config.passages.start = passage.title;
					}

					if (passage.tags.contains("widget")) {
						widgets.push(passage);
					} else {
						passages[passage.title] = passage;
					}
				});

			/*
				Set the story title.

				TODO: Maybe `$storydata.attr("name")` should be used instead?
			*/
			titleSet("{{STORY_NAME}}");
		};

	}

	function start() {
		/*
			Add the story styles.
		*/
		for (var i = 0; i < styles.length; ++i) {
			addStyle(styles[i].text);
		}

		/*
			Evaluate the story scripts.
		*/
		for (var i = 0; i < scripts.length; ++i) { // eslint-disable-line no-redeclare
			try {
				eval(scripts[i].text); // eslint-disable-line no-eval
			} catch (e) {
				technicalAlert(scripts[i].title, e.message);
			}
		}

		/*
			Process the story widgets.
		*/
		for (var i = 0; i < widgets.length; ++i) { // eslint-disable-line no-redeclare
			try {
				Wikifier.wikifyEval(widgets[i].processText());
			} catch (e) {
				technicalAlert(widgets[i].title, e.message);
			}
		}
	}


	/*******************************************************************************************************************
	 * Story Settings Functions
	 ******************************************************************************************************************/
	function titleGet() {
		return _title;
	}

	function titleSet(title) {
		if (title == null || title === "") { // lazy equality for null
			throw new Error("story title cannot be null or empty");
		}
		document.title = _title = Util.unescape(title);
		_domId = Util.slugify(_title);
	}

	function domIdGet() {
		return _domId;
	}


	/*******************************************************************************************************************
	 * Passage Lookup Functions
	 ******************************************************************************************************************/
	function passagesHas(title) {
		switch (typeof title) {
		case "number":
			title += "";
			/* falls through */
		case "string":
			return passages.hasOwnProperty(title);
		default:
			var what = typeof title;
			throw new TypeError("Story.has title parameter cannot be " + (what === "object" ? "an " + what : "a " + what));
		}
	}

	function passagesGet(title) {
		switch (typeof title) {
		case "number":
			title += "";
			/* falls through */
		case "string":
			return passages.hasOwnProperty(title) ? passages[title] : new Passage(title || "(unknown)");
		default:
			var what = typeof title;
			throw new TypeError("Story.get title parameter cannot be " + (what === "object" ? "an " + what : "a " + what));
		}
	}

	function passagesLookup(key, value, sortKey) {
		if (!sortKey) {
			sortKey = "title";
		}

		var	pnames  = Object.keys(passages),
			results = [];
		for (var i = 0; i < pnames.length; ++i) {
			var passage = passages[pnames[i]];
			if (passage.hasOwnProperty(key)) {
				switch (typeof passage[key]) {
				case "undefined":
					/* no-op */
					break;
				case "object":
					// currently, we assume that the only properties which are objects will
					// either be arrays or array-like-objects
					for (var j = 0, jend = passage[key].length; j < jend; ++j) {
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

		results.sort(function (a, b) {
			/* eslint-disable eqeqeq */
			return a[sortKey] == b[sortKey] /* lazy equality for null */
				? 0
				: a[sortKey] < b[sortKey] ? -1 : +1;
			/* eslint-enable eqeqeq */
		});

		return results;
	}


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		// Passage Containers
		passages : { value : passages },
		styles   : { value : styles },
		scripts  : { value : scripts },
		widgets  : { value : widgets },
		// Initialization & Startup
		init     : { value : init },
		start    : { value : start },
		// Story Settings Functions (exported as getters & setters)
		title    : { get : titleGet }, // A setter is probably not required here
		domId    : { get : domIdGet },
		// Passage Lookup Functions
		has      : { value : passagesHas },
		get      : { value : passagesGet },
		lookup   : { value : passagesLookup }
	}));

})();

