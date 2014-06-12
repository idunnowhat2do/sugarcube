/***********************************************************************************************************************
** [Begin macros.js]
***********************************************************************************************************************/

/***********************************************************************************************************************
** [Macro API]
***********************************************************************************************************************/
function Macros() {
	// protect the Macros API object's properties and return it
	//   n.b. we can't use Object.freeze() here because we still have to support old-style macros
	return Object.defineProperties({}, {
		// data properties
		definitions: {
			value: {}
		},

		tags: {
			value: {}
		},

		// method properties
		add: {
			value: function (name, def, deep) {
				if (Array.isArray(name)) {
					name.forEach(function (n) { this.add(n, def, deep); }, this);
					return;
				}

				if (this.has(name)) {
					throw new Error("cannot clobber existing macro <<" + name + ">>");
				} else if (this.tags.hasOwnProperty(name)) {
					throw new Error("cannot clobber child tag <<" + name + ">> of parent macro"
						+ (this.tags[name].length === 1 ? '' : 's') + " <<" + this.tags[name].join(">>, <<") + ">>");
				}

				try {
					if (typeof def === "object") {
						// add the macro definition
						this.definitions[name] = deep ? clone(def) : def;
					} else {
						// add the macro alias
						if (this.has(def)) {
							this.definitions[name] = deep ? clone(this.definitions[def]) : this.definitions[def];
						} else {
							throw new Error("cannot create alias of nonexistent macro <<" + def + ">>");
						}
					}
					Object.defineProperty(this.definitions, name, { writable: false });

					/* legacy kludges */
					this.definitions[name]["_USE_MACROS_API"] = true;
					/* /legacy kludges */
				} catch (e) {
					if (e.name === "TypeError") {
						throw new Error("cannot clobber protected macro <<" + name + ">>");
					} else {
						throw new Error("unknown error when attempting to add macro <<" + name + ">>: [" + e.name + "] " + e.message);
					}
				}

				// tags post-processing
				if (this.definitions[name].hasOwnProperty("tags")) {
					if (this.definitions[name].tags == null) {
						this.registerTags(name);
					} else if (Array.isArray(this.definitions[name].tags)) {
						this.registerTags(name, this.definitions[name].tags);
					} else {
						throw new Error('bad value for "tags" property of macro <<' + name + ">>");
					}
				}
			}
		},

		remove: {
			value: function (name) {
				if (Array.isArray(name)) {
					name.forEach(function (n) { this.remove(n); }, this);
					return;
				}

				if (this.definitions.hasOwnProperty(name)) {
					// tags pre-processing
					if (this.definitions[name].hasOwnProperty("tags")) {
						this.unregisterTags(name);
					}

					try {
						// remove the macro definition
						Object.defineProperty(this.definitions, name, { writable: true });
						delete this.definitions[name];
					} catch (e) {
						throw new Error("unknown error removing macro <<" + name + ">>: " + e.message);
					}
				} else if (this.tags.hasOwnProperty(name)) {
					throw new Error("cannot remove child tag <<" + name + ">> of parent macro <<" + this.tags[name] + ">>");
				}
			}
		},

		has: {
			value: function (name, searchTags) {
				return this.definitions.hasOwnProperty(name) || (searchTags && this.tags.hasOwnProperty(name));
			}
		},

		get: {
			value: function (name) {
				var macro = null;

				if (this.definitions.hasOwnProperty(name) && typeof this.definitions[name]["handler"] === "function") {
					macro = this.definitions[name];
				} else if (this.hasOwnProperty(name) && typeof this[name]["handler"] === "function") {
					macro = this[name];
				}
				return macro;
			}
		},

		getHandler: {
			value: function (name, handler) {
				var macro = this.get(name);

				if (!handler) { handler = "handler"; }
				return (macro && macro.hasOwnProperty(handler) && typeof macro[handler] === "function") ? macro[handler] : null;
			}
		},

		evalStatements: {
			value: function (statements, thisp) {
				"use strict";
				try {
					eval((thisp == null)  /* use lazy equality */
						? 'var output = document.createElement("div");(function(){' + statements + '\n}());'
						: "var output = thisp.output;(function(){" + statements + "\n}.call(thisp));");
					return true;
				} catch (e) {
					if (thisp == null) {  // use lazy equality
						throw e;
					}
					return thisp.error("bad evaluation: " + e.message);
				}
			}
		},

		registerTags: {
			value: function (parent, bodyTags) {
				if (!parent) { throw new Error("no parent specified"); }

				if (!Array.isArray(bodyTags)) { bodyTags = []; }

				var endTags = [ "/" + parent, "end" + parent ],  // automatically create the closing tags
					allTags = [].concat(endTags, bodyTags);

				for (var i = 0; i < allTags.length; i++) {
					var tag = allTags[i];
					if (this.definitions.hasOwnProperty(tag)) {
						throw new Error("cannot register tag for an existing macro");
					}
					if (this.tags.hasOwnProperty(tag)) {
						if (!this.tags[tag].contains(parent)) {
							this.tags[tag].push(parent);
							this.tags[tag].sort();
						}
					} else {
						this.tags[tag] = [ parent ];
					}
				}
			}
		},

		unregisterTags: {
			value: function (parent) {
				if (!parent) { throw new Error("no parent specified"); }

				for (var tag in this.tags) {
					var i = this.tags[tag].indexOf(parent);
					if (i !== -1) {
						if (this.tags[tag].length === 1) {
							delete this.tags[tag];
						} else {
							this.tags[tag].splice(i, 1);
						}
					}
				}
			}
		},

		init: {
			value: function () {
				for (var name in this.definitions) {
					var fn = this.getHandler(name, "init");
					if (fn) { fn.call(this.definitions[name], name); }
				}
				/* legacy kludges */
				for (var name in this) {
					var fn = this.getHandler(name, "init");
					if (fn) { fn.call(this[name], name); }
				}
				/* /legacy kludges */
			}
		},

		lateInit: {
			value: function () {
				for (var name in this.definitions) {
					var fn = this.getHandler(name, "lateInit");
					if (fn) { fn.call(this.definitions[name], name); }
				}
				/* legacy kludges */
				for (var name in this) {
					var fn = this.getHandler(name, "lateInit");
					if (fn) { fn.call(this[name], name); }
				}
				/* /legacy kludges */
			}
		}
	});
}


/***********************************************************************************************************************
** [End macros.js]
***********************************************************************************************************************/
