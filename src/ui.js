/***********************************************************************************************************************
 *
 * ui.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var UI = (function () {
	"use strict";

	var
		_bar            = null,
		_overlay        = null,
		_dialog         = null,
		_dialogTitle    = null,
		_dialogClose    = null,
		_dialogBody     = null,
		_scrollbarWidth = 0;


	/*******************************************************************************************************************
	 * Initialization
	 ******************************************************************************************************************/
	function init() {
		if (DEBUG) { console.log("[UI.init()]"); }

		// remove #init-no-js & #init-lacking from #init-screen
		jQuery("#init-no-js, #init-lacking").remove();

		// calculate and cache the width of scrollbars
		_scrollbarWidth = (function () {
			var scrollbarWidth;
			try {
				var inner = document.createElement("p");
				inner.style.width  = "100%";
				inner.style.height = "200px";

				var outer = document.createElement("div");
				outer.style.position   = "absolute";
				outer.style.left       = "0px";
				outer.style.top        = "0px";
				outer.style.width      = "100px";
				outer.style.height     = "100px";
				outer.style.visibility = "hidden";
				outer.style.overflow   = "hidden";

				outer.appendChild(inner);
				document.body.appendChild(outer);

				var w1 = inner.offsetWidth;
				outer.style.overflow = "auto"; // "overflow: scroll" does not work consistently with scrollbars which are styled with "::-webkit-scrollbar"
				var w2 = inner.offsetWidth;
				if (w1 === w2) {
					w2 = outer.clientWidth;
				}

				document.body.removeChild(outer);

				scrollbarWidth = w1 - w2;
			} catch (e) { /* do nothing */ }
			return (scrollbarWidth || 17); // 17px is a reasonable failover
		}());

		// generate the UI elements and add them to the page
		var	store  = document.getElementById("store-area"),
			uiTree = document.createDocumentFragment(),
			temp   = document.createElement("div");

		// generate the core elements
		temp.innerHTML =
			  '<div id="ui-bar">'
			+     '<div id="ui-bar-toggle"><a></a></div>'
			+     '<div id="ui-bar-body">'
			+         '<header id="title" role="banner">'
			+             '<div id="story-banner"></div>'
			+             '<h1 id="story-title"></h1>'
			+             '<div id="story-subtitle"></div>'
			+             '<div id="story-title-separator"></div>'
			+             '<p id="story-author"></p>'
			+         '</header>'
			+         '<div id="story-caption"></div>'
			+         '<nav id="menu" role="navigation">'
			+             '<ul id="menu-story"></ul>'
			+             '<ul id="menu-core">'
			+                 '<li id="menu-saves"><a>' + strings.saves.title + '</a></li>'
			+                 '<li id="menu-settings"><a>' + strings.settings.title + '</a></li>'
//			+                 '<li id="menu-rewind"><a>' + strings.rewind.title + '</a></li>'
			+                 '<li id="menu-restart"><a>' + strings.restart.title + '</a></li>'
			+                 '<li id="menu-share"><a>' + strings.share.title + '</a></li>'
			+             '</ul>'
			+         '</nav>'
			+         '<footer role="contentinfo">'
			+             '<p id="credits">' + strings.uiBar.credits + '</p>'
			+             '<p id="version">' + version.short() + '</p>'
			+         '</footer>'
			+     '</div>'
			+ '</div>'
			+ '<div id="ui-overlay" class="ui-close"></div>'
			+ '<div id="ui-dialog">'
			+     '<h1 id="ui-dialog-title"></h1>'
			+     '<button id="ui-dialog-close" class="ui-close">\ue804</button>'
			+     '<div id="ui-dialog-body"></div>'
			+ '</div>'
			+ '<div id="story" role="main">'
			+     '<div id="passages"></div>'
			+ '</div>';
		while (temp.hasChildNodes()) {
			uiTree.appendChild(temp.firstChild);
		}

		// cache the main UI elements
		_bar         = uiTree.querySelector("#ui-bar");
		_overlay     = uiTree.querySelector("#ui-overlay");
		_dialog      = uiTree.querySelector("#ui-dialog");
		_dialogTitle = uiTree.querySelector("#ui-dialog-title");
		_dialogClose = uiTree.querySelector("#ui-dialog-close");
		_dialogBody  = uiTree.querySelector("#ui-dialog-body");

		// insert the UI elements into the page before the store area
		store.parentNode.insertBefore(uiTree, store);
	}


	/*******************************************************************************************************************
	 * Internals
	 ******************************************************************************************************************/
	function start() {
		if (DEBUG) { console.log("[UI.start()]"); }

		// setup the title
		if (TWINE1) {
			setPageElement("story-title", "StoryTitle", tale.title);
		} else {
			jQuery("#story-title").empty().append(tale.title);
		}

		// setup the #credits
		jQuery("#credits", _bar)
			.html(strings.uiBar.credits);

		// setup the #ui-bar-toggle button
		jQuery("#ui-bar-toggle a")
			.attr("title", strings.uiBar.toggle)
			.on("click", function () {
				_bar.classList.toggle("stowed");
			});

		// setup the dynamic page elements
		if (!tale.has("StoryCaption")) {
			jQuery("#story-caption").remove();
		}
		if (!tale.has("StoryMenu")) {
			jQuery("#menu-story").remove();
		}
		setPageElements();

		// setup the Saves menu item
		dialogAddClickHandler("#menu-saves a", null, function () { buildDialogSaves(); })
			.text(strings.saves.title);

//		// setup the Rewind menu item
//		if (!config.disableHistoryTracking && tale.lookup("tags", "bookmark").length > 0) {
//			dialogAddClickHandler("#menu-rewind a", null, function () { buildDialogRewind(); })
//				.text(strings.rewind.title);
//		} else {
//			jQuery("#menu-rewind").remove();
//		}

		// setup the Restart menu item
		dialogAddClickHandler("#menu-restart a", null, function () { buildDialogRestart(); })
			.text(strings.restart.title);

		// setup the Settings menu item
		if (!Setting.isEmpty()) {
			dialogAddClickHandler("#menu-settings a", null, function () { buildDialogSettings(); })
				.text(strings.settings.title);
		} else {
			jQuery("#menu-settings").remove();
		}

		// setup the Share menu item
		if (tale.has("StoryShare")) {
			dialogAddClickHandler("#menu-share a", null, function () { buildDialogShare(); })
				.text(strings.share.title);
		} else {
			jQuery("#menu-share").remove();
		}

		// handle the loading screen
		if (document.readyState === "complete") {
			document.documentElement.classList.remove("init-loading");
		}
		document.addEventListener("readystatechange", function () {
			// readyState can be: "loading", "interactive", or "complete"
			if (document.readyState === "complete") {
				if (config.loadDelay > 0) {
					setTimeout(function () {
						document.documentElement.classList.remove("init-loading");
					}, config.loadDelay);
				} else {
					document.documentElement.classList.remove("init-loading");
				}
			} else {
				document.documentElement.classList.add("init-loading");
			}
		}, false);
	}

	function setPageElements() {
		if (DEBUG) { console.log("[UI.setPageElements()]"); }

		// setup the (non-navigation) dynamic page elements
		setPageElement("story-banner", "StoryBanner");
		setPageElement("story-subtitle", "StorySubtitle");
		setPageElement("story-author", "StoryAuthor");
		setPageElement("story-caption", "StoryCaption");

		// setup the #menu-story items
		var menuStory = document.getElementById("menu-story");
		if (menuStory !== null) {
			removeChildren(menuStory);
			if (tale.has("StoryMenu")) {
				buildListFromPassage("StoryMenu", menuStory);
			}
		}
	}

	function buildDialogSaves() {
		function createActionItem(bId, bClass, bText, bAction) {
			var	li  = document.createElement("li"),
				btn = document.createElement("button");
			btn.id = "saves-" + bId;
			if (bClass) {
				btn.classList.add(bClass);
			}
			btn.innerHTML = bText;
			if (bAction) {
				jQuery(btn).on("click", bAction);
			} else {
				btn.classList.add("disabled");
			}
			li.appendChild(btn);
			return li;
		}
		function createSaveList() {
			function createButton(bId, bClass, bText, bSlot, bAction) {
				var btn = document.createElement("button");
				btn.id = "saves-" + bId + "-" + bSlot;
				if (bClass) {
					btn.classList.add(bClass);
				}
				btn.classList.add(bId);
				btn.innerHTML = bText;
				if (bAction) {
					jQuery(btn).on("click", bSlot === "auto"
						? function () { bAction(); }
						: function () { bAction(bSlot); });
				} else {
					btn.classList.add("disabled");
				}
				return btn;
			}

			var saves = storage.getItem("saves");
			if (saves === null) { return false; }

			var	tbody  = document.createElement("tbody"),
				tr,
				tdSlot,
				tdLoad,
				tdDesc,
				tdDele;
			var	tdLoadBtn, tdDescTxt, tdDeleBtn;

			if (Save.autosaveOK()) {
				tr     = document.createElement("tr"),
				tdSlot = document.createElement("td"),
				tdLoad = document.createElement("td"),
				tdDesc = document.createElement("td"),
				tdDele = document.createElement("td");

				//tdSlot.appendChild(document.createTextNode("\u25c6")); // Black Diamond
				tdDescTxt = document.createElement("b");
				tdDescTxt.innerHTML = "A";
				tdSlot.appendChild(tdDescTxt);

				if (saves.autosave && saves.autosave.state.mode === config.historyMode) {
					tdLoadBtn = createButton("load", "ui-close", strings.saves.slotLoad, "auto", Save.loadAuto);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createTextNode(saves.autosave.title);
					tdDesc.appendChild(tdDescTxt);
					tdDesc.appendChild(document.createElement("br"));
					tdDescTxt = document.createElement("span");
					tdDescTxt.classList.add("datestamp");
					if (saves.autosave.date) {
						tdDescTxt.innerHTML = strings.saves.savedOn + " (" + new Date(saves.autosave.date).toLocaleString() + ")";
					} else {
						tdDescTxt.innerHTML = strings.saves.savedOn + " (<i>" + strings.saves.unknownDate + "</i>)";
					}
					tdDesc.appendChild(tdDescTxt);

					tdDeleBtn = createButton("delete", null, strings.saves.slotDelete, "auto", function () {
						Save.deleteAuto();
						buildDialogSaves(); // rebuild the saves dialog
					});
					tdDele.appendChild(tdDeleBtn);
				} else {
					tdLoadBtn = createButton("load", null, strings.saves.slotLoad, "auto");
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createElement("i");
					tdDescTxt.innerHTML = strings.saves.slotEmpty;
					tdDesc.appendChild(tdDescTxt);
					tdDesc.classList.add("empty");

					tdDeleBtn = createButton("delete", null, strings.saves.slotDelete, "auto");
					tdDele.appendChild(tdDeleBtn);
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
					tdLoadBtn = createButton("load", "ui-close", strings.saves.slotLoad, i, Save.load);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createTextNode(saves.slots[i].title);
					tdDesc.appendChild(tdDescTxt);
					tdDesc.appendChild(document.createElement("br"));
					tdDescTxt = document.createElement("span");
					tdDescTxt.classList.add("datestamp");
					if (saves.slots[i].date) {
						tdDescTxt.innerHTML = strings.saves.savedOn + " (" + new Date(saves.slots[i].date).toLocaleString() + ")";
					} else {
						tdDescTxt.innerHTML = strings.saves.savedOn + " (<i>" + strings.saves.unknownDate + "</i>)";
					}
					tdDesc.appendChild(tdDescTxt);

					tdDeleBtn = createButton("delete", null, strings.saves.slotDelete, i, function (i) {
						Save.delete(i);
						buildDialogSaves(); // rebuild the saves dialog
					});
					tdDele.appendChild(tdDeleBtn);
				} else {
					tdLoadBtn = createButton("save", "ui-close", strings.saves.slotSave, i, Save.save);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createElement("i");
					tdDescTxt.innerHTML = strings.saves.slotEmpty;
					tdDesc.appendChild(tdDescTxt);
					tdDesc.classList.add("empty");

					tdDeleBtn = createButton("delete", null, strings.saves.slotDelete, i);
					tdDele.appendChild(tdDeleBtn);
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
			var	el    = document.createElement("div"),
				label = document.createElement("label"),
				input = document.createElement("input");

			el.id = "saves-import-box";

			// add label
			label.id      = "saves-import-label";
			label.htmlFor = "saves-import-file";
			label.appendChild(document.createTextNode(strings.saves.importLabel));
			el.appendChild(label);

			el.appendChild(document.createElement("br"));

			// add file input
			input.type = "file";
			input.id   = "saves-import-file";
			input.name = "saves-import-file";
			jQuery(input).on("change", function (evt) {
				Save.importSave(evt);
				dialogClose();
			});
			el.appendChild(input);

			return el;
		}

		if (DEBUG) { console.log("[UI.buildDialogSaves()]"); }

		var	savesOK  = Save.OK(),
			hasSaves = Save.hasAuto() || !Save.isEmpty(),
			list,
			btnBar;

		dialogSetup(strings.saves.title, "saves");

		if (savesOK) {
			// add saves list
			list = createSaveList();
			if (!list) {
				list = document.createElement("div");
				list.id = "saves-list"
				list.innerHTML = "<i>" + strings.saves.unavailable + "</i>";
			}
			_dialogBody.appendChild(list);
		}

		// add action list (export, import, and purge) and import input
		if (hasSaves || has.fileAPI) {
			btnBar = document.createElement("ul");
			btnBar.classList.add("buttons");
			if (has.fileAPI) {
				btnBar.appendChild(createActionItem("export", "ui-close", strings.saves.diskSave, Save.exportSave));
				btnBar.appendChild(createActionItem("import", null, strings.saves.diskLoad, function (evt) {
					if (document.getElementById("saves-import-file")) {
						jQuery("#saves-import-box", _dialogBody).remove();
					} else {
						_dialogBody.appendChild(createSavesImport());
					}
				}));
			}
			if (hasSaves) {
				btnBar.appendChild(createActionItem("purge", null, strings.saves.slotsPurge, function (evt) {
					Save.purge();
					buildDialogSaves(); // rebuild the saves menu
				}));
			}
			_dialogBody.appendChild(btnBar);
			return true;
		} else {
			dialogAlert(strings.saves.incapable.replace("%identity%", strings.identity));
			return false;
		}
	}

//	function buildDialogRewind() {
//		if (DEBUG) { console.log("[UI.buildDialogRewind()]"); }
//
//		var list = document.createElement("ul");
//
//		jQuery(dialogSetup(strings.rewind.title, "rewind list"))
//			.append(list);
//
//		for (var i = state.length - 2; i >= 0; i--) {
//			var passage = tale.get(state.history[i].title);
//			if (passage && passage.tags.contains("bookmark")) {
//				var	item = document.createElement("li"),
//					link = document.createElement("a");
//				link.classList.add("ui-close");
//				jQuery(link).one("click", (function () {
//					var p = i;
//					if (config.historyMode === History.Modes.Session) {
//						return function () {
//							if (DEBUG) { console.log("[rewind:click() @Session]"); }
//
//							// necessary?
//							document.title = tale.title;
//
//							// regenerate the state history suid
//							state.regenerateSuid();
//
//							// push the history states in order
//							if (config.disableHistoryControls) {
//								if (DEBUG) { console.log("    > pushing: " + p + " (" + state.history[p].title + ")"); }
//
//								// load the state into the window history
//								History.replaceWindowState(
//									{ suid : state.suid, sidx : state.history[p].sidx },
//									(config.displayPassageTitles && state.history[p].title !== config.startPassage)
//										? tale.title + ": " + state.history[p].title
//										: tale.title
//								);
//							} else {
//								for (var i = 0, end = p; i <= end; i++) {
//									if (DEBUG) { console.log("    > pushing: " + i + " (" + state.history[i].title + ")"); }
//
//									// load the state into the window history
//									History.addWindowState(
//										{ suid : state.suid, sidx : state.history[i].sidx },
//										(config.displayPassageTitles && state.history[i].title !== config.startPassage)
//											? tale.title + ": " + state.history[i].title
//											: tale.title
//									);
//								}
//							}
//
//							var windowState = History.getWindowState();
//							if (windowState !== null && windowState.sidx < state.top.sidx) {
//								if (DEBUG) { console.log("    > stacks out of sync; popping " + (state.top.sidx - windowState.sidx) + " states to equalize"); }
//								// stack indexes are out of sync, pop our stack until
//								// we're back in sync with the window.history
//								state.pop(state.top.sidx - windowState.sidx);
//							}
//
//							// activate the current top
//							state.setActiveState(state.top);
//
//							// display the passage
//							state.display(state.active.title, null, "replace");
//						};
//					} else if (config.historyMode === History.Modes.Window) {
//						return function () {
//							if (DEBUG) { console.log("[rewind:click() @Window]"); }
//
//							// necessary?
//							document.title = tale.title;
//
//							// push the history states in order
//							if (!config.disableHistoryControls) {
//								for (var i = 0, end = p; i <= end; i++) {
//									if (DEBUG) { console.log("    > pushing: " + i + " (" + state.history[i].title + ")"); }
//
//									// load the state into the window history
//									var stateObj = { history : state.history.slice(0, i + 1) };
//									if (state.hasOwnProperty("prng")) {
//										stateObj.rseed = state.prng.seed;
//									}
//									History.addWindowState(
//										stateObj,
//										(config.displayPassageTitles && state.history[i].title !== config.startPassage)
//											? tale.title + ": " + state.history[i].title
//											: tale.title
//									);
//								}
//							}
//
//							// stack ids are out of sync, pop our stack until
//							// we're back in sync with the window.history
//							state.pop(state.length - (p + 1));
//
//							// activate the current top
//							state.setActiveState(state.top);
//
//							// display the passage
//							state.display(state.active.title, null, "replace");
//						};
//					} else { // History.Modes.Hash
//						return function () {
//							if (DEBUG) { console.log("[rewind:click() @Hash]"); }
//
//							if (!config.disableHistoryControls) {
//								window.location.hash = state.history[p].hash;
//							} else {
//								session.setItem("activeHash", state.history[p].hash);
//								window.location.reload();
//							}
//						};
//					}
//				}()));
//				link.appendChild(document.createTextNode(strings.rewind.turn + " " + (i + 1) + ": " + passage.description()));
//				item.appendChild(link);
//				list.appendChild(item);
//			}
//		}
//		if (!list.hasChildNodes()) {
//			var	item = document.createElement("li"),
//				link = document.createElement("a");
//			link.innerHTML = "<i>" + strings.rewind.unavailable + "</i>";
//			item.appendChild(link);
//			list.appendChild(item);
//		}
//	}

	function buildDialogRestart() {
		if (DEBUG) { console.log("[UI.buildDialogRestart()]"); }

		jQuery(dialogSetup(strings.restart.title, "restart"))
			.append('<p>' + strings.restart.prompt + '</p><ul class="buttons">'
				+ '<li><button id="restart-ok" class="ui-close">' + (strings.restart.ok || strings.ok) + '</button></li>'
				+ '<li><button id="restart-cancel" class="ui-close">' + (strings.restart.cancel || strings.cancel) + '</button></li>'
				+ '</ul>');

		// add an additional click handler for the OK button
		jQuery("#ui-dialog-body #restart-ok").one("click", function () {
			state.restart();
		});

		return true;
	}

	function buildDialogSettings() {
		if (DEBUG) { console.log("[UI.buildDialogSettings()]"); }

		dialogSetup(strings.settings.title, "settings");

		Setting.controls.forEach(function (control) {
			var	name      = control.name,
				id        = Util.slugify(name),
				elSetting = document.createElement("div"),
				elLabel   = document.createElement("div"),
				elControl = document.createElement("div"),
				elInput;

			elSetting.appendChild(elLabel);
			elSetting.appendChild(elControl);
			elSetting.id = "setting-body-" + id;
			elLabel.id   = "setting-label-" + id;
			elControl.id = "setting-control-" + id;

			// setup the label
			new Wikifier(elLabel, control.label);

			// setup the control
			if (settings[name] == null) { // use lazy equality
				settings[name] = control.default;
			}
			switch (control.type) {
			case Setting.Types.Toggle:
				elInput = document.createElement("a");
				if (settings[name]) {
					jQuery(elInput)
						.addClass("enabled")
						.text(strings.settings.on);
				} else {
					jQuery(elInput)
						.text(strings.settings.off);
				}
				jQuery(elInput).on("click", function (evt) {
					if (settings[name]) {
						jQuery(this)
							.removeClass("enabled")
							.text(strings.settings.off);
						settings[name] = false;
					} else {
						jQuery(this)
							.addClass("enabled")
							.text(strings.settings.on);
						settings[name] = true;
					}
					Setting.save();
					if (typeof control.callback === "function") {
						control.callback.call(this);
					}
				});
				break;
			case Setting.Types.List:
				elInput = document.createElement("select");
				for (var i = 0; i < control.list.length; i++) {
					var elItem = document.createElement("option");
					insertText(elItem, control.list[i]);
					elInput.appendChild(elItem);
				}
				elInput.value = settings[name];
				jQuery(elInput).on("change", function (evt) {
					settings[name] = evt.target.value;
					Setting.save();
					if (typeof control.callback === "function") {
						control.callback.call(this);
					}
				});
				break;
			}
			elInput.id = "setting-input-" + id;
			elControl.appendChild(elInput);

			_dialogBody.appendChild(elSetting);
		});

		// add the button bar
		jQuery(_dialogBody)
			.append('<ul class="buttons">'
				+ '<li><button id="settings-ok" class="ui-close">' + (strings.settings.ok || strings.ok) + '</button></li>'
				+ '<li><button id="settings-reset" class="ui-close">' + strings.settings.reset + '</button></li>'
				+ '</ul>');

		// add an additional click handler for the Reset button
		jQuery("#ui-dialog-body #settings-reset").one("click", function (evt) {
			Setting.reset();
			window.location.reload();
		});

		return true;
	}

	function buildDialogShare() {
		if (DEBUG) { console.log("[UI.buildDialogShare()]"); }

		jQuery(dialogSetup(strings.share.title, "share list"))
			.append(buildListFromPassage("StoryShare"));
			//.find("a")
			//	.addClass("ui-close");

		return true;
	}

	function buildDialogAutoload() {
		if (DEBUG) { console.log("[UI.buildDialogAutoload()]"); }

		jQuery(dialogSetup(strings.autoload.title, "autoload"))
			.append('<p>' + strings.autoload.prompt + '</p><ul class="buttons">'
				+ '<li><button id="autoload-ok" class="ui-close">' + (strings.autoload.ok || strings.ok) + '</button></li>'
				+ '<li><button id="autoload-cancel" class="ui-close">' + (strings.autoload.cancel || strings.cancel) + '</button></li>'
				+ '</ul>');

		// add an additional click handler for the #autoload-* buttons
		jQuery(document.body).one("click.autoload", ".ui-close", function (evt) {
			if (DEBUG) { console.log('    > display/autoload: "' + Save.getAuto().title + '"'); }
			if (evt.target.id !== "autoload-ok" || !Save.loadAuto()) {
				if (DEBUG) { console.log('    > display: "' + config.startPassage + '"'); }
				state.display(config.startPassage);
			}
		});

		return true;
	}

	function buildListFromPassage(passage, list) {
		if (list == null) { // use lazy equality
			list = document.createElement("ul");
		}
		var temp = document.createDocumentFragment();
		new Wikifier(temp, tale.get(passage).processText().trim());
		if (temp.hasChildNodes()) {
			var li = null;
			while (temp.hasChildNodes()) {
				var node = temp.firstChild;
				if (
					   node.nodeType !== Node.TEXT_NODE
					&& (node.nodeType !== Node.ELEMENT_NODE || node.nodeName.toUpperCase() === "BR")
				) { // non-text, non-element, or <br>-element nodes
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


	/*******************************************************************************************************************
	 * Built-ins
	 ******************************************************************************************************************/
	function dialogAlert(message, options, closeFn) {
		jQuery(dialogSetup("Alert", "alert"))
			.append('<p>' + message + '</p><ul class="buttons">'
				+ '<li><button id="alert-ok" class="ui-close">' + (strings.alert.ok || strings.ok) + '</button></li>'
				+ '</ul>');
		dialogOpen(options, closeFn);
	}

	function dialogRestart(options) {
		buildDialogRestart();
		dialogOpen(options);
	}

	function dialogSettings(/* options, closeFn */) {
		buildDialogSettings();
		dialogOpen.apply(null, arguments);
	}

//	function dialogRewind(/* options, closeFn */) {
//		buildDialogRewind();
//		dialogOpen.apply(null, arguments);
//	}

	function dialogSaves(/* options, closeFn */) {
		buildDialogSaves();
		dialogOpen.apply(null, arguments);
	}

	function dialogShare(/* options, closeFn */) {
		buildDialogShare();
		dialogOpen.apply(null, arguments);
	}


	/*******************************************************************************************************************
	 * Core
	 ******************************************************************************************************************/
	function dialogIsOpen(classNames) {
		return _dialog.classList.contains("open") && (!classNames ? true : _dialogBody.classList.contains(classNames));
	}

	function dialogBody() {
		return _dialogBody;
	}

	function dialogSetup(title, classNames) {
		jQuery(_dialogBody)
			.empty()
			.removeClass();
		if (classNames != null) { // use lazy equality
			jQuery(_dialogBody).addClass(classNames);
		}
		title = (title == null ? "" : title + ""); // use lazy equality on null check
		jQuery(_dialogTitle)
			.empty()
			.append(title === "" ? "\u00a0" : title);
		return _dialogBody;
	}

	function dialogAddClickHandler(target, options, startFn, doneFn, closeFn) {
		return jQuery(target).on("click", function (evt) {
			evt.preventDefault(); // does not prevent bound events, only default actions (e.g. href links)

			// call the start function
			if (typeof startFn === "function") {
				startFn(evt);
			}

			// open the dialog
			dialogOpen(options, closeFn);

			// call the done function
			if (typeof doneFn === "function") {
				doneFn(evt);
			}
		});
	}

	function dialogOpen(options, closeFn) {
		options = jQuery.extend({ top : 50 }, options);

		// setup the delegated UI close handler
		jQuery(document.body)
			.one("click.uisystem-close", ".ui-close", closeFn, dialogClose);

		// add the UI isOpen class
		jQuery(document.documentElement)
			.addClass("ui-dialog-open");

		// display the overlay
		jQuery(_overlay)
			.addClass("open");

		// add the imagesLoaded handler to the dialog body, if necessary
		if (_dialogBody.querySelector("img") !== null) {
			jQuery(_dialogBody)
				.imagesLoaded()
				.always((function (top) {
					return function () {
						dialogResizeHandler({ data : top });
					};
				}(options.top)));
		}

		// display the dialog
		var position = dialogCalcPosition(options.top);
		jQuery(_dialog)
			.css(position)
			.addClass("open");

		// add the UI resize handler
		jQuery(window)
			.on("resize.uisystem", null, options.top, jQuery.throttle(40, dialogResizeHandler));
	}

	function dialogClose(evt) {
		// largely reverse the actions taken in `dialogOpen()`
		jQuery(window)
			.off("resize.uisystem");
		jQuery(_dialog)
			.removeClass("open")
			.css({ left : "", right : "", top : "", bottom : "" });
		jQuery(_dialogTitle)
			.empty();
		jQuery(_dialogBody)
			.empty()
			.removeClass();
		jQuery(_overlay)
			.removeClass("open");
		jQuery(document.documentElement)
			.removeClass("ui-dialog-open");
		jQuery(document.body)
			.off("click.uisystem-close");

		// call the given "on close" callback function, if any
		if (evt && typeof evt.data === "function") {
			evt.data(evt);
		}
	}

	function dialogResizeHandler(evt) {
		var	$dialog = jQuery(_dialog),
			topPos  = (evt && typeof evt.data !== "undefined") ? evt.data : 50;

		if ($dialog.css("display") === "block") {
			// stow the dialog
			$dialog.css({ display : "none" });

			// restore the dialog with its new positional properties
			var position = dialogCalcPosition(topPos);
			$dialog.css(jQuery.extend({ display : "" }, position));
		}
	}

	function dialogCalcPosition(topPos) {
		if (topPos == null) { // use lazy equality
			topPos = 50;
		}

		var	$parent   = jQuery(window),
			$dialog   = jQuery(_dialog),
			dialogPos = { left : "", right : "", top : "", bottom : "" };

		// unset the dialog's positional properties before checking its dimensions
		$dialog.css(dialogPos);

		var	horzSpace = $parent.width() - $dialog.outerWidth(true) - 1,   // -1 to address a Firefox issue
			vertSpace = $parent.height() - $dialog.outerHeight(true) - 1; // -1 to address a Firefox issue

		if (horzSpace <= (32 + _scrollbarWidth)) {
			vertSpace -= _scrollbarWidth;
		}
		if (vertSpace <= (32 + _scrollbarWidth)) {
			horzSpace -= _scrollbarWidth;
		}

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

		Object.keys(dialogPos).forEach(function (p) {
			if (dialogPos[p] !== "") {
				dialogPos[p] += "px";
			}
		});

		return dialogPos;
	}


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		// Initialization
		init                 : { value : init },
		// Internals
		start                : { value : start },
		setPageElements      : { value : setPageElements },
		buildDialogSaves     : { value : buildDialogSaves },
//		buildDialogRewind    : { value : buildDialogRewind },
		buildDialogRestart   : { value : buildDialogRestart },
		buildDialogSettings  : { value : buildDialogSettings },
		buildDialogShare     : { value : buildDialogShare },
		buildDialogAutoload  : { value : buildDialogAutoload },
		buildListFromPassage : { value : buildListFromPassage },
		// Built-ins
		alert                : { value : dialogAlert },
		restart              : { value : dialogRestart },
		settings             : { value : dialogSettings },
//		rewind               : { value : dialogRewind },
		saves                : { value : dialogSaves },
		share                : { value : dialogShare },
		// Core
		isOpen               : { value : dialogIsOpen },
		body                 : { value : dialogBody },
		setup                : { value : dialogSetup },
		addClickHandler      : { value : dialogAddClickHandler },
		open                 : { value : dialogOpen },
		close                : { value : dialogClose }
	}));

}());

