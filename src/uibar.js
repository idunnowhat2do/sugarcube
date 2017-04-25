/***********************************************************************************************************************
 *
 * uibar.js
 *
 * Copyright © 2013–2017 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/*
	global Dialog, Engine, L10n, Setting, State, Story, UI, Config, setPageElement
*/

var UIBar = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	// Whether `UIBar.destroy()` has been called.
	let _destroyed = false;


	/*******************************************************************************************************************
	 * UI Bar Functions.
	 ******************************************************************************************************************/
	function uiBarInit() {
		if (DEBUG) { console.log('[UIBar/uiBarInit()]'); }

		if (_destroyed || document.getElementById('ui-bar')) {
			return;
		}

		/*
			Generate the UI bar elements and insert them into the page before the store area.
		*/
		(() => {
			const toggleLabel   = L10n.get('uiBarToggle');
			const backwardLabel = L10n.get('uiBarBackward');
			const jumptoLabel   = L10n.get('uiBarJumpto');
			const forwardLabel  = L10n.get('uiBarForward');

			jQuery(document.createDocumentFragment())
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
					/* eslint-enable max-len */
				)
				.insertBefore('#store-area');
		})();

		/*
			Setup the UI bar's global event handlers.
		*/
		jQuery(document)
			// Setup a handler for the history-backward/-forward buttons.
			.on(':historyupdate.ui-bar', (($backward, $forward) => () => {
				$backward.prop('disabled', State.length < 2);
				$forward.prop('disabled', State.length === State.size);
			})(jQuery('#history-backward'), jQuery('#history-forward')));
	}

	function uiBarStart() {
		if (DEBUG) { console.log('[UIBar/uiBarStart()]'); }

		if (_destroyed) {
			return;
		}

		// Cache the jQuery-wrapped #ui-bar.
		const $uiBar = jQuery('#ui-bar');

		// Setup the #ui-bar's initial state.
		if (
			typeof Config.ui.stowBarInitially === 'boolean'
				? Config.ui.stowBarInitially
				: jQuery(window).width() <= Config.ui.stowBarInitially
		) {
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
			uiBarSetStoryElements();
		}

		// Setup the Saves menu item.
		Dialog.addClickHandler('#menu-item-saves a', null, UI.buildSaves)
			.text(L10n.get('savesTitle'));

		// Setup the Settings menu item.
		if (!Setting.isEmpty()) {
			Dialog.addClickHandler('#menu-item-settings a', null, UI.buildSettings)
				.text(L10n.get('settingsTitle'));
		}
		else {
			jQuery('#menu-item-settings').remove();
		}

		// Setup the Restart menu item.
		Dialog.addClickHandler('#menu-item-restart a', null, UI.buildRestart)
			.text(L10n.get('restartTitle'));

		// Setup the Share menu item.
		if (Story.has('StoryShare')) {
			Dialog.addClickHandler('#menu-item-share a', null, UI.buildShare)
				.text(L10n.get('shareTitle'));
		}
		else {
			jQuery('#menu-item-share').remove();
		}
	}

	function uiBarDestroy() {
		if (DEBUG) { console.log('[UIBar/uiBarDestroy()]'); }

		if (_destroyed) {
			return;
		}

		// Remove all namespaced events.
		jQuery(document).off('.ui-bar');

		// Remove the UI bar itself and its styles.
		jQuery('#ui-bar').remove();
		jQuery(document.head).find('#style-ui-bar').remove();

		// Disable calls to `UIBar.setStoryElements()`.
		Config.ui.updateStoryElements = false;

		_destroyed = true;
	}

	function uiBarStow() {
		if (_destroyed) {
			return;
		}

		jQuery('#ui-bar').addClass('stowed');
	}

	function uiBarUnstow() {
		if (_destroyed) {
			return;
		}

		jQuery('#ui-bar').removeClass('stowed');
	}

	function uiBarSetStoryElements() {
		if (DEBUG) { console.log('[UIBar/uiBarSetStoryElements()]'); }

		if (_destroyed) {
			return;
		}

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
				UI.assembleLinkList('StoryMenu', menuStory);
			}
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		init             : { value : uiBarInit },
		start            : { value : uiBarStart },
		destroy          : { value : uiBarDestroy },
		stow             : { value : uiBarStow },
		unstow           : { value : uiBarUnstow },
		setStoryElements : { value : uiBarSetStoryElements }
	}));
})();
