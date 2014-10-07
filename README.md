# SugarCube #
[SugarCube](http://www.motoslave.net/sugarcube/ "http://www.motoslave.net/sugarcube/") is a free (gratis and libre) story format for [Twine/Twee](http://twinery.org/ "http://twinery.org/"), based on [TiddlyWiki](http://tiddlywiki.com/ "http://tiddlywiki.com/").

Downloads and documentation can be found at [SugarCube's website](http://www.motoslave.net/sugarcube/ "http://www.motoslave.net/sugarcube/").

## Feature Highlights ##
- Semantic HTML5 (for the most part, anyway).
- The ability to easily save your progress, at any point, and revisit it at any time.
- Persistent end-user options, via the [`options` variable](#reserved-names-variables "see: options"), the [`MenuOptions` passage](#reserved-names-passages "see: MenuOptions"), and the [options macros](#macrocat-options "see: options macros").
- Supports most Twine 1.4+ features (e.g. [embedded image passages](#wiki-syntax-extensions-image-passage "see: Image Passage Syntax for [img[]]")).
- Supports most of the current set of TiddlyWiki markup (e.g. adds `<nowiki>…</nowiki>` & table caption markup).
- Embeds the [jQuery library](http://jquery.com/ "http://jquery.com/") (2.x series) and the [seedrandom.js library](https://github.com/davidbau/seedrandom "https://github.com/davidbau/seedrandom").
- And more….  See the documentation at [SugarCube's website](http://www.motoslave.net/sugarcube/ "http://www.motoslave.net/sugarcube/") for more information.

## Requirements ##
SugarCube's sole requirement is a modern web browser, and by *modern* I mean one released within the last several years (you do not need the absolute latest and greatest shiny).

**Caveat for Internet Explorer:** SugarCube only supports  IE9+.  So, users of Windows XP (who are limited to IE8) will not be able to play/view stories built with SugarCube with their version of IE.  They would either have to use a different browser or upgrade to a less obsolescent version of Windows (Microsoft ended public support for Windows XP in April, 2014).

## Building SugarCube ##
If you want to build SugarCube from scratch, rather than grabbing one of the pre-built packages of of its website, then these instructions are for you.

SugarCube uses Node.js as its build system, so the first thing you need to do is to install it if you don't already have it.

- [Node.js website: `http://nodejs.org/`](http://nodejs.org/ "http://nodejs.org/")

After downloading and installing Node.js, change to the root of the `sugarcube` project directory.  You'll now need to download and install dependencies required by the build script, `build.js`, which you do by running the following command:

>     npm install

Dependencies will be installed to the root of the `sugarcube` project directory, nothing will be installed elsewhere on your computer.  Assuming that completes with no errors, run the following command to build the story format:

>     node build.js

If you're running this from a UNIX-style shell, simply running `build.js` should also work as it's shebanged.

If there were no errors, the story format will, by default, be output to the `dist` directory.  Congratulations!


