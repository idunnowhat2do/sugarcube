/***********************************************************************************************************************
 *
 * passage.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Story, Util, Wikifier, config, convertBreaksToParagraphs, insertElement, postrender, prerender, strings */

var Passage = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	if (TWINE1) { // for Twine 1

		/*
			Returns a decoded version of the passed Twine 1 passage store encoded string.
		*/
		var _unescapeTwine1 = function (str) {
			if (str === "") {
				return "";
			}
			var	escapedHtmlRe    = /(?:\\n|\\t|\\s|\\|\r)/g,
				hasEscapedHtmlRe = RegExp(escapedHtmlRe.source), // to drop the global flag
				escapedHtmlMap   = Object.freeze({
					"\\n" : "\n",
					"\\t" : "\t",
					"\\s" : "\\",
					"\\"  : "\\",
					"\r"  : ""
				});
			return hasEscapedHtmlRe.test(str)
				? str.replace(escapedHtmlRe, function (c) { return escapedHtmlMap[c]; })
				: str;
		};

	}


	/*******************************************************************************************************************
	 * Constructor
	 ******************************************************************************************************************/
	function Passage(title, el) {
		this.title = Util.unescape(title);
		this.domId = "passage-" + Util.slugify(this.title);
		if (el) {
			this.element = el;
			this.tags    = el.hasAttribute("tags") ? el.getAttribute("tags").trim().splitOrEmpty(/\s+/) : [];
			this.classes = [];
			if (this.tags.length > 0) {
				// tags to skip transforming into classes
				//     debug      → special tag
				//     nobr       → special tag
				//     passage    → the default class
				//     script     → special tag (only in Twine 1)
				//     stylesheet → special tag (only in Twine 1)
				//     twine.*    → special tag
				//     widget     → special tag
				var	tagClasses = [],
					tagsToSkip;
				if (TWINE1) { // for Twine 1
					tagsToSkip = /^(?:debug|nobr|passage|script|stylesheet|widget|twine\..*)$/i;
				} else { // for Twine 2
					tagsToSkip = /^(?:debug|nobr|passage|widget|twine\..*)$/i;
				}
				for (var i = 0; i < this.tags.length; ++i) {
					if (!tagsToSkip.test(this.tags[i])) {
						tagClasses.push(Util.slugify(this.tags[i]));
					}
				}
				if (tagClasses.length > 0) {
					if (el.className) {
						tagClasses = tagClasses.concat(el.className.split(/\s+/));
					}
					// sort and filter out non-uniques
					this.classes = tagClasses.sort().filter(function (val, i, aref) { // eslint-disable-line no-shadow
						return i === 0 || aref[i - 1] !== val;
					});
				}
			}
		} else {
			this.element = null;
			this.tags    = [];
			this.classes = [];
		}
	}

	// Setup the Passage prototype
	Object.defineProperties(Passage.prototype, {
		// getters
		className : {
			get : function () {
				return this.classes.join(" ");
			}
		},

		text : {
			get : function () {
				if (this.element == null) { // lazy equality for null
					return ('<span class="error" title="%passage%">' + strings.errors.title + ": "
						+ strings.errors.nonexistentPassage /* this also contains the `%passage%` pattern */
						+ '</span>').replace(/%passage%/g, Util.escape(this.title));
				}
				if (TWINE1) { // for Twine 1
					return _unescapeTwine1(this.element.textContent);
				} else { // for Twine 2
					return this.element.textContent.replace(/\r/g, "");
				}
			}
		},

		// methods
		description : {
			value : function () {
				if (config.passages.descriptions != null) { // lazy equality for null
					switch (typeof config.passages.descriptions) {
					case "boolean":
						if (config.passages.descriptions) {
							return this.title;
						}
						break;
					case "object":
						if (config.passages.descriptions.hasOwnProperty(this.title)) {
							return config.passages.descriptions[this.title];
						}
						break;
					case "function":
						var result = config.passages.descriptions.call(this);
						if (result) {
							return result;
						}
						break;
					default:
						throw new TypeError("config.passages.descriptions must be a boolean, object, or function");
					}
				}
				if (this._excerpt == null) { // lazy equality for null
					return Passage.getExcerptFromText(this.text);
				}
				return this._excerpt;
			}
		},

		processText : {
			value : function () {
				var res = this.text;
				// handle the nobr tag
				if (this.tags.contains("nobr")) {
					res = res.replace(/^\n+|\n+$/g, "").replace(/\n+/g, " ");
				}
				// check for image passage transclusion
				if (this.tags.contains("Twine.image")) {
					res = "[img[" + res + "]]";
				}
				return res;
			}
		},

		render : {
			value : function () {
				if (DEBUG) { console.log("[<Passage>.render()] title: " + this.title); }

				// create the new passage element
				var passage = insertElement(null, "div", this.domId, "passage");
				passage.setAttribute("data-passage", this.title);

				// add classes (generated from tags) to the passage and <body>
				for (var i = 0; i < this.classes.length; ++i) {
					document.body.classList.add(this.classes[i]);
					passage.classList.add(this.classes[i]);
				}

				// execute pre-render tasks
				Object.keys(prerender).forEach(function (task) {
					if (typeof prerender[task] === "function") {
						prerender[task].call(this, passage, task);
					}
				}, this);

				// wikify the PassageHeader passage, if it exists, into the passage element
				if (Story.has("PassageHeader")) {
					new Wikifier(passage, Story.get("PassageHeader").processText());
				}

				// wikify the passage into its element
				new Wikifier(passage, this.processText());

				// wikify the PassageFooter passage, if it exists, into the passage element
				if (Story.has("PassageFooter")) {
					new Wikifier(passage, Story.get("PassageFooter").processText());
				}

				// convert breaks to paragraphs within the output passage
				if (config.cleanupWikifierOutput) {
					convertBreaksToParagraphs(passage);
				}

				// execute post-render tasks
				Object.keys(postrender).forEach(function (task) {
					if (typeof postrender[task] === "function") {
						postrender[task].call(this, passage, task);
					}
				}, this);

				// create/update the excerpt cache to reflect the rendered text
				this._excerpt = Passage.getExcerptFromNode(passage);

				return passage;
			}
		}
	});

	// Setup the Passage static methods
	Object.defineProperties(Passage, {
		getExcerptFromNode : {
			value : function (node, count) {
				if (!node.hasChildNodes()) { return ""; }

				var	excerptRe = new RegExp("(\\S+(?:\\s+\\S+){0," + (count > 0 ? count - 1 : 7) + "})"),
					excerpt   = node.textContent.trim();
				if (excerpt !== "") {
					excerpt = excerpt
						// compact whitespace
						.replace(/\s+/g, " ")
						// attempt to match the excerpt regexp
						.match(excerptRe);
				}
				return excerpt ? excerpt[1] + "\u2026" : "\u2026"; // horizontal ellipsis
			}
		},

		getExcerptFromText : {
			value : function (text, count) {
				if (text === "") { return ""; }

				var	excerptRe = new RegExp("(\\S+(?:\\s+\\S+){0," + (count > 0 ? count - 1 : 7) + "})"),
					excerpt   = text
						// strip macro tags (replace with a space)
						.replace(/<<.*?>>/g, " ")
						// strip html tags (replace with a space)
						.replace(/<.*?>/g, " ")
						// the above might have left problematic whitespace, so trim
						.trim()
						// strip wiki tables
						.replace(/^\s*\|.*\|.*?$/gm, "")
						// strip wiki images
						.replace(/\[[<>]?img\[[^\]]*\]\]/g, "")
						// clean wiki links, i.e. remove all but the pretty link text
						.replace(/\[\[([^|\]]*)(?:|[^\]]*)?\]\]/g, "$1")
						// clean wiki !headings
						.replace(/^\s*!+(.*?)$/gm, "$1")
						// clean wiki bold/italic/underline/highlight formatting
						.replace(/\'{2}|\/{2}|_{2}|@{2}/g, "")
						// a final trim
						.trim()
						// compact whitespace
						.replace(/\s+/g, " ")
						// attempt to match the excerpt regexp
						.match(excerptRe);
				return excerpt ? excerpt[1] + "\u2026" : "\u2026"; // horizontal ellipsis
			}
		}
	});


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Passage; // export the constructor

})();

