/***********************************************************************************************************************
 *
 * lib/audiowrapper.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Has, Util, clone */

var AudioWrapper = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const
		// Events supported by the `on()`, `one()`, and `off()` methods.
		_events = Object.freeze({
			canplay : 'canplaythrough',
			end     : 'ended',
			error   : 'error',
			fade    : 'aw:fade',
			pause   : 'pause',
			play    : 'playing',
			rate    : 'ratechange',
			seek    : 'seeked',
			stop    : 'aw:stop',
			volume  : 'volumechange'
		});


	/*******************************************************************************************************************
	 * AudioWrapper Class.
	 ******************************************************************************************************************/
	/*
		n.b. The various data constants (e.g. for comparison to `readyState` or `networkState`)
			 are not defined by all browsers on the descendant elements `HTMLAudioElement` and
			 `HTMLVideoElement` (notably, IE/Edge do not).  Therefore, the base media element,
			 `HTMLMediaElement`, must be used to reference the constants.
	*/
	class AudioWrapper {
		constructor(obj) {
			if (Array.isArray(obj)) {
				this._create(obj);
			}
			else if (obj instanceof AudioWrapper) {
				this._copy(obj);
			}
			else {
				throw new Error('sources parameter must be an array of either URLs or source objects');
			}
		}

		_create(sourceList) {
			if (!Array.isArray(sourceList) || sourceList.length === 0) {
				throw new Error('sources parameter must be an array of either URLs or source objects');
			}

			const
				dataUrlRe   = /^data:\s*audio\/([^;,]+)\s*[;,]/i,
				extRe       = /\.([^\.\/\\]+)$/,
				getType     = AudioWrapper.getType,
				usedSources = [],
				// sourceElems = document.createDocumentFragment(),
				/*
					HTMLAudioElement: DOM factory method vs. constructor

					Use of the DOM factory method, `document.createElement('audio')`, should be
					preferred over use of the constructor, `new Audio()`.  The reason being that
					objects created by the latter are, erroneously, treated differently, often
					unfavorably, by certain browser engines—e.g. within some versions of the iOS
					browser core.

					Notably, the only difference between the two, per the specification, is that
					objects created via the constructor should have their `preload` property
					automatically set to 'auto'.  Thus, there's no technical reason to prefer
					usage of the constructor, even discounting buggy browser implementations.
				*/
				audio = document.createElement('audio');

			// Process the given array of sources.
			sourceList.forEach(src => {
				let srcObj = null;

				switch (typeof src) {
				case 'string':
					{
						let match;

						if (src.slice(0, 5) === 'data:') {
							match = dataUrlRe.exec(src);

							if (match === null) {
								throw new Error('source data URI missing media type');
							}
						}
						else {
							match = extRe.exec(Util.parseUrl(src).pathname);

							if (match === null) {
								throw new Error('source URL missing file extension');
							}
						}

						const type = getType(match[1]);

						if (type !== null) {
							srcObj = { src, type };
						}
					}
					break;

				case 'object':
					{
						if (src === null) {
							throw new Error('source object cannot be null');
						}
						else if (!src.hasOwnProperty('src')) {
							throw new Error('source object missing required "src" property');
						}
						else if (!src.hasOwnProperty('format')) {
							throw new Error('source object missing required "format" property');
						}

						const type = getType(src.format);

						if (type !== null) {
							srcObj = { src : src.src, type };
						}
					}
					break;

				default:
					throw new Error(`invalid source value (type: ${typeof src})`);
				}

				if (srcObj !== null) {
					const source = document.createElement('source');
					source.src  = srcObj.src;
					source.type = srcObj.type;
					audio.appendChild(source);
					// sourceElems.appendChild(source);
					usedSources.push(srcObj);
				}
			});

			// if (sourceElems.hasChildNodes()) {
			// 	audio.appendChild(sourceElems);
			// }

			this._finalize(audio, usedSources, clone(sourceList));
		}

		_copy(original) {
			if (!(original instanceof AudioWrapper)) {
				throw new Error('original parameter must be an instance of AudioWrapper');
			}

			this._finalize(
				original.audio.cloneNode(true),
				clone(original.sources),
				clone(original.originalSources)
			);
		}

		_finalize(audio, sources, originalSources) {
			// Setup our own properties.
			Object.defineProperties(this, {
				audio : {
					value : audio
				},

				sources : {
					value : Object.freeze(sources)
				},

				originalSources : {
					value : Object.freeze(originalSources)
				},

				_sourceError : {
					writable : true,
					value    : false
				},

				_faderId : {
					writable : true,
					value    : null
				}
			});

			/*
				Set `_sourceError` to true and trigger an `error` event on the audio element
				upon receiving an `error` event on the final source element (if any)—the latter
				is necessary since the source `error` event does not bubble.
			*/
			if (this.audio.hasChildNodes()) {
				jQuery(this.audio.childNodes[this.audio.childNodes.length - 1])
					.on('error', () => {
						this._sourceError = true;
						this._trigger('error');
					});
			}

			// Set `_sourceError` to false upon receiving any `loadstart` events.
			jQuery(this.audio).on('loadstart', () => this._sourceError = false);

			// Finally, attempt to preload the audio.
			this.load();
		}

		_trigger(eventName) {
			// Do not use `trigger()` here as we do not want these events to bubble.
			jQuery(this.audio).triggerHandler(eventName);
		}

		clone() {
			return new AudioWrapper(this);
		}

		get duration() {
			// n.b. May return a double (normally), Infinity (for streams), or NaN (without metadata).
			return this.audio.duration;
		}

		get rate() {
			return this.audio.playbackRate;
		}
		set rate(playRate) {
			/*
				Clamp the playback rate to sane values—some browsers also do this to varying degrees.

				n.b. The specification allows negative values for backwards playback, however, most
				     browsers (as of Aug 2016) either completely ignore negative values or clamp them
				     to some positive value.  In some (notably, IE/Edge), setting a negative playback
				     rate breaks the associated controls, if they're being displayed.
			*/
			/*
			this.audio.playbackRate = playRate < 0
				? Math.clamp(playRate, -0.2, -5) // clamp to 5× slower & faster, backward
				: Math.clamp(playRate, 0.2, 5);  // clamp to 5× slower & faster, forward
			*/
			this.audio.playbackRate = Math.clamp(playRate, 0.2, 5); // clamp to 5× slower & faster
		}

		get remaining() {
			// n.b. May return a double (normally), Infinity (for streams), or NaN (without metadata).
			return this.audio.duration - this.audio.currentTime;
		}

		get time() {
			return this.audio.currentTime;
		}
		set time(time) {
			/*
				This workaround is no longer strictly necessary in most browsers (as of 2016),
				however, it will still be required for some time to service legacy browsers.

				If we try to modify the audio clip's `.currentTime` property before its metadata
				has been loaded, it will throw an `InvalidStateError` (since it doesn't know its
				duration, allowing `.currentTime` to be set would be undefined behavior), so in
				case an exception is thrown we provide a fallback using the `loadedmetadata` event.
			*/
			try {
				this.audio.currentTime = time;
			}
			catch (e) {
				jQuery(this.audio)
					.off('loadedmetadata.AudioWrapper:time')
					.one('loadedmetadata.AudioWrapper:time', () => this.audio.currentTime = time);
			}
		}

		get volume() {
			return this.audio.volume;
		}
		set volume(vol) {
			this.audio.volume = Math.clamp(vol, 0, 1); // clamp to 0 (silent) & 1 (full loudness)
		}

		hasSource() {
			return this.sources.length > 0;
		}

		hasNoData() {
			return this.audio.readyState === HTMLMediaElement.HAVE_NOTHING;
		}

		hasMetadata() {
			return this.audio.readyState >= HTMLMediaElement.HAVE_METADATA;
		}

		hasSomeData() {
			return this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
		}

		hasData() {
			return this.audio.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA;
		}

		isFailed() {
			return this._sourceError;
		}

		isLoading() {
			return this.audio.networkState === HTMLMediaElement.NETWORK_LOADING;
		}

		isPlaying() {
			return !(this.audio.ended || this.audio.paused || !this.hasSomeData());
		}

		isEnded() {
			return this.audio.ended;
		}

		isPaused() {
			return this.audio.paused;
		}

		isMuted() {
			return this.audio.muted;
		}

		isLooped() {
			return this.audio.loop;
		}

		load() {
			if (this.audio.preload !== 'auto') {
				this.audio.preload = 'auto';
			}

			if (!this.isLoading()) {
				this.audio.load();
			}
		}

		play() {
			if (!this.hasData()) {
				this.load();
			}

			this.audio.play();
		}

		pause() {
			this.audio.pause();
		}

		stop() {
			this.audio.pause();
			this.time = 0;
			this._trigger('aw:stop');
		}

		mute() {
			this.audio.muted = true;
		}

		unmute() {
			this.audio.muted = false;
		}

		loop() {
			this.audio.loop = true;
		}

		unloop() {
			this.audio.loop = false;
		}

		fadeWithDuration(fadeDuration, toVol, fromVol) {
			if (this._faderId !== null) {
				clearInterval(this._faderId);
				this._faderId = null;
			}

			const
				from = Math.clamp(fromVol == null ? this.volume : fromVol, 0, 1), // lazy equality for null
				to   = Math.clamp(toVol, 0, 1);

			if (from === to) {
				return;
			}

			this.volume = from;

			/*
				We listen for the `timeupdate` event here, rather than `playing`, because
				various browsers (notably, mobile browsers) are poor at firing media events
				in a timely fashion, so we use `timeupdate` to ensure that we don't start
				the fade until the track is actually progressing.
			*/
			jQuery(this.audio)
				.off('timeupdate.AudioWrapper:fadeWithDuration')
				.one('timeupdate.AudioWrapper:fadeWithDuration', () => {
					let min, max;

					if (from < to) {
						// Fade in.
						min = from;
						max = to;
					}
					else {
						// Fade out.
						min = to;
						max = from;
					}

					const
						duration = Math.clamp(fadeDuration, 1, this.remaining),
						interval = 25, // in milliseconds
						delta    = (to - from) / (duration / (interval / 1000));

					this._faderId = setInterval(() => {
						if (!this.isPlaying()) {
							clearInterval(this._faderId);
							this._faderId = null;
							return;
						}

						this.volume = Math.clamp(this.volume + delta, min, max);

						if (this.volume === 0) {
							this.pause();
						}

						if (this.volume === to) {
							clearInterval(this._faderId);
							this._faderId = null;
							this._trigger('aw:fade');
						}
					}, interval);
				});

			this.play();
		}

		fade(toVol, fromVol) {
			this.fadeWithDuration(5, toVol, fromVol);
		}

		fadeIn() {
			this.fade(1);
		}

		fadeOut() {
			this.fade(0);
		}

		on(eventNames, listener) {
			if (typeof listener !== 'function') {
				throw new Error('listener parameter must be a function');
			}

			const events = eventNames.trim().splitOrEmpty(/\s+/)
				.map(nameAndNS => {
					const name = nameAndNS.split('.', 1)[0];

					if (!_events.hasOwnProperty(name)) {
						throw new Error(`unknown event "${name}"; valid: ${Object.keys(_events).join(', ')}`);
					}

					return `${nameAndNS.replace(name, _events[name])}.AudioWrapperEvent`;
				})
				.join(' ');

			if (events === '') {
				throw new Error(`invalid eventNames parameter "${eventNames}"`);
			}

			jQuery(this.audio).on(events, listener);
			return this;
		}

		one(eventNames, listener) {
			if (typeof listener !== 'function') {
				throw new Error('listener parameter must be a function');
			}

			const events = eventNames.trim().splitOrEmpty(/\s+/)
				.map(nameAndNS => {
					const name = nameAndNS.split('.', 1)[0];

					if (!_events.hasOwnProperty(name)) {
						throw new Error(`unknown event "${name}"; valid: ${Object.keys(_events).join(', ')}`);
					}

					return `${nameAndNS.replace(name, _events[name])}.AudioWrapperEvent`;
				})
				.join(' ');

			if (events === '') {
				throw new Error(`invalid eventNames parameter "${eventNames}"`);
			}

			jQuery(this.audio).one(events, listener);
			return this;
		}

		off(eventNames, listener) {
			if (listener && typeof listener !== 'function') {
				throw new Error('listener parameter must be a function');
			}

			if (!eventNames) {
				return jQuery(this.audio).off('.AudioWrapperEvent', listener);
			}
			else {
				const events = eventNames.trim().splitOrEmpty(/\s+/)
					.map(nameAndNS => {
						const name = nameAndNS.split('.', 1)[0];

						if (name) {
							if (!_events.hasOwnProperty(name)) {
								throw new Error(`unknown event "${name}"; valid: ${Object.keys(_events).join(', ')}`);
							}

							return `${nameAndNS.replace(name, _events[name])}.AudioWrapperEvent`;
						}
						else {
							return `${nameAndNS}.AudioWrapperEvent`;
						}
					})
					.join(' ');

				if (events === '') {
					throw new Error(`invalid eventNames parameter "${eventNames}"`);
				}

				jQuery(this.audio).off(events, listener);
				return this;
			}
		}
	}

	// Static data members and methods.
	Object.defineProperties(AudioWrapper, {
		/*
			Format-ID to MIME-type mappings for common audio types.

			In most cases, the codecs property should not be included with the MIME-type,
			as we have no way of knowing which codec was used—and the browser will figure
			it out.  Conversely, in cases where the relationship relationship between a
			format-ID and a specific codec is strong, we should include the codecs property.

			Caveats by browser:
				Opera (Presto) will return a false-negative if the codecs value is quoted
				with single quotes, requiring the use of either double quotes or no quotes.

				Blink-based browsers (e.g. Chrome, Opera ≥15) will return a false-negative
				for WAVE audio if the preferred MIME-type of 'audio/wave' is specified,
				requiring the use of 'audio/wav' instead.
		*/
		formats : {
			value : { // Leave this object extensible for users.
				// AAC — MPEG-2 AAC audio; specific profiles vary, but commonly "AAC-LC".
				aac : 'audio/aac',

				// CAF — Codecs vary.
				caf     : 'audio/x-caf',
				'x-caf' : 'audio/x-caf',

				// MP3 — MPEG-1/-2 Layer-III audio.
				mp3  : 'audio/mpeg; codecs="mp3"',
				mpeg : 'audio/mpeg; codecs="mp3"',

				// MP4 — Codecs vary, but commonly "mp4a.40.2" (a.k.a. "AAC-LC").
				m4a     : 'audio/mp4',
				mp4     : 'audio/mp4',
				'x-m4a' : 'audio/mp4',
				'x-mp4' : 'audio/mp4',

				// OGG — Codecs vary, but commonly "vorbis" and, recently, "opus".
				oga : 'audio/ogg',
				ogg : 'audio/ogg',

				// OPUS — Opus audio in an Ogg container.
				opus : 'audio/ogg; codecs="opus"',

				// WAVE — Codecs vary, but commonly "1" (1 is the FourCC for PCM/LPCM).
				wav  : 'audio/wav',
				wave : 'audio/wav',

				// WEBM — Codecs vary, but commonly "vorbis" and, recently, "opus".
				weba : 'audio/webm',
				webm : 'audio/webm'
			}
		},

		/*
			Retuns the MIME-type associated with the given format-ID, if it is supported,
			elsewise `null`.
		*/
		getType : {
			value(format) {
				if (!format || !Has.audio) {
					return null;
				}

				const
					known = AudioWrapper.formats,
					id    = format.toLowerCase(),
					type  = known.hasOwnProperty(id) ? known[id] : `audio/${id}`;

				return AudioWrapper._verifyType(type);
			}
		},

		/*
			Returns whether the browser potentially supports a format.
		*/
		canPlayFormat : {
			value(format) {
				return AudioWrapper.getType(format) !== null;
			}
		},

		/*
			Returns whether the browser potentially supports a MIME-type.
		*/
		canPlayType : {
			value(type) {
				return AudioWrapper._verifyType(type) !== null;
			}
		},

		/*
			Cache of supported MIME-types.
		*/
		_types : {
			value : {}
		},

		/*
			Verifies that the browser supports the given MIME-type and then retuns either
			the MIME-type, if it is supported, or `null`, if it is not.
		*/
		_verifyType : {
			value(type) {
				if (!type || !Has.audio) {
					return null;
				}

				const cache = AudioWrapper._types;

				if (!cache.hasOwnProperty(type)) {
					const audio = document.createElement('audio');

					// Some early implementations return 'no' instead of the empty string.
					cache[type] = audio.canPlayType(type).replace(/^no$/i, '') !== '';
				}

				return cache[type] ? type : null;
			}
		}
	});


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return AudioWrapper;
})();
