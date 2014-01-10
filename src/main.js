/***********************************************************************************************************************
** [Begin main.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Initialization]
***********************************************************************************************************************/
var version =
{
	  title      : "SugarCube"
	, major      : 1
	, minor      : 0
	, revision   : 0
	, build      : [($BUILD$)]
	, date       : new Date([($DATE$)])
	, extensions : {}
	, toString   : function() { return this.title + " " + this.major + "." + this.minor + "." + this.revision + "." + this.build + " (" + this.date.toLocaleDateString() + ")"; }
};

var modes =		// SugarCube History class modes
{
	  hashTag        : 1
	, windowHistory  : 2
	, sessionHistory : 3
};

var config =	// SugarCube config
{
	// capability properties
	  hasPushState      : ("history" in window) && ("pushState" in window.history)
	  // the try/catch and length property access here is required due to a monumentally stupid
	  // Firefox bug [ #748620; https://bugzilla.mozilla.org/show_bug.cgi?id=748620 ]
	, hasLocalStorage   : ("localStorage" in window) && (function () { try { return window.localStorage != null && window.localStorage.length >= 0 } catch (e) { return false } }())	// use != to catch both null & undefined
	, hasSessionStorage : ("sessionStorage" in window) && (function () { try { return window.sessionStorage != null && window.sessionStorage.length >= 0 } catch (e) { return false } }())	// use != to catch both null & undefined
	, hasFileAPI        : window.File && window.FileReader && window.Blob

	// basic browser detection
	, userAgent : navigator.userAgent.toLowerCase()
	, browser   : {}

	// general option properties
	, displayPassageTitles : false
	, loadDelay            : 0

	// history option properties
	, disableHistoryControls : false
	, disableHistoryTracking : false
	, historyMode            : modes.hashTag

	// saves option properties
	, saves:
		{
			  autosave  : undefined
			, id        : "untitled-story"
			, isAllowed : undefined
			, onLoad    : undefined
			, onSave    : undefined
			, slots     : 8
		}

	// error messages properties
	, errors:
		{
			savesNotAllowed: "Saving has been disallowed on this passage."
		}
};
config.browser =
{
	  isGecko      : (navigator && navigator.product === "Gecko" && config.userAgent.search(/webkit|trident/) === -1)
	, isIE         : (config.userAgent.search(/msie|trident/) !== -1 && config.userAgent.indexOf("opera") === -1)
	, ieVersion    : (function () { var ieVer = /(?:msie\s+|rv:)(\d{1,2}\.\d)/.exec(config.userAgent); return ieVer ? +ieVer[1] : 0; }())
	// opera <= 12: "opera/9.80 (windows nt 6.1; wow64) presto/2.12.388 version/12.16"
	// opera >= 15: "mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/28.0.1500.52 safari/537.36 opr/15.0.1147.130"
	, isOpera      : (config.userAgent.indexOf("opera") !== -1) || (config.userAgent.indexOf(" opr/") !== -1)
	, operaVersion : (function () { var re = new RegExp((/applewebkit|chrome/.test(config.userAgent) ? "opr" : "version") + "\\/(\\d{1,2}\\.\\d+)"), oprVer = re.exec(config.userAgent); return oprVer ? +oprVer[1] : 0; }())
};
config.historyMode = (config.hasPushState ? (config.browser.isGecko ? modes.sessionHistory : modes.windowHistory) : modes.hashTag);
config.transitionEndEventName = (function () { var teMap = { "transition": "transitionend", "MSTransition": "msTransitionEnd", "WebkitTransition": "webkitTransitionEnd", "MozTransition": "transitionend" }, el = document.createElement("div"); for (var tName in teMap) { if (el.style[tName] !== undefined) { return teMap[tName]; } } return ""; }());

var   formatter = null	// Wikifier formatters
	, macros    = {}	// macros manager
	, tale      = {}	// story manager
	, state     = {}	// history manager
	, storage   = {}	// persistant storage manager
	, session   = {}	// session manager
	, options   = {}	// options variable store
	, setup     = {};	// author setup variable store

var   testPlay			// Twine 1.4+ "Test Play From Here" feature variable
	, prerender  = {}	// Twine 1.4+ pre-render task callbacks
	, postrender = {};	// Twine 1.4+ post-render task callbacks

/**
 * Main function, entry point for story startup
 */
$(document).ready(function ()
{
	console.log("[main()]");

	if (!document.head || !document.querySelector || !window.JSON)
	{
		$(document.documentElement).removeClass("loading");
		$("#passages").children().replace("<b>Apologies.  This story requires a less obsolescent web browser.</b>");
		return;
	}

	/**
	 * WARNING!
	 * 
	 * The ordering of the code in this function is important, so be careful
	 * when mucking around with it.
	 */

	// instantiate the wikifier formatters, macro, story, and state objects
	formatter = new WikiFormatter(Wikifier.formatters);
	macros    = new Macros();
	tale      = new Tale();
	state     = new History();

	// standard macro library setup (this must be done before any setup for special passages)
	addStandardMacros();

	// set the document title
	var storyTitle = setPageElement("story-title", "StoryTitle", tale.title);
	if (storyTitle.textContent !== tale.title) { tale.setTitle(storyTitle.textContent); }
	document.title = tale.title;

	// n.b. Trying to use (directly or indirectly) the storage and/or session objects within
	//      StoryTitle, will cause an error.  There's not much I can do about that though, as
	//      it's a chicken & egg problem.  The story title must be finalized before anything
	//      requiring its normalized (slugified) form can proceed.	This is unlikely to ever
	//      be an issue, but....

	// instantiate the storage and session objects
	storage = new KeyValueStore("localStorage", tale.domId);
	session = new KeyValueStore("sessionStorage", tale.domId);

	// set the default saves ID
	config.saves.id = tale.domId;

	// setup for some of the special passages
	setPageElement("story-banner", "StoryBanner");
	setPageElement("story-subtitle", "StorySubtitle");
	setPageElement("story-author", "StoryAuthor");
	if (tale.has("StoryCaption"))
	{
		document.getElementById("story-caption").style.display = "block";
		setPageElement("story-caption", "StoryCaption");
	}
	if (tale.has("StoryMenu"))
	{
		document.getElementById("menu-story").style.display = "block";
		setPageElement("menu-story", "StoryMenu");
	}
	else if (tale.has("MenuStory"))
	{
		document.getElementById("menu-story").style.display = "block";
		setPageElement("menu-story", "MenuStory");
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
			var errMesg = e.message;
			if (e.name === "TypeError" && /read[\s-]only/.test(e.message))
			{
				var errMatch = /([\"\'])([^\1]+)\1/.exec(e.message);
				if (errMatch)
				{
					if (errMatch[2] && macros.has(errMatch[2]))
					{
						errMesg = "cannot clobber protected macro <<" + errMatch[2] + ">>";
					}
				}
			}
			window.alert("There is a technical problem with this story (" + scripts[i].title + ": " + errMesg + "). You may be able to continue reading, but all parts of the story may not work properly.");
		}
	}
	var widgets = tale.lookup("tags", "widget");
	for (var i = 0; i < widgets.length; i++)
	{
		try
		{
			Wikifier.wikifyEval(widgets[i].text);
		}
		catch (e)
		{
			window.alert("There is a technical problem with this story (" + widgets[i].title + ": " + e.message + "). You may be able to continue reading, but all parts of the story may not work properly.");
		}
	}

	// initialize the save system (this must be done after script passages and before state initialization)
	SaveSystem.init();

	// initialize the user interface
	UISystem.init();

	// call macros' "early" init functions
	macros.init();

	// execute the StoryInit passage
	if (tale.has("StoryInit"))
	{
		try
		{
			Wikifier.wikifyEval(tale.get("StoryInit").text);
		}
		catch (e)
		{
			window.alert("There is a technical problem with this story (StoryInit: " + e.message + "). You may be able to continue reading, but all parts of the story may not work properly.");
		}
	}

	// finalize the config.disableHistoryControls setting before initializing our state
	//   n.b. we do this here to give the author every opportunity to modify config.disableHistoryTracking during setup
	if (config.disableHistoryTracking)
	{
		config.disableHistoryControls = true;
	}

	// initialize our state
	state.init();	// this could take a while, so do it late

	// call macros' "late" init functions
	macros.lateInit();

	// lastly, export identifiers for debugging purposes
	window.SugarCube =
	{
		  macros  : macros
		, tale    : tale
		, state   : state
		, storage : storage
		, session : session
	};
});


/***********************************************************************************************************************
** [Save System]
***********************************************************************************************************************/
var SaveSystem =
{
	_bad: false,
	_max: -1,
	init: function ()
	{
		function appendSlots(array, num)
		{
			for (var i = 0; i < num; i++)
			{
				array.push(null);
			}
			return array;
		}

		console.log("[SaveSystem.init()]");

		if (config.saves.slots < 0) { config.saves.slots = 0; }
		if (storage.store === null) { return false; }

		// create and store the saves object, if it doesn't exist
		if (!storage.hasItem("saves"))
		{
			storage.setItem("saves", {
				  autosave: null
				, slots:    appendSlots([], config.saves.slots)
			});
		}

		// retrieve the saves object
		var saves = storage.getItem("saves");
		if (saves === null)
		{
			SaveSystem._bad = true;
			return false;
		}

		/* legacy kludges */
		// convert an old saves array into a new saves object
		if (Array.isArray(saves))
		{
			saves =
			{
				  autosave: null
				, slots:    saves
			};
			storage.setItem("saves", saves);
		}
		/* /legacy kludges */

		// handle the author changing the number of save slots
		if (config.saves.slots !== saves.slots.length)
		{
			// attempt to decrease the number of slots
			if (config.saves.slots < saves.slots.length)
			{
				// this will only compact the slots array, by removing empty slots, no saves will be deleted
				saves.slots.reverse();
				saves.slots = saves.slots.filter(function (val, i, aref) {
					if (val === null && this.count > 0)
					{
						this.count--;
						return false;
					}
					return true;
				}, { count: saves.slots.length - config.saves.slots });
				saves.slots.reverse();
			}
			// attempt to increase the number of slots
			else if (config.saves.slots > saves.slots.length)
			{
				appendSlots(saves.slots, config.saves.slots - saves.slots.length);
			}
			storage.setItem("saves", saves);
		}

		SaveSystem._max = saves.slots.length - 1;

		return true;
	},
	OK: function ()
	{
		return SaveSystem.autosaveOK() || SaveSystem.slotsOK();
	},
	autosaveOK: function ()
	{
		return !SaveSystem._bad && typeof config.saves.autosave !== "undefined";
	},
	slotsOK: function ()
	{
		return !SaveSystem._bad && SaveSystem._max !== -1;
	},
	saveAuto: function (title)
	{
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed())
		{
			return false;
		}

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }

		saves.autosave = SaveSystem.marshal();
		saves.autosave.title = title || tale.get(state.active.title).excerpt();
		saves.autosave.date = Date.now();

		return storage.setItem("saves", saves);
	},
	loadAuto: function ()
	{
		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (saves.autosave === null) { return false; }

		return SaveSystem.unmarshal(saves.autosave);
	},
	deleteAuto: function ()
	{
		var saves = storage.getItem("saves");
		if (saves === null) { return false; }

		saves.autosave = null;

		return storage.setItem("saves", saves);
	},
	save: function (slot, title)
	{
		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed())
		{
			window.alert(config.errors.savesNotAllowed);
			return false;
		}
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }

		saves.slots[slot] = SaveSystem.marshal();
		saves.slots[slot].title = title || tale.get(state.active.title).excerpt();
		saves.slots[slot].date = Date.now();

		return storage.setItem("saves", saves);
	},
	load: function (slot)
	{
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }
		if (saves.slots[slot] === null) { return false; }

		return SaveSystem.unmarshal(saves.slots[slot]);
	},
	delete: function (slot)
	{
		if (slot < 0 || slot > SaveSystem._max) { return false; }

		var saves = storage.getItem("saves");
		if (saves === null) { return false; }
		if (slot > saves.slots.length) { return false; }

		saves.slots[slot] = null;

		return storage.setItem("saves", saves);
	},
	purge: function ()
	{
		storage.removeItem("saves");
		return SaveSystem.init();
	},
	exportSave: function ()
	{
		console.log("[SaveSystem.exportSave()]");

		if (typeof config.saves.isAllowed === "function" && !config.saves.isAllowed())
		{
			window.alert(config.errors.savesNotAllowed);
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
		$(reader).load(function(file) {
			return function(evt)
			{
				console.log('    > loaded: ' + escape(file.name) + '; payload: ' + evt.target.result);

				if (!evt.target.result) { return; }

				var saveObj;
				try
				{
					saveObj = JSON.parse(evt.target.result);
				}
				catch (evt)
				{
					// noop, the unmarshal() method will handle the error
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
			saveObj.data = clone(state.history, true);
			break;
		case modes.sessionHistory:
			saveObj.data = clone(state.history.slice(0, state.active.sidx + 1), true);
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
				state.history.push(clone(saveObj.data[i], true));

				console.log("    > loading: " + i + " (" + state.history[i].title + ")");

				// load the state into the window history
				if (!config.disableHistoryControls)
				{
					if (config.historyMode === modes.windowHistory)
					{
						window.history.pushState(state.history, document.title);
					}
					else
					{
						window.history.pushState({ sidx: state.history[i].sidx, suid: state.suid }, document.title);
					}
				}
			}

			// activate the current top and display the passage
			state.activate(state.top);
			state.display(state.active.title, null, "back");
			break;

		case modes.hashTag:
			if (!config.disableHistoryControls)
			{
				window.location.hash = saveObj.data;
			}
			else
			{
				session.setItem("activeHash", saveObj.data);
				window.location.reload();
			}
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
		console.log("[UISystem.init()]");

		var   html   = $(document.documentElement)
			, target;

		// add menu containers to <body>
		insertElement(document.body, "div", "ui-overlay");
		insertElement(document.body, "div", "ui-body");

		// setup Save menu
		UISystem.addClickHandler("#menu-saves", null, function () { UISystem.buildSaves(); });

		// setup Rewind menu
		target = $("#menu-rewind");
		if (!config.disableHistoryTracking && tale.lookup("tags", "bookmark").length > 0)
		{
			target.css({ display: "block" });
			UISystem.addClickHandler(target.find("a"), null, function () { UISystem.buildRewind(); });
		}
		else
		{
			target.remove();
		}

		// setup Restart menu
		UISystem.addClickHandler("#menu-restart", null, function () { UISystem.buildRestart(); });

		// setup Options menu
		target = $("#menu-options");
		if (tale.has("MenuOptions") && tale.get("MenuOptions").text.trim() !== "")
		{
			target.css({ display: "block" });
			UISystem.addClickHandler(target.find("a"), null, function () { UISystem.buildOptions(); });
		}
		else
		{
			target.remove();
		}

		// setup Share menu
		target = $("#menu-share");
		if (tale.has("MenuShare") && tale.get("MenuShare").text.trim() !== "")
		{
			target.css({ display: "block" });
			UISystem.addClickHandler(target.find("a"), null, function () { UISystem.buildShare(); });
		}
		else
		{
			target.remove();
		}

		// handle the loading screen
		if (document.readyState === "complete")
		{
			html.removeClass("loading");
		}
		document.addEventListener("readystatechange", function () {
			console.log("**** document.readyState: " + document.readyState + "  (on: readystatechange)");
			// readyState can be: "loading", "interactive", or "complete"
			if (document.readyState === "complete")
			{
				console.log('---- removing class "loading" (in ' + config.loadDelay + 'ms)');
				if (config.loadDelay > 0)
				{
					setTimeout(function () { html.removeClass("loading"); }, config.loadDelay);
				}
				else
				{
					html.removeClass("loading");
				}
			}
			else
			{
				console.log('++++ adding class "loading"');
				html.addClass("loading");
			}
		}, false);
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
			$(btn).click(bAction);
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
				$(btn).click(function (i) {
					return function ()
					{
						bAction(i);
					};
				}(bSlot));
				return btn;
			}

			var saves = storage.getItem("saves");
			if (saves === null) { return false; }

			var   tbody  = document.createElement("tbody")
				, tr
				, tdSlot
				, tdLoad
				, tdDesc
				, tdDele;
			var tdLoadBtn, tdDescTxt, tdDeleBtn;

			if (SaveSystem.autosaveOK())
			{
				  tr     = document.createElement("tr")
				, tdSlot = document.createElement("td")
				, tdLoad = document.createElement("td")
				, tdDesc = document.createElement("td")
				, tdDele = document.createElement("td");

				//tdSlot.appendChild(document.createTextNode("\u25c6"));
				tdDescTxt = document.createElement("b");
				tdDescTxt.innerHTML = "A";
				tdSlot.appendChild(tdDescTxt);

				if (saves.autosave && saves.autosave.mode === config.historyMode)
				{
					tdLoadBtn = document.createElement("button");
					tdLoadBtn.id = "saves-load-autosave";
					tdLoadBtn.classList.add("load");
					tdLoadBtn.classList.add("ui-close");
					tdLoadBtn.innerHTML = "Load";
					$(tdLoadBtn).click(SaveSystem.loadAuto);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createTextNode(saves.autosave.title);
					tdDesc.appendChild(tdDescTxt);
					tdDesc.appendChild(document.createElement("br"));
					tdDescTxt = document.createElement("small");
					tdDescTxt.innerHTML = "Autosaved (" + new Date(saves.autosave.date).toLocaleString() + ")";
					tdDesc.appendChild(tdDescTxt);

					tdDeleBtn = document.createElement("button");
					tdDeleBtn.id = "saves-delete-autosave";
					tdDeleBtn.classList.add("delete");
					tdDeleBtn.classList.add("ui-close");
					tdDeleBtn.innerHTML = "Delete";
					$(tdDeleBtn).click(SaveSystem.deleteAuto);
					tdDele.appendChild(tdDeleBtn);
				}
				else
				{
					tdDescTxt = document.createElement("i");
					tdDescTxt.innerHTML = "(autosave slot empty)";
					tdDesc.appendChild(tdDescTxt);
					tdDesc.classList.add("empty");
				}

				tr.appendChild(tdSlot);
				tr.appendChild(tdLoad);
				tr.appendChild(tdDesc);
				tr.appendChild(tdDele);
				tbody.appendChild(tr);
			}
			for (var i = 0; i < saves.slots.length; i++)
			{
				  tr     = document.createElement("tr")
				, tdSlot = document.createElement("td")
				, tdLoad = document.createElement("td")
				, tdDesc = document.createElement("td")
				, tdDele = document.createElement("td");

				tdSlot.appendChild(document.createTextNode(i+1));

				if (saves.slots[i] && saves.slots[i].mode === config.historyMode)
				{
					tdLoadBtn = createButton("load", "Load", i, SaveSystem.load);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createTextNode(saves.slots[i].title);
					tdDesc.appendChild(tdDescTxt);
					tdDesc.appendChild(document.createElement("br"));
					tdDescTxt = document.createElement("small");
					if (saves.slots[i].date)
					{
						tdDescTxt.innerHTML = "Saved (" + new Date(saves.slots[i].date).toLocaleString() + ")";
					}
					else
					{
						tdDescTxt.innerHTML = "Saved (<i>unknown</i>)";
					}
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
			$(input).change(function (evt) {
				SaveSystem.importSave(evt);
				UISystem.close();
			});
			el.appendChild(input);

			return el;
		}

		var   menu    = document.getElementById("ui-body")
			, list
			, btnBar
			, savesOK = SaveSystem.OK();

		// remove old contents
		$(menu)
			.empty()
			.addClass("saves");

		if (savesOK)
		{
			// add saves list
			list = createSaveList();
			if (!list)
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
			btnBar = document.createElement("div");
			list = document.createElement("ul");
			if (config.hasFileAPI && (!config.browser.isOpera || config.browser.operaVersion >= 15))
			{
				list.appendChild(createActionItem("export", "Save to Disk\u2026", SaveSystem.exportSave));
				list.appendChild(createActionItem("import", "Load from Disk\u2026", function (evt) {
					if (!document.getElementById("saves-import-file"))
					{
						menu.appendChild(createSavesImport());
					}
				}));
			}
			if (savesOK)
			{
				list.appendChild(createActionItem("purge", "Purge Save Slots", SaveSystem.purge));
			}
			btnBar.appendChild(list);
			menu.appendChild(btnBar);
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
		$(menu)
			.empty()
			.addClass("rewind");

		for (var i = 0, len = state.history.length - 1; i < len; i++)
		{
			var passage = tale.get(state.history[i].title);
			if (passage && passage.tags.indexOf("bookmark") !== -1)
			{
				var el = document.createElement("div");
				el.classList.add("ui-close");
				$(el).click(function ()
				{
					var p = i;
					if (config.historyMode === modes.windowHistory)
					{
						return function ()
						{
							console.log("[rewind:click() @windowHistory]");

							// necessary?
							document.title = tale.title;

							// push the history states in order
							if (!config.disableHistoryControls)
							{
								for (var i = 0, end = p; i <= end; i++)
								{
									console.log("    > pushing: " + i + " (" + state.history[i].title + ")");

									// load the state into the window history
									window.history.pushState(state.history.slice(0, i + 1), document.title);
								}
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
							console.log("[rewind:click() @sessionHistory]");

							// necessary?
							document.title = tale.title;

							// regenerate the state history suid
							state.regenerateSuid();

							// push the history states in order
							if (config.disableHistoryControls)
							{
								console.log("    > pushing: " + p + " (" + state.history[p].title + ")");

								// load the state into the window history
								window.history.replaceState({ sidx: state.history[p].sidx, suid: state.suid }, document.title);
							}
							else
							{
								for (var i = 0, end = p; i <= end; i++)
								{
									console.log("    > pushing: " + i + " (" + state.history[i].title + ")");

									// load the state into the window history
									window.history.pushState({ sidx: state.history[i].sidx, suid: state.suid }, document.title);
								}
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
							if (!config.disableHistoryControls)
							{
								window.location.hash = state.history[p].hash;
							}
							else
							{
								session.setItem("activeHash", state.history[p].hash);
								window.location.reload();
							}
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

		$(menu)
			.empty()
			.addClass("restart")
			.append('<p>Are you sure that you want to restart?  Unsaved progress will be lost.</p><ul><li><button id="restart-ok" class="ui-close">OK</button></li><li><button id="restart-cancel" class="ui-close">Cancel</button></li></ul></div>');

		// add additional click handler for the OK button
		$("#restart-ok").click(function () {
			state.restart();
		});

		return true;
	},
	buildOptions: function ()
	{
		var menu = document.getElementById("ui-body");

		$(menu)
			.empty()
			.addClass("options");
		new Wikifier(menu, tale.get("MenuOptions").text.trim());

		return true;
	},
	buildShare: function ()
	{
		var menu = document.getElementById("ui-body");

		$(menu)
			.empty()
			.addClass("share");
		new Wikifier(menu, tale.get("MenuShare").text.trim());
		menu.innerHTML = menu.innerHTML.replace(/(?:<br\s*\/?>)+/g, "\n");

		return true;
	},
	close: function (evt)
	{
		$(window)
			.off("resize", UISystem.resizeHandler);
		$("#ui-body")
			.css({
				  display: "none"
				, opacity: 0
				, left:    ""
				, right:   ""
				, top:     ""
				, bottom:  ""
			})
			.removeClass()
			.empty();	// .empty() here will break static menus
		/*
		$("#ui-overlay")
			.css({
				  "display": "none"
				, "opacity": 0
			})
			.fadeOut(200)
			.add(".ui-close")
			.off("click", UISystem.closeHandler);
		*/
		$("#ui-overlay")
			.fadeOut(200)
			.add(".ui-close")
			.off("click", UISystem.closeHandler);
		$(document.body)
			.removeClass("ui-open");

		// call the given "on close" callback function, if any
		if (evt && typeof evt.data === "function")
		{
			evt.data(evt);
		}
	},
	addClickHandler: function (target, options, startFunc, doneFunc, closeFunc)
	{
		options = $.extend({ top: 50, opacity: 0.8 }, options);

		$(target).click(function (evt) {
			evt.preventDefault();	// this doesn't prevent bound events, only default actions (e.g. href links)

			// call the start function
			if (typeof startFunc === "function")
			{
				startFunc(evt);
			}

			var   parent  = $(window)
				, overlay = $("#ui-overlay")
				, menu    = $("#ui-body");

			// setup close function handlers
			overlay
				.add(".ui-close")
				.on("click", null, closeFunc, UISystem.close);

			// stop the body from scrolling
			$(document.body)
				.addClass("ui-open");

			// display the overlay
			overlay
				.css({
					  display: "block"
					, opacity: 0
				})
				.fadeTo(200, options.opacity);

			// display the menu
			menu
				.css($.extend({ display: "block", opacity: 0 }, UISystem.calcPositionalProperties(options.top)))
				.fadeTo(200, 1);

			// call the done function
			if (typeof doneFunc === "function")
			{
				doneFunc(evt);
			}

			// add the UI resize handler
			parent.on("resize", null, options.top, $.debounce(40, UISystem.resizeHandler));
		});
	},
	resizeHandler: function (evt)
	{
		var   parent = $(window)
			, menu   = $("#ui-body")
			, topPos = (evt && typeof evt.data !== "undefined") ? evt.data : 50;

		if (menu.css("display") === "block")
		{
			// stow the menu and unset its positional properties (this is important!)
			menu.css({ display: "none", left: "", right: "", top: "", bottom: "" });

			// restore the menu with its new positional properties
			menu.css($.extend({ display: "block" }, UISystem.calcPositionalProperties(topPos)));
		}
	},
	calcPositionalProperties: function (topPos)
	{
		if (typeof topPos === "undefined") { topPos = 50; }

		var   parent    = $(window)
			, menu      = $("#ui-body")
			, menuStyle = { left: "", right: "", top: "", bottom: "" }
			, horzSpace = parent.width() - menu.outerWidth(true)
			, vertSpace = parent.height() - menu.outerHeight(true);

		if (horzSpace <= 20)
		{
			menuStyle.left = menuStyle.right = "10px";
		}
		else
		{
			menuStyle.left = menuStyle.right = ~~(horzSpace / 2) + "px";
		}
		if (vertSpace <= 20)
		{
			menuStyle.top = menuStyle.bottom = "10px";
		}
		else
		{
			if ((vertSpace / 2) > topPos)
			{
				menuStyle.top = topPos + "px";
			}
			else
			{
				menuStyle.top = menuStyle.bottom = ~~(vertSpace / 2) + "px";
			}
		}
		return menuStyle;
	}
};


/***********************************************************************************************************************
** [End main.js]
***********************************************************************************************************************/
