/***********************************************************************************************************************
 *
 * story.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Passage, Util, Wikifier, config */

/***********************************************************************************************************************
 * Tale API
 **********************************************************************************************************************/
// Setup the Tale constructor
function Tale(instanceName) {
	if (DEBUG) { console.log("[Tale()]"); }

	this._title   = "";
	this._domId   = "";
	this.passages = {};
	this.styles   = [];
	this.scripts  = [];
	this.widgets  = [];

	var	nodes = document.getElementById("store-area").childNodes;
	var	el, name, tags, passage;

	/*
		Twine 1 passage loading code.
	*/
	if (TWINE1) {

		config.passages.start = "Start"; // set the default starting passage title
		var	storyStylesheet,
			storyScript;
		for (var i = 0; i < nodes.length; ++i) {
			el = nodes[i];
			// skip non-element nodes (should never be any, but…)
			if (el.nodeType !== Node.ELEMENT_NODE) {
				continue;
			}

			name = el.hasAttribute("tiddler") ? el.getAttribute("tiddler") : "";
			// skip nameless passages (should never be any, but…)
			if (name === "") {
				continue;
			}

			tags = el.hasAttribute("tags") ? el.getAttribute("tags").trim().splitOrEmpty(/\s+/) : [];
			// skip passages with forbidden tags
			if (tags.containsAny("Twine.private", "annotation")) {
				continue;
			}

			passage = new Passage(name, el, i);

			if (name === "StoryStylesheet") {
				storyStylesheet = passage;
			} else if (name === "StoryJavaScript") {
				storyScript = passage;
			} else if (tags.contains("stylesheet")) {
				this.styles.push(passage);
			} else if (tags.contains("script")) {
				this.scripts.push(passage);
			} else if (tags.contains("widget")) {
				this.widgets.push(passage);
			} else {
				this.passages[name] = passage;
			}
		}
		if (storyStylesheet) {
			this.styles.unshift(storyStylesheet);
		}
		if (storyScript) {
			this.scripts.unshift(storyScript);
		}

		if (this.passages.hasOwnProperty("StoryTitle")) {
			// We cannot Wikify and then grab the text content here as parts of the `Wikifier`
			// depend on `tale` (being an instance of `Tale`), which we're in the process of
			// instantiating now.  Chicken <-> Egg.
			this.title = this.passages.StoryTitle.text.trim();
		} else {
			throw new Error("cannot find the StoryTitle special passage");
		}

	}

	/*
		Twine 2 passage loading code.
	*/
	else {

		config.passages.start = null; // no default starting passage title
		var startNode = nodes[0].hasAttribute("startnode") ? nodes[0].getAttribute("startnode") : "";
		nodes = nodes[0].childNodes;
		for (var i = 0; i < nodes.length; ++i) { // eslint-disable-line no-redeclare
			el = nodes[i];
			// skip non-element nodes (should never be any, but…)
			if (el.nodeType !== Node.ELEMENT_NODE) {
				continue;
			}

			switch (el.nodeName.toUpperCase()) {
			case "STYLE":
				this.styles.push(new Passage("user-style-node-" + i, el, -i));
				break;
			case "SCRIPT":
				this.scripts.push(new Passage("user-script-node-" + i, el, -i));
				break;
			default: // TW-PASSAGEDATA
				name = el.hasAttribute("name") ? el.getAttribute("name") : "";
				// skip nameless passages (should never be any, but…)
				if (name === "") {
					continue;
				}

				tags = el.hasAttribute("tags") ? el.getAttribute("tags").trim().splitOrEmpty(/\s+/) : [];
				// skip passages with forbidden tags
				if (tags.containsAny("Twine.private", "annotation")) {
					continue;
				}

				var	pid = el.hasAttribute("pid") ? el.getAttribute("pid") : "";
				passage = new Passage(name, el, +pid);

				if (startNode !== "" && startNode === pid) {
					config.passages.start = name;
				}

				if (tags.contains("widget")) {
					this.widgets.push(passage);
				} else {
					this.passages[name] = passage;
				}
				break;
			}
		}

		this.title = "{{STORY_NAME}}";

	}

	// update instance reference in the `SugarCube` global object
	window.SugarCube[instanceName || "tale"] = this;
}

// Setup the Tale prototype
Object.defineProperties(Tale.prototype, {
	// getters/setters
	title : {
		get : function () {
			return this._title;
		},
		set : function (title) {
			if (title == null || title === "") { // lazy equality for null
				throw new Error("story title cannot be null or empty");
			}
			document.title = this._title = title;
			this._domId = Util.slugify(title);
		}
	},

	domId : {
		get : function () {
			return this._domId;
		}
	},

	// methods
	init : {
		value : function () {
			// This exists for things which must be done during initialization, but
			// which cannot be done within the constructor for whatever reason.
			if (TWINE1) {
				var buf = document.createElement("div");
				new Wikifier(buf, this.passages.StoryTitle.processText().trim());
				this.title = buf.textContent.trim();
			}
		}
	},

	has : {
		value : function (title) {
			switch (typeof title) {
			case "number":
				title += "";
				/* falls through */
			case "string":
				return this.passages.hasOwnProperty(title);
			default:
				var what = typeof title;
				throw new TypeError("Tale.prototype.has title parameter cannot be " + (what === "object" ? "an " + what : "a " + what));
			}
		}
	},

	get : {
		value : function (title) {
			switch (typeof title) {
			case "number":
				title += "";
				/* falls through */
			case "string":
				return this.passages.hasOwnProperty(title) ? this.passages[title] : new Passage(title || "(unknown)");
			default:
				var what = typeof title;
				throw new TypeError("Tale.prototype.get title parameter cannot be " + (what === "object" ? "an " + what : "a " + what));
			}
		}
	},

	lookup : {
		value : function (key, value, sortKey) {
			if (!sortKey) { sortKey = "title"; }

			var	pnames  = Object.keys(this.passages),
				results = [];
			for (var i = 0; i < pnames.length; ++i) {
				var passage = this.passages[pnames[i]];
				if (passage.hasOwnProperty(key)) {
					switch (typeof passage[key]) {
					case "undefined":
						/* no-op */
						break;
					case "object":
						// currently, we assume that the only properties which are objects
						// will be either arrays or array-like-objects
						for (var j = 0, jend = passage[key].length; j < jend; ++j) {
							/* eslint-disable eqeqeq */
							if (passage[key][j] == value) { // lazy equality for null
								results.push(passage);
								break;
							}
							/* eslint-enable eqeqeq */
						}
						break;
					default:
						/* eslint-disable eqeqeq */
						if (passage[key] == value) { // lazy equality for null
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
	}
});

