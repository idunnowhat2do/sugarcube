/***********************************************************************************************************************
 *
 * option.js
 *
 * Copyright © 2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var Option = (function () {
	"use strict";

	var
		_controls = [],
		_values   = {};


	/*******************************************************************************************************************
	 * Initialization
	 ******************************************************************************************************************/
	function init() {
	}


	/*******************************************************************************************************************
	 * Setup
	 ******************************************************************************************************************/
	/*
	setup.pies = [ "Apple", "Blueberry", "Cherry", "Creme", "Lemon", "Pecan", "Pumpkin", "Raspberry" ];
	Option.addToggle("immature", "Include content for immature audiences?", false);
	Option.addToggle("pie", "Include extra content about pies?", false);
	Option.addList("pie", "Choose a pie.", setup.pies, 1);
	*/
	function addToggle(name, label, initial, callback) { // `initial` is boolean value, defaults to false
	}

	function addList(name, label, list, initial, callback) { // `initial` is array index, defaults to 0
	}


	/*******************************************************************************************************************
	 * Private
	 ******************************************************************************************************************/


	/*******************************************************************************************************************
	 * Exports
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		// Initialization
		init      : { value : init },
		// Setup
		addToggle : { value : addToggle },
		addList   : { value : addList }
	}));

}());

