
# SugarCube #

A header for [Twine/Twee](http://gimcrackd.com/etc/src/ "http://gimcrackd.com/etc/src/"), based on [TiddlyWiki](http://tiddlywiki.com/ "http://tiddlywiki.com/").

Downloads and documentation can be found at [SugarCube's website](http://www.motoslave.net/sugarcube/ "http://www.motoslave.net/sugarcube/").

## Feature Highlights ##

- Semantic HTML5 (for the most part, anyway).
- Two modes of operation:
   - **Window History mode:** The default mode.
      - Works with the browser's history, so no more ever growing hash tag (fragment ID).
      - Fully persistent state within a story, even over page reloads.
      - The ability to easily save your progress, within the browser, at any point and revisit it at any time.
      - The Rewind menu allows you to jump to any bookmarked passage in your current history, forward or back.
   - **Hash Tag mode:** The traditional Twine/Twee header mode, which is included largely for compatibility, but authors can choose to force its use over Window History mode if they desire.  Additionally, SugarCube's version benefits from the save system created for Window History mode.
      - The ability to easily save your progress, within the browser, at any point and revisit it at any time.
- ShareMenu passage.  The shareMenu is now easily user configurable.  During startup a passage named ShareMenu is searched for, if it exists, and is non-empty, the share menu menu will be built and stored in the shareMenu element, then the share menu item will be displayed.  The default share menu has been completely removed as a result.
- Tags as classes.  When displaying a passage, Twine/Twee tags on the passage are added to the passage's container element and the page's `<body>` element as CSS classes.  Special tag names such as "script", "stylesheet", "twine.*", and "widget" are excluded from this mapping (as an exception, "bookmark" is not excluded).
- Widget macros.  Widgets allow you to create macros by using the standard macros and wiki text that you use normally within your story, so all Twine/Twee users can now create simple macros.
