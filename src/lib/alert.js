/***********************************************************************************************************************
 *
 * lib/alert.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var Alert = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
	 * Error Functions.
	 ******************************************************************************************************************/
	function _alertMesg(type, where, mesg, error) {
		const isFatal = type === 'fatal';
		let	errMesg = `Apologies! ${isFatal ? 'A fatal' : 'An'} error has occurred.`;

		if (isFatal) {
			errMesg += ' Aborting.';
		}
		else {
			errMesg += ' You may be able to continue, but some parts may not work properly.';
		}

		if (where != null || mesg != null) { // lazy equality for null
			errMesg += '\n\nError';

			if (where != null) { // lazy equality for null
				errMesg += ` [${where}]`;
			}

			if (mesg != null) { // lazy equality for null
				errMesg += `: ${mesg.replace(/^(?:(?:uncaught\s+(?:exception:\s+)?)?error:\s+)+/i, '')}.`;
			}
			else {
				errMesg += ': unknown error.';
			}
		}

		if (error && error.stack) {
			errMesg += `\n\nStack Trace:\n${error.stack}`;
		}

		window.alert(errMesg); // eslint-disable-line no-alert
	}

	function alertError(where, mesg, error) {
		_alertMesg(null, where, mesg, error);
	}

	function alertFatal(where, mesg, error) {
		_alertMesg('fatal', where, mesg, error);
	}


	/*******************************************************************************************************************
	 * Error Event.
	 ******************************************************************************************************************/
	/*
		Setup a global error handler for uncaught exceptions.
	*/
	(origOnError => {
		window.onerror = function (mesg, url, lineNum, colNum, error) {
			// Uncaught exceptions during play may be recoverable/ignorable.
			if (document.readyState === 'complete') {
				alertError(null, mesg, error);
			}

			// Uncaught exceptions during startup should be fatal.
			else {
				alertFatal(null, mesg, error);
				window.onerror = origOnError;

				if (typeof window.onerror === 'function') {
					window.onerror.apply(this, arguments);
				}
			}
		};
	})(window.onerror);


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		error : { value : alertError },
		fatal : { value : alertFatal }
	}));
})();
