#!/usr/bin/env node
/*
 * build.js
 *   - Description : Node.js-hosted build script for SugarCube
 *   - Author      : Thomas Michael Edwards <tmedwards@motoslave.net>
 *   - Copyright   : Copyright © 2014 Thomas Michael Edwards. All rights reserved.
 *   - Version     : 1.0.9, 2014-07-28
 */
"use strict";

/*******************************************************************************
 * CONFIGURATION
 ******************************************************************************/
var CONFIG = {
	html : {
		"src/header.tpl" : "dist/sugarcube/header.html"
	},
	js   : [
		// the ordering here is significant
		"src/intro.js",
		"src/intrinsics.js",
		"src/utility.js",
		"src/savesystem.js",
		"src/uisystem.js",
		"src/story.js",
		"src/wikifier.js",
		"src/macros.js",
		"src/macroslib.js",
		"src/main.js",
		"src/outro.js"
	],
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
		return "window.DEBUG=" + (_opt.options.debug || false) + ";\n" + jsSource;
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
			var mesg = "uglification error";
			if (e.line > 0) {
				var begin = (e.line > 4 ) ? e.line - 4 : 0,
					end   = (e.line + 3 < jsSource.length) ? e.line + 3 : jsSource.length;
				mesg += ":\n >> " + jsSource.split(/\n/).slice(begin, end).join("\n >> ");
			}
			die(mesg, e);
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
	var version, jsSource, cssSource;

	// create the build ID file, if nonexistent
	if (!_fs.existsSync(".build")) {
		writeFileContents(".build", 0);
	}

	// get the base version info and set build metadata
	version          = require("./src/sugarcube.json");  // "./" prefixing the relative path is important here
	version.build    = +readFileContents(".build") + 1;
	version.date     = (new Date()).toISOString();
	version.toString = function () {
		return "v" + this.major + "." + this.minor + "." + this.patch + (this.prerelease ? "-" + this.prerelease : "");
	};

	// combine and minify the JS
	jsSource = compileJS(CONFIG.js);

	// combine and minify the CSS
	cssSource = compileCSS(CONFIG.css);

	// process the header templates and write the outfiles
	Object.keys(CONFIG.html).forEach(function (file) {
		var infile  = _path.normalize(file),
			outfile = _path.normalize(CONFIG.html[file]),
			output  = readFileContents(infile);  // load the header template
		log('build "' + outfile + '"');

		// process the source replacement tokens (first!)
		output = output.replace(/\"\{\{JS_SOURCE\}\}\"/g, jsSource);
		output = output.replace(/\"\{\{CSS_SOURCE\}\}\"/g, cssSource);

		// process the build replacement tokens
		output = output.replace(/\"\{\{BUILD_MAJOR\}\}\"/g, version.major);
		output = output.replace(/\"\{\{BUILD_MINOR\}\}\"/g, version.minor);
		output = output.replace(/\"\{\{BUILD_PATCH\}\}\"/g, version.patch);
		output = output.replace(/\"\{\{BUILD_PRERELEASE\}\}\"/g, JSON.stringify(version.prerelease));
		output = output.replace(/\"\{\{BUILD_BUILD\}\}\"/g, version.build);
		output = output.replace(/\"\{\{BUILD_DATE\}\}\"/g, JSON.stringify(version.date));
		output = output.replace(/\"\{\{BUILD_VERSION\}\}\"/g, version);

		// write the outfile
		makePath(_path.dirname(outfile));
		writeFileContents(outfile, output);
	});

	// process the files that simply need copied into the distribution
	Object.keys(CONFIG.copy).forEach(function (file) {
		var infile  = _path.normalize(file),
			outfile = _path.normalize(CONFIG.copy[file]),
			output  = readFileContents(infile);  // load the file (raw)
		log('copy  "' + outfile + '"');

		// write the file
		makePath(_path.dirname(outfile));
		writeFileContents(outfile, output);
	});

	// update the build ID
	writeFileContents(".build", version.build);
}());

// that's all folks!
console.log('Build complete!  (check the "dist" directory)');

