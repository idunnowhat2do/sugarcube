/***********************************************************************************************************************
 *
 * ui.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Has, Save, Setting, State, Story, StyleWrapper, Util, Wikifier, config, insertText, removeChildren,
	       safeActiveElement, setPageElement, session, settings, storage, strings, version
*/

var UI = (function () { // eslint-disable-line no-unused-vars
	"use strict";

	var
		_bar            = null,
		_overlay        = null,
		_dialog         = null,
		_dialogTitle    = null,
		_dialogClose    = null, // eslint-disable-line no-unused-vars
		_dialogBody     = null,
		_lastActive     = null,
		_outlinePatch   = null,
		_scrollbarWidth = 0;


	/*******************************************************************************************************************
	 * Initialization & Startup
	 ******************************************************************************************************************/
	function init() {
		if (DEBUG) { console.log("[UI.init()]"); }

		/*
			Remove #init-no-js & #init-lacking from #init-screen.
		*/
		jQuery("#init-no-js, #init-lacking").remove();

		/*
			Add `tabindex=-1` to <body>.
		*/
		//jQuery(document.body).attr("tabindex", -1);

		/*
			Generate and cache the outline patching <style> element.
		*/
		_outlinePatch      = document.createElement("style");
		_outlinePatch.id   = "style-outline-patch";
		_outlinePatch.type = "text/css";
		document.head.appendChild(_outlinePatch);

		/*
			Calculate and cache the width of scrollbars.
		*/
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
				// `overflow: scroll` does not work consistently with scrollbars which are
				// styled with `::-webkit-scrollbar`
				outer.style.overflow = "auto";
				var w2 = inner.offsetWidth;
				if (w1 === w2) {
					w2 = outer.clientWidth;
				}

				document.body.removeChild(outer);

				scrollbarWidth = w1 - w2;
			} catch (e) { /* no-op */ }
			return scrollbarWidth || 17; // 17px is a reasonable failover
		})();

		/*
			Generate the main UI elements.
		*/
		var	store  = document.getElementById("store-area"),
			uiTree = document.createDocumentFragment(),
			temp   = document.createElement("div");
		/* eslint-disable max-len */
		temp.innerHTML =
			  '<div id="ui-bar">'
			+     '<div id="ui-bar-tray">'
			+         String.format('<button id="ui-bar-toggle" tabindex="0" title="{0}" aria-label="{0}"></button>', strings.uiBar.toggle)
			+         '<div id="ui-bar-history">'
			+             String.format('<button id="history-backward" tabindex="0" title="{0}" aria-label="{0}">\ue821</button>',
							strings.uiBar.backward.replace(/%identity%/g, strings.identity))
			+             String.format('<button id="history-jumpto" tabindex="0" title="{0}" aria-label="{0}">\ue839</button>',
							strings.uiBar.jumpto.replace(/%identity%/g, strings.identity))
			+             String.format('<button id="history-forward" tabindex="0" title="{0}" aria-label="{0}">\ue822</button>',
							strings.uiBar.forward.replace(/%identity%/g, strings.identity))
			+         '</div>'
			+     '</div>'
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
			+                 '<li id="menu-item-saves"><a tabindex="0">' + strings.saves.title + '</a></li>'
			+                 '<li id="menu-item-settings"><a tabindex="0">' + strings.settings.title + '</a></li>'
			+                 '<li id="menu-item-restart"><a tabindex="0">' + strings.restart.title + '</a></li>'
			+                 '<li id="menu-item-share"><a tabindex="0">' + strings.share.title + '</a></li>'
			+             '</ul>'
			+         '</nav>'
			+     '</div>'
			+ '</div>'
			+ '<div id="ui-overlay" class="ui-close"></div>'
			+ '<div id="ui-dialog" tabindex="0" role="dialog" aria-labelledby="ui-dialog-title">'
			+     '<div id="ui-dialog-titlebar">'
			+         '<h1 id="ui-dialog-title"></h1>'
			+         '<button id="ui-dialog-close" class="ui-close" tabindex="0" aria-label="' + strings.close + '">\ue804</button>'
			+     '</div>'
			+     '<div id="ui-dialog-body"></div>'
			+ '</div>'
			+ '<div id="story" role="main">'
			+     '<div id="passages"></div>'
			+ '</div>';
		/* eslint-enable max-len */
		while (temp.hasChildNodes()) {
			uiTree.appendChild(temp.firstChild);
		}

		/*
			Cache the core UI elements, since they're going to be used often.
		*/
		_bar         = uiTree.querySelector("#ui-bar");
		_overlay     = uiTree.querySelector("#ui-overlay");
		_dialog      = uiTree.querySelector("#ui-dialog");
		_dialogTitle = uiTree.querySelector("#ui-dialog-title");
		_dialogClose = uiTree.querySelector("#ui-dialog-close");
		_dialogBody  = uiTree.querySelector("#ui-dialog-body");

		/*
			Insert the main UI elements into the page before the store area.
		*/
		store.parentNode.insertBefore(uiTree, store);

		/*
			Setup the document-wide delegated handlers.
		*/
		jQuery(document)
			// setup a handler for the history-backward/-forward buttons
			.on("tw:historyupdate", (function ($backward, $forward) {
				return function () {
					$backward.prop("disabled", State.length < 2);
					$forward.prop("disabled", State.length === State.size);
				};
			})(jQuery("#history-backward"), jQuery("#history-forward")))
			// setup accessible outline handling
			// based on: http://www.paciellogroup.com/blog/2012/04/how-to-remove-css-outlines-in-an-accessible-manner/
			.on("mousedown.outline-handler keydown.outline-handler", function (evt) {
				switch (evt.type) {
				case "mousedown":
					patchOutlines(true);
					break;
				case "keydown":
					patchOutlines(false);
					break;
				}
			});
	}

	function start() {
		if (DEBUG) { console.log("[UI.start()]"); }

		// setup the #ui-bar's initial state
		if (config.ui.stowBarInitially || jQuery(window).width() <= 800) {
			var	$uiBarStory = jQuery("#ui-bar,#story");
			$uiBarStory.addClass("no-transition");
			_bar.classList.add("stowed");
			setTimeout(function () {
				$uiBarStory.removeClass("no-transition");
			}, 100);
		}

		// setup the #ui-bar-toggle and #ui-bar-history widgets
		jQuery("#ui-bar-toggle")
			.ariaClick({
				label : strings.uiBar.toggle
			}, function () {
				jQuery(_bar).toggleClass("stowed");
			});
		if (config.history.controls) {
			jQuery("#history-backward")
				.prop("disabled", State.length < 2)
				.ariaClick({
					label : strings.uiBar.backward.replace(/%identity%/g, strings.identity)
				}, function () {
					State.backward();
				});
			if ((config.history.maxStates === 0 || config.history.maxStates > 10) && Story.lookup("tags", "bookmark").length > 0) {
				jQuery("#history-jumpto")
					.ariaClick({
						label : strings.uiBar.jumpto.replace(/%identity%/g, strings.identity)
					}, function () {
						UI.jumpto();
					});
			} else {
				jQuery("#history-jumpto").remove();
			}
			jQuery("#history-forward")
				.prop("disabled", State.length === State.size)
				.ariaClick({
					label : strings.uiBar.forward.replace(/%identity%/g, strings.identity)
				}, function () {
					State.forward();
				});
		} else {
			jQuery("#ui-bar-history").remove();
		}

		// setup the title
		if (TWINE1) { // for Twine 1
			setPageElement("story-title", "StoryTitle", Story.title);
		} else { // for Twine 2
			jQuery("#story-title").text(Story.title);
		}

		// setup the dynamic page elements
		if (!Story.has("StoryCaption")) {
			jQuery("#story-caption").remove();
		}
		if (!Story.has("StoryMenu")) {
			jQuery("#menu-story").remove();
		}
		setStoryElements();

		// setup the Saves menu item
		dialogAddClickHandler("#menu-item-saves a", null, buildDialogSaves)
			.text(strings.saves.title);

		// setup the Settings menu item
		if (!Setting.isEmpty()) {
			dialogAddClickHandler("#menu-item-settings a", null, buildDialogSettings)
				.text(strings.settings.title);
		} else {
			jQuery("#menu-item-settings").remove();
		}

		// setup the Restart menu item
		dialogAddClickHandler("#menu-item-restart a", null, buildDialogRestart)
			.text(strings.restart.title);

		// setup the Share menu item
		if (Story.has("StoryShare")) {
			dialogAddClickHandler("#menu-item-share a", null, buildDialogShare)
				.text(strings.share.title);
		} else {
			jQuery("#menu-item-share").remove();
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


	/*******************************************************************************************************************
	 * Internals
	 ******************************************************************************************************************/
	function setStoryElements() {
		if (DEBUG) { console.log("[UI.setStoryElements()]"); }

		// setup the (non-navigation) dynamic page elements
		setPageElement("story-banner", "StoryBanner");
		setPageElement("story-subtitle", "StorySubtitle");
		setPageElement("story-author", "StoryAuthor");
		setPageElement("story-caption", "StoryCaption");

		// setup the #menu-story items
		var menuStory = document.getElementById("menu-story");
		if (menuStory !== null) {
			removeChildren(menuStory);
			if (Story.has("StoryMenu")) {
				buildLinkListFromPassage("StoryMenu", menuStory);
			}
		}
	}

	function patchOutlines(patch) {
		var	outlines = new StyleWrapper(_outlinePatch);
		if (patch) {
			outlines.set("*:focus{outline:none}");
		} else {
			outlines.clear();
		}
	}

	function buildDialogJumpTo() {
		if (DEBUG) { console.log("[UI.buildDialogJumpTo()]"); }

		var list = document.createElement("ul");

		jQuery(dialogSetup(strings.jumpto.title, "jumpto list"))
			.append(list);

		for (var i = State.size - 1; i >= 0; --i) {
			if (i === State.activeIndex) {
				continue;
			}

			var passage = Story.get(State.history[i].title);

			if (passage && passage.tags.contains("bookmark")) {
				var	item = document.createElement("li"),
					link = document.createElement("a");

				jQuery(link)
					.ariaClick({ one : true }, (function (idx) {
						return function () {
							State.goTo(idx);
						};
					})(i))
					.addClass("ui-close")
					.text(strings.jumpto.turn + " " + (State.expired + i + 1) + ": " + passage.description());

				item.appendChild(link);
				list.appendChild(item);
			}

		}
		if (!list.hasChildNodes()) {
			jQuery(list).append("<li><a><i>" + strings.jumpto.unavailable + "</i></a></li>");
		}
	}

	function buildDialogSaves() {
		function createActionItem(bId, bClass, bText, bAction) {
			var	li   = document.createElement("li"),
				$btn = jQuery(document.createElement("button"));

			$btn
				.attr("id", "saves-" + bId)
				.html(bText);
			if (bClass) {
				$btn.addClass(bClass);
			}
			if (bAction) {
				$btn.ariaClick(bAction);
			} else {
				$btn.prop("disabled", true);
			}
			$btn.appendTo(li);
			//li.appendChild($btn[0]);
			return li;
		}
		function createSaveList() {
			function createButton(bId, bClass, bText, bSlot, bAction) {
				var $btn = jQuery(document.createElement("button"));

				$btn
					.attr("id", "saves-" + bId + "-" + bSlot)
					.addClass(bId)
					.html(bText);
				if (bClass) {
					$btn.addClass(bClass);
				}
				if (bAction) {
					if (bSlot === "auto") {
						$btn
							.ariaClick({
								label : bText + " " + strings.saves.labelAuto
							}, function () { bAction(); });
					} else {
						$btn
							.ariaClick({
								label : bText + " " + strings.saves.labelSlot + " " + (bSlot + 1)
							}, function () { bAction(bSlot); });
					}
				} else {
					$btn.prop("disabled", true);
				}
				return $btn[0];
			}

			var	saves = Save.get(),
				tbody = document.createElement("tbody");

			var	tr, tdSlot, tdLoad, tdLoadBtn, tdDesc, tdDescTxt, tdDele, tdDeleBtn;

			if (Save.autosave.ok()) {
				tr     = document.createElement("tr");
				tdSlot = document.createElement("td");
				tdLoad = document.createElement("td");
				tdDesc = document.createElement("td");
				tdDele = document.createElement("td");

				//tdDescTxt = document.createElement("span");
				//tdDescTxt.innerHTML = "\u25c6"; // Black Diamond
				tdDescTxt = document.createElement("b");
				tdDescTxt.innerHTML = "A";
				tdDescTxt.title = strings.saves.labelAuto;
				tdSlot.appendChild(tdDescTxt);

				if (saves.autosave) {
					tdLoadBtn = createButton("load", "ui-close", strings.saves.labelLoad, "auto", Save.autosave.load);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createElement("div");
					tdDescTxt.appendChild(document.createTextNode(saves.autosave.title));
					tdDesc.appendChild(tdDescTxt);
					tdDescTxt = document.createElement("div");
					tdDescTxt.classList.add("datestamp");
					if (saves.autosave.date) {
						tdDescTxt.innerHTML = strings.saves.savedOn
							+ " " + new Date(saves.autosave.date).toLocaleString();
					} else {
						tdDescTxt.innerHTML = strings.saves.savedOn
							+ " <em>" + strings.saves.unknownDate + "</em>";
					}
					tdDesc.appendChild(tdDescTxt);

					tdDeleBtn = createButton("delete", null, strings.saves.labelDelete, "auto", function () {
						Save.autosave.delete();
						buildDialogSaves(); // rebuild the saves dialog
					});
					tdDele.appendChild(tdDeleBtn);
				} else {
					tdLoadBtn = createButton("load", null, strings.saves.labelLoad, "auto");
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createElement("i");
					tdDescTxt.innerHTML = strings.saves.emptySlot;
					tdDesc.appendChild(tdDescTxt);
					tdDesc.classList.add("empty");

					tdDeleBtn = createButton("delete", null, strings.saves.labelDelete, "auto");
					tdDele.appendChild(tdDeleBtn);
				}

				tr.appendChild(tdSlot);
				tr.appendChild(tdLoad);
				tr.appendChild(tdDesc);
				tr.appendChild(tdDele);
				tbody.appendChild(tr);
			}
			for (var i = 0; i < saves.slots.length; ++i) {
				tr     = document.createElement("tr");
				tdSlot = document.createElement("td");
				tdLoad = document.createElement("td");
				tdDesc = document.createElement("td");
				tdDele = document.createElement("td");

				tdSlot.appendChild(document.createTextNode(i + 1));

				if (saves.slots[i]) {
					tdLoadBtn = createButton("load", "ui-close", strings.saves.labelLoad, i, Save.slots.load);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createElement("div");
					tdDescTxt.appendChild(document.createTextNode(saves.slots[i].title));
					tdDesc.appendChild(tdDescTxt);
					tdDescTxt = document.createElement("div");
					tdDescTxt.classList.add("datestamp");
					if (saves.slots[i].date) {
						tdDescTxt.innerHTML = strings.saves.savedOn
							+ " " + new Date(saves.slots[i].date).toLocaleString();
					} else {
						tdDescTxt.innerHTML = strings.saves.savedOn
							+ " <em>" + strings.saves.unknownDate + "</em>";
					}
					tdDesc.appendChild(tdDescTxt);

					tdDeleBtn = createButton("delete", null, strings.saves.labelDelete, i, function (slot) {
						Save.slots.delete(slot);
						buildDialogSaves();    // rebuild the saves dialog
						dialogResizeHandler(); // manually call the resize handler
					});
					tdDele.appendChild(tdDeleBtn);
				} else {
					tdLoadBtn = createButton("save", "ui-close", strings.saves.labelSave, i, Save.slots.save);
					tdLoad.appendChild(tdLoadBtn);

					tdDescTxt = document.createElement("i");
					tdDescTxt.innerHTML = strings.saves.emptySlot;
					tdDesc.appendChild(tdDescTxt);
					tdDesc.classList.add("empty");

					tdDeleBtn = createButton("delete", null, strings.saves.labelDelete, i);
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

		if (DEBUG) { console.log("[UI.buildDialogSaves()]"); }

		var	savesOk  = Save.ok(),
			hasSaves = Save.autosave.has() || !Save.slots.isEmpty(),
			list,
			btnBar;

		dialogSetup(strings.saves.title, "saves");

		if (savesOk) {
			// add saves list
			list = createSaveList();
			if (!list) {
				list = document.createElement("div");
				list.id = "saves-list";
				list.innerHTML = "<i>" + strings.saves.unavailable + "</i>";
			}
			_dialogBody.appendChild(list);
		}

		// add button bar items (export, import, and clear)
		if (hasSaves || Has.fileAPI) {
			btnBar = document.createElement("ul");
			btnBar.classList.add("buttons");
			if (Has.fileAPI) {
				btnBar.appendChild(createActionItem("export", "ui-close", strings.saves.labelExport, Save.export));
				btnBar.appendChild(createActionItem("import", null, strings.saves.labelImport, function () {
					jQuery("#saves-import-file", _dialogBody).trigger("click");
				}));
			}
			if (savesOk) {
				btnBar.appendChild(createActionItem("clear", null, strings.saves.labelClear, hasSaves ? function () {
					Save.clear();
					buildDialogSaves();    // rebuild the saves dialog
					dialogResizeHandler(); // manually call the resize handler
				} : null));
			}
			_dialogBody.appendChild(btnBar);
			if (Has.fileAPI) {
				// add the hidden `input[type=file]` element which will be triggered by the `#saves-import` button
				_dialogBody.appendChild((function () {
					var	input = document.createElement("input");
					jQuery(input)
						.css({
							"display"    : "block",
							"visibility" : "hidden",
							"position"   : "fixed",
							"left"       : "-9999px",
							"top"        : "-9999px",
							"width"      : "1px",
							"height"     : "1px"
						})
						.attr("type", "file")
						.attr("id", "saves-import-file")
						.attr("tabindex", -1)
						.attr("aria-hidden", true)
						.on("change", function (evt) {
							Save.import(evt);
							dialogClose();
						});
					return input;
				})());
			}
			return true;
		} else {
			dialogAlert(strings.saves.incapable.replace(/%identity%/g, strings.identity));
			return false;
		}
	}

	function buildDialogRestart() {
		if (DEBUG) { console.log("[UI.buildDialogRestart()]"); }

		jQuery(dialogSetup(strings.restart.title, "restart"))
			.append('<p>' + strings.restart.prompt + '</p><ul class="buttons">'
				+ '<li><button id="restart-ok" class="ui-close">' + (strings.restart.ok || strings.ok) + '</button></li>'
				+ '<li><button id="restart-cancel" class="ui-close">' + (strings.restart.cancel || strings.cancel) + '</button></li>'
				+ '</ul>');

		// add an additional click handler for the OK button
		jQuery("#ui-dialog-body #restart-ok").one("click", function () {
			State.restart();
		});

		return true;
	}

	function buildDialogSettings() {
		if (DEBUG) { console.log("[UI.buildDialogSettings()]"); }

		dialogSetup(strings.settings.title, "settings");

		Setting.forEach(function (control) {
			var	name      = control.name,
				id        = Util.slugify(name),
				elSetting = document.createElement("div"),
				elLabel   = document.createElement("label"),
				elWrapper = document.createElement("div"),
				elControl;

			elSetting.appendChild(elLabel);
			elSetting.appendChild(elWrapper);
			elSetting.id = "setting-body-" + id;
			elLabel.id   = "setting-label-" + id;

			// setup the label
			new Wikifier(elLabel, control.label);

			// setup the control
			if (settings[name] == null) { // lazy equality for null
				settings[name] = control.default;
			}
			switch (control.type) {
			case Setting.Types.Toggle:
				elControl = document.createElement("button");
				if (settings[name]) {
					jQuery(elControl)
						.addClass("enabled")
						.text(strings.settings.on);
				} else {
					jQuery(elControl)
						.text(strings.settings.off);
				}
				jQuery(elControl).ariaClick(function () {
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
					if (control.hasOwnProperty("onChange")) {
						control.onChange.call({
							name    : name,
							value   : settings[name],
							default : control.default
						});
					}
				});
				break;
			case Setting.Types.List:
				elControl = document.createElement("select");
				for (var i = 0; i < control.list.length; ++i) {
					var elItem = document.createElement("option");
					jQuery(elItem)
						.val(i)
						.text(control.list[i]);
					elControl.appendChild(elItem);
				}
				jQuery(elControl)
					.val(control.list.indexOf(settings[name]))
					.attr("tabindex", 0)
					.on("change", function () {
						settings[name] = control.list[+this.value];
						Setting.save();
						if (control.hasOwnProperty("onChange")) {
							control.onChange.call({
								name    : name,
								value   : settings[name],
								default : control.default,
								list    : control.list
							});
						}
					});
				break;
			}
			elControl.id = "setting-control-" + id;
			elWrapper.appendChild(elControl);

			// associate the label with the control
			elLabel.setAttribute("for", elControl.id);

			_dialogBody.appendChild(elSetting);
		});

		// add the button bar
		jQuery(_dialogBody)
			.append('<ul class="buttons">'
				+ '<li><button id="settings-ok" class="ui-close">' + (strings.settings.ok || strings.ok) + '</button></li>'
				+ '<li><button id="settings-reset" class="ui-close">' + strings.settings.reset + '</button></li>'
				+ '</ul>');

		// add an additional click handler for the Reset button
		jQuery("#ui-dialog-body #settings-reset").one("click", function () {
			Setting.reset();
			window.location.reload();
		});

		return true;
	}

	function buildDialogShare() {
		if (DEBUG) { console.log("[UI.buildDialogShare()]"); }

		jQuery(dialogSetup(strings.share.title, "share list"))
			.append(buildLinkListFromPassage("StoryShare"));
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
			if (DEBUG) { console.log('    > display/autoload: "' + Save.autosave.get().title + '"'); }
			if (evt.target.id !== "autoload-ok" || !Save.autosave.load()) {
				if (DEBUG) { console.log('    > display: "' + config.passages.start + '"'); }
				State.play(config.passages.start);
			}
		});

		return true;
	}

	function buildLinkListFromPassage(passage, list) {
		if (list == null) { // lazy equality for null
			list = document.createElement("ul");
		}
		var temp = document.createDocumentFragment();
		new Wikifier(temp, Story.get(passage).processText().trim());
		if (temp.hasChildNodes()) {
			var li = null;
			while (temp.hasChildNodes()) {
				var node = temp.firstChild;
				if (node.nodeType !== Node.ELEMENT_NODE || node.nodeName.toUpperCase() !== "A") { // non-<a>-element nodes
					temp.removeChild(node);
					if (li !== null) {
						// forget the current list item
						li = null;
					}
				} else { // <a>-element nodes
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

	function dialogJumpTo(/* options, closeFn */) {
		buildDialogJumpTo();
		dialogOpen.apply(null, arguments);
	}

	function dialogSaves(/* options, closeFn */) {
		buildDialogSaves();
		dialogOpen.apply(null, arguments);
	}

	function dialogRestart(options) {
		buildDialogRestart();
		dialogOpen(options);
	}

	function dialogSettings(/* options, closeFn */) {
		buildDialogSettings();
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
		if (classNames != null) { // lazy equality for null
			jQuery(_dialogBody).addClass(classNames);
		}
		title = title == null ? "" : title + ""; // lazy equality for null
		jQuery(_dialogTitle)
			.empty()
			.append(title === "" ? "\u00a0" : title);
		return _dialogBody;
	}

	function dialogAddClickHandler(targets, options, startFn, doneFn, closeFn) {
		return jQuery(targets).ariaClick(function (evt) {
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

		// record the last active/focused non-dialog element
		if (!dialogIsOpen()) {
			_lastActive = safeActiveElement();
		}

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
				})(options.top));
		}

		// EXPERIMENTAL (really comment this at some point)
		// add `aria-hidden=true` to all direct non-dialog-children of <body>
				//.attr("aria-hidden", true)
				//.prop("disabled", true)
				//.attr("aria-disabled", true)
		jQuery("body>:not(script,#store-area,#ui-bar,#ui-overlay,#ui-dialog)")
			.attr("tabindex", -3)
			.attr("aria-hidden", true);
		jQuery("#ui-bar,#story")
			.find("[tabindex]:not([tabindex^=-])")
				.attr("tabindex", -2)
				.attr("aria-hidden", true);
		// /EXPERIMENTAL

		// display the dialog
		var position = dialogCalcPosition(options.top);
		jQuery(_dialog)
			.css(position)
			.addClass("open")
			.focus();

		// add the UI resize handler
		jQuery(window)
			.on("resize.ui-resize", null, options.top, jQuery.throttle(40, dialogResizeHandler));

		// setup the delegated UI close handler
		jQuery(document.body)
			.on("click.ui-close", ".ui-close", closeFn, dialogClose) // yes, namespace and class have the same name
			.on("keypress.ui-close", ".ui-close", function (evt) {
				// 13 is Enter/Return, 32 is Space
				if (evt.which === 13 || evt.which === 32) {
					jQuery(this).trigger("click");
				}
			});
	}

	function dialogClose(evt) {
		// largely reverse the actions taken in `dialogOpen()`
		jQuery(document.body)
			.off(".ui-close"); // namespace, not to be confused with the class by the same name
		jQuery(window)
			.off("resize.ui-resize");
		jQuery(_dialog)
			.removeClass("open")
			.css({ left : "", right : "", top : "", bottom : "" });

		// EXPERIMENTAL
		jQuery("#ui-bar,#story")
			.find("[tabindex=-2]")
				.removeAttr("aria-hidden")
				.attr("tabindex", 0);
		jQuery("body>[tabindex=-3]")
			.removeAttr("aria-hidden")
			.removeAttr("tabindex");
		// /EXPERIMENTAL

		jQuery(_dialogTitle)
			.empty();
		jQuery(_dialogBody)
			.empty()
			.removeClass();
		jQuery(_overlay)
			.removeClass("open");
		jQuery(document.documentElement)
			.removeClass("ui-dialog-open");
		if (_lastActive !== null) {
			// attempt to restore focus to whichever element had it prior to opening the dialog
			jQuery(_lastActive).focus();
			_lastActive = null;
		}

		// call the given "on close" callback function, if any
		if (evt && typeof evt.data === "function") {
			evt.data(evt);
		}
	}

	function dialogResizeHandler(evt) {
		var	$dialog = jQuery(_dialog),
			topPos  = evt && typeof evt.data !== "undefined" ? evt.data : 50;

		if ($dialog.css("display") === "block") {
			// stow the dialog
			$dialog.css({ display : "none" });

			// restore the dialog with its new positional properties
			var position = dialogCalcPosition(topPos);
			$dialog.css(jQuery.extend({ display : "" }, position));
		}
	}

	function dialogCalcPosition(topPos) {
		if (topPos == null) { // lazy equality for null
			topPos = 50;
		}

		var	$parent   = jQuery(window),
			$dialog   = jQuery(_dialog),
			dialogPos = { left : "", right : "", top : "", bottom : "" };

		// unset the dialog's positional properties before checking its dimensions
		$dialog.css(dialogPos);

		var	horzSpace = $parent.width() - $dialog.outerWidth(true) - 1,   // -1 to address a Firefox issue
			vertSpace = $parent.height() - $dialog.outerHeight(true) - 1; // -1 to address a Firefox issue

		if (horzSpace <= 32 + _scrollbarWidth) {
			vertSpace -= _scrollbarWidth;
		}
		if (vertSpace <= 32 + _scrollbarWidth) {
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
			if (vertSpace / 2 > topPos) {
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
		// Initialization & Startup
		init                     : { value : init },
		start                    : { value : start },
		// Internals
		setStoryElements         : { value : setStoryElements },
		patchOutlines            : { value : patchOutlines },
		buildDialogJumpTo        : { value : buildDialogJumpTo },
		buildDialogSaves         : { value : buildDialogSaves },
		buildDialogRestart       : { value : buildDialogRestart },
		buildDialogSettings      : { value : buildDialogSettings },
		buildDialogShare         : { value : buildDialogShare },
		buildDialogAutoload      : { value : buildDialogAutoload },
		buildLinkListFromPassage : { value : buildLinkListFromPassage },
		// Built-ins
		alert                    : { value : dialogAlert },
		jumpto                   : { value : dialogJumpTo },
		saves                    : { value : dialogSaves },
		restart                  : { value : dialogRestart },
		settings                 : { value : dialogSettings },
		share                    : { value : dialogShare },
		// Core
		isOpen                   : { value : dialogIsOpen },
		body                     : { value : dialogBody },
		setup                    : { value : dialogSetup },
		addClickHandler          : { value : dialogAddClickHandler },
		open                     : { value : dialogOpen },
		close                    : { value : dialogClose }
	}));

})();

