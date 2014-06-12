#!/usr/bin/env node
/*
 * build.js
 *   - Description : Node.js-hosted build script for SugarCube
 *   - Author      : Thomas Michael Edwards <tmedwards@motoslave.net>
 *   - Copyright   : Copyright © 2014 Thomas Michael Edwards. All rights reserved.
 *   - Version     : 1.0.0, 2014-06-11
 */
"use strict";

/*******************************************************************************
 * CONFIGURATION
 ******************************************************************************/
var CONFIG = {
	html : {
		"src/header.tpl" : "dist/sugarcube/header.html"
	},
	js   : [ "src/polyfills.js", "src/utility.js", "src/main.js", "src/story.js", "src/wikifier.js", "src/macros.js" , "src/macroslib.js" ],
	css  : [ "src/styles.css" ],
	copy : {
		"src/sugarcube.py" : "dist/sugarcube/sugarcube.py"
	}
};


/*******************************************************************************
 * UTILITY FUNCTIONS
 ******************************************************************************/
function log(message) {
	console.log("%s%s", _indent, message);
}

function warn(message) {
	console.warn("%swarning: %s", _indent, message);
}

function die(message, error) {
	if (error) {
		console.error("error: %s\n[@: %d/%d] Trace:\n", message, error.line, error.col, error.stack);
	} else {
		console.error("error: %s", message);
	}
	process.exit(1);
}

function makePath(pathname) {
	var pathBits = _path.normalize(pathname).split(_path.sep);
	for (var i = 0; i < pathBits.length; i++) {
		var dirPath = i === 0 ? pathBits[i] : pathBits.slice(0, i+1).join(_path.sep);
		if (!_fs.existsSync(dirPath)) {
			_fs.mkdirSync(dirPath);
		}
	}
}

function readFileContents(filename) {
	try {
		// the replace() is necessary because Node.js only offers binary mode file
		// access, regardless of platform, so we convert DOS-style line terminators
		// to UNIX-style, just in case someone adds/edits a file and gets DOS-style
		// line termination all over it
		return _fs.readFileSync(filename, { encoding: "utf8" }).replace(/\r\n/g, "\n");
	} catch (e) {
		die('cannot open file "' + filename + '" for reading (reason: ' + e.message + ')');
	}
}

function writeFileContents(filename, data) {
	try {
		_fs.writeFileSync(filename, data, { encoding: "utf8" });
	} catch (e) {
		die('cannot open file "' + filename + '" for writing (reason: ' + e.message + ')');
	}
}

function concatFiles(filenames) {
	var _os    = require("os"),
		output = filenames.map(function (filename) {
			return readFileContents(_path.normalize(filename));
		});
	return output.join("\n");  // we only use UNIX-style line termination
}

function compileJS(filenames) {
	log('compiling JS...');
	var jsSource = concatFiles(filenames);
	if (_opt.options.unminified) {
		return jsSource;
	} else {
		try {
			// HOWTO: '--screw-ie8'
			// HOWTO: '-r "thisp"'
			var uglifyjs = require("uglify-js"),
				result   = uglifyjs.minify(jsSource, {
				fromString : true,
				compress   : { global_defs : { DEBUG : (_opt.options.debug || false) }, screw_ie8 : true },
				mangle     : { except : [ "thisp" ], screw_ie8 : true },
				output     : { screw_ie8 : true }
			});
			return result.code;
		} catch (e) {
			die("uglification error", e);
		}
	}
}

function compileCSS(filenames) {
	log('compiling CSS...');
	// only returns the files combined contents at the moment, exists so that
	// in the future this can be rewritten to minify the CSS, if so desired
	return concatFiles(filenames);
}


/*******************************************************************************
 * MAIN SCRIPT
 ******************************************************************************/
var _fs     = require("fs"),
	_path   = require("path"),
	_opt    = require('node-getopt').create([
		['d', 'debug',      'Keep debugging code; gated by DEBUG symbol.'],
		['u', 'unminified', 'Suppress minification stages.'],
		['h', 'help',       'Print this help, then exit.']
	])
		.bindHelp()      // bind option 'help' to default action
		.parseSystem(),  // parse command line
	_indent = " -> ";

// build the project
(function () {
	var build = +readFileContents(".build") + 1,         // get the build number
		date  = '"' + (new Date()).toISOString() + '"',  // get the build date
		js    = compileJS(CONFIG.js),                    // combine and minify the JS
		css   = compileCSS(CONFIG.css);                  // combine and minify the CSS

	// process the header templates and write the outfiles
	for (var file in CONFIG.html) {
		var infile  = _path.normalize(file),
			outfile = _path.normalize(CONFIG.html[file]),
			output  = readFileContents(infile);  // load the header template
		log('build "' + outfile + '"');

		// process the replacement tokens (source tokens first!)
		output = output.replace(/\"\{\{JS_SOURCE\}\}\"/g, js);
		output = output.replace(/\"\{\{CSS_SOURCE\}\}\"/g, css);
		output = output.replace(/\"\{\{BUILD_ID\}\}\"/g, build);
		output = output.replace(/\"\{\{BUILD_DATE\}\}\"/g, date);

		// write the outfile
		makePath(_path.dirname(outfile));
		writeFileContents(outfile, output);
	}

	// process the files that simply need copied into the distribution
	for (var file in CONFIG.copy) {
		var infile  = _path.normalize(file),
			outfile = _path.normalize(CONFIG.copy[file]),
			output  = readFileContents(infile);  // load the file (raw)
		log('copy  "' + outfile + '"');

		// write the file
		makePath(_path.dirname(outfile));
		writeFileContents(outfile, output);
	}

	// update the build ID
	writeFileContents(".build", build);
}());

// that's all folks!
console.log('Build complete!  (check the "dist" directory for the header)');

