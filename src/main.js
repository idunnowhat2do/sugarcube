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
var version = { title: "SugarCube", major: 1, minor: 0, revision: 0, date: new Date("September 25, 2013"), extensions: {} };

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
			  id:        "untitled-story"
			, isAllowed: undefined
			, onLoad:    undefined
			, onSave:    undefined
			, slots:     8
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
	, options   = {}	// options variable store
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
	var $ = function (id)
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

	// setup for some of the special passages
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
		document.getElementById("menu-story").style.display = "block";
		setPageElement("menu-story", "StoryMenu");
	}
	if (tale.has("MenuOptions"))
	{
		if (tale.get("MenuOptions").text.trim() !== "")
		{
			document.getElementById("menu-options").style.display = "block";
		}
	}
	if (tale.has("MenuShare"))
	{
		if (tale.get("MenuShare").text.trim() !== "")
		{
			document.getElementById("menu-share").style.display = "block";
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
	UISystem.init();
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
		}(file));

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
			var errMsg = config.saves.onLoad(saveObj);
			if (errMsg)
			{
				window.alert(errMsg + "\n\nAborting load.");
				return false;
			}
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
** [UI System]
***********************************************************************************************************************/
var UISystem =
{
	init: function ()
	{
		// add menu containers to <body>
		insertElement(document.body, "div", "ui-overlay");
		insertElement(document.body, "div", "ui-body");

		// setup click handlers
		UISystem.addClickHandler("#menu-saves",   null, function (e) { UISystem.buildSaves(); });
		UISystem.addClickHandler("#menu-rewind",  null, function (e) { UISystem.buildRewind(); });
		UISystem.addClickHandler("#menu-restart", null, function (e) { UISystem.buildRestart(); });
		UISystem.addClickHandler("#menu-options", null, function (e) { UISystem.buildOptions(); });
		UISystem.addClickHandler("#menu-share",   null, function (e) { UISystem.buildShare(); });
	},
	buildSaves: function ()
	{
		console.log("[buildSaves()]");

		function createActionItem(bId, bText, bAction)
		{
			var li = document.createElement("li");
			var btn = document.createElement("button");
			btn.id = "saves-" + bId;
			if (bId !== "import")
			{
				btn.classList.add("ui-close");
			}
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
				btn.id = "saves-" + bIdClass + "-" + bSlot;
				btn.classList.add(bIdClass);
				btn.classList.add("ui-close");
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
					tdDesc.classList.add("empty");
				}

				tr.appendChild(tdSlot);
				tr.appendChild(tdLoad);
				tr.appendChild(tdDesc);
				tr.appendChild(tdDele);
				tbody.appendChild(tr);
			}
			var table = document.createElement("table");
			table.id = "saves-list";
			table.appendChild(tbody);
			return table;
		}
		function createSavesImport()
		{
			var   el    = document.createElement("div")
				, label = document.createElement("div")
				, input = document.createElement("input");

			// add label
			label.id = "saves-import-label";
			label.appendChild(document.createTextNode("Select a save file to load:"));
			el.appendChild(label);

			// add file input
			input.type     = "file";
			input.id       = "saves-import-file";
			input.name     = "saves-import-file";
			input.onchange = function (e) {
				SaveSystem.importSave(e);
				UISystem.close();
			};
			el.appendChild(input);

			return el;
		}

		var   menu    = document.getElementById("ui-body")
			, list
			, savesOK = storage.store !== null;

		// remove old contents
		jQuery(menu)
			.empty()
			.addClass("saves");

		if (savesOK)
		{
			// initialize the saves
			SaveSystem.init();

			// add saves list
			list = createSaveList();
			if (!list || list.length === 0)
			{
				list = document.createElement("div");
				list.id = "saves-list"
				list.innerHTML = "<i>No save slots found</i>";
			}
			menu.appendChild(list);
		}

		// add action list (export, import, and purge) and import input
		if (savesOK || (config.hasFileAPI && (!config.browser.isOpera || config.browser.operaVersion >= 15)))
		{
			list = document.createElement("ul");
			if (config.hasFileAPI && (!config.browser.isOpera || config.browser.operaVersion >= 15))
			{
				list.appendChild(createActionItem("export", "Save to Disk\u2026", SaveSystem.exportSave));
				list.appendChild(createActionItem("import", "Load from Disk\u2026", function (e) {
					if (!document.getElementById("saves-import-file"))
					{
						menu.appendChild(createSavesImport());
					}
				}));
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
	buildRewind: function ()
	{
		var   menu     = document.getElementById("ui-body")
			, hasItems = false;

		// remove old contents
		jQuery(menu)
			.empty()
			.addClass("rewind");

		for (var i = 0, len = state.history.length - 1; i < len; i++)
		{
			var passage = tale.get(state.history[i].title);
			if (passage && passage.tags.indexOf("bookmark") !== -1)
			{
				var el = document.createElement("div");
				el.classList.add("ui-close");
				el.onclick = (function ()
				{
					var p = i;
					if (config.historyMode === modes.windowHistory)
					{
						return function ()
						{
							console.log("[rewind:onclick() @windowHistory]");

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
							console.log("[rewind:onclick() @sessionHistory]");

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
	buildRestart: function ()
	{
		var menu = document.getElementById("ui-body");

		jQuery(menu)
			.empty()
			.addClass("restart")
			.append('<p>Are you sure that you want to restart?  Unsaved progress will be lost.</p><ul><li><button id="restart-ok" class="ui-close">OK</button></li><li><button id="restart-cancel" class="ui-close">Cancel</button></li></ul></div>');

		// add additional click handler for the OK button
		jQuery("#restart-ok").click(function () {
			state.restart();
		});

		return true;
	},
	buildOptions: function ()
	{
		var menu = document.getElementById("ui-body");

		jQuery(menu)
			.empty()
			.addClass("options");
		new Wikifier(menu, tale.get("MenuOptions").text.trim());

		return true;
	},
	buildShare: function ()
	{
		var menu = document.getElementById("ui-body");

		jQuery(menu)
			.empty()
			.addClass("share");
		new Wikifier(menu, tale.get("MenuShare").text.trim());
		menu.innerHTML = menu.innerHTML.replace(/(?:<br\s*\/?>)+/g, "\n");

		return true;
	},
	close: function ()
	{
		jQuery("#ui-overlay").fadeOut(200);
		jQuery("#ui-body")
			.css({ "display": "none" })
			.removeClass()
			.empty();	// .empty() here will break static menus
	},
	addClickHandler: function (targetSel, options, startFunc, doneFunc)
	{
		options = jQuery.extend({
			  top        : 50
			, opacity    : 0.66
		}, options);

		jQuery(targetSel).click(function (e) {
			e.preventDefault();

			// call the start function
			if (typeof startFunc === "function")
			{
				startFunc(e);
			}

			var   overlay = jQuery("#ui-overlay")
				, menu    = jQuery("#ui-body");

			// setup close function handlers
			overlay
				.add(".ui-close")
				.click(function () {
					UISystem.close();
				});

			// display the overlay
			overlay
				.css({
					  "display":  "block"
					, "z-index":  1000
					, "opacity":  0
					, "position": "fixed"
				})
				.fadeTo(200, options.opacity);

			// display the menu
			//   n.b. we have to do this in two separate stages to force the browser to finalize
			//        the outer width of the container before we can use it to center the container
			menu.css({
				  "display":  "block"
				, "z-index":  1100
				, "opacity":  0
				, "position": "absolute"
				, "top":      options.top + "px"
				, "left":     "0"
			});
			menu
				.css({
					  "left"       : "50%"
					, "margin-left": -(menu.outerWidth() / 2) + "px"
				})
				.fadeTo(200, 1);

			// call the done function
			if (typeof doneFunc === "function")
			{
				doneFunc(e);
			}
		});
	}
};


/***********************************************************************************************************************
** [End main.js]
***********************************************************************************************************************/
