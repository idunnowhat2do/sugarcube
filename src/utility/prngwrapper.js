/***********************************************************************************************************************
 *
 * utility/prngwrapper.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

/*
	Setup the PRNGWrapper constructor.
*/
function PRNGWrapper(seed, useEntropy) {
	/* eslint-disable no-shadow, new-cap */
	Object.defineProperties(this, new Math.seedrandom(seed, useEntropy, function (prng, seed) {
		return {
			_prng : {
				value : prng
			},
			seed : {
				/*
					TODO: Make this non-writable.
				*/
				writable : true,
				value    : seed
			},
			pull : {
				writable : true,
				value    : 0
			},
			random : {
				value : function () {
					++this.pull;
					return this._prng();
				}
			}
		};
	}));
	/* eslint-enable no-shadow, new-cap */
}

/*
	Setup the PRNGWrapper static methods.
*/
Object.defineProperties(PRNGWrapper, {
	marshal : {
		value : function (prng) {
			if (!prng || !prng.hasOwnProperty("seed") || !prng.hasOwnProperty("pull")) {
				throw new Error("PRNG is missing required data");
			}

			return {
				seed : prng.seed,
				pull : prng.pull
			};
		}
	},

	unmarshal : {
		value : function (prngObj) {
			if (!prngObj || !prngObj.hasOwnProperty("seed") || !prngObj.hasOwnProperty("pull")) {
				throw new Error("PRNG object is missing required data");
			}

			/*
				Create a new PRNG using the original seed and pull values until it has
				reached the original pull count.
			*/
			var prng = new PRNGWrapper(prngObj.seed, false);
			for (var i = prngObj.pull; i > 0; --i) {
				prng.random();
			}

			return prng;
		}
	}
});

