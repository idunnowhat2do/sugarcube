/***********************************************************************************************************************
** [Begin story.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [History]
***********************************************************************************************************************/
function History()
{
	console.log("[History()]");
	console.log("    > mode: " + (config.historyMode === modes.hashTag ? "hashTag" : (config.historyMode === modes.windowHistory ? "windowHistory" : "sessionHistory")));
	if (window.history.state) { if (config.historyMode === modes.windowHistory) { console.log("    > window.history.state: " + window.history.state.length); } else if (config.historyMode === modes.sessionHistory) { console.log("    > window.history.state: " + window.history.state.sidx + "/" + window.history.state.suid); } } else { console.log("    > window.history.state: null (" + window.history.state + ")"); }

	// currently active/displayed state
	this.active = { init: true, variables: {} };	// allows macro initialization to set variables at startup

	// history state stack
	//     hashTag        [{ title: null, variables: {} }]
	//     windowHistory  [{ title: null, variables: {} }]
	//     sessionHistory [{ title: null, variables: {}, sidx: null }]
	this.history = [];
}

// setup accessor and mutator properties
History.prototype =
{
	get top ()     { return (this.history.length !== 0) ? this.history[this.history.length - 1] : null; },
	get bottom ()  { return (this.history.length !== 0) ? this.history[0] : null; },
	get isEmpty () { return this.history.length === 0; },
	get length ()  { return this.history.length; }
};

/*
History.prototype.clone = function (at)
{
	if (this.history.length == 0) { return null; }
	at = 1 + (at ? Math.abs(at) : 0);
	if (at > this.history.length) { return null; }

	var dup = clone(this.history[this.history.length - at], true);
	if (config.historyMode === modes.sessionHistory)
	{
		delete dup.sidx;
	}
	return dup;
};
*/

History.prototype.index = function (idx)
{
	if (this.history.length === 0) { return null; }
	if (idx < 0 || idx >= this.history.length) { return null; }

	return this.history[idx];
};

History.prototype.peek = function (at)
{
	if (this.history.length === 0) { return null; }
	at = 1 + (at ? Math.abs(at) : 0);
	if (at > this.history.length) { return null; }

	return this.history[this.history.length - at];
};

History.prototype.push = function (/* variadic */)
{
	if (arguments.length === 0) { return; }	// maybe throw?

	for (var i = 0; i < arguments.length; i++)
	{
		var state = arguments[i];
		if (config.historyMode === modes.sessionHistory)
		{
			state.sidx = this.history.length;
		}
		this.history.push(state);
	}
	return this.history.length;
};

History.prototype.pop = function (num)
{
	if (this.history.length === 0) { return []; }
	num = num ? Math.abs(num) : 1;
	//if (num > this.history.length) { return []; }

	return (num == 1) ? this.history.pop() : this.history.splice(this.history.length - num, num);
};

History.prototype.activate = function (state)
{
	if (arguments.length === 0) { return; }	// maybe throw?

	if (typeof state === "object")
	{
		if (state === null) { return null; }
		this.active = clone(state, true);
	}
	else
	{
		if (this.history.length === 0) { return null; }
		if (state < 0 || state >= this.history.length) { return null; }
		this.active = clone(this.history[state], true);
	}
	return this.active;
};

History.prototype.init = function ()
{
	console.log("[<History>.init()]");

	// display the initial passage
	if (typeof testPlay !== "undefined")	// enables the Twine 1.4+ "Test Play From Here" feature
	{
		console.log('    > display: "' + testPlay + '" (testPlay)');
		this.display(testPlay);
	}
	else if (!this.restore())
	{
		console.log('    > display: "Start"');
		this.display("Start");
	}

	// setup the history change handlers
	//   n.b. do not update these to use jQuery; the "popstate" event gains
	//        nothing from being wrapped in the jQuery Event object and it would
	//        complicate either the handlers, by having to deal with it, or the
	//        jQuery Event object, if we pushed the properties we need onto it
	if (config.historyMode === modes.windowHistory)
	{
		window.addEventListener("popstate", History.popStateHandler_windowHistory, false);
	}
	else if (config.historyMode === modes.sessionHistory)
	{
		window.addEventListener("popstate", History.popStateHandler_sessionHistory, false);
	}
	else
	{
		window.addEventListener("hashchange", History.hashChangeHandler, false);
	}
};

History.prototype.display = function (title, link, render)
{
	console.log("[<History>.display()]");
	// n.b. the title parameter can either be a passage title (string) or passage ID (number), so
	//      after loading the passage, always refer to passage.title and never the title parameter
	var passage = tale.get(title);

	// ensure that this.active is set if we have history
	if (this.active.init && !this.isEmpty)
	{
		if (config.historyMode === modes.sessionHistory)
		{
			console.log("    [SH]> state.active.init && !state.isEmpty; activating: " + (window.history.state !== null ? "window.history.state.sidx" : "state.top"));
			this.activate(window.history.state !== null ? window.history.state.sidx : this.top);
		}
		else if (config.historyMode === modes.windowHistory)
		{
			console.log("    [WH]> state.active.init && !state.isEmpty; activating: state.top");
			this.activate(this.top);
		}
		else
		{
			console.log("    [HT]> state.active.init && !state.isEmpty; activating: state.top");
			this.activate(this.top);
		}
	}

	// create a fresh entry in the history
	if (render !== "back")
	{
		if (!this.isEmpty)
		{
			if (config.disableHistoryTracking)
			{
				this.pop();
			}
			else if (config.historyMode === modes.sessionHistory && window.history.state.sidx < this.top.sidx)
			{
				console.log("    > stacks out of sync; popping " + (this.top.sidx - window.history.state.sidx) + " states to equalize");
				// stack IDs are out of sync, pop our stack until we're back in
				// sync with the window.history
				this.pop(this.top.sidx - window.history.state.sidx);
			}
		}

		this.push({ title: passage.title, variables: clone(this.active.variables, true) });
		this.activate(this.top);
	}
	if (render !== "back" || config.disableHistoryControls)
	{
		if (config.historyMode === modes.windowHistory)
		{
			if (window.history.state === null || config.disableHistoryControls)
			{
				window.history.replaceState(this.history, document.title);
			}
			else
			{
				window.history.pushState(this.history, document.title);
			}
		}
		else if (config.historyMode === modes.sessionHistory)
		{
			if (window.history.state === null || config.disableHistoryControls)
			{
				window.history.replaceState({ sidx: this.active.sidx, suid: this.suid }, document.title);
			}
			else
			{
				window.history.pushState({ sidx: this.active.sidx, suid: this.suid }, document.title);
			}
		}
	}
	if (config.historyMode === modes.hashTag || config.historyMode === modes.sessionHistory)
	{
		this.save();
	}

	// clear <body> classes and execute the PassageReady passage
	if (render !== "offscreen")
	{
		if (document.body.className)
		{
			document.body.className = "";
		}
		if (tale.has("PassageReady"))
		{
			try
			{
				Wikifier.wikifyEval(tale.get("PassageReady").text);
			}
			catch (e)
			{
				window.alert("There is a technical problem with this story (PassageReady: " + e.message + "). You may be able to continue reading, but all parts of the story may not work properly.");
			}
		}
	}

	// add it to the page
	var el = passage.render();
	el.style.visibility = "visible";
	if (render !== "offscreen")
	{
		var passages = document.getElementById("passages");
		removeChildren(passages);
		el.classList.add("transition-in");
		passages.appendChild(el);
		setTimeout(function () { el.classList.remove("transition-in"); }, 1);

		if (config.displayPassageTitles && passage.title !== "Start")
		{
			document.title = tale.title + ": " + passage.title;
		}
		if (config.historyMode === modes.hashTag)
		{
			if (!config.disableHistoryControls)
			{
				window.location.hash = this.hash = this.active.hash;
			}
			else
			{
				session.setItem("activeHash", this.hash = this.active.hash);
			}
		}
		window.scroll(0, 0);
	}

	// execute the PassageDone passage
	if (render !== "offscreen")
	{
		if (tale.has("PassageDone"))
		{
			try
			{
				Wikifier.wikifyEval(tale.get("PassageDone").text);
			}
			catch (e)
			{
				window.alert("There is a technical problem with this story (PassageDone: " + e.message + "). You may be able to continue reading, but all parts of the story may not work properly.");
			}
		}
	}

	// handle autosaves
	if (typeof config.saves.autosave !== "undefined")
	{
		if (typeof config.saves.autosave === "boolean")
		{
			if (config.saves.autosave)
			{
				SaveSystem.saveAuto();
			}
		}
		else if (passage.tags.indexOf(config.saves.autosave) !== -1)
		{
			SaveSystem.saveAuto();
		}
	}

	return el;
};

History.prototype.regenerateSuid = function ()
{
	session.removeItem("activeHistory");
	this.suid = generateUuid();
	this.save();
};

History.prototype.restart = function ()
{
	console.log("[<History>.restart()]");
	if (config.historyMode === modes.windowHistory)
	{
		window.history.pushState(null, document.title);	// yes, null
		window.location.reload();
	}
	else if (config.historyMode === modes.sessionHistory)
	{
		session.removeItem("activeHistory");
		window.location.reload();
	}
	else
	{
		if (!config.disableHistoryControls)
		{
			window.location.hash = "";
		}
		else
		{
			session.removeItem("activeHash");
			window.location.reload();
		}
	}
};

History.prototype.save = function ()
{
	console.log("[<History>.save()]");
	if (config.historyMode === modes.sessionHistory)
	{
		if (session.setItem("history." + this.suid, this.history))
		{
			session.setItem("activeHistory", this.suid);
		}
	}
	else if (config.historyMode === modes.hashTag)
	{
		var order = "";

		// encode our history
		for (var i = 0; i < this.history.length; i++)
		{
			var passage = tale.get(this.history[i].title);
			if (passage && typeof passage.id !== "undefined")	// 0 is a valid value for passage.id, so typeof it is
			{
				order += passage.id.toString(36) + ".";
			}
		}

		// save to the active & top history (stripping the trailing period)
		this.active.hash = this.top.hash = "#" + order.substr(0, order.length - 1);

		return this.active.hash;
	}
};

History.prototype.restore = function (suid)
{
	console.log("[<History>.restore()]");
	if (config.historyMode === modes.windowHistory)
	{
		if (window.history.state !== null)
		{
			this.history = window.history.state;
		}
		if (!this.isEmpty && tale.has(this.top.title))
		{
			this.display(this.top.title, null, "back");
			return true;
		}
	}
	else if (config.historyMode === modes.sessionHistory)
	{
		if (suid)
		{
			this.suid = suid;
		}
		else
		{
			if (window.history.state !== null && session.hasItem("activeHistory"))
			{
				this.suid = session.getItem("activeHistory");
			}
			else
			{
				this.suid = generateUuid();
			}
		}
		if (this.suid && session.hasItem("history." + this.suid))
		{
			this.history = session.getItem("history." + this.suid);
			console.log("    > window.history.state.sidx: " + window.history.state.sidx);
			if (tale.has(this.history[window.history.state.sidx].title))
			{
				this.display(this.history[window.history.state.sidx].title, null, "back");
				return true;
			}
		}
	}
	else if (config.historyMode === modes.hashTag)
	{
		var order;
		if (session.hasItem("activeHash"))
		{
			order = session.getItem("activeHash").replace("#", "").split(".");
		}
		else if (window.location.hash !== "" && window.location.hash !== "#")
		{
			order = window.location.hash.replace("#", "").split(".");
		}
		if (order)
		{
			try
			{
				// render the passages in the order the reader clicked them
				// we only show the very last one
				for (var i = 0, end = order.length - 1; i <= end; i++)
				{
					var id = parseInt(order[i], 36);

					if (!tale.has(id)) { return false; }

					console.log("    > id: " + id + " (" + order[i] + ")");

					this.display(id, null, (i === end) ? null : "offscreen");
				}

				return true;
			}
			catch (e)
			{
				console.log("restore failed", e);
			}
		}
	}
	return false;
};

History.hashChangeHandler = function (evt)
{
	console.log("[History.hashChangeHandler()]");

	if (window.location.hash !== state.hash)
	{
		if (window.location.hash !== "" && window.location.hash !== "#")
		{
			var el = document.getElementById("passages");

			// reset the history stack, making a copy of the <<remember>> variables
			var remember = storage.getItem("remember");
			state.active = { init: true, variables: (remember === null ? {} : clone(remember, true)) };
			state.history = [];

			if (!config.disableHistoryControls)
			{
				el.style.visibility = "hidden";
				removeChildren(el);
				if (!state.restore())
				{
					window.alert("The passage you had previously visited could not be found.");
				}
				el.style.visibility = "visible";
			}
			else
			{
				session.setItem("activeHash", state.hash = window.location.hash);
				window.location.hash = "";
				return;
			}
		}
		else
		{
			window.location.reload();
		}
		state.hash = window.location.hash;
	}
};

History.popStateHandler_windowHistory = function (evt)
{
	console.log("[History.popStateHandler_windowHistory()]");
	if (evt.state === null) { console.log("    > evt.state: null; no-op"); }

	// no-op if state is null
	if (evt.state === null) { return; }

	// throw error if state is empty
	if (evt.state.length === 0) { throw new Error("Guru meditation error!"); }

	state.history = evt.state;
	state.display(state.activate(state.top).title, null, "back");
};

History.popStateHandler_sessionHistory = function (evt)
{
	console.log("[History.popStateHandler_sessionHistory()]");
	if (evt.state === null) { console.log("    > evt.state: null; no-op"); }

	// no-op if state is null
	if (evt.state === null) { return; }

	// update the history stack if necessary
	if (evt.state.suid !== state.suid)
	{
		console.log("    > state from previous history detected, swapping in history");
		state.save();
		state.restore(evt.state.suid);
	}

	state.display(state.activate(evt.state.sidx).title, null, "back");
};


/***********************************************************************************************************************
** [Passage]
***********************************************************************************************************************/
function Passage(title, el, order)
{
	this.title = title;
	if (el)
	{
		this.id          = order;
		this.domId       = "passage-" + slugify(this.title);
		this.text        = Passage.unescapeLineBreaks(el.firstChild ? el.firstChild.nodeValue : "");
		this.textExcerpt = Passage.getExcerptFromText(this.text);
		this.tags        = el.hasAttribute("tags") ? el.getAttribute("tags").trim() : "";
		if (this.tags)
		{
			this.tags = this.tags.split(/\s+/);	//readBracketedList();
			this.classes = [];
			this.className = "";

			// add tags as classes
			if (this.tags.length > 0)
			{
				// tags to skip transforming into classes
				//     "debug"        : special tag
				//     "nobr"         : special tag
				//     "passage"      : the default class
				//     "script"       : special tag
				//     "stylesheet"   : special tag
				//     "widget"       : special tag
				//     "twine.*"      : special tag (in theory, anyway)
				//   ? "twinequest.*" : private use tag
				//   ? "tq.*"         : private use tag, AFAIK shorthand form of twinequest.*
				var tagsToSkip = /^(?:debug|nobr|passage|script|stylesheet|widget|twine\.\w*)$/i;

				var tagClasses = [];
				for (var i = 0; i < this.tags.length; i++)
				{
					var tag = this.tags[i].toLowerCase();
					if (!tagsToSkip.test(tag))
					{
						tagClasses.push(slugify(tag));
					}
				}
				if (tagClasses.length > 0)
				{
					if (el.className)
					{
						tagClasses = tagClasses.concat(el.className.split(/\s+/));
					}
					// sort and filter out non-uniques
					tagClasses = tagClasses.sort().filter(function (val, i, aref) { return (i === 0 || aref[i-1] != val) ? true : false });

					this.classes = tagClasses;
					this.className = tagClasses.join(' ');
				}
			}
		}
		else
		{
			this.tags = [];
			this.classes = [];
			this.className = "";
		}
	}
	else
	{
		this.text = "<html><span class=\"error\">Error: this passage does not exist</span></html>";
		this.tags = [];
		this.classes = [];
		this.className = "";
	}
}

Passage.prototype.processText = function ()
{
	var res = this.text;

	if (this.tags.indexOf("nobr") !== -1)
	{
		res = res.replace(/\n/g, "");	// maybe use zero-width-space or zero-width-non-joiner?
	}
	// check for Twine 1.4 Base64 image passage transclusion
	if (this.tags.indexOf("Twine.image") !== -1)
	{
		res = "[img[" + res + "]]";
	}
	return res;
};

Passage.prototype.render = function ()
{
	console.log("[<Passage>.render()]");

	// create the new passage element
	var passage = insertElement(null, "section", this.domId, "passage");
	passage.setAttribute("data-passage", this.title);
	passage.style.visibility = "hidden";

	// add classes (generated from tags) to the passage and <body>
	for (var i = 0, len = this.classes.length; i < len; i++)
	{
		document.body.classList.add(this.classes[i]);
		passage.classList.add(this.classes[i]);
	}

	// add the passage header, content, and footer elements
	insertElement(passage, "header", null, "header");
	var content = insertElement(passage, "div", null, "body content");
	insertElement(passage, "footer", null, "footer");

	// execute pre-render tasks
	for (var task in prerender)
	{
		if (typeof prerender[task] === "function") { prerender[task].call(this, content, task); }
	}

	// wikify the passage into the content element
	new Wikifier(content, this.processText());

	// execute post-render tasks
	for (var task in postrender)
	{
		if (typeof postrender[task] === "function") { postrender[task].call(this, content, task); }
	}

	// update the excerpt cache to reflect the rendered text
	this.textExcerpt = Passage.getExcerptFromNode(content);

	return passage;
};

Passage.prototype.reset = function ()
{
	/**
	 * This method should never be called, so this code is largely redundant
	 *   n.b. <Tale>.reset() does call this method, but nothing calls it, so...
	 */
	var store = document.getElementById("store-area").childNodes;
	for (var i = 0; i < store.length; i++)
	{
		var   el = store[i]
			, tiddlerTitle;
		if (el.getAttribute && (tiddlerTitle = el.getAttribute("tiddler")))
		{
			if (this.title == tiddlerTitle)
			{
				this.text = Passage.unescapeLineBreaks(el.firstChild ? el.firstChild.nodeValue : "");
				return;
			}
		}
	}
	this.text = "<html><span class=\"error\">Error: this passage does not exist</span></html>";
};

Passage.prototype.excerpt = function ()
{
	return this.textExcerpt;
};

Passage.getExcerptFromText = function (text, count)
{
	var   pattern = new RegExp("(\\S+(?:\\s+\\S+){0," + (typeof count !== 'undefined' ? count - 1 : 7) + "})")
		, result  = text
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
			// compact remaining whitespace
			.replace(/\s+/g, " ")
			// a final trim
			.trim()
			// lastly, match the excerpt
			.match(pattern);
	return (result ? result[1] + "\u2026" : "\u2026");
};

Passage.getExcerptFromNode = function (node, count)
{
	function getTextFromNode(node)
	{
		if (!node.hasChildNodes()) { return ""; }

		var   nodes  = node.childNodes
			, output = "";

		for (var i = 0, len = nodes.length; i < len; i++)
		{
			switch (nodes[i].nodeType)
			{
			case 1:	// element nodes
				if (nodes[i].style.display !== "none")
				{
					output += " ";	// out here to handle void nodes, in addition to child bearing nodes
					if (nodes[i].hasChildNodes())
					{
						output += getTextFromNode(nodes[i]);
					}
				}
				break;
			case 3:	// text nodes
				output += nodes[i].textContent;
				break;
			default:
				console.log(" ~> nodes[" + i + "].nodeType: " + nodes[i].nodeType);
				break;
			}
		}
		return output;
	}

	if (!node.hasChildNodes()) { return ""; }

	var   excerptRe = new RegExp("(\\S+(?:\\s+\\S+){0," + (typeof count !== 'undefined' ? count - 1 : 7) + "})")
		, excerpt   = getTextFromNode(node).trim();

	if (excerpt)
	{
		excerpt = excerpt
			// compact whitespace
			.replace(/\s+/g, " ")
			// attempt to match the excerpt regexp
			.match(excerptRe);
	}
	return (excerpt ? excerpt[1] + "\u2026" : "\u2026");
};

Passage.unescapeLineBreaks = function (text)
{
	if (text && text != "")
	{
		return text
			.replace(/\\n/gm, '\n')
			.replace(/\\s|\\/gm, '\\')	// "\\s" is required to workaround a Twine "feature"
			.replace(/\r/gm, "");
	}
	else
	{
		return "";
	}
};

Passage.mergeClassNames = function (/* variadic */)
{
	if (arguments.length == 0) { return ""; }

	var classes = [];
	for (var i = 0; i < arguments.length; i++)
	{
		if (typeof arguments[i] === "object" && Array.isArray(arguments[i]))
		{
			classes = classes.concat(arguments[i]);
		}
		else if (typeof arguments[i] === "string")
		{
			classes = classes.concat(arguments[i].split(/\s+/));
		}
	}
	if (classes.length > 0)
	{
		// return a string of sorted, and unique, class names
		return classes
			.sort()
			.filter(function (val, i, aref) { return (i == 0 || aref[i-1] != val) ? true : false })
			.join(' ');
	}
	return "";
};


/***********************************************************************************************************************
** [Tale]
***********************************************************************************************************************/
function Tale()
{
	console.log("[Tale()]");

	this.passages = {};
	// Chrome breaks some data URLs if you don't normalize
	if (document.normalize)
	{
		document.normalize();
	}
	var store = document.getElementById("store-area").childNodes;

	for (var i = 0; i < store.length; i++)
	{
		var el = store[i];
		var tiddlerTitle;
		if (el.getAttribute && (tiddlerTitle = el.getAttribute("tiddler")))
		{
			this.passages[tiddlerTitle] = new Passage(tiddlerTitle, el, i);
		}
	}
	this.setTitle(this.passages.StoryTitle ? this.passages.StoryTitle.text : "Untitled Story");
}

Tale.prototype.setTitle = function (title)
{
	this.title = title;
	this.domId = slugify(title);
};

Tale.prototype.has = function (key)
{
	if (typeof key === "string")
	{
		return this.passages[key] !== undefined && this.passages[key] !== null;
	}
	else if (typeof key === "number")
	{
		for (var pname in this.passages)
		{
			if (this.passages[pname].id === key)
			{
				return true;
			}
		}
	}
	return false;
};

Tale.prototype.get = function (key)
{
	if (typeof key === "string")
	{
		return this.passages[key] || new Passage(key);
	}
	else if (typeof key === "number")
	{
		for (var pname in this.passages)
		{
			if (this.passages[pname].id === key)
			{
				return this.passages[pname];
			}
		}
	}
	return;	//FIXME: should this return null instead of undefined?
};

Tale.prototype.lookup = function (key, value, sortKey)
{
	if (!sortKey) { sortKey = "title"; }
	var results = [];

	for (var pname in this.passages)
	{
		var passage = this.passages[pname];

		switch (typeof passage[key])
		{
		case "undefined":
			/* noop */
			break;
		case "object":
			// currently, we assume that the only properties which are objects
			// will be either arrays or array-like-objects
			for (var i = 0; i < passage[key].length; i++)
			{
				if (passage[key][i] == value)	// use lazy equality
				{
					results.push(passage);
				}
			}
			break;
		default:
			if (passage[key] == value)	// use lazy equality
			{
				results.push(passage);
			}
			break;
		}
	}

	results.sort(function (a, b) { return (a[sortKey] == b[sortKey]) ? 0 : ((a[sortKey] < b[sortKey]) ? -1 : +1); });

	return results;
};

Tale.prototype.reset = function ()
{
	/**
	 * This method should never be called, so this code is largely redundant
	 */
	for (var i in this.passages)
	{
		this.passages[i].reset();
	}
};


/***********************************************************************************************************************
** [End story.js]
***********************************************************************************************************************/
