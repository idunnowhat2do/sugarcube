/***********************************************************************************************************************
** [Begin uisystem.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [UISystem API]
***********************************************************************************************************************/
var UISystem = {
	_overlay : null,
	_body    : null,
	_closer  : null,
	init     : function () {
		if (DEBUG) { console.log("[UISystem.init()]"); }

		var html   = $(document.documentElement),
			target;

		// add UI dialog elements to <body>
		UISystem._overlay = insertElement(document.body, "div", "ui-overlay", "ui-close");
		UISystem._body    = insertElement(document.body, "div", "ui-body");
		UISystem._closer  = insertElement(document.body, "a", "ui-body-close", "ui-close");
		insertText(UISystem._closer, "\ue002");

		// setup for the non-passage page elements
		if (tale.has("StoryCaption")) {
			document.getElementById("story-caption").style.display = "block";
		}
		if (tale.has("StoryMenu") || tale.has("MenuStory")) {
			document.getElementById("menu-story").style.display = "block";
		}
		setPageElement("story-title", "StoryTitle", tale.title);
		UISystem.setPageElements();

		// setup Saves menu
		UISystem.addClickHandler("#menu-saves", null, function () { UISystem.buildSaves(); });

		// setup Rewind menu
		target = $("#menu-rewind");
		if (!config.disableHistoryTracking && tale.lookup("tags", "bookmark").length > 0) {
			target.css({ display : "block" });
			UISystem.addClickHandler(target.find("a"), null, function () { UISystem.buildRewind(); });
		} else {
			target.remove();
		}

		// setup Restart menu
		UISystem.addClickHandler("#menu-restart", null, function () { UISystem.buildRestart(); });

		// setup Options menu
		target = $("#menu-options");
		if (tale.has("MenuOptions") && tale.get("MenuOptions").text.trim() !== "") {
			target.css({ display : "block" });
			UISystem.addClickHandler(target.find("a"), null, function () { UISystem.buildOptions(); });
		} else {
			target.remove();
		}

		// setup Share menu
		target = $("#menu-share");
		if (tale.has("MenuShare") && tale.get("MenuShare").text.trim() !== "") {
			target.css({ display : "block" });
			UISystem.addClickHandler(target.find("a"), null, function () { UISystem.buildShare(); });
		} else {
			target.remove();
		}

		// handle the loading screen
		if (document.readyState === "complete") {
			html.removeClass("init-loading");
		}
		document.addEventListener("readystatechange", function () {
			if (DEBUG) { console.log("**** document.readyState: " + document.readyState + "  (on: readystatechange)"); }
			// readyState can be: "loading", "interactive", or "complete"
			if (document.readyState === "complete") {
				if (DEBUG) { console.log('---- removing class "init-loading" (in ' + config.loadDelay + 'ms)'); }
				if (config.loadDelay > 0) {
					setTimeout(function () { html.removeClass("init-loading"); }, config.loadDelay);
				} else {
					html.removeClass("init-loading");
				}
			} else {
				if (DEBUG) { console.log('++++ adding class "init-loading"'); }
				html.addClass("init-loading");
			}
		}, false);
	},
	setPageElements : function () {
		if (DEBUG) { console.log("[UISystem.setPageElements()]"); }
		// setup for the non-passage page elements
		setPageElement("story-banner",   "StoryBanner");
		setPageElement("story-subtitle", "StorySubtitle");
		setPageElement("story-author",   "StoryAuthor");
		setPageElement("story-caption",  "StoryCaption");
		setPageElement("menu-story",     ["StoryMenu", "MenuStory"]);
	},
	buildSaves : function () {
		function createActionItem(bId, bClass, bText, bAction) {
			var li = document.createElement("li");
			var btn = document.createElement("button");
			btn.id = "saves-" + bId;
			if (bClass) { btn.className = bClass; }
			btn.innerHTML = bText;
			$(btn).click(bAction);
			li.appendChild(btn);
			return li;
		}
		function createSaveList() {
			function createButton(bId, bClass, bText, bSlot, bAction) {
				var btn = document.createElement("button");
				btn.id = "saves-" + bId + "-" + bSlot;
				if (bClass) { btn.className = bClass; }
				btn.classList.add(bId);
				btn.innerHTML = bText;
				$(btn).click(function (i) {
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
					tdDeleBtn.innerHTML = "Delete";
					$(tdDeleBtn).click(function () {
						SaveSystem.deleteAuto();
						UISystem.buildSaves();  // rebuild the saves menu
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
						UISystem.buildSaves();  // rebuild the saves menu
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
			$(input).change(function (evt) {
				SaveSystem.importSave(evt);
				UISystem.close();
			});
			el.appendChild(input);

			return el;
		}

		if (DEBUG) { console.log("[UISystem.buildSaves()]"); }

		var dialog  = UISystem._body,
			list,
			btnBar,
			savesOK = SaveSystem.OK();

		$(dialog)
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
				list.appendChild(createActionItem("purge", null, "Purge Save Slots", function (evt) {
					SaveSystem.purge();
					UISystem.buildSaves();  // rebuild the saves menu
				}));
			}
			btnBar.appendChild(list);
			dialog.appendChild(btnBar);
			return true;
		} else {
			UISystem.alert("Apologies! Your browser either lacks some of the capabilities required to support saves or has disabled them.\n\nThe former may be solved by updating it to a newer version or by switching to a more modern browser.\n\nThe latter may be solved by loosening its security restrictions or, perhaps, by viewing the " + config.errorName + " via the HTTP protocol.");
			return false;
		}
	},
	buildRewind : function () {
		if (DEBUG) { console.log("[UISystem.buildRewind()]"); }

		var dialog   = UISystem._body,
			hasItems = false;

		$(dialog)
			.empty()
			.addClass("rewind");

		for (var i = 0, len = state.length - 1; i < len; i++) {
			var passage = tale.get(state.history[i].title);
			if (passage && passage.tags.contains("bookmark")) {
				var el = document.createElement("div");
				el.classList.add("ui-close");
				$(el).click(function () {
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
					} else {  // History.Modes.Hash
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
				el.innerHTML = passage.excerpt();
				dialog.appendChild(el);
				hasItems = true;
			}
		}
		if (!hasItems) {
			var el = document.createElement("div");
			el.innerHTML = "<i>No passages available</i>";
			dialog.appendChild(el);
		}
	},
	buildRestart : function () {
		if (DEBUG) { console.log("[UISystem.buildRestart()]"); }

		var dialog = UISystem._body;

		$(dialog)
			.empty()
			.addClass("dialog restart")
			.append('<p>Are you sure that you want to restart?  Unsaved progress will be lost.</p><ul><li><button id="restart-ok" class="ui-close">OK</button></li><li><button id="restart-cancel" class="ui-close">Cancel</button></li></ul>');

		// add an additional click handler for the OK button
		$("#ui-body #restart-ok").click(function () {
			state.restart();
		});

		return true;
	},
	buildOptions : function () {
		if (DEBUG) { console.log("[UISystem.buildOptions()]"); }

		var dialog = UISystem._body;

		$(dialog)
			.empty()
			.addClass("dialog options");
		new Wikifier(dialog, tale.get("MenuOptions").processText().trim());

		return true;
	},
	buildShare : function () {
		if (DEBUG) { console.log("[UISystem.buildShare()]"); }

		var dialog = UISystem._body;

		$(dialog)
			.empty()
			.addClass("share");
		new Wikifier(dialog, tale.get("MenuShare").processText().trim());
		$("br", dialog).remove();

		return true;
	},
	alert : function (message, options, closeFunc) {
		var dialog = UISystem._body;

		$(dialog)
			.empty()
			.addClass("dialog alert")
			.append('<p>' + message + '</p><ul><li><button id="alert-ok" class="ui-close">OK</button></li></ul>');

		// show the dialog
		UISystem.show(options, closeFunc);
	},
	restart : function (options) {
		// build the dialog
		UISystem.buildRestart();

		// show the dialog
		UISystem.show(options);
	},
	body : function () {
		return UISystem._body;
	},
	setup : function (classNames) {
		$(UISystem._body)
			.empty()
			.removeClass()
			.addClass("dialog");
		if (classNames != null) {  // use lazy equality
			$(UISystem._body).addClass(classNames);
		}
		return UISystem._body;
	},
	isOpen : function () {
		return document.body.classList.contains("ui-open");
	},
	addClickHandler : function (target, options, startFunc, doneFunc, closeFunc) {
		$(target).click(function (evt) {
			evt.preventDefault();  // does not prevent bound events, only default actions (e.g. href links)

			// call the start function
			if (typeof startFunc === "function") { startFunc(evt); }

			// show the dialog
			UISystem.show(options, closeFunc);

			// call the done function
			if (typeof doneFunc === "function") { doneFunc(evt); }
		});
	},
	show : function (options, closeFunc) {
		options = $.extend({ top : 50, opacity : 0.8 }, options);

		// stop the body from scrolling and setup the delegated UI close handler
		$(document.body)
			.addClass("ui-open")
			.on("click.uisystem-close", ".ui-close", closeFunc, UISystem.close);

		// display the overlay
		$(UISystem._overlay)
			//.addClass("ui-close")
			.css({ display : "block", opacity : 0 })
			.fadeTo(200, options.opacity);

		// display the dialog
		var position = UISystem.calcPositionalProperties(options.top);
		$(UISystem._body)
			.css($.extend({ display : "block", opacity : 0 }, position.dialog))
			.fadeTo(200, 1);
		$(UISystem._closer)
			.css($.extend({ display : "block", opacity : 0 }, position.closer))
			.fadeTo(50, 1);

		// add the UI resize handler
		$(window)
			.on("resize.uisystem", null, options.top, $.debounce(40, UISystem.resizeHandler));
	},
	close : function (evt) {
		// pretty much reverse the actions taken in UISystem.show()
		$(window)
			.off("resize.uisystem");
		$(UISystem._body)
			.css({
				display : "none",
				opacity : 0,
				left    : "",
				right   : "",
				top     : "",
				bottom  : ""
			})
			.removeClass()
			.empty();  // .empty() here will break static menus
		$(UISystem._closer)
			.css({
				display : "none",
				opacity : 0,
				right   : "",
				top     : ""
			});
		/*
		$(UISystem._overlay)
			.css({
				display : "none",
				opacity : 0
			})
			.fadeOut(200)
			.removeClass();
		*/
		$(UISystem._overlay)
			.fadeOut(200);
			//.removeClass();
		$(document.body)
			.off("click.uisystem-close")
			.removeClass("ui-open");

		// call the given "on close" callback function, if any
		if (evt && typeof evt.data === "function") { evt.data(evt); }
	},
	resizeHandler : function (evt) {
		var dialog = $(UISystem._body),
			closer = $(UISystem._closer),
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
	},
	calcPositionalProperties : function (topPos) {
		if (typeof topPos === "undefined") { topPos = 50; }

		var parent    = $(window),
			dialog    = $(UISystem._body),
			dialogPos = { left : "", right : "", top : "", bottom : "" },
			closer    = $(UISystem._closer),
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
		for (var p in dialogPos) {
			if (dialogPos[p] !== "") {
				dialogPos[p] += "px";
			}
		}

		return { dialog : dialogPos, closer : closerPos };
	}
};


/***********************************************************************************************************************
** [End uisystem.js]
***********************************************************************************************************************/
