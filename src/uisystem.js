/***********************************************************************************************************************
** [Begin uisystem.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [UISystem API]
***********************************************************************************************************************/
var UISystem = Object.defineProperties({}, {
	// data members
	_overlay : {
		writable : true,
		value    : null
	},
	_body : {
		writable : true,
		value    : null
	},
	_closer : {
		writable : true,
		value    : null
	},

	// static methods: internals
	init : {
		value : function () {
			if (DEBUG) { console.log("[UISystem.init()]"); }

			// remove #init-no-js & #init-lacking from #init-screen
			jQuery("#init-no-js, #init-lacking").remove();

			// generate the UI elements and add them to the page
			var store  = document.getElementById("store-area"),
				uiTree = document.createDocumentFragment(),
				temp   = document.createElement("div");

			// generate the core elements
			temp.innerHTML = tale.has("StoryFormatMarkup")
				? tale.get("StoryFormatMarkup").text.trim()
				:     '<div id="ui-bar">'
					+     '<header id="title">'
					+         '<div id="story-banner"></div>'
					+         '<h1 id="story-title"></h1>'
					+         '<div id="story-subtitle"></div>'
					+         '<div id="story-title-separator"></div>'
					+         '<p id="story-author"></p>'
					+     '</header>'
					+     '<div id="story-caption"></div>'
					+     '<nav id="menu">'
					+         '<ul id="menu-story-transitional"></ul>'
					+         '<ul id="menu-core">'
					+             '<li id="menu-story"></li>'
					+             '<li id="menu-saves"><a>Saves</a></li>'
					+             '<li id="menu-rewind"><a>Rewind</a></li>'
					+             '<li id="menu-restart"><a>Restart</a></li>'
					+             '<li id="menu-options"><a>Options</a></li>'
					+             '<li id="menu-share"><a>Share</a></li>'
					+         '</ul>'
					+     '</nav>'
					+     '<footer>'
					+         '<p id="credits">Made with <a href="http://twinery.org/" target="_blank">Twine</a> &amp; <a href="http://www.motoslave.net/sugarcube/" target="_blank">SugarCube</a></p>'
					+         '<p id="version">SugarCube ("{{BUILD_VERSION}}")</p>'
					+     '</footer>'
					+ '</div>'
					+ '<div id="passages" role="main"></div>';
			while (temp.hasChildNodes()) {
				uiTree.appendChild(temp.firstChild);
			}

			// generate the dialog elements
			UISystem._overlay = insertElement(uiTree, "div", "ui-overlay", "ui-close");
			UISystem._body    = insertElement(uiTree, "div", "ui-body");
			UISystem._closer  = insertElement(uiTree, "a", "ui-body-close", "ui-close", "\ue002");

			// insert the UI elements into the page before the store area
			store.parentNode.insertBefore(uiTree, store);
		}
	},

	start : {
		value : function () {
			if (DEBUG) { console.log("[UISystem.start()]"); }

			var html = jQuery(document.documentElement);

			// setup the title
			setPageElement("story-title", "StoryTitle", tale.title);

			// setup the dynamic page elements
			if (!tale.has("StoryCaption")) {
				jQuery("#story-caption").remove();
			}
			if (!tale.has("StoryMenu")) {
				jQuery("#menu-story").remove();
			}
			if (!tale.has("MenuStory")) {
				jQuery("#menu-story-transitional").remove();
			}
			UISystem.setPageElements();

			// setup Saves menu
			UISystem.addClickHandler("#menu-saves", null, function () { UISystem.buildDialogSaves(); });

			// setup Rewind menu
			if (!config.disableHistoryTracking && tale.lookup("tags", "bookmark").length > 0) {
				UISystem.addClickHandler(jQuery("#menu-rewind a"), null, function () { UISystem.buildDialogRewind(); });
			} else {
				jQuery("#menu-rewind").remove();
			}

			// setup Restart menu
			UISystem.addClickHandler("#menu-restart", null, function () { UISystem.buildDialogRestart(); });

			// setup Options menu
			if (tale.has("MenuOptions")) {
				UISystem.addClickHandler(jQuery("#menu-options a"), null, function () { UISystem.buildDialogOptions(); });
			} else {
				jQuery("#menu-options").remove();
			}

			// setup Share menu
			if (tale.has("MenuShare")) {
				UISystem.addClickHandler(jQuery("#menu-share a"), null, function () { UISystem.buildDialogShare(); });
			} else {
				jQuery("#menu-share").remove();
			}

			// handle the loading screen
			if (document.readyState === "complete") {
				html.removeClass("init-loading");
			}
			document.addEventListener("readystatechange", function () {
				// readyState can be: "loading", "interactive", or "complete"
				if (document.readyState === "complete") {
					if (config.loadDelay > 0) {
						setTimeout(function () { html.removeClass("init-loading"); }, config.loadDelay);
					} else {
						html.removeClass("init-loading");
					}
				} else {
					html.addClass("init-loading");
				}
			}, false);
		}
	},

	setPageElements : {
		value : function () {
			if (DEBUG) { console.log("[UISystem.setPageElements()]"); }

			// setup the dynamic page elements
			setPageElement("story-banner", "StoryBanner");
			setPageElement("story-subtitle", "StorySubtitle");
			setPageElement("story-author", "StoryAuthor");
			setPageElement("story-caption", "StoryCaption");
			setPageElement("menu-story", "StoryMenu");
			if (tale.has("MenuStory")) {
				var menuStory = document.getElementById("menu-story-transitional");
				removeChildren(menuStory);
				UISystem.populateListFromPassage("MenuStory", menuStory);
			}
		}
	},

	buildDialogSaves : {
		value : function () {
			function createActionItem(bId, bClass, bText, bAction) {
				var li  = document.createElement("li"),
					btn = document.createElement("button");
				btn.id = "saves-" + bId;
				if (bClass) {
					btn.className = bClass;
				}
				btn.innerHTML = bText;
				jQuery(btn).click(bAction);
				li.appendChild(btn);
				return li;
			}
			function createSaveList() {
				function createButton(bId, bClass, bText, bSlot, bAction) {
					var btn = document.createElement("button");
					btn.id = "saves-" + bId + "-" + bSlot;
					if (bClass) {
						btn.className = bClass;
					}
					btn.classList.add(bId);
					btn.innerHTML = bText;
					jQuery(btn).click(function (i) {
						return function () { bAction(i); };
					}(bSlot));
					return btn;
				}

				var saves = storage.getItem("saves");
				if (saves === null) { return false; }

				var tbody  = document.createElement("tbody"),
					tr,
					tdSlot,
					tdLoad,
					tdDesc,
					tdDele;
				var tdLoadBtn, tdDescTxt, tdDeleBtn;

				if (SaveSystem.autosaveOK()) {
					tr     = document.createElement("tr"),
					tdSlot = document.createElement("td"),
					tdLoad = document.createElement("td"),
					tdDesc = document.createElement("td"),
					tdDele = document.createElement("td");

					//tdSlot.appendChild(document.createTextNode("\u25c6"));
					tdDescTxt = document.createElement("b");
					tdDescTxt.innerHTML = "A";
					tdSlot.appendChild(tdDescTxt);

					if (saves.autosave && saves.autosave.state.mode === config.historyMode) {
						tdLoadBtn = document.createElement("button");
						tdLoadBtn.id = "saves-load-autosave";
						tdLoadBtn.classList.add("load");
						tdLoadBtn.classList.add("ui-close");
						tdLoadBtn.innerHTML = "Load";
						jQuery(tdLoadBtn).click(SaveSystem.loadAuto);
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
						tdDeleBtn.innerHTML = "Delete";
						jQuery(tdDeleBtn).click(function () {
							SaveSystem.deleteAuto();
							UISystem.buildDialogSaves(); // rebuild the saves menu
						});
						tdDele.appendChild(tdDeleBtn);
					} else {
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
				for (var i = 0; i < saves.slots.length; i++) {
					tr     = document.createElement("tr"),
					tdSlot = document.createElement("td"),
					tdLoad = document.createElement("td"),
					tdDesc = document.createElement("td"),
					tdDele = document.createElement("td");

					tdSlot.appendChild(document.createTextNode(i+1));

					if (saves.slots[i] && saves.slots[i].state.mode === config.historyMode) {
						tdLoadBtn = createButton("load", "ui-close", "Load", i, SaveSystem.load);
						tdLoad.appendChild(tdLoadBtn);

						tdDescTxt = document.createTextNode(saves.slots[i].title);
						tdDesc.appendChild(tdDescTxt);
						tdDesc.appendChild(document.createElement("br"));
						tdDescTxt = document.createElement("small");
						if (saves.slots[i].date) {
							tdDescTxt.innerHTML = "Saved (" + new Date(saves.slots[i].date).toLocaleString() + ")";
						} else {
							tdDescTxt.innerHTML = "Saved (<i>unknown</i>)";
						}
						tdDesc.appendChild(tdDescTxt);

						tdDeleBtn = createButton("delete", null, "Delete", i, function (i) {
							SaveSystem.delete(i);
							UISystem.buildDialogSaves(); // rebuild the saves menu
						});
						tdDele.appendChild(tdDeleBtn);
					} else {
						tdLoadBtn = createButton("save", "ui-close", "Save", i, SaveSystem.save);
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
			function createSavesImport() {
				var el    = document.createElement("div"),
					label = document.createElement("div"),
					input = document.createElement("input");

				// add label
				label.id = "saves-import-label";
				label.appendChild(document.createTextNode("Select a save file to load:"));
				el.appendChild(label);

				// add file input
				input.type = "file";
				input.id   = "saves-import-file";
				input.name = "saves-import-file";
				jQuery(input).change(function (evt) {
					SaveSystem.importSave(evt);
					UISystem.close();
				});
				el.appendChild(input);

				return el;
			}

			if (DEBUG) { console.log("[UISystem.buildDialogSaves()]"); }

			var dialog  = UISystem._body,
				list,
				btnBar,
				savesOK = SaveSystem.OK();

			jQuery(dialog)
				.empty()
				.addClass("saves");

			if (savesOK) {
				// add saves list
				list = createSaveList();
				if (!list) {
					list = document.createElement("div");
					list.id = "saves-list"
					list.innerHTML = "<i>No save slots found</i>";
				}
				dialog.appendChild(list);
			}

			// add action list (export, import, and purge) and import input
			if (savesOK || has.fileAPI) {
				btnBar = document.createElement("div");
				list = document.createElement("ul");
				if (has.fileAPI) {
					list.appendChild(createActionItem("export", "ui-close", "Save to Disk\u2026", SaveSystem.exportSave));
					list.appendChild(createActionItem("import", null, "Load from Disk\u2026", function (evt) {
						if (!document.getElementById("saves-import-file")) {
							dialog.appendChild(createSavesImport());
						}
					}));
				}
				if (savesOK) {
					list.appendChild(createActionItem("purge", null, "Purge Slots", function (evt) {
						SaveSystem.purge();
						UISystem.buildDialogSaves(); // rebuild the saves menu
					}));
				}
				btnBar.appendChild(list);
				dialog.appendChild(btnBar);
				return true;
			} else {
				UISystem.alert("Apologies! Your browser either lacks some of the capabilities required to support saves or has disabled them.\n\nThe former may be solved by updating it to a newer version or by switching to a more modern browser.\n\nThe latter may be solved by loosening its security restrictions or, perhaps, by viewing the " + config.errorName + " via the HTTP protocol.");
				return false;
			}
		}
	},

	buildDialogRewind : {
		value : function () {
			if (DEBUG) { console.log("[UISystem.buildDialogRewind()]"); }

			var dialog = UISystem._body,
				list   = document.createElement("ul");

			jQuery(dialog)
				.empty()
				.addClass("dialog-list rewind")
				.append(list);

			for (var i = 0, iend = state.length - 1; i < iend; i++) {
				var passage = tale.get(state.history[i].title);
				if (passage && passage.tags.contains("bookmark")) {
					var item = document.createElement("li"),
						link = document.createElement("a");
					link.classList.add("ui-close");
					jQuery(link).click(function () {
						var p = i;
						if (config.historyMode === History.Modes.Session) {
							return function () {
								if (DEBUG) { console.log("[rewind:click() @Session]"); }

								// necessary?
								document.title = tale.title;

								// regenerate the state history suid
								state.regenerateSuid();

								// push the history states in order
								if (config.disableHistoryControls) {
									if (DEBUG) { console.log("    > pushing: " + p + " (" + state.history[p].title + ")"); }

									// load the state into the window history
									History.replaceWindowState(
										{ suid : state.suid, sidx : state.history[p].sidx },
										(config.displayPassageTitles && state.history[p].title !== config.startPassage)
											? tale.title + ": " + state.history[p].title
											: tale.title
									);
								} else {
									for (var i = 0, end = p; i <= end; i++) {
										if (DEBUG) { console.log("    > pushing: " + i + " (" + state.history[i].title + ")"); }

										// load the state into the window history
										History.addWindowState(
											{ suid : state.suid, sidx : state.history[i].sidx },
											(config.displayPassageTitles && state.history[i].title !== config.startPassage)
												? tale.title + ": " + state.history[i].title
												: tale.title
										);
									}
								}

								var windowState = History.getWindowState();
								if (windowState.sidx < state.top.sidx) {
									if (DEBUG) { console.log("    > stacks out of sync; popping " + (state.top.sidx - windowState.sidx) + " states to equalize"); }
									// stack ids are out of sync, pop our stack until
									// we're back in sync with the window.history
									state.pop(state.top.sidx - windowState.sidx);
								}

								// activate the current top
								state.activate(state.top);

								// display the passage
								state.display(state.active.title, null, "replace");
							};
						} else if (config.historyMode === History.Modes.Window) {
							return function () {
								if (DEBUG) { console.log("[rewind:click() @Window]"); }

								// necessary?
								document.title = tale.title;

								// push the history states in order
								if (!config.disableHistoryControls) {
									for (var i = 0, end = p; i <= end; i++) {
										if (DEBUG) { console.log("    > pushing: " + i + " (" + state.history[i].title + ")"); }

										// load the state into the window history
										var stateObj = { history : state.history.slice(0, i + 1) };
										if (state.hasOwnProperty("prng")) {
											stateObj.rseed = state.prng.seed;
										}
										History.addWindowState(
											stateObj,
											(config.displayPassageTitles && state.history[i].title !== config.startPassage)
												? tale.title + ": " + state.history[i].title
												: tale.title
										);
									}
								}

								// stack ids are out of sync, pop our stack until
								// we're back in sync with the window.history
								state.pop(state.length - (p + 1));

								// activate the current top
								state.activate(state.top);

								// display the passage
								state.display(state.active.title, null, "replace");
							};
						} else { // History.Modes.Hash
							return function () {
								if (DEBUG) { console.log("[rewind:click() @Hash]"); }

								if (!config.disableHistoryControls) {
									window.location.hash = state.history[p].hash;
								} else {
									session.setItem("activeHash", state.history[p].hash);
									window.location.reload();
								}
							};
						}
					}());
					link.appendChild(document.createTextNode("Turn " + (i + 1) + ": " + passage.excerpt()));
					item.appendChild(link);
					list.appendChild(item);
				}
			}
			if (!list.hasChildNodes()) {
				var item = document.createElement("li"),
					link = document.createElement("a");
				link.innerHTML = "<i>No rewind points available\u2026</i>";
				item.appendChild(link);
				list.appendChild(item);
			}
		}
	},

	buildDialogRestart : {
		value : function () {
			if (DEBUG) { console.log("[UISystem.buildDialogRestart()]"); }

			var dialog = UISystem._body;

			jQuery(dialog)
				.empty()
				.addClass("dialog restart")
				.append('<p>Are you sure that you want to restart?  Unsaved progress will be lost.</p><ul><li><button id="restart-ok" class="ui-close">OK</button></li><li><button id="restart-cancel" class="ui-close">Cancel</button></li></ul>');

			// add an additional click handler for the OK button
			jQuery("#ui-body #restart-ok").click(function () {
				state.restart();
			});

			return true;
		}
	},

	buildDialogOptions : {
		value : function () {
			if (DEBUG) { console.log("[UISystem.buildDialogOptions()]"); }

			var dialog = UISystem._body;

			jQuery(dialog)
				.empty()
				.addClass("dialog options");
			new Wikifier(dialog, tale.get("MenuOptions").processText().trim());

			return true;
		}
	},

	buildDialogShare : {
		value : function () {
			if (DEBUG) { console.log("[UISystem.buildDialogShare()]"); }

			var dialog = UISystem._body;

			jQuery(dialog)
				.empty()
				.addClass("dialog-list share")
				.append(UISystem.populateListFromPassage("MenuShare"));
				//.find("a")
				//	.addClass("ui-close");

			return true;
		}
	},

	populateListFromPassage : {
		value : function (passage, list) {
			if (list == null) { // use lazy equality
				list = document.createElement("ul");
			}
			var temp = document.createDocumentFragment();
			new Wikifier(temp, tale.get(passage).processText().trim());
			if (temp.hasChildNodes()) {
				var li = null;
				while (temp.hasChildNodes()) {
					var node = temp.firstChild;
					if (node.nodeType !== 3 && (node.nodeType !== 1 || node.nodeName.toUpperCase() === "BR")) { // non-text, non-element, or <br>-element nodes
						temp.removeChild(node);
						if (li !== null) {
							// forget the current list item
							li = null;
						}
					} else { // text or non-<br>-element nodes
						if (li === null) {
							// create a new list item
							li = document.createElement("li");
							list.appendChild(li);
						}
						li.appendChild(node);
					}
				}
			}
			return list;
		}
	},

	// static methods: built-ins
	alert : {
		value : function (message, options, closeFn) {
			var dialog = UISystem._body;
			jQuery(dialog)
				.empty()
				.addClass("dialog alert")
				.append('<p>' + message + '</p><ul><li><button id="alert-ok" class="ui-close">OK</button></li></ul>');
			UISystem.open(options, closeFn);
		}
	},

	restart : {
		value : function (options) {
			UISystem.buildDialogRestart();
			UISystem.open(options);
		}
	},

	body : {
		value : function () {
			return UISystem._body;
		}
	},

	setup : {
		value : function (classNames) {
			jQuery(UISystem._body)
				.empty()
				.removeClass()
				.addClass("dialog");
			if (classNames != null) { // use lazy equality
				jQuery(UISystem._body).addClass(classNames);
			}
			return UISystem._body;
		}
	},

	isOpen : {
		value : function () {
			return document.body.classList.contains("ui-open");
		}
	},

	addClickHandler : {
		value : function (target, options, startFn, doneFn, closeFn) {
			jQuery(target).click(function (evt) {
				evt.preventDefault(); // does not prevent bound events, only default actions (e.g. href links)

				// call the start function
				if (typeof startFn === "function") {
					startFn(evt);
				}

				// open the dialog
				UISystem.open(options, closeFn);

				// call the done function
				if (typeof doneFn === "function") {
					doneFn(evt);
				}
			});
		}
	},

	show : {
		value : function (options, closeFunc) {
			options = $.extend({ top : 50, opacity : 0.8 }, options);
	
			// stop the body from scrolling and setup the delegated UI close handler
			jQuery(document.body)
				.addClass("ui-open")
				.on("click.uisystem-close", ".ui-close", closeFunc, UISystem.close);
	
			// display the overlay
			jQuery(UISystem._overlay)
				//.addClass("ui-close")
				.css({ display : "block", opacity : 0 })
				.fadeTo(200, options.opacity);

			// display the dialog
			var position = UISystem.calcPositionalProperties(options.top);
			jQuery(UISystem._body)
				.css($.extend({ display : "block", opacity : 0 }, position.dialog))
				.fadeTo(200, 1);
			jQuery(UISystem._closer)
				.css($.extend({ display : "block", opacity : 0 }, position.closer))
				.fadeTo(50, 1);

			// add the UI resize handler
			jQuery(window)
				.on("resize.uisystem", null, options.top, $.debounce(40, UISystem.resizeHandler));
		}
	},

	close : {
		value : function (evt) {
			// pretty much reverse the actions taken in UISystem.show()
			jQuery(window)
				.off("resize.uisystem");
			jQuery(UISystem._body)
				.css({
					display : "none",
					opacity : 0,
					left    : "",
					right   : "",
					top     : "",
					bottom  : ""
				})
				.removeClass()
				.empty(); // .empty() here will break static menus
			jQuery(UISystem._closer)
				.css({
					display : "none",
					opacity : 0,
					right   : "",
					top     : ""
				});
			/*
			jQuery(UISystem._overlay)
				.css({
					display : "none",
					opacity : 0
				})
				.fadeOut(200)
				.removeClass();
			*/
			jQuery(UISystem._overlay)
				.fadeOut(200);
				//.removeClass();
			jQuery(document.body)
				.off("click.uisystem-close")
				.removeClass("ui-open");

			// call the given "on close" callback function, if any
			if (evt && typeof evt.data === "function") {
				evt.data(evt);
			}
		}
	},

	resizeHandler : {
		value : function (evt) {
			var dialog = jQuery(UISystem._body),
				closer = jQuery(UISystem._closer),
				topPos = (evt && typeof evt.data !== "undefined") ? evt.data : 50;

			if (dialog.css("display") === "block") {
				// stow the dialog and unset its positional properties (this is important!)
				dialog.css({ display : "none", left : "", right : "", top : "", bottom : "" });
				closer.css({ display : "none", right : "", top : "" });

				// restore the dialog with its new positional properties
				var position = UISystem.calcPositionalProperties(topPos);
				dialog.css($.extend({ display : "block" }, position.dialog));
				closer.css($.extend({ display : "block" }, position.closer));
			}
		}
	},

	calcPositionalProperties : {
		value : function (topPos) {
			if (typeof topPos === "undefined") {
				topPos = 50;
			}

			var parent    = jQuery(window),
				dialog    = jQuery(UISystem._body),
				dialogPos = { left : "", right : "", top : "", bottom : "" },
				closer    = jQuery(UISystem._closer),
				closerPos = { right : "", top : "" },
				horzSpace = parent.width() - dialog.outerWidth(true),
				vertSpace = parent.height() - dialog.outerHeight(true);

			if (horzSpace <= 32) {
				dialogPos.left = dialogPos.right = 16;
			} else {
				dialogPos.left = dialogPos.right = ~~(horzSpace / 2);
			}
			if (vertSpace <= 32) {
				dialogPos.top = dialogPos.bottom = 16;
			} else {
				if ((vertSpace / 2) > topPos) {
					dialogPos.top = topPos;
				} else {
					dialogPos.top = dialogPos.bottom = ~~(vertSpace / 2);
				}
			}

			closerPos.right = (dialogPos.right - closer.outerWidth(true) + 6) + "px";
			closerPos.top = (dialogPos.top - closer.outerHeight(true) + 6) + "px";
			Object.keys(dialogPos).forEach(function (p) {
				if (dialogPos[p] !== "") {
					dialogPos[p] += "px";
				}
			});

			return { dialog : dialogPos, closer : closerPos };
		}
	}
});


/***********************************************************************************************************************
** [End uisystem.js]
***********************************************************************************************************************/
