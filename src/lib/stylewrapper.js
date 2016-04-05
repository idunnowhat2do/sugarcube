/***********************************************************************************************************************
 *
 * lib/stylewrapper.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var StyleWrapper = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
	 * StyleWrapper Class.
	 ******************************************************************************************************************/
	class StyleWrapper {
		constructor(style) {
			if (style == null) { // lazy equality for null
				throw new TypeError('StyleWrapper style parameter must be an HTMLStyleElement object');
			}

			Object.defineProperties(this, {
				style : {
					value : style
				}
			});
		}

		isEmpty() {
			/*
			return this.style.styleSheet
				? this.style.styleSheet.cssText === '' // for IE ≤ 10
				: this.style.hasChildNodes();          // for all other browsers (incl. IE ≥ 11)
			*/
			// This should work in all supported browsers.
			return this.style.cssRules.length === 0;
		}

		set(css) {
			this.clear();
			this.add(css);
		}

		add(css) {
			// For IE ≤ 10.
			if (this.style.styleSheet) {
				this.style.styleSheet.cssText += css;
			}

			// For all other browsers (incl. IE ≥ 11).
			else {
				this.style.appendChild(document.createTextNode(css));
			}
		}

		clear() {
			// For IE ≤ 10.
			if (this.style.styleSheet) {
				this.style.styleSheet.cssText = '';
			}

			// For all other browsers (incl. IE ≥ 11).
			else {
				jQuery(this.style).empty();
			}
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return StyleWrapper;
})();
