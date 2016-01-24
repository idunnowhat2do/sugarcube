/***********************************************************************************************************************
 *
 * error.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

function alertUser(type, where, mesg, error) {
	var	errMesg = "Apologies! A " + type + " problem has occurred.";
	switch (type) {
	case "fatal":
		errMesg += " Aborting.";
		break;
	case "technical":
		errMesg += " You may be able to continue, but some parts may not work properly.";
		break;
	}
	if (where != null || mesg != null) { // lazy equality for null
		errMesg += "\n\nError";
		if (where != null) { // lazy equality for null
			errMesg += " [" + where + "]";
		}
		errMesg += ": "
			+ (mesg != null /* lazy equality for null */
				? mesg.replace(/^(?:(?:Uncaught\s+)?Error:\s+)+/, "")
				: "unknown error")
			+ ".";
	}
	if (error && error.stack) {
		errMesg += "\n\nStack Trace:\n" + error.stack;
	}
	window.alert(errMesg); // eslint-disable-line no-alert
}

function fatalAlert(where, mesg, error) { // eslint-disable-line no-unused-vars
	alertUser("fatal", where, mesg, error);
}

function technicalAlert(where, mesg, error) {
	alertUser("technical", where, mesg, error);
}

if (!DEBUG) {
	window.onerror = function (mesg, url, lineNum, colNum, error) {
		technicalAlert(null, mesg, error);
	};
}

