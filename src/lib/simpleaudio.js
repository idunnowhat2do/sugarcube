/***********************************************************************************************************************
 *
 * lib/simpleaudio.js
 *
 * Copyright © 2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global Has, Util, clone */

var SimpleAudio = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const
		// Mapping of subscriber -> callback pairs.
		_subscribers = new Map();

	let
		// Master playback rate.
		_masterRate = 1,

		// Master playback volume.
		_masterVolume = 1,

		// Master mute state.
		_masterMute = false;


	/*******************************************************************************************************************
	 * AudioWrapper Class.
	 ******************************************************************************************************************/
	class AudioWrapper {
		constructor(obj) {
			// Process the given array of sources or AudioWrapper object.
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

			// Process the array of sources.
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
				original.audio.cloneNode(true), // deep clone of the audio element & its children
				clone(original.sources),
				clone(original.originalSources)
			);
		}

		_finalize(audio, sources, originalSources) {
			// Setup our own properties.
			Object.defineProperties(this, {
				audio : {
					configurable : true,
					value        : audio
				},

				sources : {
					configurable : true,
					value        : Object.freeze(sources)
				},

				originalSources : {
					configurable : true,
					value        : Object.freeze(originalSources)
				},

				_error : {
					writable : true,
					value    : false
				},

				_faderId : {
					writable : true,
					value    : null
				},

				_mute : {
					writable : true,
					value    : false
				},

				_rate : {
					writable : true,
					value    : 1
				},

				_volume : {
					writable : true,
					value    : 1
				}
			});

			// Setup event handlers on the audio and source elements.
			jQuery(this.audio)
				/*
					Upon receiving a `loadstart` event on the audio element, set `_error` to
					`false`.
				*/
				.on('loadstart', () => this._error = false)
				/*
					Upon receiving an `error` event on the final source element (if any), set
					`_error` to `true` and trigger an `error` event on the audio element—the
					latter being necessary because the source `error` event does not bubble.
				*/
				.find('source:last-of-type')
					.on('error', () => {
						this._error = true;
						this._trigger('error');
					});

			/*
				Subscribe to `SimpleAudio` for command messages.  Currently, for signaling changes
				to the master volume, mute, and rate, as well as a master stop command.
			*/
			SimpleAudio.subscribe(this, mesg => {
				switch (mesg) {
				case 'mute':   this._updateAudioMute();   break;
				case 'rate':   this._updateAudioRate();   break;
				case 'stop':   this.stop();               break;
				case 'volume': this._updateAudioVolume(); break;
				}
			});

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

		destroy() {
			/*
				Strictly speaking, self-destruction is not necessary as this object will,
				eventually, be garbage collected.  That said, since the audio element contains
				data buffers for the selected audio source, which may be quite large, manually
				purging them as soon as we know that they're no longer needed is not a bad idea.
			*/
			// Stop and remove an in-progress fade.
			if (this._faderId !== null) {
				clearInterval(this._faderId);
				this._faderId = null;
			}

			// Stop playback.
			this.stop();

			const audio = this.audio;

			// Remove all event handlers.
			jQuery(audio).off();

			// Remove all source elements.
			while (audio.hasChildNodes()) {
				audio.removeChild(audio.firstChild);
			}

			/*
				Now that all sources have been removed from the audio element, call for a load
				so that it drops all of its existing audio data buffers.
			*/
			audio.load();
			this._error = true;

			// // Set the reference-type properties' values to `null` and then freeze them.
			// Object.defineProperties(this, {
			// 	audio           : { writable : true, value : null },
			// 	sources         : { writable : true, value : null },
			// 	originalSources : { writable : true, value : null }
			// });
			// Object.defineProperties(this, {
			// 	audio           : { configurable : false, writable : false },
			// 	sources         : { configurable : false, writable : false },
			// 	originalSources : { configurable : false, writable : false }
			// });

			// Delete the reference-type properties.
			delete this.audio;
			delete this.sources;
			delete this.originalSources;
		}

		get duration() {
			// NOTE: May return a double (normally), Infinity (for streams), or NaN (without metadata).
			return this.audio.duration;
		}

		get ended() {
			return this.audio.ended;
		}

		get loop() {
			return this.audio.loop;
		}
		set loop(state) {
			this.audio.loop = !!state;
		}

		get mute() {
			return this._mute;
		}
		set mute(state) {
			this._mute = !!state;
			this._updateAudioMute();
		}
		_updateAudioMute() {
			this.audio.muted = this._mute || SimpleAudio.mute;
		}

		get paused() {
			return this.audio.paused;
		}

		get rate() {
			return this._rate;
		}
		set rate(playRate) {
			/*
				Clamp the playback rate to sane values—some browsers also do this to varying degrees.

				NOTE: The specification allows negative values for backwards playback, however,
				      most browsers (ca. Aug 2016) either completely ignore negative values or
				      clamp them to some positive value.  In some (notably, IE/Edge), setting a
				      negative playback rate breaks the associated controls, if displayed.
			*/
			/*
			this._rate = playRate < 0
				? Math.clamp(playRate, -0.2, -5) // clamp to 5× slower & faster, backward
				: Math.clamp(playRate, 0.2, 5);  // clamp to 5× slower & faster, forward
			*/
			this._rate = Math.clamp(playRate, 0.2, 5); // clamp to 5× slower & faster
			this._updateAudioRate();
		}
		_updateAudioRate() {
			this.audio.playbackRate = this._rate * SimpleAudio.rate;
		}

		get remaining() {
			// NOTE: May return a double (normally), Infinity (for streams), or NaN (without metadata).
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
			catch (ex) {
				jQuery(this.audio)
					.off('loadedmetadata.AudioWrapper:time')
					.one('loadedmetadata.AudioWrapper:time', () => this.audio.currentTime = time);
			}
		}

		get volume() {
			return this._volume;
		}
		set volume(vol) {
			this._volume = Math.clamp(vol, 0, 1); // clamp to 0 (silent) & 1 (full loudness)
			this._updateAudioVolume();
		}
		_updateAudioVolume() {
			this.audio.volume = this._volume * SimpleAudio.volume;
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
			return this._error;
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
			/*
				If the selected audio resource is a stream, `currentTime` may return a non-zero
				value even at the earliest available position within the stream as the browser
				may have dropped the earliest chunks of buffered data or the stream may have a
				timeline that does not start at zero.

				In an attempt to guard against these possiblities, as best as we can, we test
				`duration` against `Infinity` first, which should yield true for actual streams.
			*/
			return this.audio.paused
				&& (this.audio.duration === Infinity || this.audio.currentTime > 0)
				&& !this.audio.ended;
		}

		isMuted() {
			return this._mute;
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

			const
				awEvents = AudioWrapper._events,
				events   = eventNames.trim().splitOrEmpty(/\s+/)
					.map(nameAndNS => {
						const name = nameAndNS.split('.', 1)[0];

						if (!awEvents.hasOwnProperty(name)) {
							throw new Error(`unknown event "${name}"; valid: ${Object.keys(awEvents).join(', ')}`);
						}

						return `${nameAndNS.replace(name, awEvents[name])}.AudioWrapperEvent`;
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

			const
				awEvents = AudioWrapper._events,
				events   = eventNames.trim().splitOrEmpty(/\s+/)
					.map(nameAndNS => {
						const name = nameAndNS.split('.', 1)[0];

						if (!awEvents.hasOwnProperty(name)) {
							throw new Error(`unknown event "${name}"; valid: ${Object.keys(awEvents).join(', ')}`);
						}

						return `${nameAndNS.replace(name, awEvents[name])}.AudioWrapperEvent`;
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

			const
				awEvents = AudioWrapper._events,
				events   = eventNames.trim().splitOrEmpty(/\s+/)
					.map(nameAndNS => {
						const name = nameAndNS.split('.', 1)[0];

						if (name) {
							if (!awEvents.hasOwnProperty(name)) {
								throw new Error(`unknown event "${name}"; valid: ${Object.keys(awEvents).join(', ')}`);
							}

							return `${nameAndNS.replace(name, awEvents[name])}.AudioWrapperEvent`;
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

		/*
			Verifies that the browser supports the given MIME-type and then retuns either
			the MIME-type, if it is supported, or `null`, if it is not.
		*/
		static _verifyType(type) {
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

		/*
			Retuns the MIME-type associated with the given format-ID, if it is supported,
			elsewise `null`.
		*/
		static getType(format) {
			if (!format || !Has.audio) {
				return null;
			}

			const
				known = AudioWrapper.formats,
				id    = format.toLowerCase(),
				type  = known.hasOwnProperty(id) ? known[id] : `audio/${id}`;

			return AudioWrapper._verifyType(type);
		}

		/*
			Returns whether the browser potentially supports a format.
		*/
		static canPlayFormat(format) {
			return AudioWrapper.getType(format) !== null;
		}

		/*
			Returns whether the browser potentially supports a MIME-type.
		*/
		static canPlayType(type) {
			return AudioWrapper._verifyType(type) !== null;
		}
	}

	// Attach the static data members.
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
			Cache of supported MIME-types.
		*/
		_types : {
			value : {}
		},

		/*
			Mapping of AudioWrapper event names -> actual event names.
		*/
		_events : {
			value : Object.freeze({
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
			})
		}
	});


	/*******************************************************************************************************************
	 * AudioList Class.
	 ******************************************************************************************************************/
	class AudioList {
		constructor(obj) {
			// Setup our own properties.
			Object.defineProperties(this, {
				tracks : {
					configurable : true,
					value        : []
				},

				queue : {
					configurable : true,
					value        : []
				},

				current : {
					writable : true,
					value    : null
				},

				_rate : {
					writable : true,
					value    : 1
				},

				_volume : {
					writable : true,
					value    : 1
				},

				_mute : {
					writable : true,
					value    : false
				},

				_loop : {
					writable : true,
					value    : false
				},

				_shuffle : {
					writable : true,
					value    : false
				}
			});

			// Process the given array of track objects or AudioList object.
			if (Array.isArray(obj)) {
				obj.forEach(track => this.add(track));
			}
			else if (obj instanceof AudioList) {
				obj.tracks.forEach(track => this.add(track));
			}
		}

		add(trackObj) {
			if (trackObj == null || typeof trackObj !== 'object') { // lazy equality for null
				throw new Error('track parameter must be an object');
			}

			let copy, track, volume, rate;

			if (trackObj instanceof AudioWrapper) {
				copy   = true;
				track  = trackObj.clone();
				volume = trackObj.volume;
				rate   = trackObj.rate;
			}
			else {
				if (!trackObj.hasOwnProperty('track')) {
					throw new Error('track object missing required "track" property');
				}
				else if (!(trackObj.track instanceof AudioWrapper)) {
					throw new Error('track object\'s "track" property must be an AudioWrapper object');
				}
				// else if (!trackObj.hasOwnProperty('volume')) {
				// 	throw new Error('track object missing required "volume" property');
				// }

				copy   = trackObj.hasOwnProperty('copy') && trackObj.copy;
				track  = copy ? trackObj.track.clone() : trackObj.track;
				volume = trackObj.hasOwnProperty('volume') ? trackObj.volume : trackObj.track.volume;
				rate   = trackObj.hasOwnProperty('rate') ? trackObj.rate : trackObj.track.rate;
			}

			track.stop();
			track.loop = false;
			track.mute = false;
			track.volume = volume;
			track.rate = rate;
			track.on('end.AudioListEvent', () => this._onEnd());

			this.tracks.push({ copy, track, volume, rate });
		}

		destroy() {
			/*
				Strictly speaking, self-destruction is not necessary as this object will,
				eventually, be garbage collected.
			*/
			// Stop playback.
			this.stop();

			// Destroy all copied tracks.
			this.tracks
				.filter(trackObj => trackObj.copy)
				.forEach(trackObj => trackObj.track.destroy());

			// // Set the reference-type properties' values to `null` and then freeze them.
			// Object.defineProperties(this, {
			// 	tracks : { writable : true, value : null },
			// 	queue  : { writable : true, value : null }
			// });
			// Object.defineProperties(this, {
			// 	tracks : { configurable : false, writable : false },
			// 	queue  : { configurable : false, writable : false }
			// });

			// Delete the reference-type properties.
			delete this.tracks;
			delete this.queue;
		}

		get duration() {
			// NOTE: May return a double (normally), Infinity (for streams), or NaN (without metadata).
			return this.tracks
				.map(trackObj => trackObj.track.duration)
				.reduce((prev, cur) => prev + cur, 0);
		}

		get loop() {
			return this._loop;
		}
		set loop(state) {
			this._loop = !!state;
		}

		get mute() {
			return this._mute;
		}
		set mute(state) {
			this._mute = !!state;

			if (this.current !== null) {
				this.current.track.mute = this._mute;
			}
		}

		get rate() {
			return this._rate;
		}
		set rate(playRate) {
			this._rate = Math.clamp(playRate, 0.2, 5); // clamp to 5× slower & faster

			if (this.current !== null) {
				this.current.track.rate = this.rate * this.current.rate;
			}
		}

		get remaining() {
			// NOTE: May return a double (normally), Infinity (for streams), or NaN (without metadata).
			let remainingTime = this.queue
				.map(trackObj => trackObj.track.duration)
				.reduce((prev, cur) => prev + cur, 0);

			if (this.current !== null) {
				remainingTime += this.current.track.remaining;
			}

			return remainingTime;
		}

		get shuffle() {
			return this._shuffle;
		}
		set shuffle(state) {
			this._shuffle = !!state;
		}

		get time() {
			return this.duration - this.remaining;
		}

		get volume() {
			return this._volume;
		}
		set volume(vol) {
			this._volume = Math.clamp(vol, 0, 1); // clamp to 0 (silent) & 1 (full loudness)

			if (this.current !== null) {
				this.current.track.volume = this.volume * this.current.volume;
			}
		}

		isPlaying() {
			return this.current === null ? false : this.current.track.isPlaying();
		}

		isEnded() {
			return this.queue.length === 0 && (this.current === null ? true : this.current.track.isEnded());
		}

		isPaused() {
			return this.current === null ? true : this.current.track.isPaused();
		}

		isMuted() {
			return this._mute;
		}

		isLooped() {
			return this._loop;
		}

		isShuffled() {
			return this._shuffle;
		}

		play() {
			if (this.current === null || this.current.track.isEnded()) {
				if (this.queue.length === 0) {
					this._buildList();
				}

				if (!this._next()) {
					return;
				}
			}

			this.current.track.play();
		}

		pause() {
			if (this.current !== null) {
				this.current.track.pause();
			}
		}

		stop() {
			if (this.current !== null) {
				this.current.track.stop();
				this.current = null;
			}

			this.queue.splice(0);
		}

		skip() {
			if (this._next()) {
				this.current.track.play();
			}
			else if (this._loop) {
				this.play();
			}
		}

		fadeWithDuration(fadeDuration, toVol, fromVol) {
			if (this.queue.length === 0) {
				this._buildList();
			}

			if (this.current === null || this.current.track.isEnded()) {
				if (!this._next()) {
					return;
				}
			}

			const adjToVol = Math.clamp(toVol, 0, 1) * this.current.volume;
			let adjFromVol;

			if (fromVol != null) { // lazy equality for null
				adjFromVol = Math.clamp(fromVol, 0, 1) * this.current.volume;
			}

			this.current.track.fadeWithDuration(fadeDuration, adjToVol, adjFromVol);
			this._volume = toVol; // kludgey, but necessary
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

		_next() {
			if (this.current !== null) {
				this.current.track.stop();
			}

			if (this.queue.length === 0) {
				this.current = null;
				return false;
			}

			this.current = this.queue.shift();

			if (!this.current.track.hasSource() || this.current.track.isFailed()) {
				return this._next();
			}

			this.current.track.mute = this._mute;
			this.current.track.rate = this.rate * this.current.rate;
			this.current.track.volume = this.volume * this.current.volume;

			return true;
		}

		_onEnd() {
			if (this.queue.length === 0) {
				if (!this._loop) {
					return;
				}

				this._buildList();
			}

			if (!this._next()) {
				return;
			}

			this.current.track.play();
		}

		_buildList() {
			this.queue.splice(0);
			this.queue.push(...this.tracks);

			if (this.queue.length === 0) {
				return;
			}

			if (this._shuffle) {
				this.queue.shuffle();

				// Try not to immediately replay the last track when shuffling.
				if (this.queue.length > 1 && this.queue[0] === this.current) {
					this.queue.push(this.queue.shift());
				}
			}
		}
	}


	/*******************************************************************************************************************
	 * Master Audio Functions.
	 ******************************************************************************************************************/
	function masterMuteGet() {
		return _masterMute;
	}
	function masterMuteSet(mute) {
		_masterMute = !!mute;
		publish('mute', _masterMute);
	}

	function masterRateGet() {
		return _masterRate;
	}
	function masterRateSet(rate) {
		_masterRate = Math.clamp(rate, 0.2, 5); // clamp to 5× slower & faster
		publish('rate', _masterRate);
	}

	function masterVolumeGet() {
		return _masterVolume;
	}
	function masterVolumeSet(vol) {
		_masterVolume = Math.clamp(vol, 0, 1); // clamp to 0 (silent) & 1 (full loudness)
		publish('volume', _masterVolume);
	}

	function masterStop() {
		publish('stop');
	}


	/*******************************************************************************************************************
	 * Subscription Functions.
	 ******************************************************************************************************************/
	function subscribe(id, callback) {
		if (typeof callback !== 'function') {
			throw new Error('callback parameter must be a function');
		}

		_subscribers.set(id, callback);
	}

	function unsubscribe(id) {
		_subscribers.delete(id);
	}

	function publish(mesg, data) {
		_subscribers.forEach(fn => fn(mesg, data));
	}


	/*******************************************************************************************************************
	 * Factory Functions.
	 ******************************************************************************************************************/
	function createAudio(...args) {
		return new AudioWrapper(...args);
	}

	function createList(...args) {
		return new AudioList(...args);
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return Object.freeze(Object.defineProperties({}, {
		/*
			Master Audio Functions.
		*/
		mute : {
			get : masterMuteGet,
			set : masterMuteSet
		},
		rate : {
			get : masterRateGet,
			set : masterRateSet
		},
		volume : {
			get : masterVolumeGet,
			set : masterVolumeSet
		},
		stop : { value : masterStop },

		/*
			Subscription Functions.
		*/
		subscribe   : { value : subscribe },
		unsubscribe : { value : unsubscribe },
		publish     : { value : publish },

		/*
			Factory Functions.
		*/
		create     : { value : createAudio },
		createList : { value : createList }
	}));
})();
