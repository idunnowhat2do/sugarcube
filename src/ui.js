/***********************************************************************************************************************
 *
 * ui.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Dialog, Engine, Has, L10n, Save, Setting, State, Story, StyleWrapper, Util, Wikifier, Config, setPageElement,
	       settings
*/

var UI = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	let _outlinePatch = null;


	/*******************************************************************************************************************
	 * UI Functions, Core.
	 ******************************************************************************************************************/
	function uiInit() {
		if (DEBUG) { console.log('[UI/uiInit()]'); }

		/*
			Remove #init-no-js & #init-lacking from #init-screen.
		*/
		jQuery('#init-no-js,#init-lacking').remove();

		/*
			Generate and cache the outline patching <style> element (`StyleWrapper`-wrapped).
		*/
		_outlinePatch = new StyleWrapper((
			() => jQuery(document.createElement('style'))
				.attr({
					id   : 'style-outline-patch',
					type : 'text/css'
				})
				.appendTo(document.head)
				.get(0) // return the <style> element itself
		)());

		/*
			Generate the UI bar elements and insert them into the page before the store area.
		*/
		(() => {
			const
				$uiTree       = jQuery(document.createDocumentFragment()),
				toggleLabel   = L10n.get('uiBarToggle'),
				backwardLabel = L10n.get('uiBarBackward'),
				jumptoLabel   = L10n.get('uiBarJumpto'),
				forwardLabel  = L10n.get('uiBarForward');

			$uiTree
				.append(
					/* eslint-disable max-len */
					  '<div id="ui-bar">'
					+     '<div id="ui-bar-tray">'
					+         `<button id="ui-bar-toggle" tabindex="0" title="${toggleLabel}" aria-label="${toggleLabel}"></button>`
					+         '<div id="ui-bar-history">'
					+             `<button id="history-backward" tabindex="0" title="${backwardLabel}" aria-label="${backwardLabel}">\uE821</button>`
					+             `<button id="history-jumpto" tabindex="0" title="${jumptoLabel}" aria-label="${jumptoLabel}">\uE839</button>`
					+             `<button id="history-forward" tabindex="0" title="${forwardLabel}" aria-label="${forwardLabel}">\uE822</button>`
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
					+                 `<li id="menu-item-saves"><a tabindex="0">${L10n.get('savesTitle')}</a></li>`
					+                 `<li id="menu-item-settings"><a tabindex="0">${L10n.get('settingsTitle')}</a></li>`
					+                 `<li id="menu-item-restart"><a tabindex="0">${L10n.get('restartTitle')}</a></li>`
					+                 `<li id="menu-item-share"><a tabindex="0">${L10n.get('shareTitle')}</a></li>`
					+             '</ul>'
					+         '</nav>'
					+     '</div>'
					+ '</div>'
					+ '<div id="story" role="main">'
					+     '<div id="passages"></div>'
					+ '</div>'
					/* eslint-enable max-len */
				)
				.insertBefore('#store-area');
		})();

		/*
			Setup the UI bar's global event handlers.
		*/
		jQuery(document)
			// Setup a handler for the history-backward/-forward buttons.
			.on('tw:historyupdate', (($backward, $forward) => () => {
				$backward.prop('disabled', State.length < 2);
				$forward.prop('disabled', State.length === State.size);
			})(jQuery('#history-backward'), jQuery('#history-forward')))
			// Setup accessible outline handling.
			// IDEA: http://www.paciellogroup.com/blog/2012/04/how-to-remove-css-outlines-in-an-accessible-manner/
			.on('mousedown.outline-handler keydown.outline-handler', ev => {
				switch (ev.type) {
				case 'mousedown':
					uiHideOutlines();
					break;

				case 'keydown':
					uiShowOutlines();
					break;
				}
			});
	}

	function uiStart() {
		if (DEBUG) { console.log('[UI/uiStart()]'); }

		const $uiBar = jQuery('#ui-bar');

		// Setup the #ui-bar's initial state.
		if (Config.ui.stowBarInitially || jQuery(window).width() <= 800) {
			(() => {
				const $uiBarStory = jQuery($uiBar).add('#story');
				$uiBarStory.addClass('no-transition');
				$uiBar.addClass('stowed');
				setTimeout(() => $uiBarStory.removeClass('no-transition'), Engine.minDomActionDelay);
			})();
		}

		// Setup the #ui-bar-toggle and #ui-bar-history widgets.
		jQuery('#ui-bar-toggle')
			.ariaClick({
				label : L10n.get('uiBarToggle')
			}, () => $uiBar.toggleClass('stowed'));

		if (Config.history.controls) {
			jQuery('#history-backward')
				.prop('disabled', State.length < 2)
				.ariaClick({
					label : L10n.get('uiBarBackward')
				}, () => Engine.backward());

			if (Story.lookup('tags', 'bookmark').length > 0) {
				jQuery('#history-jumpto')
					.ariaClick({
						label : L10n.get('uiBarJumpto')
					}, () => UI.jumpto());
			}
			else {
				jQuery('#history-jumpto').remove();
			}

			jQuery('#history-forward')
				.prop('disabled', State.length === State.size)
				.ariaClick({
					label : L10n.get('uiBarForward')
				}, () => Engine.forward());
		}
		else {
			jQuery('#ui-bar-history').remove();
		}

		// Setup the title.
		if (TWINE1) { // for Twine 1
			setPageElement('story-title', 'StoryTitle', Story.title);
		}
		else { // for Twine 2
			jQuery('#story-title').text(Story.title);
		}

		// Setup the dynamic page elements.
		if (!Story.has('StoryCaption')) {
			jQuery('#story-caption').remove();
		}

		if (!Story.has('StoryMenu')) {
			jQuery('#menu-story').remove();
		}

		if (!Config.ui.updateStoryElements) {
			/*
				We only need to set the story elements here if `Config.ui.updateStoryElements`
				is falsy, since otherwise they will be set by `Engine.play()`.
			*/
			uiSetStoryElements();
		}

		// Setup the Saves menu item.
		Dialog.addClickHandler('#menu-item-saves a', null, uiBuildSaves)
			.text(L10n.get('savesTitle'));

		// Setup the Settings menu item.
		if (!Setting.isEmpty()) {
			Dialog.addClickHandler('#menu-item-settings a', null, uiBuildSettings)
				.text(L10n.get('settingsTitle'));
		}
		else {
			jQuery('#menu-item-settings').remove();
		}

		// Setup the Restart menu item.
		Dialog.addClickHandler('#menu-item-restart a', null, uiBuildRestart)
			.text(L10n.get('restartTitle'));

		// Setup the Share menu item.
		if (Story.has('StoryShare')) {
			Dialog.addClickHandler('#menu-item-share a', null, uiBuildShare)
				.text(L10n.get('shareTitle'));
		}
		else {
			jQuery('#menu-item-share').remove();
		}

		// Focus the document element initially.
		jQuery(document.documentElement).focus();
	}

	function uiSetStoryElements() {
		if (DEBUG) { console.log('[UI/uiSetStoryElements()]'); }

		// Setup the (non-navigation) dynamic page elements.
		setPageElement('story-banner', 'StoryBanner');
		setPageElement('story-subtitle', 'StorySubtitle');
		setPageElement('story-author', 'StoryAuthor');
		setPageElement('story-caption', 'StoryCaption');

		// Setup the #menu-story items.
		const menuStory = document.getElementById('menu-story');

		if (menuStory !== null) {
			jQuery(menuStory).empty();

			if (Story.has('StoryMenu')) {
				uiAssembleLinkList('StoryMenu', menuStory);
			}
		}
	}

	function uiHideOutlines() {
		_outlinePatch.set('*:focus{outline:none}');
	}

	function uiShowOutlines() {
		_outlinePatch.clear();
	}

	function uiAssembleLinkList(passage, listEl) {
		let list = listEl;

		// Cache the value of `Config.debug` and then disable it during this method's run.
		const debugState = Config.debug;
		Config.debug = false;

		if (list == null) { // lazy equality for null
			list = document.createElement('ul');
		}

		const temp = document.createDocumentFragment();
		new Wikifier(temp, Story.get(passage).processText().trim());

		if (temp.hasChildNodes()) {
			let li = null;

			while (temp.hasChildNodes()) {
				const node = temp.firstChild;

				// Non-<a>-element nodes.
				if (node.nodeType !== Node.ELEMENT_NODE || node.nodeName.toUpperCase() !== 'A') {
					temp.removeChild(node);

					if (li !== null) {
						// Forget the current list item.
						li = null;
					}
				}

				// <a>-element nodes.
				else {
					if (li === null) {
						// Create a new list item.
						li = document.createElement('li');
						list.appendChild(li);
					}
					li.appendChild(node);
				}
			}
		}

		// Restore `Config.debug` to its original value.
		Config.debug = debugState;

		return list;
	}


	/*******************************************************************************************************************
	 * UI Functions, Built-ins.
	 ******************************************************************************************************************/
	function uiOpenAlert(message, /* options, closeFn */ ...args) {
		jQuery(Dialog.setup('Alert', 'alert'))
			.append(
				  `<p>${message}</p><ul class="buttons">`
				+ `<li><button id="alert-ok" class="ui-close">${L10n.get(['alertOk', 'ok'])}</button></li>`
				+ '</ul>'
			);
		Dialog.open(...args);
	}

	function uiOpenJumpto(/* options, closeFn */ ...args) {
		uiBuildJumpto();
		Dialog.open(...args);
	}

	function uiOpenRestart(/* options, closeFn */ ...args) {
		uiBuildRestart();
		Dialog.open(...args);
	}

	function uiOpenSaves(/* options, closeFn */ ...args) {
		uiBuildSaves();
		Dialog.open(...args);
	}

	function uiOpenSettings(/* options, closeFn */ ...args) {
		uiBuildSettings();
		Dialog.open(...args);
	}

	function uiOpenShare(/* options, closeFn */ ...args) {
		uiBuildShare();
		Dialog.open(...args);
	}

	function uiBuildAutoload() {
		if (DEBUG) { console.log('[UI/uiBuildAutoload()]'); }

		jQuery(Dialog.setup(L10n.get('autoloadTitle'), 'autoload'))
			.append(
				/* eslint-disable max-len */
				  `<p>${L10n.get('autoloadPrompt')}</p><ul class="buttons">`
				+ `<li><button id="autoload-ok" class="ui-close">${L10n.get(['autoloadOk', 'ok'])}</button></li>`
				+ `<li><button id="autoload-cancel" class="ui-close">${L10n.get(['autoloadCancel', 'cancel'])}</button></li>`
				+ '</ul>'
				/* eslint-enable max-len */
			);

		// Add an additional delegated click handler for the `.ui-close` elements to handle autoloading.
		jQuery(document).one('click.autoload', '.ui-close', ev => {
			const isAutoloadOk = ev.target.id === 'autoload-ok';
			jQuery(document).one('tw:dialogclosed', () => {
				if (DEBUG) { console.log(`\tattempting autoload: "${Save.autosave.get().title}"`); }

				if (!isAutoloadOk || !Save.autosave.load()) {
					Engine.play(Config.passages.start);
				}
			});
		});

		return true;
	}

	function uiBuildJumpto() {
		if (DEBUG) { console.log('[UI/uiBuildJumpto()]'); }

		const list = document.createElement('ul');

		jQuery(Dialog.setup(L10n.get('jumptoTitle'), 'jumpto list'))
			.append(list);

		const expired = State.expired.length;

		for (let i = State.size - 1; i >= 0; --i) {
			if (i === State.activeIndex) {
				continue;
			}

			const passage = Story.get(State.history[i].title);

			if (passage && passage.tags.includes('bookmark')) {
				jQuery(document.createElement('li'))
					.append(
						jQuery(document.createElement('a'))
							.ariaClick({ one : true }, (function (idx) {
								return () => jQuery(document).one('tw:dialogclosed', () => Engine.goTo(idx));
							})(i))
							.addClass('ui-close')
							.text(`${L10n.get('jumptoTurn')} ${expired + i + 1}: ${passage.description()}`)
					)
					.appendTo(list);
			}
		}

		if (!list.hasChildNodes()) {
			jQuery(list).append(`<li><a><em>${L10n.get('jumptoUnavailable')}</em></a></li>`);
		}
	}

	function uiBuildRestart() {
		if (DEBUG) { console.log('[UI/uiBuildRestart()]'); }

		jQuery(Dialog.setup(L10n.get('restartTitle'), 'restart'))
			.append(
				/* eslint-disable max-len */
				  `<p>${L10n.get('restartPrompt')}</p><ul class="buttons">`
				+ `<li><button id="restart-ok">${L10n.get(['restartOk', 'ok'])}</button></li>`
				+ `<li><button id="restart-cancel" class="ui-close">${L10n.get(['restartCancel', 'cancel'])}</button></li>`
				+ '</ul>'
				/* eslint-enable max-len */
			)
			.find('#restart-ok')
				/*
					Instead of adding '.ui-close' to '#restart-ok' (to receive the use of the default
					delegated dialog close handler), we setup a special case close handler here.  We
					do this to ensure that the invocation of `Engine.restart()` happens after the dialog
					has fully closed.  If we did not, then a race condition could occur, causing display
					shenanigans.
				*/
				.ariaClick({ one : true }, () => {
					jQuery(document).one('tw:dialogclosed', () => Engine.restart());
					Dialog.close();
				});

		return true;
	}

	function uiBuildSaves() {
		function createActionItem(bId, bClass, bText, bAction) {
			const $btn = jQuery(document.createElement('button'))
				.attr('id', `saves-${bId}`)
				.html(bText);

			if (bClass) {
				$btn.addClass(bClass);
			}

			if (bAction) {
				$btn.ariaClick(bAction);
			}
			else {
				$btn.prop('disabled', true);
			}

			return jQuery(document.createElement('li'))
				.append($btn);
		}

		function createSaveList() {
			function createButton(bId, bClass, bText, bSlot, bAction) {
				const $btn = jQuery(document.createElement('button'))
					.attr('id', `saves-${bId}-${bSlot}`)
					.addClass(bId)
					.html(bText);

				if (bClass) {
					$btn.addClass(bClass);
				}

				if (bAction) {
					if (bSlot === 'auto') {
						$btn.ariaClick({
							label : `${bText} ${L10n.get('savesLabelAuto')}`
						}, () => bAction());
					}
					else {
						$btn.ariaClick({
							label : `${bText} ${L10n.get('savesLabelSlot')} ${bSlot + 1}`
						}, () => bAction(bSlot));
					}
				}
				else {
					$btn.prop('disabled', true);
				}

				return $btn;
			}

			const
				saves  = Save.get(),
				$tbody = jQuery(document.createElement('tbody'));

			if (Save.autosave.ok()) {
				const
					$tdSlot = jQuery(document.createElement('td')),
					$tdLoad = jQuery(document.createElement('td')),
					$tdDesc = jQuery(document.createElement('td')),
					$tdDele = jQuery(document.createElement('td'));

				// Add the slot ID.
				jQuery(document.createElement('b'))
					.attr({
						title        : L10n.get('savesLabelAuto'),
						'aria-label' : L10n.get('savesLabelAuto')
					})
					.text('A') // '\u25C6' Black Diamond
					.appendTo($tdSlot);

				if (saves.autosave) {
					// Add the load button.
					$tdLoad.append(
						createButton('load', 'ui-close', L10n.get('savesLabelLoad'), 'auto', () => {
							jQuery(document).one('tw:dialogclosed', () => Save.autosave.load());
						})
					);

					// Add the description (title and datestamp).
					jQuery(document.createElement('div'))
						.text(saves.autosave.title)
						.appendTo($tdDesc);
					jQuery(document.createElement('div'))
						.addClass('datestamp')
						.html(
							saves.autosave.date
								? `${L10n.get('savesSavedOn')} ${new Date(saves.autosave.date).toLocaleString()}`
								: `${L10n.get('savesSavedOn')} <em>${L10n.get('savesUnknownDate')}</em>`
						)
						.appendTo($tdDesc);

					// Add the delete button.
					$tdDele.append(
						createButton('delete', null, L10n.get('savesLabelDelete'), 'auto', () => {
							Save.autosave.delete();
							uiBuildSaves();
							Dialog.resize();
						})
					);
				}
				else {
					// Add the load button.
					$tdLoad.append(
						createButton('load', null, L10n.get('savesLabelLoad'), 'auto')
					);

					// Add the description.
					jQuery(document.createElement('em'))
						.text(L10n.get('savesEmptySlot'))
						.appendTo($tdDesc);
					$tdDesc.addClass('empty');

					// Add the delete button.
					$tdDele.append(
						createButton('delete', null, L10n.get('savesLabelDelete'), 'auto')
					);
				}

				jQuery(document.createElement('tr'))
					.append($tdSlot)
					.append($tdLoad)
					.append($tdDesc)
					.append($tdDele)
					.appendTo($tbody);
			}

			for (let i = 0, iend = saves.slots.length; i < iend; ++i) {
				const
					$tdSlot = jQuery(document.createElement('td')),
					$tdLoad = jQuery(document.createElement('td')),
					$tdDesc = jQuery(document.createElement('td')),
					$tdDele = jQuery(document.createElement('td'));

				// Add the slot ID.
				$tdSlot.append(document.createTextNode(i + 1));

				if (saves.slots[i]) {
					// Add the load button.
					$tdLoad.append(
						createButton('load', 'ui-close', L10n.get('savesLabelLoad'), i, slot => {
							jQuery(document).one('tw:dialogclosed', () => Save.slots.load(slot));
						})
					);

					// Add the description (title and datestamp).
					jQuery(document.createElement('div'))
						.text(saves.slots[i].title)
						.appendTo($tdDesc);
					jQuery(document.createElement('div'))
						.addClass('datestamp')
						.html(
							saves.slots[i].date
								? `${L10n.get('savesSavedOn')} ${new Date(saves.slots[i].date).toLocaleString()}`
								: `${L10n.get('savesSavedOn')} <em>${L10n.get('savesUnknownDate')}</em>`
						)
						.appendTo($tdDesc);

					// Add the delete button.
					$tdDele.append(
						createButton('delete', null, L10n.get('savesLabelDelete'), i, slot => {
							Save.slots.delete(slot);
							uiBuildSaves();
							Dialog.resize();
						})
					);
				}
				else {
					// Add the load button.
					$tdLoad.append(
						createButton('save', 'ui-close', L10n.get('savesLabelSave'), i, Save.slots.save)
					);

					// Add the description.
					jQuery(document.createElement('em'))
						.text(L10n.get('savesEmptySlot'))
						.appendTo($tdDesc);
					$tdDesc.addClass('empty');

					// Add the delete button.
					$tdDele.append(
						createButton('delete', null, L10n.get('savesLabelDelete'), i)
					);
				}

				jQuery(document.createElement('tr'))
					.append($tdSlot)
					.append($tdLoad)
					.append($tdDesc)
					.append($tdDele)
					.appendTo($tbody);
			}

			return jQuery(document.createElement('table'))
				.attr('id', 'saves-list')
				.append($tbody);
		}

		if (DEBUG) { console.log('[UI/uiBuildSaves()]'); }

		const
			$dialogBody = jQuery(Dialog.setup(L10n.get('savesTitle'), 'saves')),
			savesOk     = Save.ok();

		// Add saves list.
		if (savesOk) {
			$dialogBody.append(createSaveList());
		}

		// Add button bar items (export, import, and clear).
		if (savesOk || Has.fileAPI) {
			const $btnBar = jQuery(document.createElement('ul'))
				.addClass('buttons')
				.appendTo($dialogBody);

			if (Has.fileAPI) {
				$btnBar.append(createActionItem('export', 'ui-close', L10n.get('savesLabelExport'),
					() => Save.export()));
				$btnBar.append(createActionItem('import', null, L10n.get('savesLabelImport'),
					() => $dialogBody.find('#saves-import-file').trigger('click')));

				// Add the hidden `input[type=file]` element which will be triggered by the `#saves-import` button.
				jQuery(document.createElement('input'))
					.css({
						display    : 'block',
						visibility : 'hidden',
						position   : 'fixed',
						left       : '-9999px',
						top        : '-9999px',
						width      : '1px',
						height     : '1px'
					})
					.attr({
						type          : 'file',
						id            : 'saves-import-file',
						tabindex      : -1,
						'aria-hidden' : true
					})
					.on('change', ev => {
						jQuery(document).one('tw:dialogclosed', () => Save.import(ev));
						Dialog.close();
					})
					.appendTo($dialogBody);
			}

			if (savesOk) {
				$btnBar.append(
					createActionItem('clear', null, L10n.get('savesLabelClear'),
						Save.autosave.has() || !Save.slots.isEmpty()
							? () => {
								Save.clear();
								uiBuildSaves();
								Dialog.resize();
							}
							: null
					)
				);
			}

			return true;
		}
		else {
			uiOpenAlert(L10n.get('savesIncapable'));
			return false;
		}
	}

	function uiBuildSettings() {
		if (DEBUG) { console.log('[UI/uiBuildSettings()]'); }

		const $dialogBody = jQuery(Dialog.setup(L10n.get('settingsTitle'), 'settings'));

		Setting.forEach(control => {
			if (control.type === Setting.Types.Header) {
				const
					name       = control.name,
					id         = Util.slugify(name),
					$elHeader  = jQuery(document.createElement('div')),
					$elHeading = jQuery(document.createElement('h2')),
					$elLabel   = jQuery(document.createElement('p'));

				$elHeader
					.attr('id', `header-body-${id}`)
					.append($elHeading)
					.append($elLabel)
					.appendTo($dialogBody);
				$elHeading
					.attr('id', `header-heading-${id}`)
					.wiki(name);
				$elLabel
					.attr('id', `header-label-${id}`)
					.wiki(control.label);

				return;
			}

			const
				name       = control.name,
				id         = Util.slugify(name),
				$elSetting = jQuery(document.createElement('div')),
				$elLabel   = jQuery(document.createElement('label')),
				$elWrapper = jQuery(document.createElement('div'));
			let
				$elControl;

			$elSetting
				.attr('id', `setting-body-${id}`)
				.append($elLabel)
				.append($elWrapper)
				.appendTo($dialogBody);

			// Setup the label.
			$elLabel
				.attr({
					id  : `setting-label-${id}`,
					for : `setting-control-${id}` // must be in sync with $elControl's ID (see below)
				})
				.wiki(control.label);

			// Setup the control.
			if (settings[name] == null) { // lazy equality for null
				settings[name] = control.default;
			}

			switch (control.type) {
			case Setting.Types.Toggle:
				$elControl = jQuery(document.createElement('button'));

				if (settings[name]) {
					$elControl
						.addClass('enabled')
						.text(L10n.get('settingsOn'));
				}
				else {
					$elControl
						.text(L10n.get('settingsOff'));
				}

				$elControl.ariaClick(function () {
					if (settings[name]) {
						jQuery(this)
							.removeClass('enabled')
							.text(L10n.get('settingsOff'));
						settings[name] = false;
					}
					else {
						jQuery(this)
							.addClass('enabled')
							.text(L10n.get('settingsOn'));
						settings[name] = true;
					}

					Setting.save();

					if (control.hasOwnProperty('onChange')) {
						control.onChange.call({
							name,
							value   : settings[name],
							default : control.default
						});
					}
				});
				break;

			case Setting.Types.List:
				$elControl = jQuery(document.createElement('select'));

				for (let i = 0, iend = control.list.length; i < iend; ++i) {
					jQuery(document.createElement('option'))
						.val(i)
						.text(control.list[i])
						.appendTo($elControl);
				}

				$elControl
					.val(control.list.indexOf(settings[name]))
					.attr('tabindex', 0)
					.on('change', function () {
						settings[name] = control.list[Number(this.value)];
						Setting.save();

						if (control.hasOwnProperty('onChange')) {
							control.onChange.call({
								name,
								value   : settings[name],
								default : control.default,
								list    : control.list
							});
						}
					});
				break;
			}

			$elControl
				.attr('id', `setting-control-${id}`)
				.appendTo($elWrapper);
		});

		// Add the button bar.
		$dialogBody
			.append(
				  '<ul class="buttons">'
				+     `<li><button id="settings-ok" class="ui-close">${L10n.get(['settingsOk', 'ok'])}</button></li>`
				+     `<li><button id="settings-reset">${L10n.get('settingsReset')}</button></li>`
				+ '</ul>'
			)
			.find('#settings-reset')
				/*
					Instead of adding '.ui-close' to '#settings-reset' (to receive the use of the default
					delegated dialog close handler), we setup a special case close handler here.  We
					do this to ensure that the invocation of `window.location.reload()` happens after the
					dialog has fully closed.  If we did not, then a race condition could occur, causing
					display shenanigans.
				*/
				.ariaClick({ one : true }, () => {
					jQuery(document).one('tw:dialogclosed', () => {
						Setting.reset();
						window.location.reload();
					});
					Dialog.close();
				});

		return true;
	}

	function uiBuildShare() {
		if (DEBUG) { console.log('[UI/uiBuildShare()]'); }

		jQuery(Dialog.setup(L10n.get('shareTitle'), 'share list'))
			.append(uiAssembleLinkList('StoryShare'));

		return true;
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			UI Functions, Core.
		*/
		init             : { value : uiInit },
		start            : { value : uiStart },
		setStoryElements : { value : uiSetStoryElements },
		hideOutlines     : { value : uiHideOutlines },
		showOutlines     : { value : uiShowOutlines },
		assembleLinkList : { value : uiAssembleLinkList },

		/*
			UI Functions, Built-ins.
		*/
		alert         : { value : uiOpenAlert },
		jumpto        : { value : uiOpenJumpto },
		restart       : { value : uiOpenRestart },
		saves         : { value : uiOpenSaves },
		settings      : { value : uiOpenSettings },
		share         : { value : uiOpenShare },
		buildAutoload : { value : uiBuildAutoload },
		buildJumpto   : { value : uiBuildJumpto },
		buildRestart  : { value : uiBuildRestart },
		buildSaves    : { value : uiBuildSaves },
		buildSettings : { value : uiBuildSettings },
		buildShare    : { value : uiBuildShare },

		/*
			Legacy Aliases.
		*/
		isOpen                   : { value : (...args) => Dialog.isOpen(...args) },
		body                     : { value : () => Dialog.body() },
		setup                    : { value : (...args) => Dialog.setup(...args) },
		addClickHandler          : { value : (...args) => Dialog.addClickHandler(...args) },
		open                     : { value : (...args) => Dialog.open(...args) },
		close                    : { value : (...args) => Dialog.close(...args) },
		resize                   : { value : () => Dialog.resize() },
		// Deprecated method names.
		buildDialogAutoload      : { value : uiBuildAutoload },
		buildDialogJumpto        : { value : uiBuildJumpto },
		buildDialogRestart       : { value : uiBuildRestart },
		buildDialogSaves         : { value : uiBuildSaves },
		buildDialogSettings      : { value : uiBuildSettings },
		buildDialogShare         : { value : uiBuildShare },
		buildLinkListFromPassage : { value : uiAssembleLinkList }
	}));
})();
