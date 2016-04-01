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
				DO NOT do something like `return this._engine.length;` as that will return
				the length of the entire store, rather than just our prefixed keys.
			*/
			return this.keys().length;
		}

		keys() {
			if (this._engine === null) {
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
			if (this._engine === null || !key) {
				return false;
			}

			// We really should be checking keys here.
			return this._engine.getItem(this._prefix + key) != null; // lazy equality for null
		}

		get(key) {
			if (this._engine === null || !key) {
				return null;
			}

			return this._engine.getItem(this._prefix + key);
		}

		set(key, value, quiet) {
			if (this._engine === null || !key) {
				return false;
			}

			try {
				this._engine.setItem(this._prefix + key, value);
			}
			catch (e) {
				/*
					Ideally, we could simply do:
						e.code === 22
					Or, preferably, something like:
						e.code === DOMException.QUOTA_EXCEEDED_ERR
					However, both of those are browser convention, not part of the standard,
					and are not supported in all browsers.  So, we have to resort to pattern
					matching the damn name.  I hate the parties responsible for this snafu
					so much.
				*/
				if (!quiet) {
					const error = /quota_?(?:exceeded|reached)/i.test(e.name)
						? `${this.name} quota exceeded`
						: 'unknown error';
					Alert.error(null, `unable to set key "${key}"; ${error}`, e);
				}

				return false;
			}
			return true;
		}

		delete(key) {
			if (this._engine === null || !key) {
				return false;
			}

			this._engine.removeItem(this._prefix + key);
			return true;
		}

		serialize(obj) {
			return LZString.compressToUTF16(JSON.stringify(obj));
		}

		deserialize(str) {
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
					value : 'cookie' in document // should really try to test cookie functionality
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
			return Object.keys(this._getCookies());
		}

		has(key) {
			if (!key) {
				return false;
			}

			return this._getCookies().hasOwnProperty(this._prefix + key);
		}

		get(key) {
			if (!key) {
				return null;
			}

			const
				cookies = this._getCookies(),
				pKey    = this._prefix + key;

			if (cookies.hasOwnProperty(pKey)) {
				return cookies[pKey];
			}

			return null;
		}

		set(key, value, quiet) {
			if (!key) {
				return false;
			}

			try {
				// Undefined expiry means a session cookie.
				this._setCookie(key, value, this.persist ? 'Tue, 19 Jan 2038 03:14:07 GMT' : undefined);
			}
			catch (e) {
				if (!quiet) {
					Alert.error(null, `unable to set key "${key}"; cookie error: ${e.message}`, e);
				}

				return false;
			}

			if (!this.has(key)) {
				if (!quiet) {
					Alert.error(null, `unable to set key "${key}"; unknown cookie error`);
				}

				return false;
			}

			return true;
		}

		delete(key, quiet) {
			if (!key) {
				return false;
			}

			try {
				this._setCookie(key, undefined, 'Thu, 01 Jan 1970 00:00:00 GMT');
			}
			catch (e) {
				if (!quiet) {
					Alert.error(null, `unable to delete key "${key}"; cookie error: ${e.message}`, e);
				}

				return false;
			}

			// It seems like we cannot simply use `.has()` here for validation because of IE shenanigans?
			// if (this.has(key)) {
			const test = this.get(key);
			if (test !== null && test !== '') {
				if (!quiet) {
					Alert.error(null, `unable to delete key "${key}"; unknown cookie error`);
				}

				return false;
			}

			return true;
		}

		serialize(obj) {
			return LZString.compressToBase64(JSON.stringify(obj));
		}

		deserialize(str) {
			return JSON.parse(LZString.decompressFromBase64(str));
		}

		_getCookies() {
			const cookieObj = {};

			if ('cookie' in document && document.cookie !== '') {
				const cookies = document.cookie.split(/;\s*/);

				for (let i = 0; i < cookies.length; ++i) {
					const
						kv  = cookies[i].split('='),
						key = decodeURIComponent(kv[0]);

					if (this._prefixRe.test(key)) {
						cookieObj[key] = decodeURIComponent(kv[1]);
					}
				}
			}

			return cookieObj;
		}

		_setCookie(key, value, expiry) {
			if ('cookie' in document) {
				let payload = `${encodeURIComponent(this._prefix + key)}=`;

				if (value != null) { // lazy equality for null
					payload += encodeURIComponent(value);
				}

				if (expiry != null) { // lazy equality for null
					payload += `; ${expiry}`;
				}

				payload += '; path=/';
				document.cookie = payload;
			}
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
			if (this._driver === null) {
				return 0;
			}

			if (DEBUG) { console.log('[<KeyValueStore>.length]'); }

			return this._driver.length;
		}

		keys() {
			if (this._driver === null) {
				return [];
			}

			if (DEBUG) { console.log('[<KeyValueStore>.keys()]'); }

			return this._driver.keys();
		}

		clear() {
			if (this._driver === null) {
				return false;
			}

			if (DEBUG) { console.log('[<KeyValueStore>.clear()]'); }

			const keys = this.keys();

			for (let i = 0; i < keys.length; ++i) {
				if (DEBUG) { console.log('\tdeleting key:', keys[i]); }

				this.delete(keys[i]);
			}

			return true;
		}

		has(key) {
			if (this._driver === null || !key) {
				return false;
			}

			if (DEBUG) { console.log(`[<KeyValueStore>.has(key: "${key}")]`); }

			return this._driver.has(key);
		}

		get(key) {
			if (this._driver === null || !key) {
				return null;
			}

			if (DEBUG) { console.log(`[<KeyValueStore>.get(key: "${key}")]`); }

			const value = this._driver.get(key);

			if (value == null) { // lazy equality for null
				return null;
			}

			return this._driver.deserialize(value);
		}

		set(key, value, quiet) {
			if (this._driver === null || !key) {
				return false;
			}

			if (DEBUG) { console.log(`[<KeyValueStore>.set(key: "${key}")]`); }

			return this._driver.set(key, this._driver.serialize(value), quiet);
		}

		delete(key, quiet) {
			if (this._driver === null || !key) {
				return false;
			}

			if (DEBUG) { console.log(`[<KeyValueStore>.delete(key: "${key}")]`); }

			return this._driver.delete(key, quiet);
		}

		deleteMatching(subKey, quiet) {
			if (this._driver === null || !subKey) {
				return false;
			}

			if (DEBUG) { console.log(`[<KeyValueStore>.deleteMatching(subKey: "${subKey}")]`); }

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
