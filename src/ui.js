/***********************************************************************************************************************

	ui.js

	Copyright © 2013–2017 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/*
	global Alert, Dialog, Engine, Has, L10n, Save, Setting, State, Story, Util, Wikifier, Config, settings
*/

var UI = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
		UI Functions, Core.
	*******************************************************************************************************************/
	function uiAssembleLinkList(passage, listEl) {
		let list = listEl;

		// Cache the value of `Config.debug` and then disable it during this method's run.
		const debugState = Config.debug;
		Config.debug = false;

		try {
			if (list == null) { // lazy equality for null
				list = document.createElement('ul');
			}

			// Wikify the content of the given source passage into a fragment.
			const frag = document.createDocumentFragment();
			new Wikifier(frag, Story.get(passage).processText().trim());

			// Gather the text of any error elements within the fragment…
			const errors = [...frag.querySelectorAll('.error')]
				.map(errEl => errEl.textContent.replace(/^(?:(?:Uncaught\s+)?Error:\s+)+/, ''));

			// …and throw an exception, if there were any errors.
			if (errors.length > 0) {
				throw new Error(errors.join('; '));
			}

			while (frag.hasChildNodes()) {
				const node = frag.firstChild;

				// Create list items for <a>-element nodes.
				if (node.nodeType === Node.ELEMENT_NODE && node.nodeName.toUpperCase() === 'A') {
					const li = document.createElement('li');
					list.appendChild(li);
					li.appendChild(node);
				}

				// Discard non-<a>-element nodes.
				else {
					frag.removeChild(node);
				}
			}
		}
		finally {
			// Restore `Config.debug` to its original value.
			Config.debug = debugState;
		}

		return list;
	}


	/*******************************************************************************************************************
		UI Functions, Built-ins.
	*******************************************************************************************************************/
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
			jQuery(document).one(':dialogclose', () => {
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
								return () => jQuery(document).one(':dialogclose', () => Engine.goTo(idx));
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
					jQuery(document).one(':dialogclose', () => Engine.restart());
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

			const saves  = Save.get();
			const $tbody = jQuery(document.createElement('tbody'));

			if (Save.autosave.ok()) {
				const $tdSlot = jQuery(document.createElement('td'));
				const $tdLoad = jQuery(document.createElement('td'));
				const $tdDesc = jQuery(document.createElement('td'));
				const $tdDele = jQuery(document.createElement('td'));

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
							jQuery(document).one(':dialogclose', () => Save.autosave.load());
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
						})
					);
				}
				else {
					// Add the disabled load button.
					$tdLoad.append(
						createButton('load', null, L10n.get('savesLabelLoad'), 'auto')
					);

					// Add the description.
					jQuery(document.createElement('em'))
						.text(L10n.get('savesEmptySlot'))
						.appendTo($tdDesc);
					$tdDesc.addClass('empty');

					// Add the disabled delete button.
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
				const $tdSlot = jQuery(document.createElement('td'));
				const $tdLoad = jQuery(document.createElement('td'));
				const $tdDesc = jQuery(document.createElement('td'));
				const $tdDele = jQuery(document.createElement('td'));

				// Add the slot ID.
				$tdSlot.append(document.createTextNode(i + 1));

				if (saves.slots[i]) {
					// Add the load button.
					$tdLoad.append(
						createButton('load', 'ui-close', L10n.get('savesLabelLoad'), i, slot => {
							jQuery(document).one(':dialogclose', () => Save.slots.load(slot));
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
						})
					);
				}
				else {
					// Add the save button.
					$tdLoad.append(
						createButton('save', 'ui-close', L10n.get('savesLabelSave'), i, Save.slots.save)
					);

					// Add the description.
					jQuery(document.createElement('em'))
						.text(L10n.get('savesEmptySlot'))
						.appendTo($tdDesc);
					$tdDesc.addClass('empty');

					// Add the disabled delete button.
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

		const $dialogBody = jQuery(Dialog.setup(L10n.get('savesTitle'), 'saves'));
		const savesOk     = Save.ok();

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
				$btnBar.append(createActionItem(
					'export',
					'ui-close',
					L10n.get('savesLabelExport'),
					() => Save.export()
				));
				$btnBar.append(createActionItem(
					'import',
					null,
					L10n.get('savesLabelImport'),
					() => $dialogBody.find('#saves-import-file').trigger('click')
				));

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
						jQuery(document).one(':dialogclose', () => Save.import(ev));
						Dialog.close();
					})
					.appendTo($dialogBody);
			}

			if (savesOk) {
				$btnBar.append(createActionItem(
						'clear',
						null,
						L10n.get('savesLabelClear'),
						Save.autosave.has() || !Save.slots.isEmpty()
							? () => {
								Save.clear();
								uiBuildSaves();
							}
							: null
				));
			}

			return true;
		}

		uiOpenAlert(L10n.get('savesIncapable'));
		return false;
	}

	function uiBuildSettings() {
		if (DEBUG) { console.log('[UI/uiBuildSettings()]'); }

		const $dialogBody = jQuery(Dialog.setup(L10n.get('settingsTitle'), 'settings'));

		Setting.forEach(control => {
			if (control.type === Setting.Types.Header) {
				const name       = control.name;
				const id         = Util.slugify(name);
				const $elHeader  = jQuery(document.createElement('div'));
				const $elHeading = jQuery(document.createElement('h2'));
				const $elLabel   = jQuery(document.createElement('p'));

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

			const name       = control.name;
			const id         = Util.slugify(name);
			const $elSetting = jQuery(document.createElement('div'));
			const $elLabel   = jQuery(document.createElement('label'));
			const $elWrapper = jQuery(document.createElement('div'));
			let $elControl;

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
					jQuery(document).one(':dialogclose', () => {
						Setting.reset();
						window.location.reload();
					});
					Dialog.close();
				});

		return true;
	}

	function uiBuildShare() {
		if (DEBUG) { console.log('[UI/uiBuildShare()]'); }

		try {
			jQuery(Dialog.setup(L10n.get('shareTitle'), 'share list'))
				.append(uiAssembleLinkList('StoryShare'));
		}
		catch (ex) {
			console.error(ex);
			Alert.error('StoryShare', ex.message);
			return false;
		}

		return true;
	}


	/*******************************************************************************************************************
		Module Exports.
	*******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			UI Functions, Core.
		*/
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
		// `UIBar` methods.
		/* global UIBar */
		stow                     : { value : () => UIBar.stow() },
		unstow                   : { value : () => UIBar.unstow() },
		setStoryElements         : { value : () => UIBar.setStoryElements() },
		// `Dialog` methods.
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
