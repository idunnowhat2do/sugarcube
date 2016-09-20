/***********************************************************************************************************************
 *
 * lib/keyvaluestore.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Alert, Has */

var KeyValueStore = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
	 * _WebStorageDriver Class.
	 ******************************************************************************************************************/
	class _WebStorageDriver {
		constructor(persist, storageId) {
			const
				prefix = `${storageId}.`;
			let
				engine = null,
				name   = null;

			if (persist) {
				if (Has.localStorage) {
					engine = window.localStorage;
					name   = 'localStorage';
				}
			}
			else {
				if (Has.sessionStorage) {
					engine = window.sessionStorage;
					name   = 'sessionStorage';
				}
			}

			Object.defineProperties(this, {
				_ok : {
					value : engine !== null
				},

				_engine : {
					value : engine
				},

				_prefix : {
					value : prefix
				},

				_prefixRe : {
					value : new RegExp(`^${RegExp.escape(prefix)}`)
				},

				name : {
					value : name
				},

				id : {
					value : storageId
				},

				persist : {
					value : !!persist
				}
			});
		}

		get length() {
			/*
				NOTE: DO NOT do something like `return this._engine.length;` here, as that will
				      return the length of the entire store, rather than just our prefixed keys.
			*/
			return this.keys().length;
		}

		keys() {
			if (!this._ok) {
				return [];
			}

			const keys = [];

			for (let i = 0; i < this._engine.length; ++i) {
				const key = this._engine.key(i);

				if (this._prefixRe.test(key)) {
					keys.push(key.replace(this._prefixRe, ''));
				}
			}

			return keys;
		}

		has(key) {
			if (!key || !this._ok) {
				return false;
			}

			// TODO: We probably should be checking keys here.
			return this._engine.getItem(this._prefix + key) != null; // lazy equality for null
		}

		get(key) {
			if (!key || !this._ok) {
				return null;
			}

			const value = this._engine.getItem(this._prefix + key);

			if (value == null) { // lazy equality for null
				return null;
			}

			return _WebStorageDriver._deserialize(value);
		}

		set(key, value) {
			if (!key || !this._ok) {
				return false;
			}

			try {
				this._engine.setItem(this._prefix + key, _WebStorageDriver._serialize(value));
			}
			catch (ex) {
				/*
					Massage the quota exceeded error—the most likely error—into something
					a bit nicer for the player.

					Ideally, we could simply do:
						ex.code === 22
					Or, preferably, something like:
						ex.code === DOMException.QUOTA_EXCEEDED_ERR
					However, both of those are browser convention, not part of the standard,
					and are not supported in all browsers.  So, we have to resort to pattern
					matching the damn name.  I hate the parties responsible for this snafu
					so much.
				*/
				if (/quota_?(?:exceeded|reached)/i.test(ex.name)) {
					ex.message = `${this.name} quota exceeded`;
				}

				throw ex;
			}

			return true;
		}

		delete(key) {
			if (!key || !this._ok) {
				return false;
			}

			this._engine.removeItem(this._prefix + key);

			return true;
		}

		static _serialize(obj) {
			return LZString.compressToUTF16(JSON.stringify(obj));
		}

		static _deserialize(str) {
			return JSON.parse(LZString.decompressFromUTF16(str));
		}
	}


	/*******************************************************************************************************************
	 * _CookieDriver Class.
	 ******************************************************************************************************************/
	class _CookieDriver {
		constructor(persist, storageId) {
			const
				prefix = `${storageId}.`;

			Object.defineProperties(this, {
				_ok : {
					// TODO: We probably should try to test cookie functionality here.
					value : 'cookie' in document
				},

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

				persist : {
					value : !!persist
				}
			});
		}

		get length() {
			return this.keys().length;
		}

		keys() {
			if (!this._ok) {
				return [];
			}

			return Object.keys(this._getAllCookies());
		}

		has(key) {
			if (!key || !this._ok) {
				return false;
			}

			return this._getCookie(this._prefix + key) !== null;
		}

		get(key) {
			if (!key || !this._ok) {
				return null;
			}

			const value = this._getCookie(this._prefix + key);

			if (value === null) {
				return null;
			}

			return _CookieDriver._deserialize(value);
		}

		set(key, value) {
			if (!key || !this._ok) {
				return false;
			}

			try {
				this._setCookie(
					this._prefix + key,
					_CookieDriver._serialize(value),

					// An undefined expiry denotes a session cookie.
					this.persist ? 'Tue, 19 Jan 2038 03:14:07 GMT' : undefined
				);

				if (!this.has(key)) {
					throw new Error('unknown validation error');
				}
			}
			catch (ex) {
				ex.message = `cookie error: ${ex.message}`;
				throw ex;
			}

			return true;
		}

		delete(key) {
			/*
				Attempting to delete a cookie implies setting it, so we test for its existence
				beforehand, to avoid creating it in the event that it does not already exist.
			*/
			if (!key || !this._ok || !this.has(key)) {
				return false;
			}

			try {
				this._setCookie(
					this._prefix + key,

					// Use `undefined` as the value.
					undefined,

					// Use the epoch as the expiry.
					'Thu, 01 Jan 1970 00:00:00 GMT'
				);

				if (this.has(key)) {
					throw new Error('unknown validation error');
				}
			}
			catch (ex) {
				ex.message = `cookie error: ${ex.message}`;
				throw ex;
			}

			return true;
		}

		_getAllCookies() {
			if (!this._ok || document.cookie === '') {
				return {};
			}

			const
				cookies   = document.cookie.split(/;\s*/),
				cookieObj = {};

			for (let i = 0; i < cookies.length; ++i) {
				const
					kvPair    = cookies[i].split('='),
					cookieKey = decodeURIComponent(kvPair[0]);

				if (this._prefixRe.test(cookieKey)) {
					const value = decodeURIComponent(kvPair[1]);

					/*
						All stored values are serialized and an empty string serializes to a non-empty
						string.  Therefore, receiving an empty string here signifies a deleted value,
						not a serialized empty string, so we should yield `null` for that case.
					*/
					// cookieObj[cookieKey] = value !== '' ? value : null;
					cookieObj[cookieKey] = value || null;
				}
			}

			return cookieObj;
		}

		_getCookie(prefixedKey) {
			if (!prefixedKey || !this._ok || document.cookie === '') {
				return null;
			}

			const cookies = document.cookie.split(/;\s*/);

			for (let i = 0; i < cookies.length; ++i) {
				const
					kvPair    = cookies[i].split('='),
					cookieKey = decodeURIComponent(kvPair[0]);

				if (prefixedKey === cookieKey) {
					const value = decodeURIComponent(kvPair[1]);

					/*
						All stored values are serialized and an empty string serializes to a non-empty
						string.  Therefore, receiving an empty string here signifies a deleted value,
						not a serialized empty string, so we should yield `null` for that case.
					*/
					// return value !== '' ? value : null;
					return value || null;
				}
			}

			return null;
		}

		_setCookie(prefixedKey, value, expiry) {
			if (!prefixedKey || !this._ok) {
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
	 * KeyValueStore Class.
	 ******************************************************************************************************************/
	class KeyValueStore {
		constructor(driverType, persist, storageId) {
			let driver = null;

			switch (driverType) {
			case 'cookie':
				driver = new _CookieDriver(persist, storageId);
				break;

			case 'webStorage':
				driver = new _WebStorageDriver(persist, storageId);

				if (!driver._ok) {
					// Fallback to cookies.  Perhaps, this should be handled externally?
					driver = new _CookieDriver(persist, storageId);
				}
				break;

			default:
				throw new Error('unknown driver type');
			}

			if (!driver._ok) {
				throw new Error('unknown driver error');
			}

			Object.defineProperties(this, {
				_driver : {
					value : driver
				},

				name : {
					value : driver.name
				},

				type : {
					value : driverType
				},

				id : {
					value : storageId
				},

				persist : {
					value : persist
				}
			});
		}

		get length() {
			if (DEBUG) { console.log('[<KeyValueStore>.length]'); }

			if (this._driver === null) {
				return 0;
			}

			return this._driver.length;
		}

		keys() {
			if (DEBUG) { console.log('[<KeyValueStore>.keys()]'); }

			if (this._driver === null) {
				return [];
			}

			return this._driver.keys();
		}

		clear() {
			if (DEBUG) { console.log('[<KeyValueStore>.clear()]'); }

			if (this._driver === null) {
				return false;
			}

			const keys = this.keys();

			for (let i = 0; i < keys.length; ++i) {
				if (DEBUG) { console.log('\tdeleting key:', keys[i]); }

				this.delete(keys[i]);
			}

			return true;
		}

		has(key, quiet) {
			if (DEBUG) { console.log(`[<KeyValueStore>.has(key: "${key}", quiet: "${quiet}")]`); }

			if (this._driver === null || !key) {
				return false;
			}

			try {
				return this._driver.has(key);
			}
			catch (ex) {
				if (!quiet) {
					Alert.error(null, `unable to check key "${key}"; ${ex.message}`, ex);
				}

				return false;
			}
		}

		get(key, quiet) {
			if (DEBUG) { console.log(`[<KeyValueStore>.get(key: "${key}", quiet: "${quiet}")]`); }

			if (this._driver === null || !key) {
				return null;
			}

			try {
				return this._driver.get(key);
			}
			catch (ex) {
				if (!quiet) {
					Alert.error(null, `unable to get key "${key}"; ${ex.message}`, ex);
				}

				return null;
			}
		}

		set(key, value, quiet) {
			if (DEBUG) { console.log(`[<KeyValueStore>.set(key: "${key}", value: \u2026, quiet: "${quiet}")]`); }

			if (this._driver === null || !key) {
				return false;
			}

			try {
				return this._driver.set(key, value, quiet);
			}
			catch (ex) {
				if (!quiet) {
					Alert.error(null, `unable to set key "${key}"; ${ex.message}`, ex);
				}

				return false;
			}
		}

		delete(key, quiet) {
			if (DEBUG) { console.log(`[<KeyValueStore>.delete(key: "${key}", quiet: "${quiet}")]`); }

			if (this._driver === null || !key) {
				return false;
			}

			try {
				return this._driver.delete(key, quiet);
			}
			catch (ex) {
				if (!quiet) {
					Alert.error(null, `unable to delete key "${key}"; ${ex.message}`, ex);
				}

				return false;
			}
		}

		deleteMatching(subKey, quiet) {
			if (DEBUG) { console.log(`[<KeyValueStore>.deleteMatching(subKey: "${subKey}", quiet: "${quiet}")]`); }

			if (this._driver === null || !subKey) {
				return false;
			}

			const
				keys = this.keys(),
				re   = new RegExp(`^${RegExp.escape(subKey)}`);

			for (let i = 0; i < keys.length; ++i) {
				if (re.test(keys[i])) {
					if (DEBUG) { console.log('\tdeleting key:', keys[i]); }

					this.delete(keys[i], quiet);
				}
			}

			return true;
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return KeyValueStore;
})();
