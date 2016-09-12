/***********************************************************************************************************************
 *
 * lib/debugview.js
 *
 * Copyright © 2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global L10n */

/*
	TODO: Make this use jQuery throughout.
*/
var DebugView = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
	 * DebugView Class.
	 ******************************************************************************************************************/
	class DebugView {
		constructor(parent, type, name, title) {
			Object.defineProperties(this, {
				parent : {
					value : parent
				},

				view : {
					value : document.createElement('span')
				},

				break : {
					value : document.createElement('wbr')
				}
			});

			// Setup the wrapper (`<span>`) element.
			jQuery(this.view)
				.attr({
					title,
					'aria-label' : title,
					'data-type'  : type != null ? type : '', // lazy equality for null
					'data-name'  : name != null ? name : ''  // lazy equality for null
				})
				.addClass('debug');

			// Add the wrapper (`<span>`) and word break (`<wbr>`) elements to the `parent` element.
			this.parent.appendChild(this.view);
			this.parent.appendChild(this.break);
		}

		get output() {
			return this.view;
		}

		get type() {
			return this.view.getAttribute('data-type');
		}
		set type(type) {
			this.view.setAttribute('data-type', type != null ? type : ''); // lazy equality for null
		}

		get name() {
			return this.view.getAttribute('data-name');
		}
		set name(name) {
			this.view.setAttribute('data-name', name != null ? name : ''); // lazy equality for null
		}

		get title() {
			return this.view.title;
		}
		set title(title) {
			this.view.title = title;
		}

		append(el) {
			jQuery(this.view).append(el);
			return this;
		}

		modes(options) {
			if (options == null) { // lazy equality for null
				const current = {};

				this.view.className.splitOrEmpty(/\s+/).forEach(name => {
					if (name !== 'debug') {
						current[name] = true;
					}
				});

				return current;
			}
			else if (typeof options === 'object') {
				Object.keys(options).forEach(function (name) {
					this[options[name] ? 'addClass' : 'removeClass'](name);
				}, jQuery(this.view));

				return this;
			}
			else {
				throw new Error('DebugView.prototype.modes options parameter must be an object or null/undefined');
			}
		}

		remove() {
			const $view = jQuery(this.view);

			if (this.view.hasChildNodes()) {
				$view.contents().appendTo(this.parent);
			}

			$view.remove();
			jQuery(this.break).remove();
		}

		static init() {
			// Inject the the debug view toggle button into the UI bar.
			jQuery(`<button id="debug-view-toggle">${L10n.get('debugViewTitle')}</button>`)
				.ariaClick({
					label : L10n.get('debugViewToggle')
				}, () => DebugView.toggle())
				.prependTo('#ui-bar-body');

			// Enable the debug view initially.
			DebugView.enable();
		}

		static enable() {
			jQuery(document.documentElement).addClass('debug-view');
			jQuery.event.trigger('tw:debugviewupdate');
		}

		static disable() {
			jQuery(document.documentElement).removeClass('debug-view');
			jQuery.event.trigger('tw:debugviewupdate');
		}

		static toggle() {
			jQuery(document.documentElement).toggleClass('debug-view');
			jQuery.event.trigger('tw:debugviewupdate');
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return DebugView;
})();
