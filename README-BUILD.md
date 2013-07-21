# Building SugarCube #

## Requirements ##

1. For both of the build utilities, a working installation of Perl (on Windows, I recommend: [ActiveState Perl](http://www.activestate.com/activeperl/downloads "http://www.activestate.com/activeperl/downloads")).
2. For the default minification used by `makeSugarCube.pl`, a working installation of [Google's Closure Compiler](http://code.google.com/p/closure-compiler/ "http://code.google.com/p/closure-compiler/").

## Files ##

### `makeSugarCube.pl` ###

> Builds the header.

### `closure.pl` ###

> Used by `makeSugarCube.pl` to minify SugarCube's JavaScript.    You will have to edit the `@CLOSURECMD` global at the top of the file to configure it for your local Closure Compiler install.

## Instructions ##

Once all requirements have been met and `closure.pl` has been configured, simply run the `makeSugarCube.pl` utility in the base directory.  If there were no errors, the header will, by default, be output to the `dist` directory.
