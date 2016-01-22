/***********************************************************************************************************************
 *
 * debugview.js
 *
 * Copyright © 2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global strings */

/*
	Setup the DebugView constructor.
*/
function DebugView(parent, type, name, title) {
	Object.defineProperties(this, {
		parent : {
			value : parent
		},
		view : {
			value : document.createElement("span")
		},
		break : {
			value : document.createElement("wbr")
		}
	});

	// Setup the wrapper (`<span>`) element.
	this.view.setAttribute("data-type", type != null ? type : ""); // lazy equality for null
	this.view.setAttribute("data-name", name != null ? name : ""); // lazy equality for null
	this.view.className = "debug";
	this.view.title = title;

	// Add the wrapper (`<span>`) and word break (`<wbr>`) elements to the `parent` element.
	this.parent.appendChild(this.view);
	this.parent.appendChild(this.break);
}

/*
	Setup the DebugView static methods.
*/
Object.defineProperties(DebugView, {
	init : {
		value : function () {
			// Inject the the debug view toggle button into the UI bar.
			jQuery('<button id="debug-view-toggle">' + strings.debugView.title + '</button>')
				.ariaClick({
					label : strings.debugView.toggle
				}, function () {
					DebugView.toggle();
				})
				.prependTo("#ui-bar-body");

			// Enable the debug view initially.
			DebugView.enable();
		}
	},

	enable : {
		value : function () {
			jQuery(document.documentElement).addClass("debug-view");
			jQuery.event.trigger("tw:debugviewupdate");
		}
	},

	disable : {
		value : function () {
			jQuery(document.documentElement).removeClass("debug-view");
			jQuery.event.trigger("tw:debugviewupdate");
		}
	},

	toggle : {
		value : function () {
			jQuery(document.documentElement).toggleClass("debug-view");
			jQuery.event.trigger("tw:debugviewupdate");
		}
	}
});

/*
	Setup the DebugView prototype.
*/
Object.defineProperties(DebugView.prototype, {
	output : {
		get : function () {
			return this.view;
		}
	},

	type : {
		get : function () {
			return this.view.getAttribute("data-type");
		},
		set : function (type) {
			this.view.setAttribute("data-type", type != null ? type : "");
		}
	},

	name : {
		get : function () {
			return this.view.getAttribute("data-name");
		},
		set : function (name) {
			this.view.setAttribute("data-name", name != null ? name : "");
		}
	},

	title : {
		get : function () {
			return this.view.title;
		},
		set : function (title) {
			this.view.title = title;
		}
	},

	modes : {
		value : function (options) {
			if (options == null) { // lazy equality for null
				var current = {};
				this.view.className.splitOrEmpty(/\s+/).forEach(function (name) {
					if (name !== "debug") {
						current[name] = true;
					}
				});
				return current;
			} else if (typeof options === "object") {
				Object.keys(options).forEach(function (name) {
					this.classList[options[name] ? "add" : "remove"](name);
				}, this.view);
				return this;
			} else {
				throw new Error("DebugView.prototype.modes options parameter must be an object or null/undefined");
			}
		}
	},

	remove : {
		value : function () {
			var $view = jQuery(this.view);
			if (this.view.hasChildNodes()) {
				$view.contents().appendTo(this.parent);
			}
			$view.remove();
			jQuery(this.break).remove();
		}
	}
});

