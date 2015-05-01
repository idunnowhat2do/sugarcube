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
	Option.addToggle("immature", "Include content for immature audiences?");
	Option.addToggle("pie", "Include extra content about pies?");
	Option.addList("pie", "Choose a pie.", setup.pies);
	*/
	function addToggle(name, label, callback) {
	}

	function addList(name, label, list, callback) {
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

