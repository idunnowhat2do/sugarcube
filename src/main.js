/***********************************************************************************************************************
** [Begin main.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Function Library, Story Utilities]
***********************************************************************************************************************/

/**
 * Returns a random integer in the range of min and max
 *   n.b. Using Math.round() will give you a non-uniform distribution!
 */
function getRandom(min, max)
{
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random float in the range of min and max
 */
function getRandomArbitrary(min, max)
{
	return Math.random() * (max - min) + min;
}


/***********************************************************************************************************************
** [Initialization]
***********************************************************************************************************************/
var version = { title: "SugarCube", major: 1, minor: 0, revision: 0, date: new Date("August 13, 2013"), extensions: {} };

var modes =		// SugarCube History class modes
{
	  hashTag:        1
	, windowHistory:  2
	, sessionHistory: 3
};

var config =	// SugarCube config
{
	// capability properties
	  hasPushState:      ("history" in window) && ("pushState" in window.history)
	  // the try/catch and length property access here is required due to a monumentally stupid
	  // Firefox bug [ #748620; https://bugzilla.mozilla.org/show_bug.cgi?id=748620 ]
	, hasLocalStorage:   ("localStorage" in window) && (function () { try { return window.localStorage != null && window.localStorage.length >= 0 } catch (e) { return false } }())	// use != to catch both null & undefined
	, hasSessionStorage: ("sessionStorage" in window) && (function () { try { return window.sessionStorage != null && window.sessionStorage.length >= 0 } catch (e) { return false } }())	// use != to catch both null & undefined
	, hasFileAPI:        window.File && window.FileReader && window.Blob

	// basic browser detection
	, userAgent: navigator.userAgent.toLowerCase()
	, browser: {}

	// general option properties
	, displayPassageTitles: false
	, historyMode:          modes.hashTag

	// saves option properties
	, saves:
		{
			  id:        "untitled_story"
			, isAllowed: undefined
			, onLoad:    undefined
			, onSave:    undefined
			, slots:     8
			, version:   undefined
		}
};
config.browser =
{
	  isGecko:      (navigator && navigator.product === "Gecko") && (config.userAgent.indexOf("webkit") === -1)
	, isIE:         (config.userAgent.indexOf("msie") !== -1) && (config.userAgent.indexOf("opera") === -1)
	, ieVersion:    (function () { var ieVer = /msie (\d{1,2}\.\d)/.exec(config.userAgent); return ieVer ? +ieVer[1] : 0; }())
	// opera <= 12: "opera/9.80 (windows nt 6.1; wow64) presto/2.12.388 version/12.16"
	// opera >= 15: "mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/28.0.1500.52 safari/537.36 opr/15.0.1147.130"
	, isOpera:      (config.userAgent.indexOf("opera") !== -1) || (config.userAgent.indexOf(" opr/") !== -1)
	, operaVersion: (function () { var re = new RegExp((/applewebkit|chrome/.test(config.userAgent) ? "opr" : "version") + "\\/(\\d{1,2}\\.\\d+)"), oprVer = re.exec(config.userAgent); return oprVer ? +oprVer[1] : 0; }())
};
config.historyMode = (config.hasPushState ? (config.browser.isGecko ? modes.sessionHistory : modes.windowHistory) : modes.hashTag);

var   formatter = null	// Wikifier formatters
	, tale      = {}	// story manager
	, state     = {}	// history manager
	, macros    = {}	// macro store
	, storage   = {}	// persistant storage manager
	, session   = {}	// session manager
	, setup     = {};	// author setup variable store

/**
 * Main function, entry point for story startup
 */
function main()
{
	/**
	 * Returns the DOM element corresponding to the passed ID or null on failure
	 *     n.b. Legacy code for old scripts
	 */
	function $(id)
	{
		return (typeof id === "object") ? id : document.getElementById(id);
	}

	console.log("[main()]");

	// instantiate wikifier formatters, story, storage, and session objects
	formatter = new WikiFormatter(Wikifier.formatters);
	tale      = new Tale();
	storage   = new KeyValueStore("localStorage", tale.domId);
	session   = new KeyValueStore("sessionStorage", tale.domId);

	// set the document title
	document.title = tale.title;

	// set the default saves ID
	config.saves.id = tale.domId;

	// setup for StoryBanner, StoryTitle, StorySubtitle, StoryAuthor, StoryCaption, StoryMenu, & ShareMenu passages
	setPageElement("storyBanner", "StoryBanner");
	setPageElement("storyTitle", "StoryTitle", tale.title);
	setPageElement("storySubtitle", "StorySubtitle");
	setPageElement("storyAuthor", "StoryAuthor");
	if (tale.has("StoryCaption"))
	{
		document.getElementById("storyCaption").style.display = "block";
		setPageElement("storyCaption", "StoryCaption");
	}
	if (tale.has("StoryMenu"))
	{
		document.getElementById("storyMenu").style.display = "block";
		setPageElement("storyMenu", "StoryMenu");
	}
	if (tale.has("ShareMenu"))
	{
		var shareMenu = document.getElementById("shareMenu");
		if (shareMenu)
		{
			var shareMenuText = tale.get("ShareMenu").text.trim();
			if (shareMenuText)
			{
				// build the menu contents
				removeChildren(shareMenu);
				new Wikifier(shareMenu, shareMenuText);
				shareMenu.innerHTML = shareMenu.innerHTML.replace(/(?:<br\s*\/?>)+/g, "\n");

				// enable the sidebar menu item
				var shareItem = document.getElementById("share");
				if (shareItem) { shareItem.style.display = "block"; }
			}
		}
	}

	// setup for story stylesheets & scripts (order: stylesheets, scripts, widgets)
	var styles = tale.lookup("tags", "stylesheet");
	for (var i = 0; i < styles.length; i++)
	{
		addStyle(styles[i].text);
	}
	var scripts = tale.lookup("tags", "script");
	for (var i = 0; i < scripts.length; i++)
	{
		try
		{
			eval(scripts[i].text);
		}
		catch (e)
		{
			window.alert("There is a technical problem with this story (" + scripts[i].title + ": " + e.message + "). You may be able to continue reading, but all parts of the story may not work properly.");
		}
	}
	var widgets = tale.lookup("tags", "widget");
	for (var i = 0; i < widgets.length; i++)
	{
		try
		{
			var errTrap = document.createElement("div");
			new Wikifier(errTrap, widgets[i].text);
			while (errTrap.hasChildNodes())
			{
				var fc = errTrap.firstChild;
				if (fc.classList && fc.classList.contains("error")) { throw new Error(fc.textContent); }
				errTrap.removeChild(fc);
			}
		}
		catch (e)
		{
			window.alert("There is a technical problem with this story (" + widgets[i].title + ": " + e.message + "). You may be able to continue reading, but all parts of the story may not work properly.");
		}
	}

	/**
	 * The ordering of the following code is important!
	 */
	// 1. instantiate a history object for our state
	state = new History();

	// 2. call macros' "early" init functions
	for (var macroName in macros)
	{
		if (typeof macros[macroName].init === "function")
		{
			macros[macroName].init(macroName);
		}
	}

	// 3. execute the StoryInit passage
	if (tale.has("StoryInit"))
	{
		try
		{
			var errTrap = document.createElement("div");
			new Wikifier(errTrap, tale.get("StoryInit").text);
			while (errTrap.hasChildNodes())
			{
				var fc = errTrap.firstChild;
				if (fc.classList && fc.classList.contains("error")) { throw new Error(fc.textContent); }
				errTrap.removeChild(fc);
			}
		}
		catch (e)
		{
			window.alert("There is a technical problem with this story (StoryInit: " + e.message + "). You may be able to continue reading, but all parts of the story may not work properly.");
		}
	}

	// 4. initialize our state
	state.init();	// this could take a while, so do it late

	// 5. call macros' "late" init functions
	for (var macroName in macros)
	{
		if (typeof macros[macroName].lateInit === "function")
		{
			macros[macroName].lateInit(macroName);
		}
	}

	// 6. initialize the user interface
	MenuSystem.init();
}

window.onload = main;	// starts the magic


/***********************************************************************************************************************
** [Save System]
***********************************************************************************************************************/
var SaveSystem =
{
	maxIndex: 0,
	init: function (slot)
	{
		var saves;
		if (storage.hasItem("saves"))
		{
			saves = storage.getItem("saves");
		}
		else
		{
			saves = new Array(config.saves.slots);
			storage.setItem("saves", saves);
		}
		SaveSystem.maxIndex = saves.length - 1;
	},
	save: function (slot)
	{
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed())
		{
			window.alert("Saving is not allowed here.");
			return false;
		}
		if (slot < 0 || slot > SaveSystem.maxIndex) { return false; }
		if (!storage.hasItem("saves")) { return false; }

		var saves = storage.getItem("saves");
		if (slot > saves.length) { return false; }

		saves[slot] = SaveSystem.marshal();
		saves[slot].title = tale.get(state.active.title).excerpt();

		return storage.setItem("saves", saves);
	},
	load: function (slot)
	{
		if (slot < 0 || slot > SaveSystem.maxIndex) { return false; }
		if (!storage.hasItem("saves")) { return false; }

		var saves = storage.getItem("saves");
		if (slot > saves.length) { return false; }
		if (saves[slot] === null) { return false; }

		return SaveSystem.unmarshal(saves[slot]);
	},
	delete: function (slot)
	{
		if (slot < 0 || slot > SaveSystem.maxIndex) { return false; }
		if (!storage.hasItem("saves")) { return false; }

		var saves = storage.getItem("saves");
		if (slot > saves.length) { return false; }

		saves[slot] = null;
		return storage.setItem("saves", saves);
	},
	purge: function ()
	{
		return storage.removeItem("saves");
	},
	exportSave: function ()
	{
		console.log("[SaveSystem.exportSave()]");

		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed())
		{
			window.alert("Saving is not allowed here.");
			return;
		}

		var   saveName = tale.domId + ".json"
			, saveObj  = JSON.stringify(SaveSystem.marshal());

		saveAs(new Blob([saveObj], { type: "application/json;charset=UTF-8" }), saveName);
	},
	importSave: function (event)
	{
		console.log("[SaveSystem.importSave()]");

		var   file   = event.target.files[0]
			, reader = new FileReader();

		// capture the file information once the load is finished
		reader.onload = (function(file)
		{
			return function(e)
			{
				console.log('    > loaded: ' + escape(file.name) + '; payload: ' + e.target.result);

				if (!e.target.result) { return; }

				var saveObj;
				try
				{
					saveObj = JSON.parse(e.target.result);
				}
				catch (e)
				{
					// noop, the unmarshal() function will handle the error
				}
				SaveSystem.unmarshal(saveObj);
			};
		})(file);

		// initiate the file load
		reader.readAsText(file);
	},
	marshal: function ()
	{
		console.log("[SaveSystem.marshal()]");

		var saveObj =
		{
			  mode: config.historyMode
			, id:   config.saves.id
		};

		if (config.saves.version)
		{
			saveObj.version = config.saves.version;
		}
		switch (config.historyMode)
		{
		case modes.windowHistory:
			saveObj.data = deepCopy(state.history);
			break;
		case modes.sessionHistory:
			saveObj.data = deepCopy(state.history.slice(0, state.active.sidx + 1));
			break;
		case modes.hashTag:
			saveObj.data = state.active.hash;
			break;
		}

		if (typeof config.saves.onSave === "function")
		{
			config.saves.onSave(saveObj);
		}

		return saveObj;
	},
	unmarshal: function (saveObj)
	{
		console.log("[SaveSystem.unmarshal()]");

		if (!saveObj || !saveObj.hasOwnProperty("mode") || !saveObj.hasOwnProperty("id") || !saveObj.hasOwnProperty("data"))
		{
			window.alert("Save is missing the required game data.  Either you've loaded a file which isn't a save, or the save has become corrupted.\n\nAborting load.");
			return false;
		}
		if (saveObj.mode !== config.historyMode)
		{
			window.alert("Save is from the wrong history mode.\n\nAborting load.");
			return false;
		}

		if (typeof config.saves.onLoad === "function")
		{
			config.saves.onLoad(saveObj);
		}

		if (saveObj.id !== config.saves.id)
		{
			window.alert("Save is from the wrong story.\n\nAborting load.");
			return false;
		}

		switch (config.historyMode)
		{
		case modes.windowHistory:
			// fallthrough
		case modes.sessionHistory:
			// necessary?
			document.title = tale.title;

			// start a new state history (do not call init()!)
			state = new History();
			if (config.historyMode === modes.sessionHistory)
			{
				state.regenerateSuid();
			}

			// restore the history states in order
			for (var i = 0, len = saveObj.data.length; i < len; i++)
			{
				// load the state from the save
				state.history.push(deepCopy(saveObj.data[i]));

				console.log("    > loading: " + i + " (" + state.history[i].title + ")");

				// load the state into the window history
				if (config.historyMode === modes.windowHistory)
				{
					window.history.pushState(state.history, document.title);
				}
				else
				{
					window.history.pushState({ sidx: state.history[i].sidx, suid: state.suid }, document.title);
				}
			}

			// activate the current top and display the passage
			state.activate(state.top);
			state.display(state.active.title, null, "back");
			break;

		case modes.hashTag:
			window.location.hash = saveObj.data;
			break;
		}

		return true;
	}
};


/***********************************************************************************************************************
** [Menu System]
***********************************************************************************************************************/
var MenuSystem =
{
	init: function ()
	{
		function addClickHandler(el, handler)
		{
			if (el && el.hasChildNodes())
			{
				var children = el.childNodes;
				for (var i = 0; i < children.length; i++)
				{
					if (children[i].nodeName.toLowerCase() == "a")
					{
						children[i].onclick = handler;
						return;
					}
				}
				el.onclick = handler;	// fallback
			}
		}

		addClickHandler(document.getElementById("saves"),    MenuSystem.showSaves);
		addClickHandler(document.getElementById("snapback"), MenuSystem.showSnapback);
		addClickHandler(document.getElementById("restart"),  MenuSystem.restart);
		addClickHandler(document.getElementById("share"),    MenuSystem.showShare);
	},
	hideAllMenus: function ()
	{
		var el;
		if (el = document.getElementById("savesMenu"))    { el.style.display = "none"; }
		if (el = document.getElementById("snapbackMenu")) { el.style.display = "none"; }
		if (el = document.getElementById("shareMenu"))    { el.style.display = "none"; }
	},
	showMenu: function (event, el, target)
	{
		if (!event)
		{
			event = window.event;
			if (!target)
			{
				target = event.srcElement;
			}
		}
		else if (!target)
		{
			target = event.target;
		}

		var   pos  = { x: 0, y: 0 }
			, rect = target.getBoundingClientRect();

		pos.x = rect.right + 6;
		pos.y = rect.top - Math.floor((rect.bottom - rect.top) / 2);

		el.style.top     = pos.y + "px";
		el.style.left    = pos.x + "px";
		el.style.display = "block";
		document.onclick = MenuSystem.hideAllMenus;

		event.cancelBubble = true;
		if (event.stopPropagation)
		{
			event.stopPropagation();
		}
	},
	showSaves: function (event)
	{
		var menu = document.getElementById("savesMenu");
		MenuSystem.hideAllMenus();
		if (MenuSystem.buildSaves(menu))
		{
			MenuSystem.showMenu(event, menu);
		}
	},
	buildSaves: function (menu)
	{
		function createActionItem(bId, bText, bAction)
		{
			var li = document.createElement("li");
			var btn = document.createElement("button");
			btn.id = "savesMenu_" + bId;
			btn.innerHTML = bText;
			btn.onclick = bAction;
			li.appendChild(btn);
			return li;
		}
		function createSaveList()
		{
			function createButton(bIdClass, bText, bSlot, bAction)
			{
				var btn = document.createElement("button");
				btn.id = "savesMenu_" + bIdClass + bSlot;
				btn.classList.add(bIdClass);
				btn.innerHTML = bText;
				btn.onclick = (function (i)
				{
					return function ()
					{
						bAction(i);
					};
				}(bSlot));
				return btn;
			}

			var   saves = storage.getItem("saves")
				, tbody = document.createElement("tbody");
			for (var i = 0; i < saves.length; i++)
			{
				var   tr     = document.createElement("tr")
					, tdSlot = document.createElement("td")
					, tdLoad = document.createElement("td")
					, tdDesc = document.createElement("td")
					, tdDele = document.createElement("td");

				tdSlot.appendChild(document.createTextNode(i+1));

				var tdLoadBtn, tdDescTxt, tdDeleBtn;
				if (saves[i] && saves[i].mode === config.historyMode)
				{
					tdLoadBtn = createButton("load", "Load", i, SaveSystem.load);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createTextNode(saves[i].title);
					tdDesc.appendChild(tdDescTxt);

					tdDeleBtn = createButton("delete", "Delete", i, SaveSystem.delete);
					tdDele.appendChild(tdDeleBtn);
				}
				else
				{
					tdLoadBtn = createButton("save", "Save", i, SaveSystem.save);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createElement("i");
					tdDescTxt.innerHTML = "(save slot empty)";
					tdDesc.appendChild(tdDescTxt);
					tdDesc.classList.add("emptySave");
				}

				tr.appendChild(tdSlot);
				tr.appendChild(tdLoad);
				tr.appendChild(tdDesc);
				tr.appendChild(tdDele);
				tbody.appendChild(tr);
			}
			var table = document.createElement("table");
			table.id = "savesMenu_list";
			table.appendChild(tbody);
			return table;
		}
		var   list
			, savesOK = storage.store !== null;

		// remove old contents
		removeChildren(menu);

		if (savesOK)
		{
			// initialize the saves
			SaveSystem.init();

			// add saves list
			list = createSaveList();
			if (!list || list.length === 0)
			{
				list = document.createElement("div");
				list.id = "savesMenu_list"
				list.innerHTML = "<i>No save slots found</i>";
			}
			menu.appendChild(list);
		}

		// add action list (export, import, and purge)
		if (savesOK || (config.hasFileAPI && (!config.browser.isOpera || config.browser.operaVersion >= 15)))
		{
			list = document.createElement("ul");
			if (config.hasFileAPI && (!config.browser.isOpera || config.browser.operaVersion >= 15))
			{
				list.appendChild(createActionItem("export", "Save to Disk\u2026", SaveSystem.exportSave));
				list.appendChild(createActionItem("import", "Load from Disk\u2026", MenuSystem.showSavesImport));
			}
			if (savesOK)
			{
				list.appendChild(createActionItem("purge",  "Purge Save Slots",   SaveSystem.purge));
			}
			menu.appendChild(list);
			return true;
		}
		else
		{
			window.alert("Apologies!  Your browser either has none of the features required to support saves or has disabled them.\n\nThe former may be solved by updating it to a more recent version or by switching to a more modern browser.\n\nThe latter may be solved by loosening its security restrictions or, perhaps, by viewing the story via the HTTP protocol.");
			return false;
		}
	},
	showSavesImport: function (event)
	{
		var menu = document.getElementById("savesMenu");
		MenuSystem.hideAllMenus();
		MenuSystem.buildSavesImport(menu);
		MenuSystem.showMenu(event, menu, document.getElementById("saves").getElementsByTagName("a")[0]);
	},
	buildSavesImport: function (menu)
	{
		var   label = document.createElement("div")
			, input = document.createElement("input");

		// remove old contents
		removeChildren(menu);

		// add label
		label.id = "savesMenu_importLabel";
		label.appendChild(document.createTextNode("Select a save file to load:"));
		menu.appendChild(label);

		// add file input
		input.type     = "file";
		input.id       = "savesMenu_importFile";
		input.name     = "savesMenu_importFile";
		input.onchange = SaveSystem.importSave;
		menu.appendChild(input);
	},
	showSnapback: function (event)
	{
		var menu = document.getElementById("snapbackMenu");
		MenuSystem.hideAllMenus();
		MenuSystem.buildSnapback(menu);
		MenuSystem.showMenu(event, menu);
	},
	buildSnapback: function (menu)
	{
		var hasItems = false;
		removeChildren(menu);

		for (var i = 0, len = state.history.length - 1; i < len; i++)
		{
			var passage = tale.get(state.history[i].title);
			if (passage && passage.tags.indexOf("bookmark") !== -1)
			{
				var el = document.createElement("div");
				el.onclick = (function ()
				{
					var p = i;
					if (config.historyMode === modes.windowHistory)
					{
						return function ()
						{
							console.log("[snapback:onclick() @windowHistory]");

							// necessary?
							document.title = tale.title;

							// push the history states in order
							for (var i = 0, end = p; i <= end; i++)
							{
								console.log("    > pushing: " + i + " (" + state.history[i].title + ")");

								// load the state into the window history
								window.history.pushState(state.history.slice(0, i + 1), document.title);
							}

							// stack ids are out of sync, pop our stack until
							// we're back in sync with the window.history
							state.pop(state.history.length - (p + 1));

							// activate the current top
							state.activate(state.top);

							// display the passage
							state.display(state.active.title, null, "back");
						};
					}
					else if (config.historyMode === modes.sessionHistory)
					{
						return function ()
						{
							console.log("[snapback:onclick() @sessionHistory]");

							// necessary?
							document.title = tale.title;

							// regenerate the state history suid
							state.regenerateSuid();

							// push the history states in order
							for (var i = 0, end = p; i <= end; i++)
							{
								console.log("    > pushing: " + i + " (" + state.history[i].title + ")");

								// load the state into the window history
								window.history.pushState({ sidx: state.history[i].sidx, suid: state.suid }, document.title);
							}

							if (window.history.state.sidx < state.top.sidx)
							{
								console.log("    > stacks out of sync; popping " + (state.top.sidx - window.history.state.sidx) + " states to equalize");
								// stack ids are out of sync, pop our stack until
								// we're back in sync with the window.history
								state.pop(state.top.sidx - window.history.state.sidx);
							}

							// activate the current top
							state.activate(state.top);

							// display the passage
							state.display(state.active.title, null, "back");
						};
					}
					else
					{
						return function ()
						{
							window.location.hash = state.history[p].hash;
						};
					}
				}());
				el.innerHTML = passage.excerpt();
				menu.appendChild(el);
				hasItems = true;
			}
		}
		if (!hasItems)
		{
			var el = document.createElement("div");
			el.innerHTML = "<i>No passages available</i>";
			menu.appendChild(el);
		}
	},
	restart: function ()
	{
		if (confirm("Are you sure you want to restart this story?"))
		{
			state.restart();
		}
	},
	showShare: function (event)
	{
		MenuSystem.hideAllMenus();
		MenuSystem.showMenu(event, document.getElementById("shareMenu"));
	}
};


/***********************************************************************************************************************
** [History]
***********************************************************************************************************************/
function History()
{
	console.log("[History()]");
	console.log("    > mode: " + (config.historyMode === modes.hashTag ? "hashTag" : (config.historyMode === modes.windowHistory ? "windowHistory" : "sessionHistory")));
	if (window.history.state) { if (config.historyMode === modes.windowHistory) { console.log("    > window.history.state: " + window.history.state.length.toString()); } else if (config.historyMode === modes.sessionHistory) { console.log("    > window.history.state: " + window.history.state.sidx + "/" + window.history.state.suid); } } else { console.log("    > window.history.state: null (" + window.history.state + ")"); }

	// currently active/displayed state
	this.active = { init: true, variables: {} };	// allows macro initialization to set variables at startup

	// history state stack
	//     hashTag        [{ title: null, variables: {} }]
	//     windowHistory  [{ title: null, variables: {} }]
	//     sessionHistory [{ title: null, variables: {}, sidx: null }]
	this.history = [];
}

// setup accessors and mutators
History.prototype =
{
	get isEmpty () { return this.history.length === 0; },
	get length ()  { return this.history.length; },
	get top ()     { return (this.history.length !== 0) ? this.history[this.history.length - 1] : null; }
};

/*
History.prototype.clone = function (at)
{
	if (this.history.length == 0) { return null; }
	at = 1 + (at ? Math.abs(at) : 0);
	if (at > this.history.length) { return null; }

	var dup = deepCopy(this.history[this.history.length - at]);
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
	if (typeof state === "object")
	{
		if (state === null) { return null; }
		this.active = deepCopy(state);
	}
	else
	{
		if (this.history.length === 0) { return null; }
		if (state < 0 || state >= this.history.length) { return null; }
		this.active = deepCopy(this.history[state]);
	}
	return this.active;
};

History.prototype.init = function ()
{
	console.log("[<History>.init()]");

	// display the initial passage
	if (!this.restore())
	{
		this.display("Start");
	}

	// setup the history change handlers
	if (config.historyMode === modes.windowHistory)
	{
		window.onpopstate = History.popStateHandler_windowHistory;
	}
	else if (config.historyMode === modes.sessionHistory)
	{
		window.onpopstate = History.popStateHandler_sessionHistory;
	}
	else
	{
		window.onhashchange = History.hashChangeHandler;
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
		if (config.historyMode === modes.sessionHistory && !this.isEmpty && window.history.state.sidx < this.top.sidx)
		{
			console.log("    > stacks out of sync; popping " + (this.top.sidx - window.history.state.sidx) + " states to equalize");
			// stack ids are out of sync, pop our stack until we're back
			// in sync with the window.history
			this.pop(this.top.sidx - window.history.state.sidx);
		}

		this.push({ title: passage.title, variables: deepCopy(this.active.variables) });
		this.activate(this.top);

		if (config.historyMode === modes.windowHistory)
		{
			if (window.history.state === null && this.history.length !== 1)
			{
				console.log("    > !DANGER! (window.history.state === null) && (this.history.length !== 1) !DANGER!");
				window.alert("!DANGER! (window.history.state === null) && (this.history.length !== 1) !DANGER!");
			}

			//FIXME: this or that? if (window.history.state === null)
			if (this.history.length === 1 && window.history.state === null)
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
			if (window.history.state === null)
			{
				window.history.replaceState({ sidx: this.active.sidx, suid: this.suid }, document.title);
			}
			else
			{
				window.history.pushState({ sidx: this.active.sidx, suid: this.suid }, document.title);
			}
		}
	}
	if (config.historyMode === modes.hashTag)
	{
		this.active.hash = this.top.hash = this.save();
	}
	else if (config.historyMode === modes.sessionHistory)
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
				var errTrap = document.createElement("div");
				new Wikifier(errTrap, tale.get("PassageReady").text);
				while (errTrap.hasChildNodes())
				{
					var fc = errTrap.firstChild;
					if (fc.classList && fc.classList.contains("error")) { throw new Error(fc.textContent); }
					errTrap.removeChild(fc);
				}
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
		setTimeout(function () { el.classList.remove("transition-in"); }, 1);
		passages.appendChild(el);

		if (config.displayPassageTitles && passage.title !== "Start")
		{
			document.title = tale.title + ": " + passage.title;
		}
		if (config.historyMode === modes.hashTag)
		{
			window.location.hash = this.hash = this.top.hash;
		}
		window.scroll(0, 0);
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
		window.location.hash = "";
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

		// strip the trailing period
		return "#" + order.substr(0, order.length - 1);
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
		if (window.location.hash !== "" && window.location.hash !== "#")
		{
			try
			{
				var order = window.location.hash.replace("#", "").split(".");

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
			catch(e)
			{
				console.log("restore failed", e);
			}
		}
	}
	return false;
};

History.hashChangeHandler = function (e)
{
	console.log("[History.hashChangeHandler()]");

	if (window.location.hash !== state.hash)
	{
		if (window.location.hash !== "" && window.location.hash !== "#")
		{
			var el = document.getElementById("passages");

			// reset the history stack, making a copy of the <<remember>> variables
			var remember = storage.getItem("remember");
			state.active = { init: true, variables: (remember === null ? {} : deepCopy(remember)) };
			state.history = [];

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
			window.location.reload();
		}
		state.hash = window.location.hash;
	}
};

History.popStateHandler_windowHistory = function (e)
{
	console.log("[History.popStateHandler_windowHistory()]");
	if (e.state === null) { console.log("    > e.state: null; no-op"); }

	// no-op if state is null
	if (e.state === null) { return; }

	// throw error if state is empty
	if (e.state.length === 0) { throw new Error("Guru meditation error!"); }

	state.history = e.state;
	state.display(state.activate(state.top).title, null, "back");
};

History.popStateHandler_sessionHistory = function (e)
{
	console.log("[History.popStateHandler_sessionHistory()]");
	if (e.state === null) { console.log("    > e.state: null; no-op"); }

	// no-op if state is null
	if (e.state === null) { return; }

	// update the history stack if necessary
	if (e.state.suid !== state.suid)
	{
		console.log("    > state from previous history detected, swapping in history");
		state.save();
		state.restore(e.state.suid);
	}

	state.display(state.activate(e.state.sidx).title, null, "back");
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
		this.domId       = "passage_" + slugify(this.title);
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
				//     "passage"      : the default class
				//     "stylesheet"   : special tag
				//     "script"       : special tag
				//     "widget"       : special tag
				//     "twine.*"      : special tag (in theory, anyway)
				//   ? "twinequest.*" : private use tag
				//   ? "tq.*"         : private use tag, AFAIK shorthand form of twinequest.*
				var tagsToSkip = /^(?:passage|stylesheet|script|widget|twine\.\w*)$/i;

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
					tagClasses.sort().filter(function (val, i, aref) { return (i == 0 || aref[i-1] != val) ? true : false });

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

Passage.prototype.render = function ()
{
	console.log("[<Passage>.render()]");
	var passage = insertElement(null, "section", this.domId, "passage");
	passage.style.visibility = "hidden";

	// add classes (generated from tags) to the passage and <body>
	for (var i = 0, len = this.classes.length; i < len; i++)
	{
		document.body.classList.add(this.classes[i]);
		passage.classList.add(this.classes[i]);
	}

	// add passage header element
	insertElement(passage, "header", "", "header");

	// add passage content element
	var content = insertElement(passage, "div", "", "content");
	new Wikifier(content, this.text);

	// add passage footer element
	insertElement(passage, "footer", "", "footer");

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
	var store = document.getElementById("storeArea").childNodes;
	for (var i = 0; i < store.length; i++)
	{
		var el = store[i];
		var tiddlerTitle;
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
	var pattern = new RegExp("(\\S+(?:\\s+\\S+){0," + (typeof count != 'undefined' ? count - 1 : 7) + "})");
	var result = text
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
	if (!node.hasChildNodes()) { return ""; }

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

	var   excerptRe = new RegExp("(\\S+(?:\\s+\\S+){0," + (typeof count != 'undefined' ? count - 1 : 7) + "})")
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
			.replace(/\\s|\\/gm, '\\')	// "\\s" is required to workaround a Twine bug
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
	this.passages = {};
	if (document.normalize)
	{
		document.normalize();
	}
	var store = document.getElementById("storeArea").childNodes;
	for (var i = 0; i < store.length; i++)
	{
		var el = store[i];
		var tiddlerTitle;
		if (el.getAttribute && (tiddlerTitle = el.getAttribute("tiddler")))
		{
			this.passages[tiddlerTitle] = new Passage(tiddlerTitle, el, i);
		}
	}
	if (this.passages.StoryTitle)
	{
		this.title = this.passages.StoryTitle.text;
	}
	else
	{
		this.title = "Untitled Story";
	}
	this.domId = slugify(this.title);
}

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

Tale.prototype.lookup = function (key, value, sortKey) {
	var results = [];
	if (!sortKey) { sortKey = "title"; }

	for (var pname in this.passages)
	{
		var passage = this.passages[pname];

		for (var i = 0; i < passage[key].length; i++)
		{
			if (passage[key][i] == value)
			{
				results.push(passage);
			}
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
** [End main.js]
***********************************************************************************************************************/
