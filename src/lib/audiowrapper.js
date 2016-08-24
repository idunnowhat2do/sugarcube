/***********************************************************************************************************************
 *
 * lib/audiowrapper.js
 *
 * Copyright © 2013–2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

var AudioWrapper = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	const
		// Events supported by the `on()`, `one()`, and `off()` methods.
		_events = new Map([
			['end',    'ended'],
			['fade',   'aw:fade'],
			['pause',  'pause'],
			['play',   'playing'],
			['rate',   'ratechange'],
			['seek',   'seeked'],
			['stop',   'aw:stop'],
			['volume', 'volumechange']
		]);


	/*******************************************************************************************************************
	 * AudioWrapper Class.
	 ******************************************************************************************************************/
	class AudioWrapper {
		constructor(audio) {
			Object.defineProperties(this, {
				audio : {
					value : audio
				},

				_faderId : {
					writable : true,
					value    : null
				}
			});

			// Ensure that, at least, the metadata is loaded.
			if (this.audio.preload !== 'metadata' && this.audio.preload !== 'auto') {
				this.audio.preload = 'metadata';
			}
		}

		/*
			n.b. The various data constants (e.g. for comparison to `readyState` or `networkState`)
			     are not defined by all browsers on the descendant elements `HTMLAudioElement` and
			     `HTMLVideoElement` (notably, IE/Edge do not).  Therefore, the base media element,
			     `HTMLMediaElement`, must be used to reference the constants.
		*/

		get duration() {
			// n.b. May return a double, NaN, or Infinity.
			return this.audio.duration;
		}

		get rate() {
			return this.audio.playbackRate;
		}
		set rate(playRate) {
			// Clamp the playback rate to sane values.  Some browsers also do this to varying degrees.
			this.audio.playbackRate = Math.clamp(playRate, 0.2, 5); // clamp to 5× slower & faster
		}

		get remaining() {
			// n.b. May return a double, NaN, or Infinity.
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

		hasMetadata() {
			return this.audio.readyState >= HTMLMediaElement.HAVE_METADATA;
		}

		hasSomeData() {
			return this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
		}

		hasData() {
			return this.audio.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA;
		}

		noSource() {
			return !(this.audio.src || this.audio.hasChildNodes())
				|| this.audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
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

			this.audio.load();
		}

		play() {
			if (!this.hasData() && !this.isLoading()) {
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
			jQuery(this.audio).triggerHandler('aw:stop');
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
							jQuery(this.audio).triggerHandler('aw:fade');
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

		on(eventName, listener) {
			if (!_events.has(eventName)) {
				throw new Error(`unknown event "${eventName}"; valid: ${[..._events.keys()].join(', ')}`);
			}
			else if (typeof listener !== 'function') {
				throw new Error('listener parameter must be a function');
			}

			return jQuery(this.audio).on(`${_events.get(eventName)}.AudioWrapperEvents`, listener);
		}

		one(eventName, listener) {
			if (!_events.has(eventName)) {
				throw new Error(`unknown event "${eventName}"; valid: ${[..._events.keys()].join(', ')}`);
			}
			else if (typeof listener !== 'function') {
				throw new Error('listener parameter must be a function');
			}

			return jQuery(this.audio).one(`${_events.get(eventName)}.AudioWrapperEvents`, listener);
		}

		off(eventName, listener) {
			if (eventName && !_events.has(eventName)) {
				throw new Error(`unknown event "${eventName}"; valid: ${[..._events.keys()].join(', ')}`);
			}
			else if (listener && typeof listener !== 'function') {
				throw new Error('listener parameter must be a function');
			}

			return jQuery(this.audio).off(`${eventName ? _events.get(eventName) : ''}.AudioWrapperEvents`, listener);
		}

		clone() {
			// Do not use `jQuery.clone()` here, as we do not want event handlers carried over.
			// return new AudioWrapper(this.audio.cloneNode(true));
			return new this.constructor(this.audio.cloneNode(true));
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return AudioWrapper;
})();
