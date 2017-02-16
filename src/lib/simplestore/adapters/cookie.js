/***********************************************************************************************************************
 *
 * lib/simplestore/adapters/cookie.js
 *
 * Copyright © 2013–2017 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global SimpleStore */

SimpleStore.adapters.push((() => {
	'use strict';

	// Adapter readiness state.
	let _ok = false;


	/*******************************************************************************************************************
	 * _CookieAdapter Class.
	 ******************************************************************************************************************/
	class _CookieAdapter {
		constructor(storageId, persistent) {
			const prefix = `${storageId}${persistent ? '!' : '*'}.`;

			Object.defineProperties(this, {
				_prefix : {
					value : prefix
				},

				_prefixRe : {
					value : new RegExp(`^${RegExp.escape(prefix)}`)
				},

				name : {
					value : 'cookie'
				},

				id : {
					value : storageId
				},

				persistent : {
					value : !!persistent
				}
			});
		}

		/* legacy */
		get length() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.length : Number]`); }

			return this.keys().length;
		}
		/* /legacy */

		size() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.size() : Number]`); }

			return this.keys().length;
		}

		keys() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.keys() : String Array]`); }

			if (document.cookie === '') {
				return [];
			}

			const cookies = document.cookie.split(/;\s*/);
			const keys    = [];

			for (let i = 0; i < cookies.length; ++i) {
				const kvPair = cookies[i].split('=');
				const key    = decodeURIComponent(kvPair[0]);

				if (this._prefixRe.test(key)) {
					/*
						All stored values are serialized and an empty string serializes to a non-empty
						string.  Therefore, receiving an empty string here signifies a deleted value,
						not a serialized empty string, so we should omit such pairs.
					*/
					const value = decodeURIComponent(kvPair[1]);

					if (value !== '') {
						keys.push(key.replace(this._prefixRe, ''));
					}
				}
			}

			return keys;
		}

		has(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.has(key: "${key}") : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			return _CookieAdapter._getCookie(this._prefix + key) !== null;
		}

		get(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.get(key: "${key}") : Any]`); }

			if (typeof key !== 'string' || !key) {
				return null;
			}

			const value = _CookieAdapter._getCookie(this._prefix + key);

			return value === null ? null : _CookieAdapter._deserialize(value);
		}

		set(key, value) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.set(key: "${key}", value: \u2026) : Boolean]`); }

			if (typeof key !== 'string' || !key) {
				return false;
			}

			try {
				_CookieAdapter._setCookie(
					this._prefix + key,
					_CookieAdapter._serialize(value),

					// An undefined expiry denotes a session cookie.
					this.persistent ? 'Tue, 19 Jan 2038 03:14:07 GMT' : undefined
				);

				if (!this.has(key)) {
					throw new Error('unknown validation error during set');
				}
			}
			catch (ex) {
				ex.message = `cookie error: ${ex.message}`;
				throw ex;
			}

			return true;
		}

		delete(key) {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.delete(key: "${key}") : Boolean]`); }

			/*
				Attempting to delete a cookie implies setting it, so we test for its existence
				beforehand, to avoid creating it in the event that it does not already exist.
			*/
			if (typeof key !== 'string' || !key || !this.has(key)) {
				return false;
			}

			try {
				_CookieAdapter._setCookie(
					this._prefix + key,

					// Use `undefined` as the value.
					undefined,

					// Use the epoch as the expiry.
					'Thu, 01 Jan 1970 00:00:00 GMT'
				);

				if (this.has(key)) {
					throw new Error('unknown validation error during delete');
				}
			}
			catch (ex) {
				ex.message = `cookie error: ${ex.message}`;
				throw ex;
			}

			return true;
		}

		clear() {
			if (DEBUG) { console.log(`[<SimpleStore:${this.name}>.clear() : Boolean]`); }

			const keys = this.keys();

			for (let i = 0, iend = keys.length; i < iend; ++i) {
				if (DEBUG) { console.log('\tdeleting key:', keys[i]); }

				this.delete(keys[i]);
			}

			// this.keys().forEach(key => {
			// 	if (DEBUG) { console.log('\tdeleting key:', key); }
			//
			// 	this.delete(key);
			// });

			return true;
		}

		static _getCookie(prefixedKey) {
			if (!prefixedKey || document.cookie === '') {
				return null;
			}

			const cookies = document.cookie.split(/;\s*/);

			for (let i = 0; i < cookies.length; ++i) {
				const kvPair = cookies[i].split('=');
				const key    = decodeURIComponent(kvPair[0]);

				if (prefixedKey === key) {
					const value = decodeURIComponent(kvPair[1]);

					/*
						All stored values are serialized and an empty string serializes to a non-empty
						string.  Therefore, receiving an empty string here signifies a deleted value,
						not a serialized empty string, so we should yield `null` for such pairs.
					*/
					return value || null;
				}
			}

			return null;
		}

		static _setCookie(prefixedKey, value, expiry) {
			if (!prefixedKey) {
				return;
			}

			let payload = `${encodeURIComponent(prefixedKey)}=`;

			if (value != null) { // lazy equality for null
				payload += encodeURIComponent(value);
			}

			if (expiry != null) { // lazy equality for null
				payload += `; ${expiry}`;
			}

			payload += '; path=/';
			document.cookie = payload;
		}

		static _serialize(obj) {
			return LZString.compressToBase64(JSON.stringify(obj));
		}

		static _deserialize(str) {
			return JSON.parse(LZString.decompressFromBase64(str));
		}
	}


	/*******************************************************************************************************************
	 * Adapter Utility Functions.
	 ******************************************************************************************************************/
	function adapterInit(
		// Only used for stores updates.
		storageId
	) {
		// FIXME: We probably should try to test functionality here.
		_ok = 'cookie' in document;

		/* legacy */
		// Attempt to update the cookie stores, if necessary.  This should happen only during initialization.
		if (_ok) {
			_updateCookieStores(storageId);
		}
		/* /legacy */

		return _ok;
	}

	function adapterCreate(storageId, persistent) {
		if (!_ok) {
			throw new Error('adapter not initialized');
		}

		return new _CookieAdapter(storageId, persistent);
	}

	/* legacy */
	// Updates old non-segmented cookie stores into segmented stores.
	function _updateCookieStores(storageId) {
		if (document.cookie === '') {
			return;
		}

		const oldPrefix     = `${storageId}.`;
		const oldPrefixRe   = new RegExp(`^${RegExp.escape(oldPrefix)}`);
		const persistPrefix = `${storageId}!.`;
		const sessionPrefix = `${storageId}*.`;
		const sessionTestRe = /\.(?:state|rcWarn)$/;
		const cookies       = document.cookie.split(/;\s*/);

		for (let i = 0; i < cookies.length; ++i) {
			const kvPair = cookies[i].split('=');
			const key    = decodeURIComponent(kvPair[0]);

			if (oldPrefixRe.test(key)) {
				/*
					All stored values are serialized and an empty string serializes to a non-empty
					string.  Therefore, receiving an empty string here signifies a deleted value,
					not a serialized empty string, so we should skip processing such pairs.
				*/
				const value = decodeURIComponent(kvPair[1]);

				if (value !== '') {
					const persist = !sessionTestRe.test(key);

					// Delete the old k/v pair.
					_CookieAdapter._setCookie(
						key,
						undefined,
						'Thu, 01 Jan 1970 00:00:00 GMT'
					);

					// Set the new k/v pair.
					_CookieAdapter._setCookie(
						key.replace(oldPrefixRe, () => persist ? persistPrefix : sessionPrefix),
						value,
						persist ? 'Tue, 19 Jan 2038 03:14:07 GMT' : undefined
					);
				}
			}
		}
	}
	/* /legacy */


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		init   : { value : adapterInit },
		create : { value : adapterCreate }
	}));
})());
