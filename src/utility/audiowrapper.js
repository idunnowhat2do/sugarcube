/***********************************************************************************************************************
 *
 * utility/audiowrapper.js
 *
 * Copyright © 2013–2015 Thomas Michael Edwards <tmedwards@motoslave.net>. All rights reserved.
 * Use of this source code is governed by a Simplified BSD License which can be found in the LICENSE file.
 *
 **********************************************************************************************************************/

/*
	Setup the AudioWrapper constructor.
*/
function AudioWrapper(audio) {
	Object.defineProperties(this, {
		audio : {
			value : audio
		},
		_faderId : {
			writable : true,
			value    : null
		}
	});
	if (this.audio.preload !== "metadata" && this.audio.preload !== "auto") {
		this.audio.preload = "metadata";
	}
}

/*
	Setup the AudioWrapper prototype.

	n.b. The various data constants (e.g. for comparison to `readyState` or `networkState`)
	     are not defined by all browsers on the descendant elements `HTMLAudioElement` and
	     `HTMLVideoElement` (notably, IE/Edge do not).  Therefore, the base media element,
	     `HTMLMediaElement`, must be used to reference the constants.
*/
Object.defineProperties(AudioWrapper.prototype, {
	/*
		Getters/Setters
	*/
	duration : {
		get : function () {
			return this.audio.duration;
		}
	},
	time : {
		get : function () {
			return this.audio.currentTime;
		},
		set : function (time) {
			/*
				If we try to modify the audio clip's `.currentTime` property before its metadata
				has been loaded, it will throw an `InvalidStateError` (since it doesn't know its
				duration, allowing `.currentTime` to be set would be undefined behavior), so we
				must check its readiness first.
			*/
			if (this.hasMetadata()) {
				this.audio.currentTime = time;
			} else {
				jQuery(this.audio)
					.off("loadedmetadata.AudioWrapper:time")
					.one("loadedmetadata.AudioWrapper:time", function () {
						this.currentTime = time;
					});
			}
		}
	},
	volume : {
		get : function () {
			return this.audio.volume;
		},
		set : function (vol) {
			this.audio.volume = Math.clamp(vol, 0, 1);
		}
	},
	controls : {
		get : function () {
			return this.audio.controls;
		},
		set : function (state) {
			this.audio.controls = !!state;
		}
	},

	/*
		Methods
	*/
	hasMetadata : {
		value : function () {
			return this.audio.readyState >= HTMLMediaElement.HAVE_METADATA;
		}
	},
	hasData : {
		value : function () {
			return this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
		}
	},
	noSource : {
		value : function () {
			return this.audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
		}
	},
	isPlaying : {
		value : function () {
			return !(this.audio.ended || this.audio.paused || !this.hasData());
		}
	},
	isEnded : {
		value : function () {
			return this.audio.ended;
		}
	},
	isPaused : {
		value : function () {
			return this.audio.paused;
		}
	},
	isMuted : {
		value : function () {
			return this.audio.muted;
		}
	},
	isLooped : {
		value : function () {
			return this.audio.loop;
		}
	},

	load : {
		value : function () {
			if (this.audio.preload !== "auto") {
				this.audio.preload = "auto";
			}
			this.audio.load();
		}
	},
	play : {
		value : function () {
			if (!this.hasData()) {
				this.load();
			}
			this.audio.play();
		}
	},
	pause : {
		value : function () {
			this.audio.pause();
		}
	},
	stop : {
		value : function () {
			this.audio.pause();
			this.time = 0;
		}
	},

	mute : {
		value : function () {
			this.audio.muted = true;
		}
	},
	unmute : {
		value : function () {
			this.audio.muted = false;
		}
	},
	loop : {
		value : function () {
			this.audio.loop = true;
		}
	},
	unloop : {
		value : function () {
			this.audio.loop = false;
		}
	},

	fadeWithDuration : {
		value : function (duration, from, to) {
			if (this._faderId !== null) {
				clearInterval(this._faderId);
				this._faderId = null;
			}
			from = Math.clamp(from, 0, 1);
			to   = Math.clamp(to, 0, 1);
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
				.off("timeupdate.AudioWrapper:fadeWithDuration")
				.one("timeupdate.AudioWrapper:fadeWithDuration", (function (self) {
					return function () {
						var min, max;
						if (from < to) {
							// Fade in.
							min = from;
							max = to;
						} else {
							// Fade out.
							min = to;
							max = from;
						}
						duration = Math.clamp(duration, 1, self.duration || 5);
						var	interval = 25, // in milliseconds
							delta    = (to - from) / (duration / (interval / 1000));
						self._faderId = setInterval(function () {
							if (!self.isPlaying()) {
								clearInterval(self._faderId);
								self._faderId = null;
								return;
							}
							self.volume = Math.clamp(self.volume + delta, min, max);
							if (self.volume === 0) {
								self.pause();
							}
							if (self.volume === to) {
								clearInterval(self._faderId);
								self._faderId = null;
							}
						}, interval);
					};
				})(this));

			this.play();
		}
	},
	fade : {
		value : function (from, to) {
			this.fadeWithDuration(5, from, to);
		}
	},
	fadeIn : {
		value : function () {
			this.fade(this.volume, 1);
		}
	},
	fadeOut : {
		value : function () {
			this.fade(this.volume, 0);
		}
	},

	onPlay : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).on("playing.AudioWrapper:onPlay", callback);
			} else {
				jQuery(this.audio).off("playing.AudioWrapper:onPlay");
			}
		}
	},
	onePlay : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).one("playing.AudioWrapper:onePlay", callback);
			} else {
				jQuery(this.audio).off("playing.AudioWrapper:onePlay");
			}
		}
	},

	onPause : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).on("pause.AudioWrapper:onPause", callback);
			} else {
				jQuery(this.audio).off("pause.AudioWrapper:onPause");
			}
		}
	},
	onePause : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).one("pause.AudioWrapper:onePause", callback);
			} else {
				jQuery(this.audio).off("pause.AudioWrapper:onePause");
			}
		}
	},

	onEnd : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).on("ended.AudioWrapper:onEnd", callback);
			} else {
				jQuery(this.audio).off("ended.AudioWrapper:onEnd");
			}
		}
	},
	oneEnd : {
		value : function (callback) {
			if (typeof callback === "function") {
				jQuery(this.audio).one("ended.AudioWrapper:oneEnd", callback);
			} else {
				jQuery(this.audio).off("ended.AudioWrapper:oneEnd");
			}
		}
	},

	clone : {
		value : function () {
			return new AudioWrapper(this.audio.cloneNode(true));
		}
	}
});

