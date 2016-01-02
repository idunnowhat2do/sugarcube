/***********************************************************************************************************************
 *
 * utility/stylewrapper.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global removeChildren */

/*
	Setup the StyleWrapper constructor.
*/
function StyleWrapper(style) {
	/*
	if (style == null || !(style instanceof HTMLStyleElement)) { // lazy equality for null
	*/
	if (style == null) { // lazy equality for null
		throw new TypeError("StyleWrapper style parameter must be an HTMLStyleElement object");
	}
	Object.defineProperties(this, {
		style : {
			value : style
		}
	});
}

/*
	Setup the StyleWrapper prototype.
*/
Object.defineProperties(StyleWrapper.prototype, {
	isEmpty : {
		value : function () {
			/*
			return this.style.styleSheet
				? this.style.styleSheet.cssText === "" // for IE ≤ 10
				: this.style.hasChildNodes();          // for all other browsers (incl. IE ≥ 11)
			*/
			return this.style.cssRules.length === 0; // should work in all browsers (I think…)
		}
	},
	set : {
		value : function (css) {
			this.clear();
			this.add(css);
		}
	},
	add : {
		value : function (css) {
			if (this.style.styleSheet) { // for IE ≤ 10
				this.style.styleSheet.cssText += css;
			} else { // for all other browsers (incl. IE ≥ 11)
				this.style.appendChild(document.createTextNode(css));
			}
		}
	},
	clear : {
		value : function () {
			if (this.style.styleSheet) { // for IE ≤ 10
				this.style.styleSheet.cssText = "";
			} else { // for all other browsers (incl. IE ≥ 11)
				removeChildren(this.style);
			}
		}
	}
});

