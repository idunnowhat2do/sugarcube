# SugarCube #
[SugarCube](http://www.motoslave.net/sugarcube/ "http://www.motoslave.net/sugarcube/") is a free (gratis and libre) story format for [Twine/Twee](http://twinery.org/ "http://twinery.org/"), based on [TiddlyWiki](http://tiddlywiki.com/ "http://tiddlywiki.com/").

Downloads and documentation can be found at [SugarCube's website](http://www.motoslave.net/sugarcube/ "http://www.motoslave.net/sugarcube/").

## Requirements ##
SugarCube's sole requirement is a modern web browser, and by *modern* I mean one released within the last several years (you do not need the absolute latest and greatest shiny).

**Caveat for Internet Explorer:** SugarCube only supports  IE9+.  So, users of Windows XP (who are limited to IE8) will not be able to play/view stories built with SugarCube with their version of IE.  They would either have to use a different browser or upgrade to a less obsolescent version of Windows (Microsoft ended public support for Windows XP in April, 2014).

## Getting the source ##
You can get the SugarCube source in one of two ways, by downloading a specific tagged release or 
by cloning the repository.  If you only wish to build the latest release in the v1 or v2 series, then the former option is probably easiest.  If you wish to hack on SugarCube at all, then the latter option is probably best.

### Downloading a specific tagged release ###
From the main repository's *Downloads* page, go to the *Tags* tab and download only the specific release you're interested in.

### Cloning the repository ###
This requires you to have the [Mercurial (`hg`)](http://mercurial.selenic.com/ "http://mercurial.selenic.com/") source control management tool installed (knowing how to use it also helps).  If you go this route, know that there are several active branches, so be sure to update your local clone to the branch you wish to work on by issuing the appropriate `hg update` command.  The current permanent branches are:

- `default`: The v2 development branch
- `v2-release`: The v2 release branch
- `v1-devel`: The v1 development branch
- `v1-release`: The v1 release branch

## Building ##
If you want to build SugarCube from scratch, rather than grabbing one of the pre-built packages off of its website, then these instructions are for you.

SugarCube uses Node.js as the core of its build system, so the first thing you need to do is to install it if you don't already have it.

- [Node.js website: `http://nodejs.org/`](http://nodejs.org/ "http://nodejs.org/")

After downloading and installing Node.js, change to the root of the `sugarcube` project directory.  You'll now need to download and install dependencies required by the build script, `build.js`, which you do by running the following command:

>     npm install

Dependencies will be installed to the root of the `sugarcube` project directory, nothing will be installed elsewhere on your computer.  Assuming that completes with no errors, run the following command to build the story format:

>     node build.js

**n.b.** If you're running this from a UNIX-style shell, simply running `build.js` should also work as it's shebanged.

If there were no errors, the story format, in Twine 1 and Twine 2 flavors, will be output to the `dist` directory.  Congratulations!

----

If you'd like additional options when building (debug builds, limiting the build to a particular version of Twine, etc.), you may request help from `build.js` by running the following command:

>     node build.js -h


