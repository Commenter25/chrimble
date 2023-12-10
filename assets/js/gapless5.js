/*! @license Gapless 5 Version 1.4.5 | Copyright 2014 Rego Sen | MIT License | https://github.com/regosen/Gapless-5 | GUI, Crossfade, & Shuffle removed by Commenter25 */
/* @license magnet:?xt=urn:btih:d3d9a9a6595521f9666a5e94cc830dab83b65699&dn=expat.txt MIT License */ "use strict";

const Gapless5State = {
	None     : 0,
	Loading  : 1,
	Starting : 2,
	Play     : 3,
	Stop     : 4,
	Error    : 5,
};

const LogLevel = {
	Debug: 1, // show log.debug and up
	Info: 2, // show log.info and up
	Warning: 3, // show log.warn and up
	Error: 4, // show log.error and up
	None: 5, // show nothing
};

// A Gapless5Source "class" handles track-specific audio requests
function Gapless5Source(parentPlayer, parentLog, inAudioPath) {
	this.audioPath = inAudioPath;
	this.trackName = inAudioPath.replace(/^.*[\\/]/, '').split('.')[0];
	const player = parentPlayer;
	const log = parentLog;

	// HTML5 Audio
	let audio = null;

	// WebAudio
	let source = null;
	let buffer = null;
	let request = null;
	let gainNode = null;

	// states
	let lastTick = 0;
	let position = 0;
	let endpos = 0;
	let queuedState = Gapless5State.None;
	let state = Gapless5State.None;
	let seekablePercent = 0;
	let endedCallback = null;
	let volume = 1; // source-specific volume (for cross-fading)

	this.getVolume = () => {
		volume = 1;
		return Math.min(1, Math.max(0, volume * player.volume));
	};

	const setState = (newState) => {
		if (state !== newState && newState === Gapless5State.Play) {
			lastTick = new Date().getTime();
		}
		state = newState;
		queuedState = Gapless5State.None;

	};

	this.getState = () => state;

	this.unload = (isError) => {
		this.stop();
		setState(isError ? Gapless5State.Error : Gapless5State.None);
		if (request) {
			request.abort();
		}
		audio = null;
		source = null;
		buffer = null;
		position = 0;
		endpos = 0;
		seekablePercent = 0;
		if (gainNode) {
			gainNode.disconnect();
			gainNode = null;
		}
		player.onunload(this.audioPath);
	};

	const onEnded = () => {
		if (state === Gapless5State.Play) {
			player.onEndedCallback();
		}
	};

	const parseError = (error) => {
		if (error) {
			if (error.message) {
				return error.message;
			}
			if (error.target && error.target.error && error.target.error.message) {
				return error.target.error.message;
			}
			return error;
		}
		return 'Error playing Gapless 5 audio';
	};

	const onError = (error) => {
		const message = parseError(error);
		log.error(message);
		this.unload(true);
		player.onerror(this.audioPath, message);
	};

	const isErrorStatus = (status) => status / 100 >= 4;

	const onLoadedWebAudio = (inBuffer) => {
		if (!request) {
			return;
		}
		request = null;
		buffer = inBuffer;
		endpos = inBuffer.duration * 1000;
		if (!gainNode) {
			gainNode = player.context.createGain();
			gainNode.connect(player.context.destination);
		}	// After a shuffle or unshuffle, the array has changed. Get the index
		// for the current-displayed song in the previous array.
		gainNode.gain.value = this.getVolume();

		if (queuedState === Gapless5State.Play && state === Gapless5State.Loading) {
			playAudioFile(true);
		} else if ((audio !== null) && (queuedState === Gapless5State.None) && this.inPlayState(true)) {
			log.debug(`Switching from HTML5 to WebAudio: ${this.audioPath}`);
			setState(Gapless5State.Stop);
			this.play(true);
		}
		if (state === Gapless5State.Loading) {
			state = Gapless5State.Stop;
		}
		player.onload(this.audioPath, true);
		player.playlist.updateLoading();

	};

	const onLoadedHTML5Audio = () => {
		if (state !== Gapless5State.Loading) {
			return;
		}
		state = Gapless5State.Stop;
		endpos = audio.duration * 1000;

		if (queuedState === Gapless5State.Play) {
			playAudioFile(true);
		}

		player.onload(this.audioPath, false);
		player.playlist.updateLoading();

	};

	this.stop = (resetPosition = false) => {
		if (state === Gapless5State.None) {
			return;
		}
		log.debug(`Stopping: ${this.audioPath}`);

		if (audio) {
			audio.pause();
		}
		if (source) {
			if (endedCallback) {
				window.clearTimeout(endedCallback);
				endedCallback = null;
			}
			source.stop(0);
			source.disconnect();
		}

		setState(Gapless5State.Stop);
		if (resetPosition) {
			this.setPosition(0);
		}
	};

	const setEndedCallbackTime = (restSecNormalized) => {
		if (endedCallback) {
			window.clearTimeout(endedCallback);
		}
		if (this.inPlayState(true)) {
			const restSec = Math.max(0, (restSecNormalized / player.playbackRate));

			// not using AudioBufferSourceNode.onended or 'ended' because:
			// a) neither will trigger when looped
			// b) AudioBufferSourceNode version triggers on stop() as well
			log.debug(`onEnded() will be called on ${this.audioPath} in ${restSec.toFixed(2)} sec`);
			endedCallback = window.setTimeout(onEnded, (restSec * 1000));
		}
	};

	const getStartOffsetMS = (syncPosition, syncLatencySec) => {
		if (syncPosition && audio) {
			// offset will fall behind by a tick, factor this in when syncing position
			return audio.currentTime ? ((audio.currentTime + syncLatencySec) * 1000) + player.avgTickMS : 0;
		}
		return position;
	};

	const playAudioFile = (syncPosition) => {
		if (this.inPlayState(true)) {
			return;
		}
		position = Math.max(position, 0);
		if (!Number.isFinite(position) || position >= this.getLength()) {
			position = 0;
		}
		const looped = player.isSingleLoop();

		if (buffer !== null) {
			setState(Gapless5State.Starting);
			player.context.resume().then(() => {
				if (state === Gapless5State.Starting) {
					gainNode.gain.value = this.getVolume();

					if (source) {
						// stop existing AudioBufferSourceNode
						source.stop();
						source.disconnect();
					}
					source = player.context.createBufferSource();
					source.buffer = buffer;
					source.playbackRate.value = player.playbackRate;
					source.loop = looped;
					source.connect(gainNode);

					const offsetSec = getStartOffsetMS(syncPosition, player.context.baseLatency) / 1000;
					log.debug(`Playing WebAudio${looped ? ' (looped)' : ''}: ${this.audioPath} at ${offsetSec.toFixed(2)} sec`);
					source.start(0, offsetSec);
					setState(Gapless5State.Play);
					player.onplay(this.audioPath);
					setEndedCallbackTime(source.buffer.duration - offsetSec);
					if (audio) {
						audio.pause();
					}
				} else if (source) {
					// in case stop was requested while awaiting promise
					source.stop();
					source.disconnect();
				}
			});
		} else if (audio !== null) {
			const offsetSec = position / 1000;
			audio.currentTime = offsetSec;
			audio.volume = this.getVolume();
			audio.loop = looped;
			audio.playbackRate = player.playbackRate;

			setState(Gapless5State.Starting);
			audio.play().then(() => {
				if (state === Gapless5State.Starting) {
					log.debug(`Playing HTML5 Audio${looped ? ' (looped)' : ''}: ${this.audioPath} at ${offsetSec.toFixed(2)} sec`);
					setState(Gapless5State.Play);
					player.onplay(this.audioPath);
					setEndedCallbackTime(audio.duration - offsetSec);
				} else if (audio) {
					// in case stop was requested while awaiting promise
					audio.pause();
				}
			}).catch((e) => {
				if (e.name !== 'AbortError') {
					// Known HTML5 Audio issue on iOS Safari: user must interact separately for loading vs playing
					log.warn(`Failed to play ${this.audioPath}: ${e.message}`);
				}
			});
		}
	};

	// PUBLIC FUNCTIONS

	this.inPlayState = (checkStarting) => (state === Gapless5State.Play ||
		(checkStarting && state === Gapless5State.Starting));

	this.isPlayActive = (checkStarting) => (this.inPlayState(checkStarting) ||
		queuedState === Gapless5State.Play);

	this.getPosition = () => position;

	this.getLength = () => endpos;

	this.play = (syncPosition) => {
		player.onPlayAllowed();
		if (state === Gapless5State.Loading) {
			log.debug(`Loading ${this.audioPath}`);
			queuedState = Gapless5State.Play;
		} else {
			playAudioFile(syncPosition); // play immediately
		}
	};

	this.setPlaybackRate = (rate) => {
		if (source) {
			source.playbackRate.value = rate;
		}
		if (audio) {
			audio.playbackRate = rate;
		}
		setEndedCallbackTime((endpos - position) / 1000);
	};

	this.tick = (updateLoopState) => {
		if (state === Gapless5State.Play) {
			const nextTick = new Date().getTime();
			const elapsed = nextTick - lastTick;
			position += (elapsed * player.playbackRate);
			lastTick = nextTick;
			if (updateLoopState) {
				const shouldLoop = player.isSingleLoop();
				if (source && source.loop !== shouldLoop) {
					source.loop = shouldLoop;
					log.debug(`Setting WebAudio loop to ${shouldLoop}`);
				}
				if (audio && audio.loop !== shouldLoop) {
					audio.loop = shouldLoop;
					log.debug(`Setting HTML5 audio loop to ${shouldLoop}`);
				}
			}
			if (audio !== null) {
				audio.volume = this.getVolume();
			}
			if (gainNode !== null) {
				const { currentTime } = window.gapless5AudioContext;
				// Ramping to prevent clicks
				// Not ramping for the whole fade because user can pause, set master volume, etc.
				gainNode.gain.linearRampToValueAtTime(this.getVolume(), currentTime + (player.tickMS / 1000));
			}
		}

		if (seekablePercent < 1) {
			const { Starting, Play, Stop } = Gapless5State;
			if (player.useWebAudio && [ Starting, Play, Stop ].includes(state)) {
				seekablePercent = 1;
			} else if (player.useHTML5Audio && audio !== null && audio.seekable.length > 0) {
				seekablePercent = audio.seekable.end(audio.seekable.length - 1) / audio.duration;
				if (!Number.isFinite(seekablePercent)) {
					seekablePercent = 0;
				}
			} else {
				seekablePercent = 0;
			}
		}
		return seekablePercent;
	};

	this.getSeekablePercent = () => seekablePercent;

	this.setPosition = (newPosition, bResetPlay) => {
		if (bResetPlay && this.inPlayState()) {
			this.stop();
			position = newPosition;
			this.play();
		} else {
			position = newPosition;	// After a shuffle or unshuffle, the array has changed. Get the index
			// for the current-displayed song in the previous array.
		}
	};

	const fetchBlob = (audioPath, loader) => {
		fetch(audioPath).then((r) => {
			if (r.ok) {
				r.blob().then((blob) => {
					loader(blob);
				});
			} else {
				onError(r.statusUI);
			}
		}).catch((e) => {
			onError(e);
		});
	};

	this.load = () => {
		if (state !== Gapless5State.None) {
			return;
		}
		const { audioPath } = this;
		player.onloadstart(audioPath);
		state = Gapless5State.Loading;
		if (player.useWebAudio) {
			const onLoadWebAudio = (data) => {
				if (data) {
					player.context.decodeAudioData(data).then(
						(incomingBuffer) => {
							onLoadedWebAudio(incomingBuffer);
						}
					);
				}
			};
			if (audioPath.startsWith('blob:')) {
				fetchBlob(audioPath, (blob) => {
					request = new FileReader();
					request.onload = () => {
						if (request) {
							onLoadWebAudio(request.result);
						}
					};
					request.readAsArrayBuffer(blob);
					if (request.error) {
						onError(request.error);
					}
				});
			} else {
				request = new XMLHttpRequest();
				request.open('get', audioPath, true);
				request.responseType = 'arraybuffer';
				request.onload = () => {
					if (request) {
						onLoadWebAudio(request.response);
					}
				};
				request.onerror = () => {
					if (request) {
						onError('Failed to load audio track');
					}
				};
				request.onloadend = () => {
					if (request && isErrorStatus(request.status)) {
						onError('Failed to load audio track');
					}
				};
				request.send();
			}
		}
		if (player.useHTML5Audio) {
			const getHtml5Audio = () => {
				const audioObj = new Audio();
				audioObj.controls = false;
				// no pitch preservation, to be consistent with WebAudio:
				audioObj.preservesPitch = false;
				audioObj.mozPreservesPitch = false;
				audioObj.webkitPreservesPitch = false;
				audioObj.addEventListener('canplaythrough', onLoadedHTML5Audio, false);
				audioObj.addEventListener('error', onError, false);
				// TODO: switch to audio.networkState, now that it's universally supported
				return audioObj;
			};
			if (audioPath.startsWith('blob:')) {
				// TODO: blob as srcObject is not supported on all browsers
				fetchBlob(audioPath, (blob) => {
					audio = getHtml5Audio();
					audio.srcObject = blob;
					audio.load();
				});
			} else {
				audio = getHtml5Audio();
				audio.src = audioPath;
				audio.load();
			}
		}
	};
}

// A Gapless5FileList "class". Processes an array of JSON song objects, taking
// the "file" members out to constitute the this.playlist.sources[] in the Gapless5 player
function Gapless5FileList(parentPlayer, parentLog, inShuffle, inLoadLimit = -1, inTracks = [], inStartingTrack = 0) {
	const player = parentPlayer;
	const log = parentLog;

	// OBJECT STATE
	// Playlist and Track Items
	this.sources = []; // List of Gapless5Sources
	this.startingTrack = 0;
	this.trackNumber = -1; // Displayed track index in GUI

	// If the tracklist ordering changes, after a pre/next song,
	// the playlist needs to be regenerated
	this.shuffledIndices = [];
	this.preserveCurrent = true;
	this.loadLimit = inLoadLimit;

	// PRIVATE METHODS

	this.setStartingTrack = (newStartingTrack) => {
		if (newStartingTrack === 'random') {
			this.startingTrack = Math.floor(Math.random() * this.sources.length);
		} else {
			this.startingTrack = newStartingTrack || 0;
		}
		log.debug(`Setting starting track to ${this.startingTrack}`);
		this.trackNumber = this.startingTrack;
	};

	this.currentSource = () => {
		if (this.numTracks() === 0) {
			return null;
		}
		const { source } = this.getSourceIndexed(this.trackNumber);
		return source;
	};

	this.isLastTrack = (index) => (index === this.sources.length - 1) && !player.loop && (player.queuedTrack === null);

	this.gotoTrack = (pointOrPath, forcePlay, allowOverride, crossfadeEnabled) => {
		const { index: prevIndex, source: prevSource } = this.getSourceIndexed(this.trackNumber);
		// TODO: why is this returning false when queuedState was Play?
		const wasPlaying = prevSource.isPlayActive(true);
		const requestedIndex = this.indexFromTrack(pointOrPath);
		this.stopAllTracks(true, []);

		this.trackNumber = requestedIndex;
		log.debug(`Setting track number to ${this.trackNumber}`);
		this.updateLoading();

		const { index: nextIndex, source: nextSource } = this.getSourceIndexed(this.trackNumber);

		if (prevIndex === nextIndex) {
			if (forcePlay || wasPlaying) {
				prevSource.stop();
				prevSource.play();
			}
			return this.trackNumber;
		}
		if (!crossfadeEnabled) {
			prevSource.stop(true);
		}
		if (forcePlay || wasPlaying) {
			nextSource.play();
		}

		return this.trackNumber;
	};

	// PUBLIC METHODS
	// After a shuffle or unshuffle, the array has changed. Get the index
	// for the current-displayed song in the previous array.
	this.lastIndex = (index, newList, oldList) => {
		const compare = newList[index];
		// Cannot compare full objects after clone() :(
		// Instead, compare the generated index
		for (let n = 0; n < oldList.length; n++) {
			if (oldList[n].index === compare.index) {
				return n;
			}
		}

		// Default value, in case some array value was removed
		return 0;
	};

	this.stopAllTracks = (resetPositions, excludedTracks = []) => {
		for (let i = 0; i < this.sources.length; i++) {
			if (!excludedTracks.includes(this.getPlaylistIndex(i))) {
				this.sources[i].stop(resetPositions);
			}
		}
	};

	this.removeAllTracks = (flushList) => {
		for (let i = 0; i < this.sources.length; i++) {
			this.sources[i].unload(); // also calls stop
		}
		if (flushList) {
			this.shuffledIndices = [];
			this.setStartingTrack(-1);
		}
		this.sources = [];
	};

	this.setPlaybackRate = (rate) => {
		for (let i = 0; i < this.sources.length; i++) {
			this.sources[i].setPlaybackRate(rate);
		}
	};


	this.numTracks = () => this.sources.length;

	// returns tracks in play order (if shuffled, the shuffled order will be reflected here)
	this.getTracks = () => {
		const tracks = [];
		for (let i = 0; i < this.numTracks(); i++) {
			const { source } = this.getSourceIndexed(i);
			tracks.push(source.audioPath);
		}
		return tracks;
	};

	// if path, returns index in play order
	this.indexFromTrack = (pointOrPath) => (typeof pointOrPath === 'string') ?
		this.findTrack(pointOrPath) : pointOrPath;

	// returns index in play order
	this.findTrack = (path) => this.getTracks().indexOf(path);

	// returns source + index in play order
	this.getSourceIndexed = (index) => {
		return { index: index, source: this.sources[index] };
	};

	this.getPlaylistIndex = (index) => index;

	// inclusive start, exclusive end
	const generateIntRange = (first, last) => Array.from({ length: (1 + last - first) }, (_v, k) => k + first);

	// returns set of actual indices (not shuffled)
	this.loadableTracks = () => {
		if (this.loadLimit === -1) {
			return new Set(generateIntRange(0, this.sources.length));
		}
		// loadable tracks are a range where size=loadLimit, centered around current track
		const startTrack = Math.round(Math.max(0, this.trackNumber - ((this.loadLimit - 1) / 2)));
		const endTrack = Math.round(Math.min(this.sources.length, this.trackNumber + (this.loadLimit / 2)));
		const loadableIndices = new Set(generateIntRange(startTrack, endTrack));
		if (player.queuedTrack !== null) {
			loadableIndices.add(this.indexFromTrack(player.queuedTrack));
		}
		if (player.fadingTrack !== null) {
			loadableIndices.add(this.indexFromTrack(player.fadingTrack));
		}
		log.debug(`Loadable indices: ${JSON.stringify([ ...loadableIndices ])}`);
		return loadableIndices;
	};

	this.updateLoading = () => {
		const loadableSet = this.loadableTracks();

		// make sure to load current track before surrounding tracks
		const curSourceIndex = this.getPlaylistIndex(this.trackNumber);
		const curSource = this.sources[curSourceIndex];
		if (loadableSet.has(curSourceIndex) && (curSource.getState() === Gapless5State.None)) {
			log.debug(`Loading track ${curSourceIndex}: ${curSource.audioPath}`);
			curSource.load();
		} else {
			for (const [ index, source ] of this.sources.entries()) {
				const playlistIndex = this.getPlaylistIndex(index);
				const shouldLoad = loadableSet.has(playlistIndex);
				const hasLoaded = source.getState() !== Gapless5State.None;
				if (shouldLoad !== hasLoaded) {
					if (shouldLoad) {
						log.debug(`Loading track ${playlistIndex}: ${source.audioPath}`);
						source.load();
					} else {
						source.unload();
						log.debug(`Unloaded track ${playlistIndex}: ${source.audioPath}`);
					}
				}
			}
		}
	};

	// Add a new song into the FileList object.
	this.add = (index, audioPath) => {
		const source = new Gapless5Source(player, log, audioPath);
		this.sources.splice(index, 0, source);

		// insert new index in random position
		this.shuffledIndices.splice(Math.floor(Math.random() * this.numTracks()), 0, this.numTracks() - 1);

		// Shift trackNumber if the insert file is earlier in the list
		if (index <= this.trackNumber || this.trackNumber === -1) {
			this.trackNumber += 1;
			if (this.trackNumber > 0) {
				log.debug(`Insertion shifted current track number to ${this.trackNumber}`);
			}
		}
		this.updateLoading();
	};

	// Remove a song from the FileList object.
	this.remove = (index) => {
		this.sources.splice(index, 1);
		this.shuffledIndices.splice(this.shuffledIndices.indexOf(index), 1);
		for (let i = 0; i < this.shuffledIndices.length; i++) {
			if (this.shuffledIndices[i] >= index) {
				this.shuffledIndices[i] -= 1;
			}
		}

		// Stay at the same song index, unless trackNumber is after the
		// removed index, or was removed at the edge of the list
		if (this.trackNumber > 0 &&
			((index < this.trackNumber) || (index >= this.numTracks() - 2))) {
			this.trackNumber -= 1;
			log.debug(`Decrementing track number to ${this.trackNumber}`);
		}
		this.updateLoading();
	};

	// process inputs from constructor
	if (inTracks.length > 0) {
		for (let i = 0; i < inTracks.length; i++) {
			this.sources.push(new Gapless5Source(player, log, inTracks[i]));
			this.shuffledIndices.splice(Math.floor(Math.random() * this.numTracks()), 0, this.numTracks() - 1);
		}
		this.setStartingTrack(inStartingTrack);
		this.updateLoading();
	}
}

function Gapless5(options = {}) {
	// System
	let tickCallback = null;
	this.tickMS = 27; // fast enough for numbers to look real-time
	this.avgTickMS = this.tickMS;
	this.initialized = false;

	const log = {
		debug: () => {},
		log: () => {},
		warn: () => {},
		error: () => {},
	};
	switch (options.logLevel || LogLevel.Info) {
	/* eslint-disable no-fallthrough */
	case LogLevel.Debug:
		log.debug = console.debug;
	case LogLevel.Info:
		log.info = console.info;
	case LogLevel.Warning:
		log.warn = console.warn;
	case LogLevel.Error:
		log.error = console.error;
	case LogLevel.None:
	default:
		break;
	/* eslint-enable no-fallthrough */
	}
	this.playlist = null;
	this.loop = options.loop || false;
	this.singleMode = options.singleMode || false;
	this.exclusive = options.exclusive || false;
	this.queuedTrack = null;
	this.fadingTrack = null;
	this.volume = options.volume !== undefined ? options.volume : 1.0;

	// This is a hack to activate WebAudio on certain iOS versions
	const silenceWavData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
	let playAllowed = false; // true after user initiates action
	const stubAudio = new Audio();
	stubAudio.controls = false;
	stubAudio.loop = true;
	stubAudio.src = silenceWavData;
	stubAudio.load();
	this.onPlayAllowed = () => {
		if (!playAllowed) {
			playAllowed = true;
			stubAudio.play().then(() => {
				stubAudio.pause();
			});
		}
	};

	// these default to true if not defined
	this.useWebAudio = options.useWebAudio !== false;
	this.useHTML5Audio = options.useHTML5Audio !== false;
	this.playbackRate = options.playbackRate || 1.0;

	// There can be only one AudioContext per window, so to have multiple players we must define this outside the player scope
	if (window.gapless5AudioContext === undefined) {
		const MaybeContext = window.AudioContext || window.webkitAudioContext;
		if (MaybeContext) {
			window.gapless5AudioContext = new MaybeContext();
		}
	}
	this.context = window.gapless5AudioContext;

	// Callback and Execution logic
	this.keyMappings = {};

	// Callbacks
	this.onprev = () => {};
	this.onplayrequest = () => {}; // play requested by user
	this.onplay = () => {}; // play actually starts
	this.onpause = () => {};
	this.onstop = () => {};
	this.onnext = () => {};

	this.onerror = () => {};
	this.onloadstart = () => {}; // load started
	this.onload = () => {}; // load completed
	this.onunload = () => {};
	this.onfinishedtrack = () => {};
	this.onfinishedall = () => {};

	// INTERNAL HELPERS

	// Current index (if sourceIndex = true and shuffle is on, value will be different)
	this.getIndex = (sourceIndex = false) => {
		// FileList object must be initiated
		if (this.playlist !== null) {
			const { trackNumber } = this.playlist;
			return sourceIndex ? this.playlist.getSourceIndexed(trackNumber).index : trackNumber;
		}
		return -1;
	};

	const isValidIndex = (index) => index >= 0 && index < this.playlist.numTracks();

	// (PUBLIC) ACTIONS
	this.totalTracks = () => {
		// FileList object must be initiated
		if (this.playlist !== null) {
			return this.playlist.numTracks();
		}
		return 0;
	};

	this.isSingleLoop = () => this.loop && (this.singleMode || this.totalTracks() === 1);

	this.getPosition = () => {
		if (this.currentSource()) {
			return this.currentSource().getPosition();
		}
		return 0;
	};

	this.setPosition = (position) => {
		if (this.currentSource()) {
			this.currentSource().setPosition(position, true);
		}
	};

	// volume is normalized between 0 and 1
	this.setVolume = (volume) => {
		this.volume = Math.min(Math.max(volume, 0), 1);
	};

	this.getSeekablePercent = () => {
		const source = this.currentSource();
		return source ? source.getSeekablePercent() : 0;
	};

	this.onEndedCallback = () => {
		// we've finished playing the track
		let finishedAll = false;
		const source = this.currentSource();
		if (source) {
			const { audioPath } = source;
			if (this.queuedTrack !== null) {
				this.gotoTrack(this.queuedTrack);
				this.queuedTrack = null;
			} else if (this.loop || this.getIndex() < this.totalTracks() - 1) {
				if (this.singleMode || this.totalTracks() === 1) {
					if (this.loop) {
						this.prev(null, false);
					}
				} else {
					this.next(null, true, true);
				}
			} else {
				source.stop(true);
				finishedAll = true;
			}
			this.onfinishedtrack(audioPath);
		}
		if (finishedAll) {
			this.onfinishedall();
		}
	};

	this.addTrack = (audioPath) => {
		const nextTrack = this.playlist.numTracks();
		this.playlist.add(nextTrack, audioPath);

	};

	this.insertTrack = (point, audioPath) => {
		const numTracks = this.totalTracks();
		const safePoint = Math.min(Math.max(point, 0), numTracks);
		if (safePoint === numTracks) {
			this.addTrack(audioPath);
		} else {
			this.playlist.add(safePoint, audioPath);
		}

	};

	this.getTracks = () => this.playlist.getTracks();

	this.getTrack = () => this.currentSource() ? this.currentSource().audioPath : '';

	this.findTrack = (path) => this.playlist.findTrack(path);

	this.removeTrack = (pointOrPath) => {
		const point = this.playlist.indexFromTrack(pointOrPath);
		if (!isValidIndex(point)) {
			log.warn(`Cannot remove missing track: ${pointOrPath}`);
			return;
		}
		const deletedPlaying = point === this.playlist.trackNumber;

		const { source: curSource } = this.playlist.getSourceIndexed(point);
		if (!curSource) {
			return;
		}
		let wasPlaying = false;

		if (curSource.state === Gapless5State.Loading) {
			curSource.unload();
		} else if (curSource.inPlayState(true)) {
			wasPlaying = true;
			curSource.stop();
		}

		this.playlist.remove(point);

		if (deletedPlaying) {
			this.next(); // Don't stop after a delete
			if (wasPlaying) {
				this.play();
			}
		}


	};

	this.replaceTrack = (point, audioPath) => {
		this.removeTrack(point);
		this.insertTrack(point, audioPath);
	};

	this.removeAllTracks = (flushPlaylist = true) => {
		this.playlist.removeAllTracks(flushPlaylist);

	};

	this.currentSource = () => this.playlist ? this.playlist.currentSource() : null;
	this.currentLength = () => this.currentSource() ? this.currentSource().getLength() : 0;
	this.currentPosition = () => this.currentSource() ? this.currentSource().getPosition() : 0;

	this.setPlaybackRate = (rate) => {
		tick(); // tick once here before changing the playback rate, to maintain correct position
		this.playbackRate = rate;
		this.playlist.setPlaybackRate(rate);
	};

	this.queueTrack = (pointOrPath) => {
		if (!isValidIndex(this.playlist.indexFromTrack(pointOrPath))) {
			log.error(`Cannot queue missing track: ${pointOrPath}`);
		} else {
			this.queuedTrack = pointOrPath;
			this.playlist.updateLoading();
		}
	};

	this.gotoTrack = (pointOrPath, forcePlay, allowOverride = false, crossfadeEnabled = false) => {
		if (!isValidIndex(this.playlist.indexFromTrack(pointOrPath))) {
			log.error(`Cannot go to missing track: ${pointOrPath}`);
		} else {
			this.playlist.gotoTrack(pointOrPath, forcePlay, allowOverride, crossfadeEnabled);
		}
	};

	this.prevtrack = () => {
		const currentSource = this.currentSource();
		if (!currentSource) {
			return;
		}
		let track = 0;
		if (this.getIndex() > 0) {
			track = this.getIndex() - 1;
		} else if (this.loop) {
			track = this.totalTracks() - 1;
		} else {
			return;
		}
		this.gotoTrack(track);
		const newSource = this.currentSource();
		this.onprev(currentSource.audioPath, newSource.audioPath);
	};

	this.prev = (uiEvent, forceReset) => {
		const currentSource = this.currentSource();
		if (!currentSource) {
			return;
		}
		let wantsCallback = true;
		let track = 0;
		const playlistIndex = this.getIndex();
		const position = currentSource.getPosition();
		if (position > 0) {
			// jump to start of track if we're not there
			currentSource.setPosition(0, forceReset || Boolean(uiEvent));
			track = playlistIndex;
			wantsCallback = false;
		} else if (this.singleMode && this.loop) {
			track = playlistIndex;
		} else if (playlistIndex > 0) {
			track = playlistIndex - 1;
		} else if (this.loop) {
			track = this.totalTracks() - 1;
		} else {
			return;
		}

		if (wantsCallback) {
			this.gotoTrack(track, forceReset, true);
			const newSource = this.currentSource();
			this.onprev(currentSource.audioPath, newSource.audioPath);
		}
	};

	this.next = (_uiEvent, forcePlay, crossfadeEnabled) => {
		const currentSource = this.currentSource();
		if (!currentSource) {
			return;
		}
		let track = 0;
		const playlistIndex = this.getIndex();
		if (this.singleMode) {
			track = playlistIndex;
		} else if (playlistIndex < this.totalTracks() - 1) {
			track = playlistIndex + 1;
		} else if (!this.loop) {
			return;
		}
		this.gotoTrack(track, forcePlay, true, crossfadeEnabled);
		const newSource = this.currentSource();
		this.onnext(currentSource.audioPath, newSource.audioPath);
	};

	this.play = () => {
		const source = this.currentSource();
		if (!source) {
			return;
		}
		source.play();
		this.onplayrequest(source.audioPath);
	};

	this.playpause = () => {
		const source = this.currentSource();
		if (source && source.inPlayState(true)) {
			this.pause();
		} else {
			this.play();
		}
	};

	this.cue = () => {
		if (this.currentPosition() > 0) {
			this.prev(null, true);
		}
		this.play();
	};

	this.pause = () => {
		const source = this.currentSource();
		this.playlist.stopAllTracks();
		if (source) {
			this.onpause(source.audioPath);
		}
	};

	this.stop = () => {
		const source = this.currentSource();
		this.playlist.stopAllTracks(true);
		if (source) {
			this.onstop(source.audioPath);
		}
	};


	// (PUBLIC) QUERIES AND CALLBACKS

	this.isPlaying = () => this.currentSource() && this.currentSource().inPlayState() || false;

	// INIT AND UI

	const getFadingSource = () => {
		if (this.fadingTrack !== null) {
			const { source: fadingSource } = this.playlist.getSourceIndexed(this.fadingTrack);
			return fadingSource;
		}
		return null;
	};

	let lastTick = -1;
	const tick = () => {
		// JS tick latency is variable, maintain rolling average of past ticks
		const curTick = Date.now();
		if (lastTick >= 0) {
			const elapsedMS = curTick - lastTick;
			this.avgTickMS = (this.avgTickMS * 0.9) + (elapsedMS * 0.1);
		}
		lastTick = curTick;
		const fadingSource = getFadingSource();
		if (fadingSource) {
			fadingSource.tick(false);
		}
		const source = this.currentSource();
		if (source) { source.tick(true); }
		if (tickCallback) {
			window.clearTimeout(tickCallback);
		}
		tickCallback = window.setTimeout(tick, this.tickMS);
	};

	if (typeof Audio === 'undefined') {
		log.error('This player is not supported by your browser.');
		return;
	}

	// set up starting track number
	if ('startingTrack' in options) {
		if (typeof options.startingTrack === 'number') {
			this.startingTrack = options.startingTrack;
		} else if ((typeof options.startingTrack === 'string') && (options.startingTrack === 'random')) {
			this.startingTrack = 'random';
		}
	}

	// set up tracks into a FileList object
	if ('tracks' in options) {
		let items = [];
		let startingTrack = 0;
		if (Array.isArray(options.tracks)) {
			if (typeof options.tracks[0] === 'string') {
				items = options.tracks;
				for (let i = 0; i < options.tracks.length; i++) {
					items[i] = options.tracks[i];
				}
				startingTrack = this.startingTrack || 0;
			} else if (typeof options.tracks[0] === 'object') {
				// convert JSON items into array
				for (let i = 0; i < options.tracks.length; i++) {
					items[i] = options.tracks[i].file;
				}
				startingTrack = this.startingTrack || 0;
			}
		} else if (typeof options.tracks === 'string') {
			items[0] = options.tracks;
		}
		this.playlist = new Gapless5FileList(this, log, options.shuffle, options.loadLimit, items, startingTrack);
	} else {
		this.playlist = new Gapless5FileList(this, log, options.shuffle, options.loadLimit);
	}

	this.initialized = true;


	tick();
}

/* global debug, music:writeable */
music = new Gapless5({ loop: true, logLevel: debug ? 1 : undefined });

/* @license-end */
