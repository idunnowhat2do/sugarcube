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
			return this.audio.duration;
		}

		get remaining() {
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
				duration, allowing `.currentTime` to be set would be undefined behavior), so we
				must check its readiness first.
			*/
			if (this.hasMetadata()) {
				this.audio.currentTime = time;
			}
			else {
				jQuery(this.audio)
					.off('loadedmetadata.AudioWrapper:time')
					.one('loadedmetadata.AudioWrapper:time', () => this.audio.currentTime = time);
			}
		}

		get volume() {
			return this.audio.volume;
		}
		set volume(vol) {
			this.audio.volume = Math.clamp(vol, 0, 1);
		}

		get controls() {
			return this.audio.controls;
		}
		set controls(state) {
			this.audio.controls = !!state;
		}

		hasMetadata() {
			return this.audio.readyState >= HTMLMediaElement.HAVE_METADATA;
		}

		hasData() {
			return this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
		}

		noSource() {
			return !this.audio.hasChildNodes() || this.audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
		}

		isPlaying() {
			return !(this.audio.ended || this.audio.paused || !this.hasData());
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

		fadeWithDuration(fadeDuration, fromVol, toVol) {
			if (this._faderId !== null) {
				clearInterval(this._faderId);
				this._faderId = null;
			}

			const
				from = Math.clamp(fromVol, 0, 1),
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
						}
					}, interval);
				});

			this.play();
		}

		fade(fromVol, toVol) {
			this.fadeWithDuration(5, fromVol, toVol);
		}

		fadeIn() {
			this.fade(this.volume, 1);
		}

		fadeOut() {
			this.fade(this.volume, 0);
		}

		onPlay(callback) {
			if (typeof callback === 'function') {
				return jQuery(this.audio).on('playing.AudioWrapper:onPlay', callback);
			}
			else {
				return jQuery(this.audio).off('playing.AudioWrapper:onPlay');
			}
		}

		onePlay(callback) {
			if (typeof callback === 'function') {
				return jQuery(this.audio).one('playing.AudioWrapper:onePlay', callback);
			}
			else {
				return jQuery(this.audio).off('playing.AudioWrapper:onePlay');
			}
		}

		onPause(callback) {
			if (typeof callback === 'function') {
				return jQuery(this.audio).on('pause.AudioWrapper:onPause', callback);
			}
			else {
				return jQuery(this.audio).off('pause.AudioWrapper:onPause');
			}
		}

		onePause(callback) {
			if (typeof callback === 'function') {
				return jQuery(this.audio).one('pause.AudioWrapper:onePause', callback);
			}
			else {
				return jQuery(this.audio).off('pause.AudioWrapper:onePause');
			}
		}

		onEnd(callback) {
			if (typeof callback === 'function') {
				return jQuery(this.audio).on('ended.AudioWrapper:onEnd', callback);
			}
			else {
				return jQuery(this.audio).off('ended.AudioWrapper:onEnd');
			}
		}

		oneEnd(callback) {
			if (typeof callback === 'function') {
				return jQuery(this.audio).one('ended.AudioWrapper:oneEnd', callback);
			}
			else {
				return jQuery(this.audio).off('ended.AudioWrapper:oneEnd');
			}
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
