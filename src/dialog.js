/***********************************************************************************************************************
 *
 * dialog.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Engine, L10n, safeActiveElement */

var Dialog = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	let
		_$overlay       = null,
		_$dialog        = null,
		_$dialogTitle   = null,
		_$dialogBody    = null,
		_lastActive     = null,
		_scrollbarWidth = 0;


	/*******************************************************************************************************************
	 * Core Functions.
	 ******************************************************************************************************************/
	function dialogInit() {
		if (DEBUG) { console.log('[Dialog/dialogInit()]'); }

		/*
			Calculate and cache the width of scrollbars.
		*/
		_scrollbarWidth = (() => {
			let scrollbarWidth;

			try {
				const
					inner = document.createElement('p'),
					outer = document.createElement('div');

				inner.style.width      = '100%';
				inner.style.height     = '200px';
				outer.style.position   = 'absolute';
				outer.style.left       = '0px';
				outer.style.top        = '0px';
				outer.style.width      = '100px';
				outer.style.height     = '100px';
				outer.style.visibility = 'hidden';
				outer.style.overflow   = 'hidden';

				outer.appendChild(inner);
				document.body.appendChild(outer);

				const w1 = inner.offsetWidth;
				/*
					The `overflow: scroll` style property value does not work consistently
					with scrollbars which are styled with `::-webkit-scrollbar`, so we use
					`overflow: auto` with dimensions guaranteed to force a scrollbar.
				*/
				outer.style.overflow = 'auto';
				let w2 = inner.offsetWidth;

				if (w1 === w2) {
					w2 = outer.clientWidth;
				}

				document.body.removeChild(outer);

				scrollbarWidth = w1 - w2;
			}
			catch (ex) { /* no-op */ }

			return scrollbarWidth || 17; // 17px is a reasonable failover
		})();

		/*
			Generate the dialog elements.
		*/
		const $uiTree = jQuery(document.createDocumentFragment())
			.append(
				/* eslint-disable max-len */
				  '<div id="ui-overlay" class="ui-close"></div>'
				+ '<div id="ui-dialog" tabindex="0" role="dialog" aria-labelledby="ui-dialog-title">'
				+     '<div id="ui-dialog-titlebar">'
				+         '<h1 id="ui-dialog-title"></h1>'
				+         `<button id="ui-dialog-close" class="ui-close" tabindex="0" aria-label="${L10n.get('close')}">\uE804</button>`
				+     '</div>'
				+     '<div id="ui-dialog-body"></div>'
				+ '</div>'
				/* eslint-enable max-len */
			);

		/*
			Cache the dialog elements, since they're going to be used often.

			NOTE: We rewrap the elements themselves, rather than simply using the results
			      of `find()`, so that we cache uncluttered jQuery-wrappers (i.e. `context`
			      refers to the elements and there is no `prevObject`).
		*/
		_$overlay     = jQuery($uiTree.find('#ui-overlay').get(0));
		_$dialog      = jQuery($uiTree.find('#ui-dialog').get(0));
		_$dialogTitle = jQuery($uiTree.find('#ui-dialog-title').get(0));
		_$dialogBody  = jQuery($uiTree.find('#ui-dialog-body').get(0));

		/*
			Insert the dialog elements into the page before the store area.
		*/
		$uiTree.insertBefore('#store-area');
	}


	/*******************************************************************************************************************
	 * Dialog Functions.
	 ******************************************************************************************************************/
	function dialogIsOpen(classNames) {
		return _$dialog.hasClass('open')
			&& (classNames ? classNames.splitOrEmpty(/\s+/).every(cn => _$dialogBody.hasClass(cn)) : true);
	}

	function dialogSetup(title, classNames) {
		_$dialogBody
			.empty()
			.removeClass();

		if (classNames != null) { // lazy equality for null
			_$dialogBody.addClass(classNames);
		}

		_$dialogTitle
			.empty()
			.append((title != null ? String(title) : '') || '\u00A0'); // lazy equality for null
		return _$dialogBody.get(0);
	}

	function dialogBody() {
		return _$dialogBody.get(0);
	}

	function dialogBodyAppend(...args) {
		_$dialogBody.append(...args);
		return Dialog;
	}

	function dialogBodyWiki(...args) {
		_$dialogBody.wiki(...args);
		return Dialog;
	}

	/**
		Adds a click hander to the target element(s) which opens the dialog modal.
	**/
	function dialogAddClickHandler(targets, options, startFn, doneFn, closeFn) {
		return jQuery(targets).ariaClick(ev => {
			ev.preventDefault();

			// Call the start function.
			if (typeof startFn === 'function') {
				startFn(ev);
			}

			// Open the dialog.
			dialogOpen(options, closeFn);

			// Call the done function.
			if (typeof doneFn === 'function') {
				doneFn(ev);
			}
		});
	}

	function dialogOpen(options, closeFn) {
		const { top } = jQuery.extend({ top : 50 }, options);

		// Record the last active/focused non-dialog element.
		if (!dialogIsOpen()) {
			_lastActive = safeActiveElement();
		}

		// Add the <html> level class (mostly used to style <body>).
		jQuery(document.documentElement)
			.addClass('ui-dialog-open');

		// Display the overlay.
		_$overlay
			.addClass('open');

		/*
			Add the imagesLoaded handler to the dialog body, if necessary.

			NOTE: We use `querySelector()` here as jQuery has no simple way to check if,
			      and only if, at least one element of the specified type exists.  The
			      best that jQuery offers is analogous to `querySelectorAll()`, which
			      enumerates all elements of the specified type.
		*/
		if (_$dialogBody[0].querySelector('img') !== null) {
			_$dialogBody
				.imagesLoaded()
					.always(() => dialogResizeHandler({ data : { top } }));
		}

		// Add `aria-hidden=true` to all direct non-dialog-children of <body> to
		// hide the underlying page form screen readers while the dialog is open.
		jQuery('body>:not(script,#store-area,#ui-bar,#ui-overlay,#ui-dialog)')
			.attr('tabindex', -3)
			.attr('aria-hidden', true);
		jQuery('#ui-bar,#story')
			.find('[tabindex]:not([tabindex^=-])')
				.attr('tabindex', -2)
				.attr('aria-hidden', true);

		// Display the dialog.
		const position = dialogCalcPosition(top);
		_$dialog
			.css(position)
			.addClass('open')
			.focus();

		// Add the UI resize handler.
		jQuery(window)
			.on('resize.ui-resize', null, { top }, jQuery.throttle(40, dialogResizeHandler));

		// Setup the delegated UI close handler.
		jQuery(document)
			.on('click.ui-close', '.ui-close', { closeFn }, dialogClose) // yes, namespace and class have the same name
			.on('keypress.ui-close', '.ui-close', function (ev) {
				// 13 is Enter/Return, 32 is Space.
				if (ev.which === 13 || ev.which === 32) {
					jQuery(this).trigger('click');
				}
			});

		// Trigger a global `tw:dialogopened` event.
		setTimeout(() => jQuery.event.trigger('tw:dialogopened'), Engine.minDomActionDelay);

		return Dialog;
	}

	function dialogClose(ev) {
		// Largely reverse the actions taken in `dialogOpen()`.
		jQuery(document)
			.off('.ui-close'); // namespace, not to be confused with the class by the same name
		jQuery(window)
			.off('resize.ui-resize');
		_$dialog
			.removeClass('open')
			.css({ left : '', right : '', top : '', bottom : '' });

		jQuery('#ui-bar,#story')
			.find('[tabindex=-2]')
				.removeAttr('aria-hidden')
				.attr('tabindex', 0);
		jQuery('body>[tabindex=-3]')
			.removeAttr('aria-hidden')
			.removeAttr('tabindex');

		_$dialogTitle
			.empty();
		_$dialogBody
			.empty()
			.removeClass();
		_$overlay
			.removeClass('open');
		jQuery(document.documentElement)
			.removeClass('ui-dialog-open');

		// Attempt to restore focus to whichever element had it prior to opening the dialog.
		if (_lastActive !== null) {
			jQuery(_lastActive).focus();
			_lastActive = null;
		}

		// Call the given "on close" callback function, if any.
		if (ev && ev.data && typeof ev.data.closeFn === 'function') {
			ev.data.closeFn(ev);
		}

		// Trigger a global `tw:dialogclosed` event.
		setTimeout(() => jQuery.event.trigger('tw:dialogclosed'), Engine.minDomActionDelay);

		return Dialog;
	}

	function dialogResizeHandler(ev) {
		const top = ev && ev.data && typeof ev.data.top !== 'undefined' ? ev.data.top : 50;

		if (_$dialog.css('display') === 'block') {
			// Stow the dialog.
			_$dialog.css({ display : 'none' });

			// Restore the dialog with its new positional properties.
			_$dialog.css(jQuery.extend({ display : '' }, dialogCalcPosition(top)));
		}
	}

	function dialogCalcPosition(topPos) {
		const
			top       = topPos != null ? topPos : 50, // lazy equality for null
			$parent   = jQuery(window),
			dialogPos = { left : '', right : '', top : '', bottom : '' };

		// Unset the dialog's positional properties before checking its dimensions.
		_$dialog.css(dialogPos);

		let
			horzSpace = $parent.width() - _$dialog.outerWidth(true) - 1,   // -1 to address a Firefox issue
			vertSpace = $parent.height() - _$dialog.outerHeight(true) - 1; // -1 to address a Firefox issue

		if (horzSpace <= 32 + _scrollbarWidth) {
			vertSpace -= _scrollbarWidth;
		}
		if (vertSpace <= 32 + _scrollbarWidth) {
			horzSpace -= _scrollbarWidth;
		}

		if (horzSpace <= 32) {
			dialogPos.left = dialogPos.right = 16;
		}
		else {
			dialogPos.left = dialogPos.right = ~~(horzSpace / 2);
		}

		if (vertSpace <= 32) {
			dialogPos.top = dialogPos.bottom = 16;
		}
		else {
			if (vertSpace / 2 > top) {
				dialogPos.top = top;
			}
			else {
				dialogPos.top = dialogPos.bottom = ~~(vertSpace / 2);
			}
		}

		Object.keys(dialogPos).forEach(key => {
			if (dialogPos[key] !== '') {
				dialogPos[key] += 'px';
			}
		});

		return dialogPos;
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		init            : { value : dialogInit },
		isOpen          : { value : dialogIsOpen },
		setup           : { value : dialogSetup },
		body            : { value : dialogBody },
		append          : { value : dialogBodyAppend },
		wiki            : { value : dialogBodyWiki },
		addClickHandler : { value : dialogAddClickHandler },
		open            : { value : dialogOpen },
		close           : { value : dialogClose },
		resize          : { value : () => dialogResizeHandler() } // Forbid params on the exported method.
	}));
})();
