
# SugarCube #

A header for [Twine/Twee](http://gimcrackd.com/etc/src/ "http://gimcrackd.com/etc/src/"), based on [TiddlyWiki](http://tiddlywiki.com/ "http://tiddlywiki.com/").

Downloads and documentation can be found at [SugarCube's website](http://www.motoslave.net/sugarcube/ "http://www.motoslave.net/sugarcube/").

## Feature Highlights ##

- Semantic HTML5 (for the most part, anyway).
- Three modes of operation:
   - **Window History mode:** The default mode.
      - Works with the browser's history, so no more ever growing hash tag (fragment ID).
      - Fully persistent state within a story, even over page reloads.
   - **Session History mode:** A special version of the Window History mode for Firefox.
   - **Hash Tag mode:** The traditional Twine/Twee header mode, which is included largely for compatibility, but authors can choose to force its use over the Window/Session History modes if they desire.
- The ability to easily save your progress, at any point, and revisit it at any time.
- A completely author configurable Share menu, via the ShareMenu passage.
- Twine/Twee tags as classes, on the active passage's container element and the page's `<body>` element.
- Widget macros.  Widgets allow you to create macros by using the standard macros and wiki text that you use normally within your story, so all Twine/Twee users can now create simple macros.
