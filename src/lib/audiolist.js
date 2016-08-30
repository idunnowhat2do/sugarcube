/***********************************************************************************************************************
 *
 * lib/audiolist.js
 *
 * Copyright © 2016 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/
/* global AudioWrapper */

var AudioList = (() => { // eslint-disable-line no-unused-vars, no-var
	'use strict';

	/*******************************************************************************************************************
	 * AudioList Class.
	 ******************************************************************************************************************/
	class AudioList {
		constructor(obj) {
			// Setup our own properties.
			Object.defineProperties(this, {
				tracks : {
					value : []
				},

				list : {
					value : []
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
					value    : true
				},

				_shuffle : {
					writable : true,
					value    : false
				}
			});

			// Process the given array of AudioWrapper or track objects.
			if (Array.isArray(obj)) {
				obj.forEach(track => this.add(track));
			}
			else if (obj instanceof AudioList) {
				obj.tracks.forEach(track => this.add(track));
			}
		}

		add(trackObj) {
			let track, volume, rate;

			if (typeof trackObj !== 'object' || trackObj == null) { // lazy equality for null
				throw new Error('track parameter must be an object');
			}
			else if (trackObj instanceof AudioWrapper) {
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

				track  = trackObj.track.clone();
				volume = trackObj.hasOwnProperty('volume') ? trackObj.volume : 1;
				rate   = trackObj.hasOwnProperty('rate') ? trackObj.rate : 1;
			}

			track.stop();
			track.unloop();
			track.unmute();
			track.volume = volume;
			track.rate = rate;
			track.on('end.AudioListEvent', () => this._onEnd());

			this.tracks.push({ track, volume, rate });
		}

		get duration() {
			// n.b. May return a double (normally), Infinity (for streams), or NaN (without metadata).
			return this.tracks
				.map(trackObj => trackObj.track.duration)
				.reduce((p, c) => p + c, 0);
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
			// n.b. May return a double (normally), Infinity (for streams), or NaN (without metadata).
			let remainingTime = this.list
				.map(trackObj => trackObj.track.duration)
				.reduce((p, c) => p + c, 0);

			if (this.current !== null) {
				remainingTime += this.current.track.remaining;
			}

			return remainingTime;
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
			return this.list.length === 0 && (this.current === null ? true : this.current.track.isEnded());
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
				if (this.list.length === 0) {
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

			this.list.splice(0);
		}

		skip() {
			if (this._next()) {
				this.current.track.play();
			}
			else if (this._loop) {
				this.play();
			}
		}

		mute() {
			this._mute = true;

			if (this.current !== null) {
				this.current.track.mute();
			}
		}

		unmute() {
			this._mute = false;

			if (this.current !== null) {
				this.current.track.unmute();
			}
		}

		loop() {
			this._loop = true;
		}

		unloop() {
			this._loop = false;
		}

		shuffle() {
			this._shuffle = true;
		}

		unshuffle() {
			this._shuffle = false;
		}

		fadeWithDuration(fadeDuration, toVol, fromVol) {
			if (this.list.length === 0) {
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

			if (this.list.length === 0) {
				this.current = null;
				return false;
			}

			this.current = this.list.shift();

			if (!this.current.track.hasSource() || this.current.track.isFailed()) {
				return this._next();
			}

			this.current.track.volume = this.volume * this.current.volume;
			this.current.track.rate = this.rate * this.current.rate;

			if (this._mute) {
				this.current.track.mute();
			}

			return true;
		}

		_onEnd() {
			if (this.list.length === 0) {
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
			this.list.splice(0);
			this.list.push(...this.tracks);

			if (this._shuffle) {
				this.list.shuffle();

				// Try not to immediately replay the last track when shuffling.
				if (this.list.length > 1 && this.list[0] === this.current) {
					this.list.push(this.list.shift());
				}
			}
		}
	}


	/*******************************************************************************************************************
	 * Module Exports.
	 ******************************************************************************************************************/
	return AudioList;
})();
