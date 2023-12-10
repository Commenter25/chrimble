/*! @license Crazy Chrimble Catastrophy v2.0.5 | Copyright (c) 2023 Commenter25 | MIT License */
/* @license magnet:?xt=urn:btih:d3d9a9a6595521f9666a5e94cc830dab83b65699&dn=expat.txt MIT License */
/* global timer, fast, loadbutton, errormode, favicon, YAPLload, YAPLloaded, YAPLfailed, debug:writeable, mainLoaded:writeable, music:writeable */
"use strict";

// please ignore how this is an obvious bodge job by someone who had 0 prior javascript knowledge and rushed a lot of it and designed it with running locally in mind and bodged in making it work with network latency

let matrix = [[0], [0]]; const px = 50; // 16x12 upscaled by 5000% to be 800x600 with 50x50 tiles

// #region HTML Elements
const loading = document.getElementById("loading");

loading.insertAdjacentHTML("beforebegin", `
<main id="container" style="display:none">

	<div id="mapIcons">
		<img id="player" src="assets/img/50x50.webp" style="object-position: 0 0" loading="lazy">
	</div>

	<canvas id="debugCanvas" style="display: none"></canvas>

	<div id="clickZones"></div>

	<div id="controls" style="display: none">
		<button id="optsButton" onclick="optsOpen()">Options (o)</button>
		<button id="invButton" onclick="invOpen()">Inventory (i)</button>
		<div id="optsBox" style="display: none">
			<h2>Volume</h2>
			<input type="range" min="0.01" max="1" step="0.01"/>
		</div>
	</div>

	<img id="speechImg">

	<div id="theBox" style="display:none">
		<div id="speechContainer">
			<p id="speechName"></p>
			<p id="speechText"></p>
			<button id="next">❯❯❯</button>
		</div>

		<menu id="invList"></menu>
		<menu id="choiceList"></menu>
	</div>
</main>

<div id="overlay" class="overlay" style="display:none"></div>

<div id="midload" class="overlay" style="display:none"><p></p></div>

<div id="endscreen" class="overlay" style="display:none">
	<h1 id="ending"></h1>
	<br>
	<h2 id="time" style="display:none"></h2><span id="maxtime" style="display:none"></span>
	<h2 id="karma"></h2>
	<h2 id="intel"></h2>
	<br>
	<p id="endflavor"></p>
	<br>
	<button id="chooseagain" onclick="endChoiceNow()">choose again</button><p id="endButtonOr">or</p><button id="replay" onclick="replay()">replay in fast mode</button>
	<button id="creditsbutton" onclick="openCredits()" style="display:none">credits</button>
	<br>
	<p id="endcreepy"></p>
</div>
`)

const main = document.getElementById("container");
	const mapIcons = document.getElementById("mapIcons");
		const playerImg = document.getElementById("player");

	const debugCanvas = document.getElementById("debugCanvas");

	const clickZones = document.getElementById("clickZones");

	const speechImg = document.getElementById("speechImg");

	const controls = document.getElementById("controls");
		const optsButton = document.getElementById("optsButton");
			const optsBox = document.getElementById("optsBox");
				const volSlider = optsBox.querySelector("input")
		const invButton = document.getElementById("invButton");

	const theBox = document.getElementById("theBox");
		const speechContainer = document.getElementById("speechContainer");
			const speechName = document.getElementById("speechName");
			const speechText = document.getElementById("speechText");
			const next = document.getElementById("next");

		const invList = document.getElementById("invList");
		const choiceList = document.getElementById("choiceList");

const overlay = document.getElementById("overlay");

const midload = document.getElementById("midload");
	const midloadText = midload.firstChild;

const endScreen = document.getElementById("endscreen");
	const endTitle = document.getElementById("ending");

	const endTime = document.getElementById("time");
		const endMaxTime = document.getElementById("maxtime");
	const endKarma = document.getElementById("karma");
	const endIntel = document.getElementById("intel");

	const endText = document.getElementById("endflavor");

	const chooseAgain = document.getElementById("chooseagain");
	const endButtonOr = document.getElementById("endButtonOr");
	const replayButton = document.getElementById("replay");

	const creditsButton = document.getElementById("creditsbutton")

	const endCreepy = document.getElementById("endcreepy");

//#endregion


// #region Spritesheets
const fiftyby = [ "50x50.webp",
	["player", "house", "house-evil", "rock", "potion", "bottle", "water", "garf"],
	["aaron", "dslite", "r4", "sd", "store", "blueinator"],
	["balde", "scissors", "coin", "chest", "blaster"],
	["worm-map", "worm", "worms", "angry", "angry-happy"],
	["ford", "car-red", "car-orange", "grinch", "button"]
]

const grinchSheet = ["grinch.webp",
	["grinch", "smirk"],
	["dying", "dead"]
]

// returns position to be multiplied by size in px
function getSprite(sheet, name) {
	for (let i = 1; i < sheet.length; i++) {
		const x = sheet[i].indexOf(name);
		if (x !== -1) return [x, i - 1]
	}
	// fallback
	return [0, 0]
}
//#endregion


// #region Utilities
const sign =()=> (Math.round(Math.random()) * 2) - 1; // randomly returns 1 or -1

const secondsAgo = unixTime => (new Date().getTime() - unixTime) / 1000;

const pxify = (num) => `${num * px}px`;

const checkKey =(code)=> (code === "Enter" || code === "Space")

function dud() { /* intentionally empty function */ }

const crispy = "image-rendering: pixelated; image-rendering: crisp-edges; "
const mushy = "image-rendering: auto; "

function deleteElems(classname) {
	const elements = document.getElementsByClassName(classname);
	if (elements === undefined) return;
	while (elements.length > 0) elements[0].remove();
}

function randomColor() {
	let color = "#"; const letters = "0123456789ABCDEF";
	for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
	return color;
}

function test(y, x) {
	if (matrix[y] !== undefined && matrix[y][x] !== 1) return true;
	return false;
}

function startLevel(bg, y, x) {
	while (mapIcons.lastChild.id !== "player") {
		mapIcons.removeChild(mapIcons.lastChild);
	}
	main.style.background = `url(assets/img/${bg})`;
	updatePlayerPos(y, x);
	matrix[player.y][player.x] = 2;
}

function animate(element, secs, ani) {
	// i have no idea why i did it this way, but if i change it it stops working
	return new Promise(async (res)=>{ // eslint-disable-line no-async-promise-executor
		element.style.animation = `${secs}s ${ani}`;
		await timer((secs * 1000) - 10);
		element.style.animation = "";
		res();
	});
}

async function cutscene(hidemap, bg = "", secs = 1, ani = "ease-in-out fade") {
	moveStop();

	await animate(main, secs, `${ani}out`);
	if (bg !== "") bg = `url(assets/img/${bg})`
	main.style.background = bg;

	if (hidemap === true) {
		mapIcons.style.display = "none";
		controls.style.display = "none";
	} else if (hidemap === false) {
		mapIcons.style.display = "";
		controls.style.display = "";
	}

	await animate(main, secs, `${ani}in`);

	if (hidemap === false) moveAllow();
}

let couldMove = false;
function boxOpen(show) {
	couldMove = canMove;
	moveStop();
	if (show === invList) invAllow();

	speechContainer.style.display = "none";
	invList.style.display = "none";
	choiceList.style.display = "none";
	show.style.display = "";

	theBox.style.display = "";
	theBox.focus();
}
function boxClose() {
	theBox.style.display = "none";
	speechContainer.style.display = "none";
	invList.style.display = "none";
	invList.innerHTML = "";
	choiceList.style.display = "none";
	choiceList.innerHTML = "";
	speechImg.style.display = "none";

	if (couldMove) moveAllow();
}
boxClose();

function makeImg(src, style = false, appendto = main, className = false) {
	const tag = document.createElement("img");
	tag.src = `assets/img/${src}`;
	if (style) tag.style = style;
	if (className) tag.className = className;
	if (appendto) appendto.appendChild(tag);
	return tag;
}

async function ebOverlay(img, time) {
	overlay.style.display = "";
	overlay.style.opacity = "50%";
	const trans = makeImg(img, false, overlay);
	await timer(time);
	await animate(overlay, 0.3, "linear fadeinfrom");
	overlay.style.opacity = "100%"
	await timer(500);
	overlay.style.display = "none";
	overlay.style.opacity = "";
	overlay.removeChild(trans);
}
//#endregion


// #region Preloading
let preloadCount = 0, preloadWaiting = false;
async function preload(array = []) {
	preloadWaiting = true;
	if (YAPLloaded < preloadCount) {
		while (YAPLloaded < preloadCount) await timer(200)
	}
	YAPLload("assets", array)
	preloadCount = array.length

	await timer(100) // to make sure the loading screen stays
	preloadWaiting = false;
}

// can't use animations as favicon
const loadicon = document.createElement("canvas");
const loaddraw = loadicon.getContext("2d");
loaddraw.canvas.width = 16;
loaddraw.canvas.height = 16;
const loadimg = new Image();
loadimg.src = `data:image/webp;base64,UklGRuADAABXRUJQVlA4TNQDAAAvP8ADEB5Z7v+3bdOTOsxO3rvnv8OjW0/dgw8+QI/ge/Q2JqVe4U8I2XsShp8MQQcQ1C3E8kCgtyKrewoZRCCwiOALuI0kSVJyn4tD/GVaukAk1oIxBVPOI1yEHdm2qoj8ozgJ4O4bm38LYI/bE9xhwdG2SZFSa7i7UxvhfgA6JyXfItTcoR5CyzhAxZzB6iF0jlBHwB1+Rm7bRpKmy1HtzHwCEbFLudilvNXdqhc9ao/dau/drX7brX7UrTGAJjOKlRnFid5RK/XO+n7PqB13tdJeRrGUUWo5pkAWFhc1xUVbcO+T12cUyzKKOTTZq93Xq3M0vPfvT74mfxfeD7/9rX/ap9+HJgkJoQAOYAAgWy1CIKQcRBARvA2swAawEWAXhJwIQQ5aEC2YFqksDUJDgjgRIo5dByLQMkoFSj8QtoBM8pkOUGwCwgVASgrQAIhByHfLHYQYYqFBARrHnieEIGTIhlKKFixp4CQJZvxyx267rmkBrbU7o1TE9mJz0wNOAF4HJICnmsboIJYHQJrAjMCUxsKwjE2HGzJCxFrKHsROS+vPK+v8dUSYUewRhcvyQQALcr7RpQJ1nwhaCyBIyncsuEebPkpVRd40MLLUBSLIb9HrEhR4YwqRSmK/zrwQwApEPLXP7XZnNwhMA3HEdR1UKjJRb05BUEKpAwAFPqOJSCk8PV92PgObRWfzMIQ4IOYgqVl0SCk0xLqGZtM3EHRhU8omosVSXNRe3T73P8e7ZnZpQKirQRUtOgAwLNFaai1ZdQDrSAwchuWj3LWkuOgo7JlCMCvQBcClBStrjOsS33TpBHrXGrdg+ei+gvyWLtBgb3wLkp/VSEkLbApol4YI27YZH9hGYmB3N20zRFBVHV7yPvNzykbze6CFlE4ULd8TEnKtvZEwbO+aMp3PYiF2Nx2Le0iSS96yxz3W7U/NEMEm1DuJKC0Wp/LiCzQwpzqsmEK3hWHpXpoKw/JBECE8GzRONEj1uMcsplNTMz7/fb9TkdV3arcrpQL6DeJIuw0xCLnt+3ZHjIsFRGAVAsiPNpAI2rDXuE+klgZTQVKV6h0b5v8EYiYU9TCkBUZY12cacFgBAiGM/N80LMONWUcshPfJcYDk91SQcp9YmgTBu7IyQov/9DcAYajf8J8zwCigtU5T113gOxY8b2RkZGpqnx+I1/zlspKKp8e5tbjo3SwuGtDSl38aHhybLqPfT4xxv7rrtnbHtQNN3rQfvml/dGvsHu7M7fetuXm52deXBavtvKyIJrOS2qxkNtfTxcKWbRS2bDU/0rmsZCQrqUZEBA==`;

let keepDrawingLoader = false;
async function loadingFavicon() {
	keepDrawingLoader = true;
	let i = 0;
	while (keepDrawingLoader) {
		i++; if (i === 4) i = 0; // frame counter
		loaddraw.clearRect(0, 0, 16, 16);
		loaddraw.drawImage(loadimg, 16 * i, 0, 16, 16, 0, 0, 16, 16);
		favicon.setAttribute('href', loadicon.toDataURL())
		await timer(200)
	}
	favicon.setAttribute('href', 'assets/ico/favicon.svg')
}

async function loadingScreen() {
	if (YAPLloaded >= preloadCount && !preloadWaiting) return;

	midload.style.display = ""
	loadingFavicon()
	musPause();
	while ((YAPLloaded < preloadCount || preloadWaiting) && !YAPLfailed) {
		midloadText.textContent = `${YAPLloaded}/${preloadCount}`
		await timer(200)
	}
	keepDrawingLoader = false;

	if (YAPLfailed) {
		midloadText.textContent = "Something has gone horribly wrong!"
		midload.style.backgroundImage = ""
		// force game to never continue
		while (YAPLfailed) await timer(99999999)
	}

	// don't do anything until currently active window
	if (document.hidden) await new Promise( (res)=> {
		document.addEventListener("visibilitychange", () => {
			if (!document.hidden) res();
		}, {once: true});
	});

	musResume()
	midload.style.display = "none"
}
// not worth a http req, ppl needing this need those minimized
midload.style.backgroundImage = "url(data:image/webp;base64,UklGRuQCAABXRUJQVlA4WAoAAAASAAAAxgAANAAAQU5JTQYAAAD/////AABBTk1GygEAAAAAAAAAAMYAADQAAPQBAABWUDhMsQEAAC/GAA0QXzD/8z//SgMAacNscPSdSSYD8I5EouOCMOBAPHzIrW3LkZVrFPKaZEEK8ovyHioOUiCEnwQLVz7jIW949aqqu1cXyoro/wS8xwrXEL8nzv9eHizh0RKO/Mf0Qed0UWutpaMP4tjFWSjt3CDGXDyHCwGAK3EDVAZC0gGkA4gNgo0ABAd0G8E5lzjkx0A+4GLPAGgqJKmMiOJ+bzvRGADM/Oi8vpWpAMEBN1zYbm4dJ+CJ95wAXJlnTgAu9kRA+7EDAxyJmAXaTmAErp4BiIfHEaAEsiMw8+TNcX4A1hETJj8nIoF3hEa7qXRiIEKlsQyts4NcZSj2QmgLBOdgmTrBxDYCZ1w253CWzazj1jg38im4BpQZ4JxyzkBHqkCo9AqACxFwFedNojFnL3gUlwTgh5iFWisAQqL28UTcx9USrXRRXAAaIhURjU8EJiAR0FaSrNaC7oUkYj68eZQIqQZgDVySbaAuMSwJW6rlkHMbzuGi1lpx1FprwfC7+yNK0g3OU7GC4ApGnSuArcCXEFihlmB/Cs4VBFbIFYStQDj/Kjs9ScS5e0gizk4VWwMAQU5NRkoAAAAAAAAAAADGAAA0AAD0AQAAVlA4TDEAAAAvxgANEB8w//M//wKBZLTMVg90GKAgktQGHZjAAtLQ31syE9H/CYC/KaM+oQgY9S19AEFOTUZCAAAAAAAAAAAAxgAANAAA9AEAAFZQOEwqAAAAL8YADRAfMP/zP/8CgWS0zFYPdBhAOIFh3VvSgvKSiuj/BOhsEuAKBGwkQU5NRkoAAAAAAAAAAADGAAA0AAD0AQAAVlA4TDEAAAAvxgANEB8w//M//wKBZLTMVg90GKAgktQGHZjAAtLQ31syE9H/CYAvLaM+oQgY9W1vAA==)"
//#endregion


// #region Sound System
let userVol = JSON.parse(localStorage.getItem("volume")) || 0.5; // multiplier

const ebAssets = [
	"snd/eb/enemydie.ogg",
	"snd/eb/enemyturn.ogg",
	"snd/eb/psi.ogg",
	"snd/eb/hit.ogg",
	"snd/eb/death.ogg",
	"mus/eb/winmus.ogg"
];

let sfx = new Audio();
function playSfx(snd) {
	return new Promise((res)=>{
		sfx = new Audio(`assets/snd/${snd}`);
		sfx.volume = 1 * userVol;
		sfx.play();
		sfx.addEventListener("ended", res, {once: true});
	});
}

// see localonly.js for music system for file:

let musPlay, musCurrent, musCurVol;
if (window.location.protocol !== "file:") {
	musPlay = async (snd, vol = defVol, fade = defFade, intro = false, introvol = false) => {
		// do nothing if this song is already playing
		if (!snd || (music.getTrack().endsWith(snd) && music.volume !== 0)) return;

		music.removeAllTracks(); music.onplay = () => {};
		if (intro) music.addTrack(`assets/mus/${intro}`)
		music.addTrack(`assets/mus/${snd}`)

		music.play();

		musCurVol = introvol || vol;
		if (fade) {
			music.volume = 0;
			await musVolume(introvol || vol, fade)
		} else {
			music.volume = (introvol || vol) * userVol;
		}

		music.onplay = () => {}
		if (intro) music.onplay = (newsrc) => {
			if (!newsrc.endsWith(snd)) return;
			music.volume = vol * userVol;
			musCurVol = vol;
			music.removeTrack(0);
			music.onplay = () => {}
		}
	}

	musCurrent =(isthisit)=> {
		if (!isthisit) return music.getTrack()

		return music.getTrack().endsWith(isthisit)
	}
}

const defVol = 0.3, defFade = 0.125, defSlowFade = 0.0125
async function musVolume(vol, fade = defFade) {
	// clamp vol between 0 and 1
	vol = Math.min(Math.max(vol, 0), 1) * userVol;

	// turn it down
	while (music.volume > vol) {
		if (music.volume <= 0.001) break;
		music.volume = Math.max(music.volume - (fade * userVol), 0)
		await timer(50);
	}

	// turn it up
	while (music.volume < vol) {
		if (music.volume >= 0.999) break;
		music.volume = Math.min(music.volume + (fade * userVol), 1)
		await timer(50);
	}
}
let oldVol = userVol
async function musPause(fade = defFade) {
	oldVol = music.volume;
	if (fade) {
		await musVolume(0, fade);
	} else {
		music.volume = 0
	}
	music.pause();
}
async function musResume(vol = oldVol, fade = defFade) {
	music.play();
	if (fade) {
		await musVolume(vol, fade)
	} else {
		music.volume = vol * userVol
	}
}

let volSounded = new Date().getTime()
volSlider.addEventListener("input", ({target})=>{
	music.volume = musCurVol * target.value
	userVol = target.value
	const curTime = new Date().getTime()
	if (curTime - volSounded > 200) {
		playSfx("weaponselect.wav")
		volSounded = curTime
	}
	sfx.volume = target.value
})
let optsShowing = false;
function optsOpen() {
	optsBox.style.display = ""
	optsButton.className = "toggled";
	optsShowing = true;

	volSlider.value = userVol
	volSlider.focus({focusVisible: true});

	const close =({code})=>{
		if (code && code !== "KeyO") return;

		userVol = volSlider.value;
		localStorage.setItem("volume", JSON.stringify(userVol));

		optsShowing = false;
		optsBox.style.display = "none"
		optsButton.onclick = optsOpen;
		optsButton.className = "";
		document.removeEventListener("keydown", close)
	};
	optsButton.onclick = close;
	document.addEventListener("keydown", close)
}
//#endregion


// #region Player Input
const player = { y: 0, x: 0, name: "player" };
const oldPos = { y: 0, x: 0 };
let curPosVal = 1;
let wasdCheck = 0;
let clipCheck = 0;
let hasInted = 0;
let moveCount = 0;

function isPlayer(y, x) {
	if (player.y === y && player.x === x) return true;
	return false;
}

function clickZone(coords) {
	const zone = document.createElement("button");
	zone.className = "clickZone";
	if (coords[2]) zone.id = "clickZone" + coords[2]

	const [y, x] = coords;
	zone.style.top = pxify(y);
	zone.style.left = pxify(x);

	zone.onclick =()=>{ updatePlayerPos(y, x) };

	clickZones.appendChild(zone);
}
function makeClickZones() {
	deleteElems("clickZone")
	const valids = [
		[player.y - 1, player.x, "Up"],
		[player.y, player.x - 1, "Left"],
		[player.y, player.x + 1, "Right"],
		[player.y + 1, player.x, "Down"]
	];
	for (const place of valids) {
		if (noclip || test(...place)) clickZone(place)
	}
}

function updatePlayerPos(newy = player.y, newx = player.x, checkInt = true) {
	if (!(newy in matrix)) return false;
	if (!(newx in matrix[newy])) return false;
	const newPos = matrix[newy][newx];

	// blocked
	if (checkInt && newPos === 1) {
		if (noclip) {
			if (clipCheck === 0) baldeEarlyRun();
			clipCheck++;
		} else { return false }
	}

	// save oldPos
	oldPos.y = player.y;
	oldPos.x = player.x;

	// replace current
	matrix[player.y][player.x] = curPosVal;
	curPosVal = newPos;

	// update player
	player.y = newy; player.x = newx;
	matrix[newy][newx] = 2;

	// update sprite
	playerImg.style.top = pxify(newy);
	playerImg.style.left = pxify(newx);

	makeClickZones();

	if (debug) console.log(`Player: { Y: ${player.y}, X: ${player.x} }`);

	// only count when interactable/voluntary
	if (checkInt) moveCount++

	// interact
	if (checkInt && newPos > 2) {
		hasInted++;
		interacts[newPos - 3]();
	}

	// noclip message
	const noclipBox = document.getElementById(`playerbox`)
	if (noclipBox) {
		noclipBox.style.top = pxify(player.y);
		noclipBox.style.left = pxify(player.x);
	}



	// from here, move ford
	if (!hasItem("Ford")) return true;

	// move normally
	let fordMoved = false;
	if (matrix[oldPos.y][oldPos.x] !== 1) {
		fordMove(oldPos.y, oldPos.x);
		fordMoved = true;
	}

	// at home
	if ( isPlayer(9, 2) || isPlayer(10, 2) ) {
		fordMove(9, 1);
		fordMoved = true;
	}

	// noclip compensation
	// i hate this i hate all of this this makes me suffer
	if (!fordMoved) {
		const newFordPos = { y: player.y, x: player.x };

		const testFord =()=> {
			// don't move onto balde's void house
			if (evilHouseEnt && matrix[newFordPos.y][newFordPos.x] === evilHouseEnt.val) return false;

			if (test(newFordPos.y, newFordPos.x))
			if (newFordPos.y !== player.y || newFordPos.x !== player.x)
			if (newFordPos.y > 0 && newFordPos.x > 0)
			if (newFordPos.y < 12 && newFordPos.x < 16 )
				return true;

			return false;
		};

		// ideally would test longer distances and not go through walls but lol too much effort 2 care
		for (let i = 1; i < 2 && !testFord(); i++) {
			if (test(newFordPos.y, player.x - i) && player.x !== 0) {
				newFordPos.x = player.x - i;
			} else if (test(newFordPos.y, player.x + i)) {
				newFordPos.x = player.x + i;
			} else if (test(player.y + i, newFordPos.x)) {
				newFordPos.y = player.y + i;
			} else if (test(player.y - i, newFordPos.x)) {
				newFordPos.y = player.y - i;
			}
		}

		if (testFord()) {
			fordMove(newFordPos.y, newFordPos.x);
		}
	}

	return true
}

let noclipincr = 0;
function mapcontrols({ code }) {
	if (optsShowing) return

	function inv() {
		if (invButton.disabled) return;
		invOpen();
		invList.firstChild.firstChild.focus({focusVisible: true});
	}

	switch (code) {
		case "KeyY":
			if (debugCommand) debug = !debug; break;

		// INVENTORY
		case "KeyE": /* falls through */
		case "KeyB":
			wasdCheck++; inv(); break;

		// MOVEMENT
		case "KeyW": wasdCheck++; /* falls through */
		case "ArrowUp":
			updatePlayerPos(player.y - 1); break;
		case "KeyS": wasdCheck++; /* falls through */
		case "ArrowDown":
			updatePlayerPos(player.y + 1); break;
		case "KeyA": wasdCheck++; /* falls through */
		case "ArrowLeft":
			updatePlayerPos(player.y, player.x - 1); break;
		case "KeyD": wasdCheck++; /* falls through */
		case "ArrowRight":
			updatePlayerPos(player.y, player.x + 1); break;

		// NOCLIP
		case "KeyN":
			noclipincr = "n"; noclipAlert(noclipincr); break;
		case "KeyO":
			if (noclipincr === "n") { noclipincr += "o"; noclipAlert(noclipincr); }
			else { optsOpen(); }
			break;
		case "KeyC":
			if (noclipincr === "no") { noclipincr += "c"; noclipAlert(noclipincr); } break;
		case "KeyL":
			if (noclipincr === "noc") { noclipincr += "l"; noclipAlert(noclipincr); } break;
		case "KeyI":
			if (noclipincr === "nocl") { noclipincr += "i"; noclipAlert(noclipincr); }
			else { inv(); }
			break;
		case "KeyP":
			if (noclipincr === "nocli") { noclipOn(); } break;
	}
}

function optsListen({code}) {
	if (optsShowing) return
	if (code === "KeyO") optsOpen();
}

let canMove = false;
function moveAllow() {
	canMove = true;
	invAllow();
	document.removeEventListener("keydown", optsListen);
	document.addEventListener("keydown", mapcontrols);
	clickZones.style.display = ""
}
function moveStop() {
	canMove = false;
	invBlock();
	document.removeEventListener("keydown", mapcontrols);
	document.addEventListener("keydown", optsListen);
	clickZones.style.display = "none"
}
//#endregion


// #region Speech
function speechSet(speaker = "", img = "", imgPos = [0, 0], imgStyle = false, sheet = false, spriteSize = [0, 0]) {
	speechName.textContent = speaker;
	speechText.innerHTML = "";
	speechText.style.fontStyle = !speaker ? "italic" : "";
	speechImg.style.display = "none";

	if (img && imgPos[0] !== 0) {
		if (imgStyle === true) {
			speechImg.style.transform = "rotateY(180deg)";
		} else if (typeof imgStyle === "string") {
			speechImg.style = imgStyle;
		} else {
			speechImg.style.transform = "";
		}

		speechImg.style.bottom = `${imgPos[0]}px`;
		speechImg.style.right = `${imgPos[1]}px`;
		speechImg.style.width = spriteSize[0] ? spriteSize[0]+"px" : "";
		speechImg.style.height = spriteSize[1] ? spriteSize[1]+"px" : "";

		if (sheet) {
			speechImg.src = `assets/img/${sheet[0]}`;
			const [x, y] = getSprite(sheet, img);
			speechImg.style.objectFit = "none"
			speechImg.style.objectPosition = `-${x * spriteSize[0]}px -${y * spriteSize[1]}px`
		} else {
			speechImg.src = `assets/img/${img}`;
			speechImg.style.objectFit = ""
			speechImg.style.objectPosition = ""
		}
		speechImg.addEventListener("load", ()=>{
			speechImg.style.display = "";
		}, {once: true});
	}
}

const textSpeed = 20;
let skipCheck = 0, doubleText;
async function speechAdd(text, skip = false, skippable = true) {
	const prevSpeech = speechText.textContent;
	next.style.display = "none";

	const stop =({code})=> {
		if (code && !checkKey(code)) return;
		stopval = true; skipCheck++;
		document.removeEventListener("keydown", stop);
	}

	let stopval = false;
	if (skippable) {
		theBox.addEventListener("click", stop, {once:true});
		document.addEventListener("keydown", stop);
	}

	let everyOther = false;
	for (const char of text) {
		if (stopval) break;
		speechText.textContent += char;

		everyOther = !everyOther
		if (everyOther) continue;

		await timer(textSpeed);
	}
	speechText.textContent = prevSpeech + text;

	if (skippable) {
		theBox.removeEventListener("click", stop);
		document.removeEventListener("keydown", stop);
	}

	if (skip === false) {
		if (!stopval) await timer(200)
		next.style.display = "";
		await speechWait();
	} else {
		// consistency against browsers changing timer length
		await timer(Math.max(skip, 50));
	}
}

function speechWait() {
	return new Promise((res)=>{
		document.addEventListener("keydown", function waitdown({code}) {
			if (checkKey(code)) {
				document.removeEventListener("keydown", waitdown);
				res();
			}
		});
		theBox.addEventListener("click", ({button})=>{
			if (button === 0) res();
		}, {once: true});
	});
}

async function speechBlank(text, skip = false, skippable = true) {
	speechSet();
	boxOpen(speechContainer);
	await speechAdd(text, skip, skippable);
}

async function speechBlankChar(char, text, skip = false, skippable = true) {
	if (typeof char === "object") {
		char.speaking()
	} else {
		speechSet(char)
	}
	boxOpen(speechContainer);
	await speechAdd(text, skip, skippable);
}

async function speech(...strings) {
	boxOpen(speechContainer);

	for (const line of strings) {
		speechText.innerHTML = "";
		await speechAdd(line);
	}

	boxClose();
}

//#endregion


// #region Interactables
const interacts = [];
let intCount = 0;

class mapEnt {
	constructor(func, intcoords = [0,0], coords = null, img = null, sheet = fiftyby, style = "") {
		this.int = intCount;
		this.func = func;
		interacts[this.int] = this.func;

		this.val = intCount + 3;
		intCount++;

		this.move(intcoords, coords)

		if (!img) return

		this.sheet = sheet
		this.sprite = makeImg("", `top: ${pxify(this.y)}; left: ${pxify(this.x)}; ${style}`, mapIcons, img.split(".")[0]);
		this.setImg(img, sheet)
	}

	changeFunc(func) {
		this.func = func;
		interacts[this.int] = func;
	}

	setImg(img, sheet = this.sheet) {
		if (!sheet) {
			this.sprite.src = `assets/img/${img}`;
			this.sprite.classList.add("nosheet")
			return
		}

		this.sprite.src = `assets/img/${sheet[0]}`;
		this.sprite.classList.remove("nosheet")
		const [x, y] = getSprite(sheet, img);
		this.sprite.style.objectPosition = `-${pxify(x)} -${pxify(y)}`
	}

	async move(intcoords = [0,0], coords = null, postdelay = false) {
		if (this.inty) this.removeInt();

		if (typeof intcoords[0] === "object") {
			// multiple intcoords
			this.inty = [];
			this.intx = [];
			for (const i in intcoords) {
				this.inty[i] = intcoords[i][0];
				this.intx[i] = intcoords[i][1];

				// hit the player
				if (matrix[this.inty[i]][this.intx[i]] === 2) {
					interacts[this.int]();
				} else {
					matrix[this.inty[i]][this.intx[i]] = this.val;
				}
			}
		} else if (intcoords[0] !== 0) {
			// only one intcoord
			this.inty = intcoords[0];
			this.intx = intcoords[1];

			// hit the player
			if (matrix[this.inty][this.intx] === 2) {
				interacts[this.int]();
			} else {
				matrix[this.inty][this.intx] = this.val;
			}
		}


		// don't continue if no visible object
		if (!coords) return


		// only runs if previous position exists and isn't for interacting with this ent
		if (this.y && (matrix[this.y][this.x] !== this.val)) {
			if (this.posPrev) {
				matrix[this.y][this.x] = this.posPrev;
			} else {
				matrix[this.y][this.x] = 0;
			}
		}

		this.y = coords[0];
		this.x = coords[1];
		this.posPrev = matrix[this.y][this.x];
		// only if not interactive
		if (matrix[this.y][this.x] !== this.val) matrix[this.y][this.x] = 1;

		if (this.sprite) {
			this.sprite.style.top = pxify(this.y);
			this.sprite.style.left = pxify(this.x);

			// noclip message
			const noclipBox = document.getElementById(`${this.func.name}box`)
			if (noclipBox) {
				noclipBox.style.top = pxify(this.y);
				noclipBox.style.left = pxify(this.x);
			}
		}

		// allow delay between movements by awaiting
		if (postdelay) await timer(postdelay);
	}

	removeInt() {
		if (typeof this.inty === "object") {
			for (const i in this.inty) {
				if (player.y === this.inty[i] &&
					player.x === this.intx[i]) {
					curPosVal = 0;
				} else {
					matrix[this.inty[i]][this.intx[i]] = 0;
				}
			}
		} else if (this.inty) {
			if (isPlayer(this.inty, this.intx)) {
				curPosVal = 0;
			} else {
				matrix[this.inty][this.intx] = 0;
			}
		}
	}

	hide() {
		this.removeInt();
		interacts[this.int] = undefined;

		if (this.y) matrix[this.y][this.x] = 0;
		if (this.sprite) mapIcons.removeChild(this.sprite);
	}
}

class talkObj {
	constructor(name, imgcoords = [0, 0], img = `${name.toLowerCase().split(" ")[0]}.webp`, imgStyle = false, sheet = false, spriteSize = [0, 0]) {
		this.name = name;

		if (!imgcoords[0]) return;

		this.talky = imgcoords[0];
		this.talkx = imgcoords[1];
		this.img = img;
		this.imgStyle = imgStyle;
		this.sheet = sheet;
		this.spriteSize = spriteSize;
	}

	speaking() {
		speechSet(this.name, this.img, [this.talky, this.talkx], this.imgStyle, this.sheet, this.spriteSize);
	}

	async speech(...strings) {
		this.speaking()
		await speech(...strings);
		speechSet();
	}

	setImg(img, imgStyle = this.imgStyle, sheet = this.sheet, spriteSize = this.spriteSize) {
		this.img = img;
		this.imgStyle = imgStyle;
		this.sheet = sheet;
		this.spriteSize = spriteSize;
	}
}

class Character extends mapEnt {
	constructor(map, talk) {
		super(...map)
		if (!talk) talk = ["null"]
		this.talkObj = new talkObj(...talk)

		// swaps the coords order bc logical sense and definitely not so i dont have to redo every scene
		this.move =(coords, intcoords, postdelay)=> super.move(intcoords, coords, postdelay)

		// this is so fucking cursed why did i do this (oh yeah convenience)
		this.talk =async(...args)=> {await this.talkObj.speech(...args)}
		this.speaking =(...args)=> {this.talkObj.speaking(...args)}
		this.setTalkImg =(...args)=> {this.talkObj.setImg(...args)}
	}
}

function choiceShow(choices) {
	choiceList.innerHTML = "";

	let i = 1;
	for (const choice of choices) {
		const li = document.createElement("li");
		choiceList.appendChild(li);

		const button = document.createElement("button");
		button.textContent = choice[0] + ` (${i})`; i++;
		button.onclick =(event)=>{
			event.stopPropagation(); // stops skipping diag from clicking
			document.removeEventListener("keydown", choiceKeyboard);
			choice[1]();
		};

		li.appendChild(button);
	}
	boxOpen(choiceList);

	document.addEventListener("keydown", choiceKeyboard);
}

function choiceKeyboard({ code }) {
	if (choiceList.style.display === "none" || theBox.style.display === "none") {
		document.removeEventListener("keydown", choiceKeyboard);
		return;
	}

	if (code.startsWith("Digit") || code.startsWith("Numpad")) {
		let choice = Number(code.slice(-1));

		if (choice === 0) choice = 10;

		const choiceButton = choiceList.children[choice - 1]
		if (choiceButton) choiceButton.firstChild.click();
	}

}
//#endregion


// #region Inventory
const itemList = [], inventory = [];

class invItem {
	constructor(name, usage = "Nothing interesting.", img = name.toLowerCase(), sheet = fiftyby, legal = true) {
		this.name = name;
		this.usage = usage;
		this.img = img;
		this.sheet = sheet

		if (legal) itemList.push(this);
	}

	async use() {
		switch (typeof this.usage) {
			case "function":
				this.usage(); break;
			case "string":
				await speech(this.usage);
				break;
			case "object":
				await speech(...this.usage);
				break;
		}
	}

	add() {
		const index = inventory.indexOf(this);
		if (index !== -1) return;

		if (inventory[0] === undefined) { controls.style.display = ""; }
		inventory.push(this);
		if (debug) console.log(inventory);
	}

	remove() {
		const index = inventory.indexOf(this);
		if (index === -1) return;

		inventory.splice(index, 1);
		if (debug) console.log(inventory);
	}
}

const
bottle = new invItem("Empty Bottle", "It's just an empty bottle now.", "bottle"),
glassOfWater = new invItem("Glass of Water", ["You stare into the water, and see your future.", "...wait no, that's just the minerals."], "water"),
worm = new invItem("Worm", "It's very wiggly.", "worm"),
worms = new invItem("Worms", "They seem to be a happy couple.", "worms"),
ds = new invItem("Nintendo DS Lite", dsUsed, "dslite"),
r4 = new invItem("R4 Cartridge", r4Used, "r4"),
sd = new invItem("microSD Card",
	["You check the back, and see some little transistors or something.",
	"You decide it's not worth breaking it to rip them out and fill more inventory slots."], "sd"),
coin = new invItem("Pooky Coin", "You suddenly remember some obscure Garfield trivia.", "coin"),
scissors = new invItem("Safety Scissors", ["You try to cut a random paper you found on the ground.", "It doesn't cut."], "scissors"),
blaster = new invItem("LAZER TAG Blaster", "You find amusement at the lack of foresight in the design.", "blaster"),
ford = new invItem("Ford", fordUsed, "ford-talk.webp", false),
destructInv = new invItem("Self-Destruct Button", "You don't actually have the button. It's just a note.", "button");



function invcontrols({ code }) {
	// CLOSE INVENTORY
	switch (code) {
		case "KeyE": /* falls through */
		case "KeyB": wasdCheck++; /* falls through */
		case "KeyI":
			if (!invButton.disabled) invClose(); break;
	}

	let prev, next, left, right;
	const current = document.activeElement.parentElement, items = invList.children,
		index = [...items].indexOf(current), first = invList.firstChild, last = invList.lastChild;
	if (!current || !invList.contains(current)) {
		prev = last
		next = first
		left = items[7] || last
		right = items[4] || first
	} else {
		prev = current.previousSibling || last
		next = current.nextSibling || items[items.length - (items.length % 4)] || first
		if (index % 4 === 0) {
			prev = items[index + 3] || last
		}
		if ((index + 1) % 4 === 0) {
			next = items[index - 3] || first
		}

		left = items[index - 4] || items[index + 8] || items[index + 4] || last
		right = items[index + 4] || items[index - 8] || items[index - 4] || last
	}

	// NAVIGATION
	switch (code) {
		case "KeyW": wasdCheck++; /* falls through */
		case "ArrowUp":
			prev.firstChild.focus();
			break;
		case "KeyS": wasdCheck++; /* falls through */
		case "ArrowDown":
			next.firstChild.focus();
			break;
		case "ArrowLeft":
		case "KeyA": wasdCheck++; /* falls through */
			left.firstChild.focus()
			break;
		case "KeyD": wasdCheck++; /* falls through */
		case "ArrowRight":
			right.firstChild.focus()
			break;
	}
}

function invMenuItem(item, clickFunc = undefined) {
	const li = document.createElement("li");
	const button = document.createElement("button")
	button.textContent = item.name;
	if (clickFunc === false) {
		button.disabled = true;
		button.style.opacity = 0.5;
	}

	if (seenEndings && seenEndings.includes(item.name)) {
		let color = "#bfb";
		if (item.name === "Nintendo DS Lite" && (!seenEndings.includes("R4 Cartridge") || !seenEndings.includes("microSD Card")) && !hasItem("R4 Cartridge")) {
			color = "#ee5";
		}
		if (item.name === "R4 Cartridge" && !seenEndings.includes("microSD Card") && !hasItem("microSD Card")) {
			color = "#ee5";
		}
		button.style.background = color;
	}

	if (clickFunc !== false) button.onclick = (event) => {
		event.stopPropagation(); // stops skipping diag from clicking
		invClose();
		if (clickFunc && typeof clickFunc === "function") {
			clickFunc(item.name)
		} else {
			item.use()
		}
	};

	if (item.sheet) {
		// img from spritesheet
		const [x, y] = getSprite(item.sheet, item.img);
		button.style.setProperty('--position', `${x * -19}px ${y * -19}px`)
	} else {
		// standalone img
		button.style.setProperty('--img', `url('../img/${item.img}')`)
		button.style.setProperty('--size', `contain`)
	}

	li.appendChild(button);
	invList.appendChild(li);

	return button;
}

function invOpen(clickFunc = undefined, allowClose = true) {
	document.addEventListener("keydown", invcontrols);
	invList.innerHTML = "";

	for (const item of inventory) invMenuItem(item, clickFunc)

	boxOpen(invList);

	invButton.onclick = invClose;
	if (allowClose) {
		invButton.className = "toggled";

		if (typeof allowClose === "function") {
			invButton.onclick = allowClose;
		}
	} else {
		invBlock();
	}
}

function invClose() {
	boxClose();
	invButton.className = "";
	invButton.onclick = invOpen;
	document.removeEventListener("keydown", invcontrols);
	if (hasItem("Std. Mov. Potion")) clickZones.style.display = ""
}
function invBlock() {
	invButton.disabled = true;
	invButton.blur();
	invButton.className = "";
}
function invAllow() {
	invButton.disabled = false;
	invButton.className = "";
}
function hasItem(name) {
	for (const item in inventory) {
		if (inventory[item].name === name) return item;
	}
	return false;
}
//#endregion


// #region Cheats

// #region Debug Renderer
function debugRender() {
	const grid = debugCanvas.getContext("2d");

	grid.canvas.width = matrix[0].length * px;
	grid.canvas.height = matrix.length * px;

	for (const row in matrix)
	for (const col in matrix[row]) {
		const val = matrix[row][col];

		let color = "#0000"; // free
		if (debug) {
			if (val === 1) color = "#f005"; // blocked
			if (val === 2) color = "#fa05"; // player
			if (val > 2) color = "#00f5"; // interactive
		}

		grid.fillStyle = color;
		grid.fillRect(col * px, row * px, px, px);
	}
}

let debugCommand = false; // default false, true if ?debug in url
if (debug) {
	debugCommand = true;
	document.body.style.border = "1px solid #fff";
	debugCanvas.style.display = "";
	document.title = "DEBUG MODE";
	debugLoop();
}
async function debugLoop() { // render 5fps
	debugRender(); setTimeout(debugLoop, 200);
	while (!debug || debugCanvas.style.display === "none") await timer(200);
}
//#endregion

// #region Noclip
function attachBox(obj) {
	const box = document.createElement("div");
	box.className = `attachbox`;
	box.id = `${obj.name || obj.func.name}box`;
	box.style.top = pxify(obj.y);
	box.style.left = pxify(obj.x);
	mapIcons.appendChild(box);
	return box;
}
let foundNoclip = false;
async function noclipAlert(text, length = 500, obj = player) {
	if (obj === player) {
		// it's weird to preload it here, but players *may* not catch on to the balde puzzle just by seeing it
		// but if they've found this, they'll almost 100% go to his house, so this is the best spot imo
		if (!foundNoclip) {
			preload([
				"img/mapbalde.webp",
				"mus/balde.ogg",
				"img/balde.png",
				"snd/outwhilecan.ogg",
				"snd/balde-kill.ogg",
				"snd/oh.ogg"
			])
		}
		foundNoclip = true
	}


	playSfx("damage.ogg");

	const oldBox = document.getElementById(`${obj.name}box`)
	if (oldBox) oldBox.remove();

	const box = attachBox(obj);

	let alert;
	if (text.length < 6) {
		alert = document.createElement("pre");
	} else {
		alert = document.createElement("p");
		box.style.paddingRight = "6px";
	}
	alert.className = "iconattach";
	alert.style.animation = `0.2s linear sideshake`;
	alert.textContent = text;
	box.appendChild(alert);

	if (text.length < 6) {
		const blinker = document.createElement("pre");
		blinker.className = "iconattach";
		blinker.style.top = "-1px";
		blinker.style.left = "-3px";
		blinker.textContent= "|";
		box.appendChild(blinker);
	}

	await timer(length);
	try{mapIcons.removeChild(box);}catch(e){ /* might crash if element is already gone */ }
}

async function noclipFullAlert(length = 10000, obj = player) {
	playSfx("damage.ogg");
	playSfx("dumbvictory.ogg");

	const oldBox = document.getElementById(`${obj.name}box`)
	if (oldBox) oldBox.remove();

	const box = attachBox(obj);
	box.style.paddingRight = "3px";

	const alert = document.createElement("pre");
	alert.className = "iconattach";
	alert.textContent = "noclip";
	alert.style.mixBlendMode = "normal";
	alert.style.filter = "none";
	alert.style.color = "#f00";

	alert.style.animation = `0.5s linear sideshake`;
	box.appendChild(alert);

	const blinker = document.createElement("pre");
	blinker.className = "iconattach";
	blinker.textContent = "|";
	blinker.style.animation = "1s linear blink infinite";
	blinker.style.color = "#f00";
	blinker.style.left = "-3px";
	blinker.style.top = "-1px";
	blinker.style.mixBlendMode = "normal";
	blinker.style.filter = "none";
	box.appendChild(blinker);

	const alert2 = document.createElement("p");
	alert2.className = "iconattach";
	alert2.style.fontWeight = 900;
	alert2.style.color = "#f00";
	alert2.style.mixBlendMode = "normal";
	alert2.style.filter = "none";
	alert2.style.left = "-3px";
	alert2.textContent = "enabled!!!!!!!";
	box.appendChild(alert2);

	await timer(length)
	try{mapIcons.removeChild(box);}catch(e){ /* might crash if element is already gone */ }
}

let noclip = false, noclipVoidCount = false;
async function noclipOn() {
	noclipincr = 0;
	noclip = !noclip;

	// refresh click movers
	makeClickZones()

	if (!noclip) {
		noclipAlert("disabled", 2000);

		if (curPosVal !== 1) return;
		noclipVoidCount++;
		moveStop();
		noclipAlert("Can't find the world", 2250);
		await playSfx("trapped.ogg");

		if (noclip) return;
		updatePlayerPos(7, 6);
		moveAllow();
		playSfx("mysterygo.ogg");
	} else {
		baldeEarlyRun();
		await noclipFullAlert();
	}
}
//#endregion

function allItems() {
	inventory.length = 0;
	for (const item of itemList) item.add()
	fordAdd();
	return "Cheater ;D";
}
//#endregion


// #region Start Game
async function startVerify() {
	loadbutton.onclick = soundTest;
	loadbutton.textContent = "Are you suuuuuuuuure?";
	await timer(3000);
	buttonRamble();
}
async function buttonRamble() {
	loadbutton.textContent = "You don't haaaaave to.";
	await timer(3000);
	loadbutton.textContent = "It's just an option.";
	await timer(3000);
	loadbutton.textContent = "Presenting you with various choices.";
	await timer(3000);
	loadbutton.textContent = "Really, you can just quit if you want.";
	await timer(3000);
	loadbutton.textContent = "It's not like there's anything interesting in here.";
	await timer(3000);
	loadbutton.textContent = "It's just, if you felt like it, you could...";
	await timer(3000);
	loadbutton.onclick = startVerify;
	loadbutton.textContent = "Start Game";
}

async function soundTest() {
	loading.style.display = "none";
	mapIcons.style.display = "none";

	musPlay("ecards.ogg", 1, false)

	overlay.insertAdjacentHTML("afterend",`
	<div id="soundtest" class="overlay">
	<p>please adjust your volume until this is at a comfortable volume,<br>
	   if very slightly quiet, like you were casually listening to this song.</p>

	<input type="range" min="0.01" max="1" step="0.01" style="margin-bottom: 10px;"/>

	<button disabled="true">I adjusted my volume! (enter)</button>
	</div>`)
	const soundtest = document.getElementById("soundtest");

	const volSlider = soundtest.querySelector("input")
	volSlider.addEventListener("input", ({target})=>{ music.volume = target.value })
	volSlider.value = userVol
	volSlider.focus({focusVisible: true});

	const soundbutton = soundtest.querySelector("button")
	await timer(5000)
	soundbutton.disabled = false
	soundbutton.onclick =()=>{
		userVol = volSlider.value;
		localStorage.setItem("volume", JSON.stringify(userVol));
		intro(); soundtest.remove();
	}

	document.addEventListener("keydown", function sounddown({code}) {
		if (!document.body.contains(soundbutton)) {
			document.removeEventListener("keydown", sounddown);
			return;
		}
		if (checkKey(code) && document.activeElement !== soundbutton) soundbutton.click();
		return false;
	});
}

let timeSinceImportance;
const momObj = new talkObj("Your Mother", [140, 72], "mom.webp")
async function intro() {
	musPause(false);

	// very unfortunate hack to prevent flashing from image decoding (i dont like canvas)
	// (the flashing is a problem everywhere but its noticeable most here cuz its the whole screen)
	const tag = document.createElement("canvas");
	const tagdraw = tag.getContext("2d");
	tagdraw.canvas.width = 800;
	tagdraw.canvas.height = 600;

	main.prepend(tag);
	async function bg(src = false) {
		if (!src) {
			// don't combine with below bc causes flashes of black
			tagdraw.fillStyle = "#000";
			tagdraw.fillRect(0, 0, 800, 600);
			return;
		}

		const img = new Image();
		img.src = `assets/img/intro/${src}.webp`;
		await new Promise( (res)=> {
			img.addEventListener("load", res, {once: true});
		});

		tagdraw.fillStyle = "#000";
		tagdraw.fillRect(0, 0, 800, 600);
		tagdraw.drawImage(img, 0, 0);
		main.style.background = "";
	}

	main.style.imageRendering = "auto"
	main.style.display = "";
	await timer(2500)

	speechSet();
	await speech("Once upon a time...");
	bg("man");
	await speech("there was a man.");
	bg("chair");
	await speech("in a chair.");
	bg("puter");
	await speech("at a computer");
	bg("desk");
	await speech("on a desk.");
	bg("house");
	await speech("in a house");
	bg("time");
	await speech("at a time.");
	bg("christmas");
	await speech("christmas time!");

	await speech("But then, all of the sudden....");
	bg("door");
	await timer(2000);
	playSfx("doorkick.ogg");
	bg("bart"); timeSinceImportance = new Date().getTime();
	await timer(2000);
	speechSet("Bartholomew");
	await speech("The Bad is coming.");
	speechSet();
	playSfx("doorclose.ogg");
	await timer(1300);
	bg("door");
	await timer(2000);

	await animate(main, 1, "ease-in-out fadeout");
	bg();
	await speech(
		"You knew this would happen one day...",
		"Your mother always said...");
	await momObj.speech("On December 25th 2022, Bart Simpson is going to break down your door and tell you that the Bad is coming!");
	await speech("And now it's come true...");

	bg("player");
	animate(tag, 10, "ease-in-out fadein");

	await speech(
		"You immediately know what you have to do.",
		"You have to go out on an absurd adventure, full of random things that donmakeawholotta sense.",
		"You have to go out and stop the Bad from happening.",
		"Whatever the Bad is.");
	await speechBlank("You have to stop it. ", 700);
	await speechAdd("Because you. ", 500);
	await speechAdd("are. ", 500);
	await speechAdd("a random guy with no importance to this universe up until this very moment.");
	boxClose();
	main.removeChild(tag);

	const introvid = document.createElement("video");
	introvid.src = `assets/vid/intro.webm`;
	introvid.id = "endvid";
	introvid.volume = userVol;

	overlay.appendChild(introvid);
	overlay.style.display = "";
	overlay.style.opacity = "";

	await new Promise(res=>{ introvid.addEventListener("canplaythrough", res, {once: true}) })
	introvid.play();
	await timer((introvid.duration * 1000) - 1600);
	main.style.imageRendering = ""
	overlay.style.display = "none";

	await loadingScreen()

	await speech("You walk outside your house, and realize that the only way you can move around is by selecting the spot in front of you that you want to go.");

	startGame();
}

function startGame() {
	loading.style.display = "none";
	mapIcons.style.display = "";
	levelOne();
}
//#endregion


// #region Level One
let aarEnt, benEnt, rockEnt, houseEnt, baldeEnt, coinEnt, chestEnt, storeEnt, angryEnt, timeStarted, upClick, wormEnt, orangeCarEnt, redCarEnt, leftHouse, leftHouseTrigger;
async function levelOne() {
	matrix = [
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1],
		[1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1],
		[1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1],
		[1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1],
		[1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
		[1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1],
		[1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1],
		[1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1],
		[1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
	];

	startLevel("map1.png", 10, 2);

	const benSheet = ["ben.webp", ["ben", "sad"]]
	benEnt = new Character(
		[benEvent, [9, 6], [10, 6], "ben", benSheet],
		["Ben Shaprio", [130, 50], "ben", true, benSheet, [320, 445]]
	)
	// this is so fucking stupid but i get to save One http request so thats cool ig
	benEnt.sprite.style = `width: 320px; height: 445px; top: 302.5px; left: 165px;\
		${mushy} transform: scale(0.113) scaleX(1.4); object-position: 0 0`

	aarEnt = new Character(
		[aarEvent, [6, 5], [6, 4], "aaron"],
		["Aaron Master 10", [174, 430]]
	)

	angryEnt = new Character(
		[angryEvent, [[5, 13], [6, 12]], [6, 13], "angry"],
		["Angry Man", [300, 200], "angry", `transform: scale(10); filter:drop-shadow(0 0 1px #000); ${crispy}`, fiftyby, [50, 50]]
	)

	baldeEnt = new Character([baldeEvent, [[5, 5], [5, 6], [4, 6]], [4, 4], "balde"])
	storeEnt = new Character([storeEvent, [10, 11], [10, 12], "store"], ["Old Man"])

	houseEnt = new mapEnt(houseEvent, [0, 0], [10, 1], "house");
	wormEnt = new mapEnt(wormEvent, [4, 7], [3, 7], "worm-map");
	coinEnt = new mapEnt(coinEvent, [1, 5], [2, 5], "coin");
	chestEnt = new mapEnt(chestEvent, [[4, 10], [3, 11]], [3, 10], "chest", fiftyby, "object-position: -149px -100px;");
	orangeCarEnt = new mapEnt(carEvent, [2, 13], [1, 13], "car-orange");
	redCarEnt = new mapEnt(carEvent, [2, 12], [1, 12], "car-red");
	rockEnt = new mapEnt(rockEvent, [9, 3], [8, 3], "rock");

	if (fast) {
		rockEnt.removeInt(); interacts[rockEnt.int] = undefined;
		bottle.add();

		matrix[9][1] = houseEnt.val;
		curPosVal = houseEnt.val;

		moveAllow();
	} else {
		upClick = new mapEnt(upClicked, [9, 2]);
		moveStop();
		funkyOn();
	}

	speechSet();
	overlay.innerHTML = "";
	main.style.display = "";
	musPlay("fuzz.ogg", defVol, defFade, "fuzz-intro.ogg", 0.4);
	await animate(main, 1, "ease-in-out fadein");
	if (!fast && isPlayer(10, 2)) clickZones.firstChild.focus({focusVisible: true})

	timeStarted = new Date().getTime();
	if (!timeSinceImportance) timeSinceImportance = timeStarted

	if (fast) {
		const alert = document.createElement("p");
		alert.className = "toprightmessage";
		alert.innerHTML = "You are in fast mode! Some animations are skipped.<br>Press Space to instantly print dialogue, and hold to skip!";
		main.appendChild(alert);
		await timer(10000);
		try{main.removeChild(alert);}catch(e){ /* other things may remove it early */ }
	}
}

// #region Click-Movement Intro
function funkyOn() {
	clickZones.style.display = ""
	document.addEventListener("keydown", funkycontrols)
}
function funkycontrols({ code }) {
	let zone;
	switch (code) {
		// INVENTORY
		case "KeyE": case "KeyB": wasdCheck++; /* falls through */
		case "KeyI":
			if ((inventory[0] === undefined)) return;
			if (!invButton.disabled) invOpen();
			invList.firstChild.firstChild.focus({focusVisible: true});
			return;

		// MOVEMENT
		case "KeyW": wasdCheck++; /* falls through */
		case "ArrowUp":
			zone = document.getElementById("clickZoneUp");
			break;
		case "KeyS": wasdCheck++; /* falls through */
		case "ArrowDown":
			zone = document.getElementById("clickZoneDown");
			break;
		case "ArrowLeft":
		case "KeyA": wasdCheck++; /* falls through */
			zone = document.getElementById("clickZoneLeft");
			break;
		case "KeyD": wasdCheck++; /* falls through */
		case "ArrowRight":
			zone = document.getElementById("clickZoneRight");
			break;
	}
	if (zone) zone.focus();
}

let introLeft, introDown;
function upClicked() {
	upClick.hide();
	introDown = new mapEnt(introDownInt, [10, 2]);
	introLeft = new mapEnt(introLeftInt, [9, 1]);

}

const houseCount = [0, 0];
async function introDownInt() {
	updatePlayerPos(player.y - 1, undefined, false);
	switch (houseCount[0]) {
		case 0:
			await speech("Sorry, walking down has not been invented yet!");
			houseCount[1] = 1; break;
		case 1:
			await speech("Nope, walking down doesn't exist either!");
			houseCount[1] = 2; break;
		case 2: case 3:
			await speech("...what exactly do you expect from this?");
			houseCount[0] = 3; houseCount[1] = 3; break;
	}
	funkyOn()
}
async function introLeftInt() {
	updatePlayerPos(undefined, player.x + 1, false);
	switch (houseCount[1]) {
		case 0:
			await speech("Sorry, walking left has not been invented yet!");
			houseCount[0] = 1; break;
		case 1:
			await speech("Nope, walking left doesn't exist either!");
			houseCount[0] = 2; break;
		case 2: case 3:
			await speech("...what exactly do you expect from this?");
			houseCount[0] = 3; houseCount[1] = 3; break;
	}
	funkyOn()
}

let potion, leftOfRock, rightOfRock;
async function rockEvent() {
	clickZones.style.display = "none"
	rockEnt.removeInt(); interacts[rockEnt.int] = undefined;
	introLeft.hide();
	introDown.hide();
	leftOfRock = new mapEnt(rockSides, [9, 2]);
	rightOfRock = new mapEnt(rockSides, [9, 4]);

	await timer(500);
	await speech(
		"Being next to this random little rock you're walking past, you feel an uncontrollable urge to interact with it.",
		"Behind the rock, you find a Potion of Standardized Movement!");
	potion = new invItem("Std. Mov. Potion", potionUsed, "potion", undefined, false);
	potion.add();
	await speech("You can use it in your Inventory that has definitely been at the top of the screen the whole time.");
	invAllow();
	funkyOn()
}
let sideRockCount = 0;
async function rockSides() {
	updatePlayerPos(9, 3, false);
	switch (sideRockCount) {
		case 5:
			await speech("Why?");
			break;
		case 4:
			invOpen();
			setTimeout(()=>{invButton.className = "toggled"}, 1)
			break;
		case 3: case 2:
			await speech("Dear Santa, all I want for Christmas is a player who will pick up on my incredibly obvious game design cues.");
			break;
		case 1: case 0:
			await speech("You've run out of stamina!");
			break;
	}
	if (sideRockCount < 5) sideRockCount++;
	invAllow();
	funkyOn()
}

async function potionUsed() {
	leftOfRock.hide();
	rightOfRock.hide();
	potion.remove();
	bottle.add();
	await speech(
		"You feel the potion's effect run down your throat and across your body.",
		"It tastes... like someone just put orange Gatorade in a glass bottle?",
		"And you sense the power of leg movement eminating from your arrow keys!",
		"You feel like you can press Up, Down, Left, or Right on your computer keyboard to move anywhere you want!",
		"...except into the void. You'd need to have some kind of \"no clip\" for that.");
	document.removeEventListener("keydown", funkycontrols)

	matrix[9][1] = houseEnt.val;
	matrix[10][2] = houseEnt.val

	moveAllow();
}
//#endregion

async function houseEvent() {
	await speech("You decide the Bad isn't all that big of a deal, and you don't really wanna go on an adventure after all, so you go back to your house.",
	"...but the door is locked, and you left your keys inside.", "Looks like you're gonna have some fun whether you like it or not.")
	matrix[9][1] = 0;
	matrix[10][2] = 0;
	curPosVal = 0;
	matrix[player.y][player.x] = 2;
	interacts[houseEnt.int] = undefined;
}

let benCount = 0;
async function benEvent() {
	switch (benCount) {
		case 0:
			await benEnt.talk("im ben shapiro");
			break;
		case 1:
			await benEnt.talk("im ben shapiro...");
			break;
		case 2:
			benEnt.setImg("sad");
			benEnt.setTalkImg("sad");
			benEnt.sprite.style.objectPosition = "-320px 0"
			await benEnt.talk(
				"OKAY YOU CAUGHT ME                                                           ",
				"im not ben shapiro.",
				"im ben shaprio",
				"please leave me alone");
	}
	if (benCount >= 3) await benEnt.talk("please leave me alone");
	benCount++;
}

// #region Aaron
let aarDeclined = false;
async function aarEvent() {
	await speech('He asks if you would like UG48600520 9.');
	choiceShow([["Accept the gift", aarAccept], ["Decline", aarDecline]]);
}
async function aarAccept() {
	playSfx("fedex-mmm.mp3");
	await aarEnt.talk("mmm");

	playSfx("fedex.mp3");
	await aarEnt.talk("fedex");

	ds.add();
	aarHide();
	toPreload.push(...[
		"mus/aarrant.mp3",
		"mus/goodend.ogg"
	])
}
async function aarDecline() {
	await aarEnt.talk("i will pee in your cereal");
	aarDeclined = true;
	aarHide();
}
function aarHide() {
	aarEnt.hide();
	playSfx("mysterygo.ogg");
	moveAllow();
}
async function dsUsed() {
	if (hasItem("R4 Cartridge")) {
		await speech("You consider playing some games. Then you realize that'd be a bit too recursive.");
		return;
	}

	await speech(
		"You check the back, and see a cartridge is inserted.",
		"You pop it out. It's an Revolution 4 Card. You put it in your inventory.");
	r4.add();
}
async function r4Used() {
	if (hasItem("microSD Card")) {
		await speechBlank("You can almost feel the swift winds of the sea against your face.");
		await speechAdd(".. in a legally obtained copy of The Legend of Zelda: Phantom Hourglass, of course.")
		boxClose();
		return;
	}

	await speech(
		"You check the back, and see a microSD card is inserted.",
		"You pop it out. It's a 50000TB SanDisk Mega Ultra Super. You put it in your inventory.");
	sd.add();
}
//#endregion

// #region Balde Encounter
function baldeEvent() {
	baldeEnt.move([4, 3], [4, 5]);
	baldeEnt.changeFunc(balde2);
}
function balde2() {
	baldeEnt.move([3, 3], [4, 4]);
	baldeEnt.changeFunc(balde3);
}
function balde3() {
	baldeEnt.move([2, 3], [4, 3]);
	baldeEnt.changeFunc(balde4);
}
function balde4() {
	baldeEnt.move([1, 3], [3, 3]);
	baldeEnt.changeFunc(balde5);
}
function balde5() {
	baldeEnt.move([1, 2], [2, 3]);
	baldeEnt.changeFunc(balde6);
}
function balde6() {
	baldeEnt.move([1, 1], [1, 2]);
	baldeEnt.changeFunc(baldeRun);
}
let evilHouseEnt, baldeScared, baldeEarlyScare, baldeDisable;
async function baldeRun() {
	moveStop();
	baldeScared = true;

	await noclipAlert("n", 400, baldeEnt);
	await noclipAlert("no", 200, baldeEnt);
	await noclipAlert("noc", 200, baldeEnt);
	await noclipAlert("nocl", 400, baldeEnt);
	await noclipAlert("nocli", 200, baldeEnt);

	noclipFullAlert(4800, baldeEnt);
	await timer(2000);

	async function move(y, x) {
		await baldeEnt.move([y, x], [0,0], 100);
	}

	await move(1, 0);
	await move(2, 0);
	await move(3, 0);
	await move(3, 1);
	await move(4, 1);
	await move(5, 1);
	await move(5, 0);
	await move(6, 0);
	await move(7, 0);
	await move(7, 1);
	await move(7, 2);

	evilHouseEnt = new mapEnt(evilHouseEvent, [6, 2], [6, 2], "house-evil")
	animate(evilHouseEnt.sprite, 1, "ease-in fadein");
	await timer(1500);
	await move(6, 2);
	await timer(100);
	baldeEnt.hide();
	matrix[6][2] = evilHouseEnt.val;

	await timer(1000);

	await speech("Seems like he doesn't wanna be near you.", "...but you get the feeling that if he has a way to get there, you could probably get there as well.")

	moveAllow();
}
async function baldeEarlyRun() {
	if (baldeScared || baldeDisable) { return; }

	baldeScared = true;
	baldeEarlyScare = true;
	await noclipFullAlert(50, baldeEnt);
	await baldeEnt.move([6, 2], [0,0], 100);

	evilHouseEnt = new mapEnt(evilHouseEvent, [6, 2], [6, 2], "house-evil")
	animate(evilHouseEnt.sprite, 0.2, "ease-in fadein");
	await timer(300);
	baldeEnt.hide();
	matrix[6][2] = evilHouseEnt.val;
}
//#endregion

// #region Balde's House
let baldeEntered, oldMatrix, baldeDoorEnt, baldeEnterEnt, scissorEnt, puterEnt;
async function evilHouseEvent() {
	oldMatrix = matrix;
	moveStop(); musPause();
	await animate(main, 1, "ease-in-out fadeout");
	main.style.display = "none";
	baldeEntered = true;

	await loadingScreen();

	for (const icon of mapIcons.children) {
		if (icon.style === undefined) break;
		if (icon.id !== "player") {
			icon.style.display = "none";
		}
	}

	updatePlayerPos(6, 2, false);
	curPosVal = 0;

	matrix = [
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
		[1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
		[1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
		[1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
		[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
		[1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
		[1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
	];

	main.style.background = `url(assets/img/mapbalde.webp)`;
	matrix[player.y][player.x] = 2;

	baldeEnt = new Character(
		[balde2Event, [[7, 12], [9, 12], [8, 11]], [8, 12], "balde"],
		["balde", [164, 100], "balde.png", crispy]
	)
	scissorEnt = new mapEnt(scissorEvent, [[4, 11], [3, 11], [5, 11], [4, 12], [4, 10]], [4, 11], "scissors")
	baldeEnterEnt = new mapEnt(baldeEnterEvent, [[6, 3], [6, 1], [7, 2], [5, 2]])

	musPlay("balde.ogg", 0.5);
	main.style.display = "";
	await animate(main, 1, "ease-in-out fadein");
	moveAllow();
}

let baldeCaught = false, baldeRanFrom = false, baldeRanPolite = false, baldeReachedExit = false;
async function baldeEnterEvent() {
	baldeEnterEnt.hide();
	matrix[5][2] = 1;
	matrix[7][2] = 1;

	if (baldeEarlyScare) {
		await baldeEnt.talk(
			"in hindsight i shouldve seen this coming",
			"i just thought oh shit i should hide in my house before they get to me but obviously you can just get in");
	} else {
		await baldeEnt.talk(
			"shit you have powers too",
			"i thought like oh they're moving around normally and abiding by the laws of reality so surely i can hide in my house");
	}
	await baldeEnt.talk(
		"anyway uh",
		"i'm hiding here because like",
		"uh", "i'm insane", "yknow",
		"see, sometimes i get an insatiable urge to murder people in grey hoodies",
		"and.                            yknow",
		"so like", "uhhhh", "yknow", "like", "if you could just",
		"like", "uhhhh", "well", "yknow");

	invBlock();

	baldeDoorEnt = new mapEnt(baldeDoorLeave, [6, 0]);

	playSfx("outwhilecan.ogg");
	async function chase(y, x) {
		if (baldeCaught || baldeRanFrom) return;
		if (player.x === 0 || player.y === 0 || player.x === 15 || player.y === 11) {
			baldeRanFrom = true; baldeLeaveAlive();
			return;
		}
		await baldeEnt.move([y, x], [[y-1, x], [y+1, x], [y, x-1], [y, x+1]], 200);
	}

	await chase(8,11);
	await chase(8,10);
	puterEnt = new mapEnt(puterEvent, [[8, 12]]);
	await chase(8,9);
	await chase(8,8);
	await chase(8,7);
	await chase(7,7);
	await chase(7,6);
	await chase(6,6);
	await chase(6,5);
	await chase(6,4);
	await chase(6,3);
	await chase(6,2);

	if (baldeCaught || baldeRanFrom) return;
	const stayedInside = (curPosVal !== 1);

	playSfx("oh.ogg");
	baldeEnt.talkObj.talkx = 550
	await baldeEnt.talk(
		"oh", "you got out of the way",
		"i uh", "i dont have any actual pathfinding");
	if (stayedInside) {
		await baldeEnt.talk("well uh, on the plus side", "youre trapped in my house now! you can never get out")
	} else {
		await baldeEnt.talk("and you have noclip so you aren't even trapped in my house", "fuck")
	}
	invAllow();
	baldeReachedExit = true;

	while (scissorWait || puterWait) await timer(200);

	while (curPosVal !== 1) await timer(200);

	if (baldeCaught) return;

	if (stayedInside) await baldeEnt.talk("...wait fuck stop noclipping");

	let hasClipped = false;
	while (!baldeCaught && player.x !== 0 && player.y !== 0 && player.x !== 15 && player.y !== 11) {
		if (!noclip && !hasClipped) {
			while (!canMove) await timer(100);
			await baldeEnt.talk(
				"...wait you actually stopped noclipping", "i gotta be real like. i can't do anything.",
				`like, you've broken into my house, ${scissorsGot ? "taken my fuckin safety scissors, " : ""}and avoided my attempts to kill you, and now i'm stuck here in my doorway until you leave`,
				"so like. you can just go. i fully do not care anymore. either walk into me and let me kill you, or get the fuck out of my house please");
			hasClipped = true;
		}
		await timer(50);
	}

	if (!baldeCaught) baldeLeaveAlive()
}

function baldeDoorLeave() {
	baldeRanFrom = true;
	baldeRanPolite = true;
	baldeLeaveAlive()
}

async function baldeLeaveAlive() {
	moveStop(); musPause();
	await animate(main, 1, "ease-in-out fadeout");
	main.style.display = "none";
	baldeBackToLevel();
}

let timeDied;
async function balde2Event() {
	moveStop(); musPause(false);
	baldeCaught = true;
	playSfx("balde-kill.ogg");
	try{ scissorEnt.hide(); }catch(e){ /* these would crash if */ }
	try{ scissors.remove(); }catch(e){ /* scissors don't exist */ }
	main.style.background = ``;
	controls.style.display = "none";
	await timer(1000);
	timeDied = new Date().getTime()
	main.style.display = "none";
	controls.style.display = "";
	baldeBackToLevel();
}

let scissorWait = false, scissorsGot = false;
async function scissorEvent() {
	if (scissorWait) return;
	scissorWait = true;
	while (!baldeReachedExit) await timer(300);
	scissorWait = false;
	if (curPosVal !== scissorEnt.val) return;
	scissors.add();
	await speech("You pick up the Safety Scissors and put them in your inventory.");
	await baldeEnt.talk("what the fuck man why are you stealing my safety scissors right in front of me you cant just break into peoples houses and steal their safety scissors");
	await scissorEnt.hide();
	scissorsGot = true
	toPreload.push(...[
		"img/boss.webp",
		"snd/eb/boss.ogg",
		"img/earthbound-boss.webp",
		"img/grinch-battle.webp",
		"mus/eb/jolly.ogg",
		"snd/eb/strangepsi.ogg",
		"snd/eb/bosswin.ogg",
		"mus/baldeend.ogg"
	])
	if (!ebLoaded) {
		toPreload.push(...ebAssets);
		ebLoaded = true;
	}
}

let puterWait = false;
async function puterEvent() {
	if (puterWait) return;
	puterWait = true;
	while (!baldeReachedExit) await timer(300);
	puterWait = false;
	if (curPosVal !== puterEnt.val) return;
	await speech(
		"It's running Windows 98, and doesn't seem like it's going to boot.",
		"The keyboard is comprised entirely of mathematical symbols, including a dedicated Pythagorean Theorem button.");
}

async function baldeBackToLevel() {
	await baldeEnt.hide();
	try{ await scissorEnt.hide(); }catch(e){ /* would crash if scissors were grabbed */ }
	await baldeDoorEnt.hide();
	await puterEnt.hide();

	for (const icon of mapIcons.children) {
		if (icon.style === undefined) break;
		if (icon.id !== "player") {
			icon.style.display = "";
		}
	}

	matrix = oldMatrix;
	curPosVal = matrix[player.y][player.x];

	if (baldeCaught) {
		updatePlayerPos(10, 2, false);
		noclip = false;
	} else {
		updatePlayerPos(6, 2);
	}

	evilHouseEnt.hide();
	matrix[5][2] = 1;
	matrix[6][0] = 1;
	matrix[6][1] = 1;
	matrix[6][3] = 1;
	matrix[7][2] = 1;
	if (baldeCaught) {
		matrix[6][2] = 1;
	} else {
		matrix[6][2] = 2;
		curPosVal = 1;
	}

	main.style.background = `url(assets/img/map1.png)`;

	if (hasItem("Ford")) fordMove(9, 1);

	musPlay("fuzz.ogg");
	main.style.display = "";
	await animate(main, 1, "ease-in-out fadein");
	await timer(500)

	if (baldeCaught) {
		await speech(`You wake up approximately 1.7 minutes later next to your house.`);
		if (scissorsGot) {
			await speech("There's a distinctly safety-scissors-shaped void in your pockets.");
		}
		if (baldeReachedExit) {
			await speech("You realize you could've just noclipped out of the house.")
		}
	} else {
		if (baldeRanPolite) {
			await speech("As you leave, you close the door softly behind you, cause even people running for their life should be polite.");
			await speech("The second the door clicks shut, the house entirely disappears!")
		} else {
			await speech("You walk through the wall, and as the final atoms of your feet have left the house, it completely disappears behind you!")
		}
		if (baldeReachedExit && !scissorsGot) {
			await speech("You kinda regret not stealing his safety scissors.");
		}
	}
	if (!baldeReachedExit) {
		await speech("You get the feeling you could've just walked further into his house and he would've kept charging at the door.");
	}
	await speech("Doesn't seem like the house is going to come back.")

	moveAllow();
}
//#endregion

let wormCount = 0;
async function wormEvent() {
	switch (wormCount) {
		case 0:
			await speech(
				"You inspect the patch of green.",
				"You notice a small worm.",
				"You pick it up and put it in your inventory.");
			worm.add();
			wormCount++;
			return;
		case 1:
			await speech(
				"You inspect the patch of green again.",
				"You notice another small worm.",
				"Despite already having a worm, you pick up the second worm and put it in your inventory.");
			worm.remove();
			worms.add();
			wormCount++;
			toPreload.push(...["img/grinch-icon-dissolve.gif", "mus/careless_whispers.ogg"])
			return;
		case 2:
			await speech(
				"Yet again, you inspect the patch of green again.",
				"You notice yet another small worm.",
				"Your worms seem to prefer monogamy.");
			wormEnt.hide();
	}
}

// #region Water Store
async function coinEvent() {
	await speechBlank("After travelling the long winding road, ", 1);

	if (baldeEntered) {
		await speechAdd("invading someone's home ", 1)
		if (scissorsGot) await speechAdd("and stealing their safety scissors ", 1)
		await speechAdd("along the way", 1)
	} else if (baldeScared) {
		await speechAdd("and chasing some guy who seems very scared of you", 1)
	} else {
		await speechAdd("walking behind some guy who seems to wanna be left alone", 1)
	}

	await speechAdd(", you have finally received your reward.")
	await speech("A singular Pooky Coin!")
	coin.add();
	coinEnt.hide();
	playSfx("coin.ogg");
	moveAllow();
}
let waterdenier;
async function storeEvent() {
	await cutscene(true, "store-screen.png");

	if (waterdenier) {
		await storeEnt.talk("You return, as the prophecy foretold.");
	} else {
		if (!fast) await timer(2000);
		await storeEnt.talk(
			"i am the one who sells water",
			"unfortunately, i'm all out of containers for my water");

		if (!hasItem("Empty Bottle")) {
			await storeEnt.talk(
				"and it looks like you don't have any containers",
				"if only you had some sort of Empty Bottle of some kind",
				"some sort of useful item that a game tutorial would very directly guide you towards receiving",
				"oh well");
			await cutscene(false, "map1.png");
			return;
		}

		await storeEnt.talk(
			"but i see you have an empty bottle",
			"would you like to                                                                 purchase");
	}

	choiceShow([["Purchase Glass of Water (costs one coin)", purchaseGlass], ["Do not purchase", noGlass]]);
	if (!hasItem("Pooky Coin")) {
		choiceList.firstChild.firstChild.disabled = true;
	}
}
async function noGlass() {
	if (!hasItem("Pooky Coin")) {
		await storeEnt.talk(
			"oh, you don't have money",
			"that's okay. come back another time");
	} else if (waterdenier) {
		await storeEnt.talk("It is only a matter of time.");
	} else {
		waterdenier = true;
		await storeEnt.talk(
			"You will return soon enough.",
			"Your thirst will overtake you.");
	}
	await cutscene(false, "map1.png");
}

async function purchaseGlass() {
	coin.remove();
	glassOfWater.add();
	bottle.remove();
	toPreload.push(...[
		"img/chris.webp",
		"mus/glassofwater-intro.ogg",
		"mus/glassofwater.ogg"
	])

	await speech(
		"You give him your coin, and the Empty Bottle becomes a Glass of Water.",
		"You get the sense this is going nowhere fast.");

	if (waterdenier) {
		await storeEnt.talk("Never doubt my water again.");
	} else {
		await storeEnt.talk("thank you kind young individual for purchasing my water");
	}
	await cutscene(false, "map1.png");

	storeEnt.removeInt();
	storeEnt.sprite.style.transition = "none";
	animate(storeEnt.sprite, 4, "linear slideright");
	await timer(500);
	matrix[10][12] = 0;
	await timer(2900);
	storeEnt.hide();
}
//#endregion

async function chestEvent() {
	await speech("You carefully open the chest.");
	await speechBlank("IT'S A MIMICCCCCCCCCCCCCCCCCCCCC ", 20);
	await speechAdd("nevermind not a mimic");
	await speech(
		"Inside, you find a LAZER TAG® blaster from Hasbro Inc.",
		"Unfortunately, you don't have a iPhone (3GS/4/4S) or iPod touch (4th generation) to combine it with.",
		"If you did, you could play against up to 23 friends at the same time!");
	blaster.add();
	chestEnt.hide();
	toPreload.push(...["snd/blaster.ogg"])
	moveAllow();
}

// #region Angry Man
let angryFighter, angryAction = false, angryAction2 = false, angryDead = false, angryRan = false, ebLoaded = false;
async function angryEvent() {
	preload([
		"img/earthbound.webp",
		"snd/eb/equip.ogg",
		"snd/eb/item.ogg",
		"snd/eb/miss.ogg",
		"snd/eb/present.ogg",
		"snd/eb/smash.ogg",
		"snd/eb/win.ogg",
		"mus/eb/weakop.ogg",
		"mus/eb/level.ogg",
		"snd/stance.ogg"
	])
	if (!ebLoaded) {
		toPreload.push(...ebAssets);
		ebLoaded = true;
	}

	if (angryAction2 === "bagel") {
		await angryEnt.talk("I LOVE PEOPLE");
		speechImg.style = "display: none"
		return;
	}

	musPause(); moveStop();
	if (angryRan) {
		await angryEnt.talk("I ESPECIALLY HATE PEOPLE WHO RUN AWAY");
	} else {
		await angryEnt.talk("I HATE PEOPLE");
	}

	if (fast) {
		await animate(main, 0.5, "linear fadeout");
		main.style.display = "none";
	} else {
		playSfx("eb/enterbattle.ogg");
		await ebOverlay("transition.png", 3000);
	}

	await loadingScreen();

	main.style.background = "url('assets/img/earthbound.webp') no-repeat 0 130px";
	mapIcons.style.display = "none";
	controls.style.display = "none";

	angryFighter = makeImg(fiftyby[0],
		`position: absolute; top: 258px; left: 382px; width: 50px; height: 50px;\
		transform: scale(400%); object-fit: none; object-position: -150px -150px;`);

	musPlay("eb/weakop.ogg", 1, false);
	main.style.display = "";
	animate(main, 0.5, "linear fadein");
	await speechBlank("The Angry Man approaches!", 1000);
	angryChoices();
}
function angryChoices() {
	choiceShow([["Bash", angryBash], ["PSI", angryPSI], ["Goods", angryGoods], ["Defend", angryDefend], ["Auto Fight", angryAuto], ["Run Away", angryRun]]);
}
async function angryBash() {
	playSfx("eb/equip.ogg");
	await speechBlank("You attack!", 700);

	playSfx("eb/miss.ogg");
	await speechBlank("Just missed!", 700);

	playSfx("eb/enemyturn.ogg");
	await speechBlank("The Angry Man is attacking!", 700);

	playSfx("eb/miss.ogg");
	await speechBlank("Just missed!", 700);

	switch (angryAction) {
		case "bash":
			angryAction2 = "bash";
			speechSet("Angry Man");
			await speech(
				"............................................................................................................................................................................................................................................",
				"fuck you");
			await speechBlank("The Angry Man gets annoyed and leaves!", 700);
			angryDie();
			break;
		default:
			angryAction = "bash";
			angryChoices();
			break;
	}
}
async function angryPSI() {
	playSfx("eb/psi.ogg");
	await speech("You ask him why do they call it oven when you of in the cold food of out hot eat the food?");

	animate(angryFighter, 0.2, "linear damage");
	playSfx("eb/hit.ogg");
	await speechBlank("The Angry Man dies instantly in one hit!", 500);
	angryDead = true;
	angryDie();
}
async function angryGoods() {
	angryAction2 = "goods";
	await speech("You pull a Bagel Bite out of your hoodie pocket.");
	speechSet("Angry Man");
	await speech("...........................")
	await speechBlankChar("Angry Man", "can i have one? 🥺", 500);
	await speechAdd("")
	choiceShow([["Give him a Bagel Bite", angryBagel], ["Do not give", angryNoBagel]]);
}
async function angryNoBagel() {
	angryAction2 = "nobagel";
	animate(angryFighter, 0.2, "linear damage");
	playSfx("eb/hit.ogg");
	await speechBlank("You hurt the Angry Man's feelings!", 700);
	angryDead = true;
	angryDie();
}
async function angryDefend() {
	if (angryAction === "defend") {
		angryAction2 = "defend";
		await speech("You continue holding the same flawless defense stance.");
		speechSet("Angry Man");
		await speech("GO FUCK YOURSELF AND YOUR STUPID ASS STANCE LOOK AT YOUR STUPID ASS STANDING LIKE THAT OOOOO LOOK AT ME IM SO COOL I KNOW HOW TO STAND FUCK YOU");
		await speechBlank("The Angry Man gets annoyed and leaves!", 700);
		angryDie();
		return;
	}

	angryAction2 = "defend";
	await speech("You enter a flawless defense stance.");

	playSfx("stance.ogg") // calebcity skit reference
	await speech("The Angry Man can't find an opening anywhere!")

	playSfx("eb/enemyturn.ogg");
	await speechBlank("The Angry Man is attacking!", 700);

	playSfx("eb/smash.ogg");
	animate(main, 1, "cubic-bezier(.68,-0.55,.27,1.55) damageshake");
	await speechBlank("SMAAAAAAAAAAAAAAAAAAASH!!!!!!!!!!!   ", 1000);
	await speechAdd("50 duodecillion HP of mortal damage to a nearby stranger the Angry Man felt like attacking!");
	playSfx("eb/death.ogg");
	await speech("The nearby stranger collapsed...");

	if (angryAction === "bash") {
		angryAction2 = "defend";
		playSfx("eb/enemyturn.ogg");
		await speechBlank("The Angry Man is annoyed and attacks again!", 700);

		playSfx("eb/miss.ogg");
		await speechBlank("Just missed!", 700);

		speechSet("Angry Man");
		await speech(
			"...........................",
			"go jump in a lake");
		await speechBlank("The Angry Man gets annoyed and leaves!");
		angryDie();
	} else {
		angryAction = "defend";
		angryChoices();
	}
}
async function angryAuto() {
	for (let i = 1; i < 4; i++) {
		await speechBlank("You stare at the Angry Man.", 1);
		await speechBlank("The Angry Man stares at you.", 1);
	}
	await speechBlank("You start to feel like Auto Fight is not going to work.");
	angryChoices();
}
async function angryRun() {
	await speechBlank("You tried to get away...", 1500);
	await speechAdd(" and did!");
	angryRan = true;
	angryBackToLevel(true);
}

async function angryDie() {
	musPause();
	playSfx("eb/enemydie.ogg");
	await animate(angryFighter, 0.5, "linear enemydie");
	angryFighter.style.opacity = 0;

	speechBlank("", 1); speechSet("YOU'RE WINNER ?");
	await playSfx("eb/win.ogg");
	musPlay("eb/winmus.ogg", 1, false);
	speechSet();
	await speech("You gained 0.74 exp.");

	musPlay("eb/level.ogg", 1, false);
	await speech(
		"Your level is now 1!",
		"You realize he might've just been hungry and you didn't have to kill him!",
		"Oh baby! IQ went down by 3!",
		"The enemy left a present!");

	await angryBackToLevel();

	angryEnt.removeInt();
	await animate(angryEnt.sprite, 1.5, "step-start blinkaway")
	angryEnt.sprite.style.display = "none";
	angryEnt.hide();
}
async function angryBagel() {
	angryAction2 = "bagel";

	angryFighter.style.objectPosition = `-200px -150px`;
	angryEnt.setImg("angry-happy");
	angryEnt.setTalkImg("angry-happy");
	angryEnt.talkObj.name = "Happy Man";

	await speechBlank("He is grateful and has become the Happy Man!");

	musPause();
	speechBlank("", 1);
	speechSet("YOU'RE WINNER !");
	await playSfx("eb/win.ogg");
	speechSet();
	musPlay("eb/winmus.ogg", 1, false);
	await speech("You gained 999999.999999 exp.");

	musPlay("eb/level.ogg", 1, false);
	await speech(
		"Your level is now nine thousand eight hundred and sixty four billion!",
		"Oh baby! Jolliness went up by 3!",
		"The friend gave a present!");

	angryBackToLevel();
}
async function angryBackToLevel(ran = false) {
	if (!ran) {
		preload([
			"img/ford-talk.webp",
			"snd/ford-walkgood.ogg"
		])
		toPreload.push(...[
			"snd/ford-whatup.ogg",
			"snd/slap.ogg",
			"snd/ford-monkeybunked.ogg",
			"mus/bonetheme.ogg",
			"mus/genocide.ogg"
		])

		playSfx("eb/present.ogg");
		await speech("Inside the present, there was a Ford!");
		fordAdd();
		playSfx("eb/item.ogg");
		await speech("You took him.");
	}

	boxClose();
	await loadingScreen();
	musPause();
	cutscene(false, "map1.png");
	await timer(1000);
	main.removeChild(angryFighter);
	musPlay("fuzz.ogg");
	await timer(500);
}
//#endregion

// #region Ford
let fordSprite; const fordPos = { y: 0, x: 0 };
const fordObj = new talkObj("Ford", [163, 390], "ford-talk.webp", true)
async function fordUsed() {
	playSfx("ford-walkgood.ogg");
	speechBlankChar(fordObj, "");
	await speechAdd("Hey, ", 800, false);
	await speechAdd("you walk real good! ", 1200, false);
	await speechAdd("I hope I can walk like that someday.");
	speechSet();
	boxClose(); moveAllow();
}
function fordMove(y = false, x = false) {
	if (y) { fordPos.y = y; fordSprite.style.top = pxify(y); }
	if (x) { fordPos.x = x; fordSprite.style.left = pxify(x); }
}
function fordAdd() {
	/* kill previous ford if one exists (dont think about the moral implications of this) */
	if (fordSprite && mapIcons.contains(fordSprite)) mapIcons.removeChild(fordSprite);
	if (hasItem("Ford")) ford.remove();

	ford.add()

	fordSprite = makeImg(fiftyby[0],
		`object-position: 0px -200px; top: ${(oldPos.y || 9) * px}px; left: ${(oldPos.x || 1) * px}px`, false);
	mapIcons.prepend(fordSprite)
}
//#endregion

// #region Cars
let seenCar = false;
async function carEvent() {
	if (!seenCar && !fast) {
		await speech("Seems like these cars will take you somewhere, but you won't be able to come back.")
		seenCar = true;
	}

	if (!fast) {
		// check if player has exhausted the map
		let intsLeft = 0;
		for (const int of interacts) {
			if (int === undefined) continue; // has been removed
			if (int === carEvent) continue; // obviously
			if (int === houseEvent) continue; // just an easter egg
			if (int === benEvent && benCount >= 3) continue; // ben has been caught
			if (int === angryEvent && angryAction2 === "bagel") continue; // happy man
			intsLeft++;
		}
		if (debug) console.log("Interactions left: " + intsLeft)

		if (intsLeft > 4) {
			await speech("It feels pretty early to leave, doesn't it?")
		} else if (!baldeEntered) {
			await speech(
				"You could leave, though you still feel like you could reach that house...",
				"Perhaps you could copy what he did to get into the void?")
		} else if (intsLeft !== 0) {
			await speech("You could leave, though there's still some things to do out here.")
		} else {
			await speech("You feel confident there's nothing left to do before you leave.")
		}
	}


	const choices = [["Leave the level in the red car", redCarEvent], ["Do not enter a car", noCar], ["Leave the level in the orange car", orangeCarEvent]]
	if (redEntered) choices.shift();
	choiceShow(choices);
}
function noCar() {
	updatePlayerPos(player.y + 1);
	boxClose();
}

let redEntered = false;
async function redCarEvent() {
	redCarEnt.sprite.style.zIndex = 99;
	boxClose();
	musPause();
	updatePlayerPos(1, 12);
	if (hasItem("Ford")) fordMove(1, 12);
	await timer(100);
	playerImg.style.display = "none";
	if (hasItem("Ford")) fordSprite.style.display = "none";

	redCarEnt.sprite.style.transition = "";
	playSfx("batman.ogg");
	await animate(redCarEnt.sprite, 1, "linear carspin");
	redCarEnt.sprite.style.display = "none";

	await timer(3000);
	await speech("The red car has taken you to a microscopic level in which you do not exist.");
	await speechBlank("Uncaught ReferenceError: player is not defined", 50, false);

	main.style.display = "none";
	redEntered = true;
	updatePlayerPos(10, 2, false);
	if (hasItem("Ford")) fordMove(9, 1);
	playerImg.style.display = "";
	if (hasItem("Ford")) fordSprite.style.display = "";

	loadbutton.textContent = "Start Game??? I Guess??????";
	loadbutton.onclick = redFakeout;

	document.documentElement.style.background = "#fff";
	await timer(Math.random() * 2000);

	document.documentElement.style.background = "#000";
	await timer(Math.random() * 1000);

	loading.style.display = "";
	loadbutton.focus({focusVisible: true});
}
async function redFakeout() {
	loading.style.display = "none";
	main.style.display = "";
	musResume(oldVol, false)
	await speech(
		"Luckily, you had your \"Send Me Home When I'm Eaten By A Sentient Red Car\" device.",
		"It's a good thing that random guy in the street last week sold it to you!");
	moveAllow();
}

let speedran = false, speedrunTime, speedrunLimit;
async function orangeCarEvent() {
	orangeCarEnt.sprite.style.zIndex = 99;
	boxClose();
	moveStop();
	musPause();
	updatePlayerPos(1, 13);
	await timer(100);
	playerImg.style.display = "none";

	// only trigger if no items or just ford obtained
	if (inventory.length === (angryDead ? 2 : 1)) {
		speedrunTime = secondsAgo(timeStarted);

		// on normal mode, can reasonably get here in 8s without items, or in 20 with killing angry
		speedrunLimit = angryDead ? 30 : 15
		// fast mode skips the rock cutscene (abt 8s if spamming space and fumbling inventory) and angry transition in
		if (fast) speedrunLimit -= angryDead ? 11 : 8;

		// i've attempted to make these times reasonable for even someone who is slow with their hands, hopefully i landed it about right

		if (speedrunTime <= speedrunLimit) {
			const speedrunAssets = [
				"img/map2.png",
				"img/grinch.webp",
				"snd/landing.ogg",
				"img/explode.gif",
				"snd/deltarune-explosion.mp3",
				"mus/selfdestruction.ogg",
			]
			if (angryDead) {
				speedrunAssets.push(
					"mus/creepygarf.mp3",
					"img/room-empty.webp",
					"img/choices.webp",
					"snd/dee.ogg", "snd/from.ogg",
					"mus/ultimatum.ogg"
				);
			} else {
				speedrunAssets.push("mus/gasgasgas.ogg");
			}
			preload(speedrunAssets);
			if (debug) console.log(`${speedrunTime} of ${speedrunLimit}`)
			deleteElems("toprightmessage")
			speedran = true;
			speedrunCar();
			return;
		}
	}

	preload([
		"img/map2.png",
		"snd/marioworld.ogg",
		"snd/aa-courtrecord.ogg",
		"snd/rock.ogg",
		"mus/suspense.ogg",
		"img/grinch.webp",
		"img/grinch-phone.webp",
		"snd/buildup.ogg",
		"snd/hunterdown.ogg",
		"mus/innsbruck.ogg"
	])

	if (hasItem("Ford")) {
		fordSprite.style.top = pxify(1);
		fordSprite.style.left = pxify(13);
		await timer(100);
		fordSprite.style.display = "none";
	}

	if (!fast) {
		orangeCarEnt.sprite.style.transition = "";
		playSfx("carcrash.mp3");
		await animate(orangeCarEnt.sprite, 6, "linear slideleft");
		orangeCarEnt.hide()
	}

	levelTwo();
}

async function speedrunCar() {
	orangeCarEnt.sprite.style.transition = "";
	playSfx("takeoff.ogg");
	animate(orangeCarEnt.sprite, 5, "linear cartakeoff");

	if (hasItem("Ford")) {
		ford.remove(); // you slam the car door as soon as you're in, abandoning your ford to shave milliseconds off your time. he is distraught, he believed you were his friend, and would've been loyal to the end. this is your opportunity to make a fanfic of what he does from here

		fordSprite.style.top = pxify(2);
		fordSprite.style.left = pxify(13);
		await timer(500);

		const flip =async (delay = 300)=> {
			await timer(delay);
			fordSprite.style.transform = "rotateY(180deg)";
			await timer(delay);
			fordSprite.style.transform = "";
		}

		await flip();
		await flip();
		await timer(300)
		fordSprite.style.transform = "rotateY(180deg)";

		await timer(1000)

		fordSprite.style.left = pxify(12);

		await timer(1900);
	} else {
		await timer(4900);
	}

	orangeCarEnt.hide();
	levelTwo();
}
//#endregion

//#endregion


// #region Level Two
const toPreload = ["mus/creepy.ogg"];
let blueInator, grinchEnt, grinchSprite, destructEnt;
let enterEnt, yellowEnt, noclipGrinch = false;
async function levelTwo() {
	await animate(main, 1, "ease-in-out fadeout");
	if (fast && !speedran) orangeCarEnt.hide()
	main.style.display = "none";

	await loadingScreen();

	if (hasItem("Worm")) toPreload.push(...["mus/bookworm.ogg"])
	if (hasItem("Pooky Coin")) toPreload.push(...[
		"img/comic.webp",
		"mus/trivia-timer.ogg",
		"snd/drumroll.ogg",
		"snd/incorrect.ogg",
		"img/turkey.webp",
		"img/real.png",
		"snd/ding.ogg",
		"mus/trivia-menu.ogg"
	])
	if (hasItem("LAZER TAG Blaster") || hasItem("Nintendo DS Lite") || hasItem("Worm") || hasItem("Safety Scissors")) toPreload.push(...[
		"snd/charging.ogg",
		"img/bluetoothlazer.gif",
		"snd/lazar.ogg",
		"snd/lazarshort.ogg",
		"vid/badend.webm",
		"mus/blue.mp3"
	])

	preload(toPreload);

	matrix = [
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
		[1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
		[1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1]
	];

	curPosVal = 1
	startLevel("map2.png", 10, 7);

	baldeDisable = true;
	noclip = false;

	// move bottle out of first slot to discourage picking it as first ending, hopefully this is too subtle for anyone to notice or care
	const hasBottle = hasItem("Empty Bottle")
	if (hasBottle) {
		inventory.splice(hasBottle, 1);
		inventory.push(bottle);
	}

	destructEnt = new mapEnt(destructEvent, [[3, 7], [3, 8]]);
	enterEnt = new mapEnt(enterEvent, [[9, 7], [9, 8]]);
	yellowEnt = new mapEnt(yellowEvent, [6, 4]);

	grinchEnt = new Character(
		[grinchEvent, [[5, 11], [7, 11], [6, 10], [6, 12]], [6, 11], "grinch"],
		["???", [92, 101], "grinch", false, grinchSheet, [313, 500]]
	)
	grinchSprite = grinchEnt.sprite;
	grinchSprite.style.filter = "brightness(50) brightness(0)";
	grinchSprite.style.transform = "rotateY(180deg)";
	speechImg.style.filter = "brightness(50) brightness(0)";

	const [bluex, bluey] = getSprite(fiftyby, "blueinator");
	blueInator = makeImg(fiftyby[0],
		`width: 200px; height: 200px; top: 32px; left: 300px; object-position: -${pxify(bluex)} -${pxify(bluey)}; filter: brightness(50) brightness(0.1);`, mapIcons);

	if (speedran) {
		if (angryDead) fordSprite.style.display = "none";
		grinchEnt.move([5, 8], [0,0]);
		playSfx("landing.ogg")
	}

	main.style.display = "";
	await animate(main, 1, "ease-in-out fadein");

	if (speedran) {
		// this is far down in the speedrun endings section, below all the normal endings
		endingSpeedrun();
		return;
	}


	if (!fast) {
		orangeCarEnt = new mapEnt(dud, [0, 0], [10, 8], "car-orange");
		orangeCarEnt.sprite.style.display = "none";

		orangeCarEnt.sprite.style.transition = "";
		orangeCarEnt.sprite.style.display = "";
		playSfx("marioworld.ogg");
		await animate(orangeCarEnt.sprite, 11, "linear carend");
		orangeCarEnt.sprite.style.transform = "rotate(270deg)";
		await timer(700);
		orangeCarEnt.hide();
	}

	playerImg.style.display = "";
	if (hasItem("Ford")) {
		mapIcons.prepend(fordSprite);
		fordSprite.style.top = pxify(11);
		fordSprite.style.left = pxify(7);
		fordSprite.style.display = "";
	}

	moveAllow();

	// detect noclip
	while (curPosVal !== 1 && !noMoreMoving) await timer(200);
	if (noMoreMoving) return;

	switch (exitScene) {
		case 0:
			await grinchEnt.talk("...I haven't even spoken a WORD to you yet, is that really necessary??")
			enterEnt.hide();
			noclipGrinch = 0;
			break;
		case 1:
			await grinchEnt.talk("Wh-", "What are you doing?!", "You do see the yellow circle, right? I had it all planned out, man!")
			leaveEnt.hide();
			noclipGrinch = 1;
			break;
		case 2:
			await grinchEnt.talk("Oh cmon, I can still see you!! Is this really necessary??")
			leave2Ent.hide();
			noclipGrinch = 2;
			break;
		case 3:
			await grinchEnt.talk("...you suck.")
			noclipGrinch = 3;
			break;
	}

}

function revealGrinch() {
	grinchSprite.style.filter = "";
	grinchSprite.style.display = "";
	speechImg.style.filter = "";
	grinchEnt.talkObj.name = "Red Grinch";
}

// #region Enter/Exit
let rockBlock; let exitScene = 0; let leaveEnt; let leave2Ent;
async function enterEvent() {
	if (!fast) {
		await grinchEnt.talk(
			"Ah, you have arrived...",
			"Please... step into the yellow circle.");
	}

	exitScene++
	enterEnt.hide();
	leaveEnt = new mapEnt(leaveEvent, [[10, 7], [10, 8]]);
}

async function leaveEvent() {
	await grinchEnt.talk(
		"Wh-", "Where are you going?!",
		"I had a whole thing planned, man!");

	exitScene++
	leaveEnt.hide();
	leave2Ent = new mapEnt(leave2Event, [[11, 7], [11, 8]]);
}
async function leave2Event() {
	leave2Ent.hide();
	await timer(100);
	moveStop();
	exitScene++

	rockBlock = makeImg(fiftyby[0],
		"width: 50px; height: 50px; top: 547px; left: 375px; object-position: -150px -0px; transform: scale(2) scaleX(2);", mapIcons);

	await animate(rockBlock, 0.1, "linear slideintop");
	updatePlayerPos(player.y - 1);
	if (hasItem("Ford")) {
		fordSprite.style.top = pxify(9);
	}
	playSfx("rock.ogg");
	await timer(3000);
	matrix[11][8] = 1; matrix[11][7] = 1;

	await grinchEnt.talk("Now can we get on with this?");
	moveAllow();
}
//#endregion

let grinchViolations = 0;
async function grinchEvent() {
	if (grinchViolations === 3) {
		await grinchEnt.talk(
			"Yknow what, fuck this.",
			"I had a whole ass monologue planned and everything.",
			"But now I'm just uncomfortable.");
		if (benCount >= 3) {
			await grinchEnt.talk(
				"Hey, you kept getting up in Ben's space too!",
				"What's up with you and harassing people???",
				"You're weird. I'm outta here before you try something.");
		} else {
			await grinchEnt.talk("I gotta go, man. I can't handle this right now.");
		}
		moveStop();
		try{ leaveEnt.hide(); }catch(e){ /* these would crash if */ }
		try{ leave2Ent.hide(); }catch(e){ /* had already been hidden */ }

		const move =async (y, x)=> {
			await grinchEnt.move([y, x], [0, 0], 100);
		}

		await move(7,11);
		await move(8,11);
		await move(8,10);
		await move(8,9);
		await move(8,8);
		await move(8,7);
		await move(9,7);
		await move(10,7);

		if (exitScene === 3) {
			await timer(1500);
			await grinchEnt.talk("....................just uh, don't talk to me.");
			await speech("He sits in the corner and tries to hide his head, mumbling in a way that sounds upset.");
			matrix[11][8] = 1; matrix[11][7] = 1; // for some reason the rock breaks????
		} else {
			await grinchEnt.move([11, 7], [0, 0], 100);
			grinchSprite.style.display = "none";
			await timer(1000);
		}
		moveAllow();
		grinchViolations++;
		return;
	}

	if (grinchViolations === 0) {
		await grinchEnt.talk("Dude, personal space!");
	}
	if (grinchViolations === 1) {
		await grinchEnt.talk("You don't listen for shit, yknow that?!");
	}
	if (grinchViolations === 2) {
		await grinchEnt.talk("STAND IN THE FUCKING CIRCLE MAN!!!!!!!");
	}
	grinchViolations++;
}

async function destructEvent() {

	await speech(
		"Behind the machine, you find a self-destruct button.",
		"You feel like you should make a note of this...");
	playSfx("aa-courtrecord.ogg");
	destructInv.add();
	await speech("Self-Destruct Button added to the Court Record.");
	destructEnt.hide();
	preload([
		"img/objection.webp",
		"img/payne.png",
		"snd/payne.ogg",
		"img/evidence.png",
		"snd/evidence.wav",
		"mus/cornered-intro.ogg",
		"mus/cornered.ogg",
		"img/explode.webp",
		"snd/explode.ogg"
	])
}

// #region Karma Score
let karmaScore = 0, intelligence = 0, timeSincePrint;
const listPos = [], listNeg = [];
function karma(num) { karmaScore += num; }
function intel(num) { intelligence += num; }

// yes all of this scoring is completely arbitrary and stupid and even contradictory. that's the fun part :D
function calcKarmaScore() {
	karmaScore = 0; intelligence = 0;

	if (wasdCheck > 0) { intel(1); }
	else {
		karma(1);
		listPos.push("you're respectful of the rules");
	}

	if (clipCheck > 0) intel(1);
	if (noclipVoidCount) intel(-1);

	if (hasInted <= 10) {
		karma(-1); intel(-1);
		listNeg.push("you ignore your surroundings");
	}
	if (hasInted >= 20) {
		karma(1); intel(1);
		listPos.push("you pay attention to your surroundings");
	}

	if (skipCheck <= 10 && hasInted >= 10) {
		karma(1);
		listPos.push("you listen to people with patience and intent");
	}
	if (skipCheck > 10) {
		karma(-1);
		listNeg.push("you're impatient and like rushing others");
	}

	if (houseCount[0] === 3 || houseCount[1] === 3) {
		intel(-1);
		listNeg.push("you try to force what you can't have");
	}

	if (sideRockCount >= 2) { intel(-1); }
	if (sideRockCount >= 3) {
		intel(-2);
		listNeg.push("you can't pick up on the simplest of hints");
	}
	if (sideRockCount === 5) { karma(-1); intel(-2); }

	if (benCount === 0) {
		karma(-1);
		listNeg.push("you avoid talking to people");
	}
	if (benCount === 1 || benCount === 2) {
		karma(1);
		listPos.push("you engage in friendly conversation");
	}
	if (benCount >= 3) {
		karma(-1);
		listNeg.push("you harass people");
	}

	if (hasItem("Nintendo DS Lite")) {
		karma(1);
		listPos.push("you accept acts of kindness");
	}
	if (aarDeclined) {
		karma(-1);
		listNeg.push("you reject acts of kindness");
	}
	if (hasItem("microSD Card")) {
		intel(2);
		listPos.push("you inspect things carefully");
	}

	if (baldeEnt.func !== baldeEvent && !baldeScared) {
		karma(2); intel(2);
		if (benCount >= 3) {
			listPos.push("you notice and respect people's boundaries... sometimes");
		}
		else {
			listPos.push("you notice and respect people's boundaries");
		}
	}
	if (baldeScared) {
		karma(-1);
		listNeg.push("you chase and scare people who clearly want to be alone");
	}
	if (baldeEntered) {
		karma(-1);
		listNeg.push("you're a home invader");
	}
	if (baldeCaught) {
		intel(-1);
		listNeg.push("you're slow");
	}
	if (baldeReachedExit) {
		intel(1);
		listPos.push("you're quick on your fingers");
	}
	if (baldeRanFrom) {
		intel(-1);
		listNeg.push("you're a coward");
	}
	if (baldeRanPolite) {
		karma(2);
		listPos.push("you're polite");
	}
	if (scissorsGot) {
		karma(-1);
		listNeg.push("you're a thief");
	}

	if (wormCount) {
		karma(1); intel(1);
		listPos.push("you enjoy nature and life");
	}

	if (waterdenier) {
		karma(-2);
		listNeg.push("you reject fate");
	}
	if (hasItem("Glass of Water")) {
		karma(2);
		listPos.push("you support local businesses");
	}

	if (angryAction2 === "bagel") {
		karma(3); intel(3);
		listPos.push("you share with those around you");
	}
	if (angryAction2 === "nobagel") {
		karma(-1); intel(-1);
		listNeg.push("you're stingy and greedy");
	}
	if (angryRan) {
		intel(-1);
		listNeg.push("you're a coward");
	}
	if (angryDead) {
		karma(-2); intel(-1);
		listNeg.push("you're a murderer");
	}

	if (redEntered) {
		intel(-1);
		listNeg.push("you chose the wrong car like an idiot");
	} else {
		intel(1);
		listPos.push("you make smart choices");
	}

	if (noclipGrinch === 0) {
		karma(-1);
		listNeg.push("you couldn't even come here for a moment without trying to break things");
	}
	if (exitScene === 3 || noclipGrinch >= 2) {
		karma(-1);
		if (noclipGrinch === 3) { karma(-1); intel(1); }
		listNeg.push("you tried to leave right after you got here, even though you're supposed to be like, saving the world or whatever");
	}
	if (hasItem("Self-Destruct Button")) {
		intel(3);
		listPos.push("you're thorough with exploration");
	}

	if (grinchViolations === 2) {
		karma(-1);
		listNeg.push("just now, you kept getting all up in my space");
	}
	if (grinchViolations === 3) {
		karma(-2);
		listNeg.push("just now, I had to shout for you to get away from me");
	}
	if (grinchViolations === 4) {
		karma(-3);
		listNeg.push("to top it all off, you were bein a fuckin creep all up in my face just now");
	}

	// tiebreakers
	if (listNeg.length - 1 > listPos.length) karma(-1);
	if (listPos.length - 1 > listNeg.length) karma(1);

	if (debug) {
		console.log(`SCORE: ${karmaScore} Karma, ${intelligence} Intelligence, ${hasInted} interactions `);
		console.log(listPos);
		console.log(listNeg);
	}
}
async function grinchPrintList(list) {

	function capitalize(string) {
			return string.charAt(0).toUpperCase() + string.slice(1);
	}

	timeSincePrint = new Date().getTime();
	await speechBlankChar(grinchEnt, capitalize(list.shift()) + ", ", 1);
	for (const line of list.slice(0, -1)) { // remove last
		await speechAdd(line + ", ", 1);
	}
	await speechAdd(`and ${list.pop()}!`);
}
//#endregion

// #region Grinch Monologue
let noMoreMoving = false;
async function yellowEvent() {
	moveStop(); noMoreMoving = true;
	calcKarmaScore();

	if (hasItem("Ford")) {
		fordSprite.style.top = pxify(6);
		fordSprite.style.left = pxify(3);
	}

	if (fast) {
		await speech("Would you like to skip to the ending choice?");
		choiceShow([["Skip to the end, reading's for LOSERS", endChoiceNow], ["Let the grinch speak", grinchBegin]]);
		return;
	}

	grinchBegin();
}
let grinchSpoken = false;
async function grinchBegin() {
	boxClose(); moveStop();
	grinchSpoken = true;

	if (grinchViolations >= 4) {
		await timer(1000);
		grinchSprite.style.display = "";
		await grinchEnt.move([6, 11], [0, 0], 100);
		await timer(1100);
		await grinchEnt.talk("Alright, I think I'm ready to try this again...");
		if (karmaScore + 3 > 0) {
			await grinchEnt.talk("Fuck, man... super out of character...");
		} else if (karmaScore + 3 < -1) {
			await grinchEnt.talk("Fuck, man... you really are an asshole...");
		} else if (hasInted < 5) {
			await grinchEnt.talk("Fuck, man... it's like you came here just to do that...");
		}
		await grinchEnt.talk("A-ahem...");
	} else if (noclipGrinch !== false && noclipGrinch !== 1) {
		await grinchEnt.talk(
			"Are you gonna stop flying around all over the place?",
			"Good. Let's try this again.", "A-ahem...");
	} else if (exitScene === 3) {
		await grinchEnt.talk(
			"Alright, gimmie a sec, you threw me off...",
			"Just, at least pretend you wanna be here, alright?",
			"A-ahem...")
	}
	await grinchEnt.talk(
		"So, you've come to try and stop me?",
		"...you have no idea who you're dealing with, do you?",
		"Yes, it is I, the most evil being of all time...");
	if (!fast) {
		await timer(500);
		await animate(grinchSprite, 1, "linear grinchunveil");
	}
	revealGrinch()
	await timer(500);
	musicSting();
	await grinchEnt.talk("Red Grinch!");

	choiceShow([["oh fuck", endOhFuck], ["Who?", endWho]]);
}

async function musicSting() {
	await playSfx("hunterdown.ogg");
	if (machineShowed === false) {
		musPlay("suspense.ogg", 0.5, defSlowFade);
	}
}
async function endOhFuck() {
	await speechBlankChar(grinchEnt, "Wait wh-", 200);
	await speechAdd(" I mean-", 200);
	await speechAdd(" Haha! Yes! Fear me!");
	genericRant();
}
async function endWho() {
	await speechBlankChar(grinchEnt, "H-", 200);
	await speechAdd("hey!!", 500);
	await speechAdd(" Fucked up!!!!", 500);
	await speechAdd(" You're supposed to fear me!");
	genericRant();
}

let machineShowed = false;
async function genericRant() {
	await grinchEnt.talk("I have come to destroy the traditional Christmas spirit in a comical way which is friendly for children's television and doesn't involve murder!");
	if (hasItem("Ford")) {
		await grinchEnt.talk(
			"Nobody will be able t-......",
			"...i just realized, who's that guy following you?");
		playSfx("ford-whatup.ogg");
		await fordObj.speech("what up son");
		await grinchEnt.talk(
			"...hi", "Anyway, you think you can stop me?");
	} else {
		await grinchEnt.talk(
			"Nobody will be able to stop me!",
			"You think you can?");
	}

	if (intelligence > 2) {
		await grinchEnt.talk(`Historically your thinking has been like ${intelligence} good so can you stop thinking please!`);
	} else if (intelligence <= 0) {
		await grinchEnt.talk(
			"That's because you're a fucking idiot!",
			`You're literally ${intelligence} smart!!!`,
			"I would know, I've been watching you this whole time!",
			"Where are my metrics for this????? WHAT A STUPID QUESTION!!! SEE, ONLY A STUPID PERSON WOULD ASK THAT!!!!");
		await speechBlankChar(grinchEnt, '"I AM NOT A SMART PERSON."      ', 500);
		await speechAdd("THAT'S YOU!!!!!!!!! THAT'S WHAT YOU SOUND LIKE!!!!!!");
	} else {
		await grinchEnt.talk(`You're only like ${intelligence} smart on the smartness scale, why would you be able to stop me?!`);
	}

	await grinchEnt.talk(`That's right, I've been stalking you the past ${secondsAgo(timeStarted)} seconds!!!!!! And I've used my patented Karma Score technology to analyze how good you are, subtracting points for bad actions and adding points for good actions!!`);

	if (hasInted < 5) {
		await grinchEnt.talk("...problem is, there's hardly anything to fucking score!");
		grinchEarlyEnd();
		return;
	}

	if (karmaScore > 1) {
		await grinchEnt.talk(`So I already know all about you and your ${karmaScore} Score, Mr. John Goodie Green Mc-Positive "Two-Shoes" Jones!`);
		await grinchPrintList(listPos);
		await grinchEnt.talk(
			"I know you like a USB 2.0 OTG Micro-B to 10/100 Ethernet Adapter Health, Safety and Warranty Information Booklet!",
			"There's no way you can stop my plan now!");
	} else if (karmaScore < -1) {
		await grinchEnt.talk(`And with a Score like ${karmaScore}, you're a bit of a Grinch 2 by Illumination Studios yourself!`);
		await grinchPrintList(listNeg);
		await grinchEnt.talk(
			"You're worse than a KVM Switch 2 Monitors 2 Computers 4K 60HZ, 2 PC 2 Monitor Switch, HDMI KVM Switch Dual Monitor, USB Switch 2 in 2 Out with Cables, Support USB 3.0,HDCP2.2, Hotkey,Extended And Mirror Display!",
			"You can't stop my plan, you're not even better than me! And besides, my plan is a service to humanity!");
	} else {
		await grinchEnt.talk("...and I must admit, you're quite the enigma. On one hand...");
		await grinchPrintList(listPos);
		await grinchEnt.talk("And at the same time...");
		await grinchPrintList(listNeg);
		await grinchEnt.talk(
			"Wh-what do I even think about you????? You're forcing me to question my binary perception of reality!!!!!",
			"I'll just uh... tell you my plan...");
	}

	await grinchEnt.talk(
		"You see, every Christmas, people spend countless dollars on awful terrible stupid garbage...",
		"Worthless trinkets, socks that don't fit, food that tastes bad, drones that explode...",
		"No more! Everyone will only be able to gift one thing, thanks to this machine...");

	machineShowed = true;
	musPause();
	await timer(100);
	if (!fast) {
		playSfx("buildup.ogg");
		await animate(blueInator, 12, "linear machineunveil");
	}
	blueInator.style.filter = "";
	await timer(500);

	musPlay("innsbruck.ogg", 0.4, false);
	await grinchEnt.talk(
		"The Plugable USB Bluetooth 4.0 Low Energy Micro Adapter Inator!!!!!!!!!!!",
		"It will brainwash everyone on Earth into only ever gifting people Plugable USB Bluetooth 4.0 Low Energy Micro Adapters!!!!!!!",
		"And it is remotely controlled...");
	grinchEnt.setTalkImg("grinch-phone.webp", false, false);
	await grinchEnt.talk("Using this Plugable USB Bluetooth 4.0 Low Energy Micro Adapter plugged into my phone!!!!!!!!!!!");
	grinchEnt.setTalkImg("grinch", false, grinchSheet);
	await grinchEnt.talk(
		"As you can see, my plan is flawless! Everything is in place!",
		`And hey, remember like ${secondsAgo(timeSincePrint)} seconds ago when I told you a bunch of things about yourself?`,
		"Yea I still know all that!!!!! I know everything about you!!!!! I was able to skim you like The Subspace Emissary's Worlds Conquest!!!!!!!!!",
		"You'd have to have some big trick up your sleeve to beat me! There's no way you do, that'd be stupid! And I'm too smart to be beat!");


	cutscene(true);
	await musVolume(0.1, defSlowFade)
	await timer(500);
	await speech("Suddenly, you remember another thing your mother always said...")
	await momObj.speech(
		"One of these days, you're going to have to make a choice!",
		"You will have 12 possible options and only one of the choices will be good and and a few of the choices will be bad and the rest will just be weird choices that don't make sense!",
		"Like you!! You're weird!!! You're a weird child!!!!!! Get out of my house!!!!!!!!!!!")
	await speech("You don't think that last part was relevant, but the rest sounded important...")
	cutscene(false, "map2.png");
	await musVolume(0.4, defSlowFade)
	await timer(500);
	await speech("You know what you have to do now.");
	await speechBlank("You open your inventory one last time, and ponder which trick to treat him with.")
	await speechAdd(".. wait fuck, that's Halloween.");
	if (new Date().getMonth() === 9) await speechAdd(".. wait it IS halloween, why are you even playi- oh fuck this just choose an item")
	endChoiceNow();
}
async function grinchEarlyEnd() {
	machineShowed = true; musPause();
	await grinchEnt.talk(
		"You're boring as shit, dude! You barely even played the game!!",
		`Imagine taking the time to start up this game,${!fast ? " and even watch the intro," : ""} just to slowly walk to the end without interacting with ANYTHING on the map!`,
		"It's like walking into fucking Disneyland and going \"Let's wait in line for a hot dog and then leave!\"",
		"YOU JUST CAN'T DO THAT MAN.", "Ugh, whatever.",
		"You probably already know my plan, it's not even worth monologuing to you.",
		"I bet you don't even have any items other than the Empty Bottle.",
		"Just go ahead and do it already.");
	endChoiceNow();
}
//#endregion

// #region The End
async function endChoiceNow(remember) {
	moveStop();
	await loadingScreen();

	// hide ending screen
	endScreen.style.display = "none";
	main.style.background = `url(assets/img/map2.png)`;
	mapIcons.style.display = "";
	controls.style.display = "";
	main.style.display = "";

	// reset everything
	overlay.innerHTML = "";
	overlay.style.display = "none";
	speechSet(); boxClose();
	grinchEnt.setImg("grinch");
	grinchEnt.setTalkImg("grinch");
	grinchEnt.move([6, 11]);
	grinchSprite.style.transform = "rotateY(180deg)";

	// reset ford
	if (hasItem("Ford")) {
		fordSprite.style.top = pxify(6);
		fordSprite.style.left = pxify(3);

		// remember ford being down when leaving scissor ending
		if (remember !== true) {
			fordDown = false;
			fordSprite.style.transform = "";
		}
	}

	// do all mid-dialogue changes
	revealGrinch()
	machineShowed = true;
	blueInator.style.filter = "";

	// reset karma
	if (endingChoice === "sd") { karma(-5); intel(-5); }
	if (endingChoice === "worm") { karma(-1); }
	if (endingChoice === "bottle") { karma(1); }
	if (endingChoice === "bash") { karma(1); }
	endingChoice = false;
	needsReplayWarning = true;

	// reset music
	if (!musCurrent(`innsbruck.ogg`)) {
		await musPause();
		music.playbackRate = 1;
		musPlay("innsbruck.ogg", 0.4, false);
	}

	// from here, actually activate choice

	invOpen(endChoice, false);

	const inverseInventory = itemList.filter(item => !inventory.includes(item))
	const itemsSeen = [], itemsMissing = [];
	for (const item of inverseInventory) (seenEndings.includes(item.name) ? itemsSeen : itemsMissing).push(item)

	for (const item of itemsSeen) invMenuItem(item, false);
	for (const item of itemsMissing) {
		const button = invMenuItem(item, false);
		button.textContent = "???"
		button.style.setProperty('--img', "")
		button.style.setProperty('--position', `-74px -573px`)
		button.style.setProperty('--size', `1500px`)
		button.style.filter = "brightness(0)"
	}
}

let endingChoice = false;
const seenEndings = JSON.parse(localStorage.getItem("seenEndings")) || [];
function endChoice(item) {
	boxClose(); moveStop();

	switch (item) {
		case "Empty Bottle": endingBottle(); break;
		case "Nintendo DS Lite": endingDS(); break;
		case "R4 Cartridge": endingR4(); break;
		case "microSD Card": endingSD(); break;
		case "Worm": endingWorm(); return;
		case "Worms": endingWorms(); break;
		case "Pooky Coin": endingCoin(); break;
		case "Glass of Water": endingWater(); break;
		case "LAZER TAG Blaster": endingBlaster(); break;
		case "Ford": endingFord(); break;
		case "Self-Destruct Button": endingDestruct(); break;
		case "Safety Scissors": endingScissors(); return;
		default: endingNull(); break;
	}

	// some above will return to prevent adding here
	if (!seenEndings.includes(item)) {
		seenEndings.push(item)
		localStorage.setItem("seenEndings", JSON.stringify(seenEndings))
	}
}

// #region Individual Endings
function endingNull() {
	errormode()
	musPause(false);
	const brokenCanvas = document.createElement("canvas");
	brokenCanvas.id = "brokenCanvas";
	main.insertBefore(brokenCanvas, theBox);
	function brokenRender() {
		const grid = brokenCanvas.getContext("2d");

		grid.canvas.width = matrix[0].length * px;
		grid.canvas.height = matrix.length * px;

		for (const row in matrix) {
		for (const col in matrix[row]) {
			grid.fillStyle = randomColor();
			grid.fillRect(col * px, row * px, px, px);
		}}
	}
	function brokenLoop() {
		brokenRender(brokenCanvas); setTimeout(brokenLoop, 500);
	}
	brokenLoop();
	for (let i = 0; i < 10; i++) {
		speechBlank("You appear to have broken reality by choosing something which was not predetermined by fate.", 10);
	}
}

async function endingBottle() {
	endingChoice = "bottle";
	karma(-1);
	await speech(
		"You pull the empty bottle out, and stare at it for a few seconds.",
		"You chunk it into his face.");
	grinchEnt.setTalkImg("dying");

	if (hasInted < 5 && grinchSpoken) {
		await grinchEnt.talk("As I expected.");
	} else {
		await grinchEnt.talk("WHAT THE FUCK DUDE YOU JUST THREW A BOTTLE AT MY FACE HOLY SHIT IM BLEEDING WHAT THE FUCKKKK");
		if (angryDead) {
			await grinchEnt.talk("YOU MURDERED THE ANGRY MAN TOO WHY ARE YOU MURDERING PEOPLE ITS FUCKING CHRISTMAS YOURE NOT SUPPOSED TO KILL PEOPLEEEEE");
		} else {
			await grinchEnt.talk("YOU CANT JUST THROW GLASS INTO PEOPLES FACES WHAT THE FUCK MAN AUAUUGHGHH");
		}
	}
	musPause();
	grinchEnt.setTalkImg("dead");
	await speechBlankChar(grinchEnt, "", 2000);
	boxClose();

	await animate(grinchSprite, 1.5, "step-start blinkaway")
	grinchSprite.style.display = "none";
	await timer(1000)

	await cutscene(true);
	await speechBlank("then went prison for 3 day.");

	const endingLine = "need more. need to do it faster.";
	if (angryDead) {
		endGame("genocide ending", "genocide.ogg", endingLine, true);
	} else {
		endGame("murderer ending", "creepy.ogg", endingLine, true);
	}
}

async function endingWorms() {
	await speech("You take the worm couple out of your inventory, and show it to him.");
	await grinchEnt.talk(
		"OH NO MY NUMBER ONE WEAKNESS",
		"THE POWER OF LOVEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE");
	musPause();
	await timer(200);
	grinchEnt.setImg("grinch-icon-dissolve.gif", false);
	await playSfx("noo.ogg");
	endGame("love ending", "careless_whispers.ogg", "merry romance");
}

// #region Worm Ending
async function endingWorm() {
	await speech("You pull the worm out of your inventory.");
	grinchEnt.setTalkImg("smirk");
	await grinchEnt.talk("oh worm!");
	musPause();
	await timer(2000);
	await grinchEnt.talk(".......can i have it?");
	choiceShow([["Give the worm", wormGiven], ["Do not give", wormRefused]]);
}
async function wormGiven() {
	await grinchEnt.talk("oh thank you");
	await timer(500);

	const move =async (y, x)=> {
		await grinchEnt.move([y, x], [0, 0], 100);
	}

	await move(7,11);
	await move(8,11);
	await move(8,10);
	await move(8,9);
	await move(8,8);
	await move(8,7);
	await move(9,7);
	await move(10,7);

	if (exitScene === 3) {
		await timer(1500);
		grinchEnt.setTalkImg("grinch");
		await grinchEnt.talk("i uh");
		if (grinchViolations === 4) {
			await grinchEnt.talk("i still don't know how to get past the rock");
		} else {
			await grinchEnt.talk("i don't know how to get past the rock");
		}
		boxClose();
	} else {
		await grinchEnt.move([11, 7], [0, 0], 100);
		grinchSprite.style.display = "none";
	}
	await timer(1500);
	endGame("worm ending", "bookworm.ogg", "merry wormmas");
	seenEndings.push("Worm")
	localStorage.setItem("seenEndings", JSON.stringify(seenEndings))
}
async function wormRefused() {
	endingChoice = "worm";
	karma(-1);
	grinchEnt.setTalkImg("grinch");
	await grinchEnt.talk(
		"oh", "well", "fuck you");
	endingBad();
}
//#endregion

let chrisEnt;
async function endingWater() {
	await speech("You pull out your Glass of Water, and give it to him.");
	await grinchEnt.talk("what does this POSSIBLY change about this situation");
	musPause();
	await timer(500);

	chrisEnt = new Character(
		[dud, [0, 0], [6, 10], "chris.webp", false, mushy],
		["Chris Martin", [130, 50], "chris.webp"]
	)

	musPlay("glassofwater.ogg", 1, false, "glassofwater-intro.ogg");
	await animate(chrisEnt.sprite, 3, "linear chrisin");
	await speechBlankChar(chrisEnt, "SON", 1000, false); boxClose();
	await timer(4500);
	await speechBlankChar(chrisEnt, "DON'T ASK", 1500, false); boxClose();
	await timer(3300);
	speechText.innerHTML = "";
	await speechBlankChar(chrisEnt, "NEITHER HAAAALF ", 1000, false);
	await speechAdd("FUUUUUUUUUULL ", 1700, false);
	await speechAdd("OR EMPTYYY", 1000, false); boxClose();
	await timer(1500);
	await speechBlankChar(chrisEnt, "IS YOUR GLASS", 2000, false); boxClose();
	await animate(chrisEnt.sprite, 2, "linear chrisout");
	chrisEnt.hide();

	await grinchEnt.talk("...", "he's technically not wrong, it's like 3/4ths full");

	endGame("water ending", false, "merry coldplay");
}

let payneEnt;
async function endingDestruct() {
	musPause();
	playSfx("payne.ogg");
	overlay.style.display = "";
	overlay.style.opacity = "";
	const objection = makeImg("objection.webp", "", overlay);
	await timer(1500);
	overlay.style.display = "none";
	overlay.removeChild(objection);

	await timer(500);
	payneEnt = new Character(
		[dud, [0, 0], [6, 7], "payne.png", false, mushy],
		["Winston Payne", [62, 318], "payne.png", crispy]
	)

	await animate(payneEnt.sprite, 0.5, "linear growin");
	await timer(1000);
	await payneEnt.talk(
		"You claim to be smart...",
		"But I happen to have evidence to the contrary!");
	await grinchEnt.talk("who are you what are you even talking about");

	playSfx("evidence.wav");
	const evidence = makeImg("evidence.png", `height: 140px; position: absolute; top: 25px; right: 25px`);
	await payneEnt.talk("Look at this cool thing I found!");

	main.removeChild(evidence);
	musPlay("cornered.ogg", 1, false, "cornered-intro.ogg");
	speechText.style.fontSize = "18px";
	speechText.style.fontWeight = "900";
	await grinchEnt.talk("HOLY SHIT HOW DO YOU HAVE THAT WHAT THE FUCK PUT THAT DOWN YOU'LL KILL US ALL HOLY SHIT PUT THAT AWAY PUT IT ON THE GROUND RIGHT NOW LET'S ALL JUST RELAX AND TAKE IT EASY WE CAN WORK THIS OUT JUST PUT THE BUTTON ON THE GROUND PLEASE FOR THE LOVE OF GOD HOLY FUCK WHY ARE YOU JUST CASUALLY HOLDING THAT IN YOUR HAND WITH THE COVER UP OH MY GOD PLEASE PUT THAT AWAY WHAT THE FUCK MAN WHYYYYYYYY");
	speechText.style.fontSize = "";
	speechText.style.fontWeight = "";

	await payneEnt.talk(
		"How can you claim to be smart when you made a self-destruct button?!?!",
		"Obviously you are STUPID!!!!!!!!!",
		"HAHAHAHAHAHA!!!!! The Great Winston Payne wins again!!!!!!!!",
		"And just to prove how right I am, I am going to press this button!");

	speechText.style.fontSize = "28px";
	speechText.style.fontWeight = "900";
	speechBlankChar(grinchEnt, "STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP STOP", 1, false);
	await timer(1000);

	playSfx("explode.ogg");
	overlay.style.display = "";
	overlay.style.opacity = "";
	const explode = makeImg("explode.webp", "", overlay);
	await timer(500);
	endGame("doof ending", false, "almost christmas means it wasn't christmas");

	overlay.style.display = "none";
	overlay.removeChild(explode);
	payneEnt.hide();
	speechText.style.fontSize = "";
	speechText.style.fontWeight = "";
}

async function endingFord() {
	if (fordDown) {
		await speech("Your Ford is down, he can't do anything! (until you get another ending)")
		endChoiceNow(true);
		return;
	}

	musPause();
	await timer(1000);
	playSfx("slap.ogg");
	fordSprite.style.left = pxify(11);
	await animate(grinchSprite, 1, "linear flyoff");
	grinchSprite.style.display = "none";
	await timer(1000);
	playSfx("ford-monkeybunked.ogg");
	await fordObj.speech("You just got monkeybunked!");
	endGame("bone ending", "bonetheme.ogg", "merry bonemas");
}

async function endingCoin() {

	const buzzes = [];
	async function youTurkey() {
		sfx = new Audio(`assets/snd/incorrect.ogg`);
		sfx.volume = 1 * userVol;
		sfx.play();
		buzzes.push(sfx);
		const turkey = makeImg("turkey.webp",
		`${mushy} position: absolute; width:auto; height: auto; top: 25px; left: 169px;`, mapIcons, "turkey");
		await animate(turkey, 0.5, "ease turkeyin");
		return turkey
	}

	await speech("You offer him the coin, on the condition that he guesses the correct line in a Garfield comic.");
	await grinchEnt.talk("oh uuhhhhhhhh sure i could use some money since i spent like a billion dollars funding this cool lazer");

	const comic = makeImg("comic.webp",
		`${mushy} width: 700px; height: 208px; object-fit: none; object-position: 0 0; position: absolute; inset: 50px;`, mapIcons);
	animate(comic, 0.5, "ease-in-out comicin");
	musPlay("trivia-timer.ogg", 1, false);
	await timer(2500);

	await grinchEnt.talk(
		"..............",
		"uhhhhhh fuck i thought this would be easy",
		"ive never actually read a garfield comic before",
		"WHAT WOULD HE EVEN SAY THERE THIS IS A CHILDRENS COMIC ISNT IT???",
		"fuck man maybe he says he went on a really good date???");
	musPause();
	playSfx("drumroll.ogg");

	await timer(2600);
	youTurkey()
	await timer(1000);
	await grinchEnt.talk("WHAT", "WHAT THE HELL DOES HE SAY??????");

	deleteElems("turkey")
	const comic2 = makeImg("comic.webp",
	`${mushy} width: 700px; height: 208px; object-fit: none; object-position: 0 -208px; position: absolute; inset: 50px;`, mapIcons);
	await animate(comic2, 1, "linear fadein");
	mapIcons.removeChild(comic);
	await timer(1000);

	const real = makeImg("real.png", `position: absolute`);
	playSfx("ding.ogg");
	await timer(500);
	real.style.display = "none";
	await timer(500);
	real.style.display = "";
	playSfx("ding.ogg");
	await timer(500);
	real.style.display = "none";
	await timer(500);
	real.style.display = "";
	playSfx("ding.ogg");
	await timer(2000);
	real.style.display = "none";
	await timer(1000);
	mapIcons.removeChild(comic2);
	await timer(1000);

	await grinchEnt.talk("..........", "i'm just gonna", "go back to shooting lasers");

	await youTurkey();
	await speechBlankChar(grinchEnt, "wait what", 200, false);
	await youTurkey();
	boxClose();

	youTurkey(); await timer(1000);
	youTurkey(); await timer(500);
	youTurkey(); await timer(200);
	youTurkey(); await timer(100);
	for (let i = 0; i < 10; i++) {
		youTurkey(); await timer(100);
	}
	youTurkey();

	endGame("trivia ending", "trivia-menu.ogg",
		"Uh oh... Coffee was spilled on the Garfield comic strip... Think you can figure out what words are missing? Don't worry... You'll have some help. Get one question from each category correct to win! Earn Pooky Coins each time you answer a question correctly. Use them to unlock question packs and lifelines.");
	youTurkey(); await timer(100);
	youTurkey(); await timer(100);
	sfx.pause(); buzzes.forEach(el => {el.pause(); el.remove()});
	deleteElems("turkey")
}

async function endingR4() {
	await speech("You offer him the R4 cartridge.");
	await grinchEnt.talk("wh", "i dont have a ds what am i supposed to use this for why would i want this");
	musPause();
	await timer(500);
	grinchSprite.style.transform = "";

	const aar2Ent = new mapEnt(dud, [0, 0], [6, 12], "aaron")

	async function flip(delay = 500) {
		await timer(delay);
		grinchSprite.style.transform = "rotateY(180deg)";
		await timer(delay);
		grinchSprite.style.transform = "";
	}

	musPlay("aarrant.mp3", 1, false);
	await animate(aar2Ent.sprite, 4, "linear slideintop");
	await timer(500);
	await flip();
	await flip(1000);
	await timer(1000);
	await speechBlankChar(grinchEnt, "where did you even come from????????? did you just sense i had an r4 and come to tell me about it?????????");
	boxClose();
	await flip(); await flip(); await flip();
	for (let i = 0; i < 9; i++) {
		await flip(100);
	}

	endGame("aaron ending", false, "merry scrungus");
	aar2Ent.hide();
}

async function endingSD() {
	endingChoice = "sd";
	karma(5); intel(5);
	await speechBlank("You offer him the microSD card.");
	await grinchEnt.talk(
		"oh, thanks!", "i've actually been needing more storage",
		"yknow, i've been making so many files planning this machine out, and my drives are all getting full, and i just can't really afford more right now");
	musPause();
	await grinchEnt.talk(
		"...wait", "you... you actually got me a good gift",
		"were you watching me as well?", "did you know i needed this????",
		"wait", "good gifts exist???????????",
		"WHAT HAVE I BEEN DOING THIS FOR????????????????",
		"the entire motivation for my plan",
		"WHAT'S THE POINT OF IT ALL",
		"WHAT'S THE POINT OF IT ALLLLLLLLLLLLLLLLLLL",
		"............................");
	grinchEnt.setTalkImg("smirk");
	musPlay("goodend.ogg", 1, 0.00125);
	await grinchEnt.talk(
		"i get it now", "christmas isn't about gifts",
		"it never was", "it's about someone showing they care",
		"someone making a conscious effort to say \"hey, i see you\"",
		"in a world where everyone always seems ready to fight",
		"in a world where anything can be gone in an instant",
		"maybe just letting someone know they're thought about can save them from doing something they'll regret",
		"thank you.");
	await timer(3500);
	grinchEnt.setTalkImg("grinch");
	await speechBlankChar(grinchEnt, "what the fuck do i do with this giant fucking laser that i just spent my life savings on", 50, false);
	creditsButton.style.display = ""
	endGame("the end", false, "merry christmas");
}

async function endingBlaster() {
	await speech("You whip out the blaster like a badass.");
	playSfx("blaster.ogg");
	await speech("*pew pew pew*");
	await grinchEnt.talk(
		"...............", "let me show you a REAL lazer");
	endingBad();
}

async function endingDS() {
	await speech("You hand him the DS.");

	if (hasItem("R4 Cartridge")) {
		await grinchEnt.talk("i dont have any games why do i even want this");
	} else {
		await grinchEnt.talk(
			"i dont have any games why do i even w-",
			"oh theres a cartridge", "oh its an r4",
			"oh the only game on it is mario kart ds",
			"i hate racing games");
	}

	await grinchEnt.talk("fuck you this gift sucks you just proved my point");
	speechSet();
	endingBad();
}

// #region Scissors Ending
let grinchFighter;
async function endingScissors() {
	musPause();
	await speechBlank("You brandish the safety scissors and threaten his knee caps.");
	boxClose();

	playSfx("eb/boss.ogg");
	await ebOverlay("boss.webp", 2000);

	main.style.background = "url('assets/img/earthbound-boss.webp')";
	mapIcons.style.display = "none";
	controls.style.display = "none";

	grinchFighter = makeImg("grinch-battle.webp",
		`width: 143px; height: 200px; object-fit: none; object-position: 0 0; position: absolute; top: 175px; left: 300px;`);

	musPlay("eb/jolly.ogg", 1, false);
	animate(main, 0.5, "linear fadein");
	await speechBlank("You confront the Red Grinch!", 1000);
	scissorChoices();
}
function scissorChoices() {
	choiceShow([["Bash", scissorBash], ["PSI", scissorPSI], ["Goods", scissorGoods], ["Defend", scissorDefend]]);
}
async function scissorBash() {
	endingChoice = "bash";
	karma(-1);
	playSfx("eb/equip.ogg");
	await speechBlank("You try to snip the hair off of his legs!", 700);

	grinchFighter.style.objectPosition = "-143px 0";
	animate(grinchFighter, 0.2, "linear damage");
	playSfx("eb/hit.ogg");
	await speechBlankChar("Red Grinch", "WHAT THE FUCK IS WRONG WITH YOU", 1000);
	scissorDie();
}
async function scissorPSI() {
	playSfx("eb/psi.ogg");
	await speech("You ask him why do they call it oven when you of in the cold food of out hot eat the food?");

	playSfx("eb/strangepsi.ogg");
	speechBlank(""); speechSet("Red Grinch");
	await speechAdd("The word likely comes from an Old English word \"ofen\", which originally referred to a chamber in a house where food was prepared and then taken to another room to be cooked over an open fire. This usage dates back to around the 13th century.");

	scissorBad();
}
async function scissorGoods() {
	await scissorEnd();
	endChoiceNow(true);
}
async function scissorDefend() {
	await speech("You enter a flawless defense stance.");
	scissorBad("defend");
}
let fordDown = false;
async function scissorDie() {
	musPause();
	playSfx("eb/enemydie.ogg");
	await animate(grinchFighter, 0.5, "linear enemydie");
	main.removeChild(grinchFighter);

	speechBlank("", 1); speechSet("YOU ARE IS DO BE WIENER        ???/?????????");
	await playSfx("eb/bosswin.ogg");
	speechSet();
	musPlay("eb/winmus.ogg", 1, false);
	await speech("You gained an exp or two.");

	musPause();
	await animate(main, 1, `linear fadeout`);
	main.style.display = "none";
	endGame("bald ending", "baldeend.ogg", "merry mathematics");
	await animate(endScreen, 1, `linear fadein`);
	seenEndings.push("Safety Scissors")
	localStorage.setItem("seenEndings", JSON.stringify(seenEndings))
}
async function scissorBad(action = false) {
	playSfx("eb/enemyturn.ogg");
	await speechBlank("The Red Grinch begins firing the inator!", 700);

	if (action === "defend") await speechBlank("The stance is irrelevant to the attack!", 700);

	if (hasItem("Ford") && fordDown === false) {
		await speechBlank("Your Ford distracts the Red Grinch by pathetically slapping him!", 700);
		animate(main, 1, "cubic-bezier(.68,-0.55,.27,1.55) lightdamageshake");
		playSfx("eb/hit.ogg");
		await speechBlank("He slaps the Ford back!", 700);
		playSfx("eb/death.ogg");
		fordDown = true;
		fordSprite.style.transform = "rotate(90deg)";
		await speechBlank("The Ford collapses...", 1000);
		scissorChoices();
		return;
	}

	await scissorEnd();

	endingBad();
}
async function scissorEnd() {
	boxClose(); musPause();
	cutscene(false, "map2.png");
	await timer(1000);
	main.removeChild(grinchFighter);
	await timer(1000);
}
//#endregion

//#endregion

// #region Bad Ending
let hasSeenBad;
async function endingBad() {
	if (fast) {
		await speech("This will play the bad end cutscene, would you like to see it?");
		choiceShow([["See the pretty lazor", endingBadCutsceneSlow], ["Make it quick", endingBadCutsceneFast], ["Let me choose again", endChoiceNow]]);
		return;
	}

	endingBadCutscene();
}
async function endingBadCutscene(instabad = "normal") {
	if (instabad === "no") hasSeenBad = false;
	if (instabad === "yes") hasSeenBad = true;

	boxClose(); musPause(); moveStop();
	if (!hasSeenBad) await timer(500);

	playSfx("charging.ogg");
	if (!hasSeenBad) {
		animate(mapIcons, 5, "linear movedown150");
		animate(main, 5, "linear movebgdown150");
	} else {
		sfx.playbackRate = 4;
		sfx.preservesPitch = false;
		animate(mapIcons, 1, "linear movedown150");
		animate(main, 1, "linear movebgdown150");
	}

	main.style.backgroundPosition = "0 150px";
	mapIcons.style.top = "150px";
	blueInator.style.filter = `brightness(1)`;
	blueInator.style.zIndex = 99;

	await timer(100)

	let seed =()=> Math.random() * (hasSeenBad ? 50 : 5) * sign()
	while (sfx.currentTime < sfx.duration - 0.2) {
		blueInator.style.top = parseInt(blueInator.style.top) + Math.round(seed()) + "px";
		blueInator.style.left = parseInt(blueInator.style.left) + Math.round(seed()) * sign() + "px";
		blueInator.style.filter = `brightness(${Math.floor(seed())})`;
		await timer(50);
	}

	blueInator.style.top = "32px";
	blueInator.style.left = "300px";
	blueInator.style.filter = `brightness(1)`;
	if (!hasSeenBad) {
		playSfx("lazar.ogg");
		await timer(2500);
	} else {
		playSfx("lazarshort.ogg");
		await timer(900);
	}

	const laser = makeImg("bluetoothlazer.gif",
		`height: 191px; position: absolute; top: 0; left: 375px`);

	function fastSnd() {
		playSfx("firing.ogg");
		sfx.playbackRate = 2;
		sfx.preservesPitch = false;
	}

	if (!hasSeenBad) {
		playSfx("firing.ogg");
	} else {
		fastSnd();
		blueInator.style.filter = `brightness(50)`;
	}

	seed =()=> Math.random() * (hasSeenBad ? 200 : 20) * sign()
	for (let i = 0; i < (hasSeenBad ? 20 : 100); i++) {
		blueInator.style.top = parseInt(blueInator.style.top) + Math.round(seed()) + "px";
		blueInator.style.left = parseInt(blueInator.style.left) + Math.round(seed()) + "px";
		blueInator.style.filter = `brightness(${Math.ceil(seed())})`;
		await timer(50);
	}
	main.removeChild(laser);

	if (!hasSeenBad) {
		animate(blueInator, 2, "linear machineback");
		await timer(1950)
	} else {
		animate(blueInator, 0.5, "linear machineback");
	}
	blueInator.style.top = "32px";
	blueInator.style.left = "300px";
	blueInator.style.filter = `brightness(1)`;
	blueInator.style.zIndex = ""

	if (!hasSeenBad) {
		animate(mapIcons, 2, "linear moveback");
		animate(main, 2, "linear movebgback");
		await timer(1950)
	} else {
		animate(mapIcons, 0.5, "linear moveback");
		await animate(main, 0.5, "linear movebgback");
	}
	main.style.backgroundPosition = "0 0";
	mapIcons.style.top = "0";

	if (!hasSeenBad) {
		await grinchEnt.talk("i have won");
	} else {
		await speechBlankChar(grinchEnt, "i have won", 50);
	}

	overlay.style.display = "";
	overlay.style.opacity = "";
	main.style.imageRendering = "auto"
	const endvid = document.createElement("video");
	endvid.src = `assets/vid/badend.webm`;
	overlay.appendChild(endvid);
	endvid.play();
	if (!hasSeenBad) {
		await timer(800);
		playSfx("firing.ogg");
		await timer(26500);
	} else {
		endvid.playbackRate = 7;
		fastSnd();
		await timer(4000);
	}

	await endGame("game over", "blue.mp3", "merry wireless");
	if (hasSeenBad) music.playbackRate = 2.7;
	music.preservesPitch = true;
	endvid.remove()
	main.style.imageRendering = ""
	hasSeenBad = true;
}
function endingBadCutsceneSlow() {endingBadCutscene("no");}
function endingBadCutsceneFast() {endingBadCutscene("yes");}
//#endregion


let allInvEndingsSeen = false;
if (seenEndings.includes("microSD Card")) creditsButton.style.display = ""

async function endGame(ending, music = false, text = "merry ceiling", creepy = false) {
	endTitle.textContent = ending;
	endKarma.textContent = `karma: ${karmaScore}`;
	endIntel.textContent = `intelligence: ${intelligence}`;
	if (!creepy) {
		endText.textContent = text;
		endCreepy.textContent = "";
	} else {
		endText.textContent = "";
		endCreepy.textContent = text
	}

	if (fast) {
		replayButton.textContent = "replay again";
	}

	allInvEndingsSeen = inventory.every(i => seenEndings.includes(i.name))
	if (allInvEndingsSeen) {
		replayButton.className = ""
	} else {
		replayButton.className = "small"
	}

	if (music) { await musPause(); musPlay(music, 1, false); }
	endScreen.style.display = "";
}
let needsReplayWarning = false;
function replay() {
	if (!allInvEndingsSeen && needsReplayWarning) {
		document.body.insertAdjacentHTML("beforeend", `
		<div class="overlay warning">
			<p>You have unseen endings in your inventory, are you sure?</p>
			<button onclick="replay()">yes, replay</button> <button onclick="this.parentElement.remove()">go back</button>
		</div>
		`)
		needsReplayWarning = false;
		return;
	}

	if (!fast) {
		let url = window.location.href;
		if (url.indexOf("?") === -1) {
			url += "?";
		} else {
			url += "&";
		}
		window.location.href = url + "fast";
	} else {
		window.location.reload();
	}
}
//#endregion

// #region Speedrun Endings
async function endingSpeedrun() {
	orangeCarEnt = new mapEnt(dud, [0, 0], [10, 8], "car-orange");
	orangeCarEnt.sprite.style.display = "none";
	orangeCarEnt.sprite.style.transition = "";

	await timer(800)
	grinchSprite.style.transform = "";
	await timer(500)
	orangeCarEnt.sprite.style.display = "";
	animate(orangeCarEnt.sprite, 3, "linear carlanding");
	await timer(1500)
	makeImg("explode.gif", `position:absolute; top: 480px; left: 340px;`)
	playSfx("deltarune-explosion.mp3");
	await timer(200)
	playerImg.style.display = "";
	musPlay("selfdestruction.ogg", 1, false);
	await timer(300)
	grinchSprite.style.transform = "rotateY(180deg)";
	await timer(500)
	orangeCarEnt.hide();

	await timer(500);

	if (angryDead) { endingSpeedrunGenocide(); return; }

	await grinchEnt.talk(
		"What the fuck you're already here???",
		`How did you get here in like ${speedrunTime} seconds???`)

	const thrownItem = hasItem("Glass of Water") ? "glass of water" : "empty bottle";
	speechText.style.margin = "5px 0 0 0" // the only text in the game long enough for the padding to look bad
	await speech(`The adrenaline rush won't let you hear him. As you landed, you had already transferred the momentum from the car through your hands and into your inventory. And as he was talking, you pulled out your ${thrownItem} faster than a sheriff at a western showdown, and with a powerful rage practically flaming out of your eyes, fueling the full might of every muscle in your arms, you hurled it directly into the tip of his nose, impacting at the perfect angle for every single shattered fragment to pierce his face and body.`)
	speechText.style.margin = ""

	revealGrinch();
	grinchEnt.setTalkImg("dying");
	await grinchEnt.talk("WHAT THE FUCK WHY??? YOU DON'T EVEN KNOW WHO I AM YET??? DID YOU COME HERE JUST TO KILL ME WHAT THE FUCK IS WRONG WITH YOU")

	// i'm not going to do it, but hypothetically, since it only checks that your inventory count is 1, HYPOTHETICALLY, you COULD get here with the glass of water. and i think it'd be really funny if someone tries to tas route that and the game acknowledges it
	let dieAmount = 5
	if (thrownItem === "glass of water") {
		await grinchEnt.talk("IT WAS FULL OF PERFECTLY GOOD DRINKING WATER TOO AND YOU JUST WASTED IT ALL???? OH GOD I THINK THE WATER IS KILLING ME MORE")
		dieAmount = 50
	}

	speechBlankChar("Red Grinch",`DFKLGJFDSOFPJGHRSIJDFJIKHLFMJLHNTIKLRNDTKLHTIJOTXJGKMLBXFNCKLFMNGFGKLN BHLDLGDFIDGJDFNXDMKHOKHLCFJIOHMBNCFJDGRIHCFMKLHMGVFDHGFHVDMFKLDFKG KDLSGJFJGKDSKGLDFKGHSJKLGDFKCUMJDFKLMBKLDFJBLKDFMBGKLDFJGKLMKLJFBKLDFB VDFBNMIOGEROITJERIODGMKSOROPDGKOPDFGOMRSLGSDGPODKSKAWLSKMLXJOIJHML`, 1, false);

	const seed =()=> Math.random() * dieAmount * sign()
	const seizure =async ()=> {
		grinchSprite.style.top = parseInt(grinchSprite.style.top) + Math.round(seed()) + "px";
		grinchSprite.style.left = parseInt(grinchSprite.style.left) + Math.round(seed()) + "px";
		grinchSprite.style.transform = "rotate(" + parseInt(grinchSprite.style.left) + Math.round(seed()) + "deg)";
		await timer(50);
	}
	for (let i = 0; i < 60; i++) await seizure();

	speechBlankChar("Red Grinch",`AISEIPOEKFEPOKCSDOGVJNROAPOKFEOARMAWOIDJIVSDKOPCOKWSDJNEIOJSJVNSEOAOKD SDVNIKFJIOJRWAOPKEDCPNDSOJBVNAEWGIUOISJFIOJESONHVOFAHIOAWJIJFIAJIW SGOVHEADKJWIOFESHIEOEUSIJFEJIWAHNDSIODVJUEOSIJIJFOSJIOAWJMFSIOJEOSFKF DSGIJVBJIFHSEJKIOFJIEJFSUOFHSEXGFDOJJFSDIOJFISMGKLSEIFJGSJIOJESGJF`, 1, false);

	for (let i = 0; i < 60; i++) await seizure();

	musPause();
	grinchEnt.setTalkImg("dead");
	await speechBlankChar(grinchEnt, "", 2000, false);
	boxClose();

	await animate(grinchSprite, 1.5, "step-start blinkaway")
	grinchSprite.style.display = "none";

	await timer(2000)

	endCreepy.textContent = "the yellow one too."

	endGameSpeedrun("speedrun ending", "gasgasgas.ogg", "merry acceleration");
}

function endGameSpeedrun(ending, music = false, text = "merry ceiling") {
	endTime.style.display = "";
	endMaxTime.style.display = "";

	endTitle.textContent = ending;
	if (speedrunTime) endTime.textContent = `time: ${speedrunTime} seconds`
	if (speedrunLimit) endMaxTime.textContent = `of ${speedrunLimit}s`
	if (moveCount) endKarma.textContent = `movements: ${moveCount}`;
	if (hasInted) endIntel.textContent = `interactions: ${hasInted}`;
	endText.textContent = text;

	chooseAgain.style.display = "none"
	endButtonOr.style.display = "none"
	if (fast) {
		replayButton.textContent = "replay again";
	}
	needsReplayWarning = false;

	musPlay(music, 1, false);
	endScreen.style.display = "";
}

let garfImg;
async function endingSpeedrunGenocide() {
	/*
	it's almost certain if you're reading this, you haven't gotten this ending.
	do me a favor, and do the speedrun ending while killing the angry man, then come back
	*/


	await speechBlankChar(grinchEnt, "What the fuck you're already", 50);
	await speechBlank(`You smash the bottle over your knee and pick up a shard.`);

	await speechBlankChar(grinchEnt, `How did you get here in like ${speedrunTime} seconds`, 50);
	localStorage.setItem("summoned", true)
	musPause();
	revealGrinch();
	updatePlayerPos(6, 8);
	playSfx("damage.ogg"); playSfx("damage.ogg"); playSfx("damage.ogg"); playSfx("damage.ogg");
	animate(grinchSprite, 0.2, "linear damage");
	await speechBlank(`You kill him.`);

	grinchEnt.setTalkImg("dying");
	await grinchEnt.talk("Wh-")
	await speechBlankChar(grinchEnt, "Why?", 200);
	playSfx("damage.ogg"); playSfx("damage.ogg"); playSfx("damage.ogg"); playSfx("damage.ogg");
	animate(grinchSprite, 0.2, "linear damage");
	await speechBlank(`You kill him.`);

	grinchEnt.setTalkImg("dead");
	await speechBlankChar(grinchEnt, "", 7000);
	endGameGenocide()
}
async function endGameGenocide() {
	loading.style.display = "none"
	main.style.display = ""
	if (!timeSinceImportance) timeSinceImportance = new Date().getTime();
	endGameSpeedrun("true genocide ending", "creepygarf.mp3", "");
	replayButton.style.display = "none"
	creditsButton.style.display = "none"

	speechSet();
	boxClose();
	main.style.background = "none"

	overlay.remove();
	midload.remove();
	loading.remove();
	document.getElementById("reswarning").remove()
	document.getElementById("yet-another-preloader").remove()

	mapIcons.remove();
	debugCanvas.remove();
	clickZones.remove();
	speechImg.remove();
	controls.remove();
	invList.remove();
	choiceList.remove();

	theBox.style.background = "none";
	theBox.style.color = "#fff";
	theBox.style.filter = "none"
	next.style.color = "#fff"
	next.style.animation = "none"

	await timer(3000);
	garfImg = makeImg(fiftyby[0],
		"position: absolute; top: 50%; left: 50%; width: 50px; height: 50px; object-fit: none; object-position: -350px 0; transform: translate(-50%, -50%);", document.body)
	await animate(endScreen, 10, "fadeout");
	endScreen.remove();

	speechText.style.textAlign = "center"
	await speech(
		"excellent work.",
		"you got rid of every single one of them.",
		"all two people this game lets you kill.",
		"and you did it with dedication. speed.")
	speechText.style.fontWeight = 900
	speechText.style.fontSize = "64px"
	speechText.style.color = "red"
	await speech("bloodlust.")
	speechText.style.fontWeight = ""
	speechText.style.fontSize = ""
	speechText.style.color = ""
	await speech(
		"do you know why i am here?",
		"because i hate christmas.", "why?",
		"i'm sure you saw on your clock at home...")

	const room = makeImg("room-empty.webp", "opacity: 0.5; transform: translate(-600px, 382px) scale(2.5)", false)
	main.prepend(room)
	await animate(room, 3, "cubic-bezier(1,0,0.2,1) theclock")
	await timer(1000)

	await speech("it is a monday.")

	room.remove();
	await speech(
		"you knew, didn't you?",
		"you summoned me. deliberately. on purpose. with intent. intentionally.",
		"you hate christmas too, obviously.",
		"you wanna see it all disappear.",
		"...i can help with that.",
		"you have two options",
		"option one")

	const choicestyle = "position: absolute; transform: translateY(-50%); padding: 10px; background: none; border: none; box-shadow: none;"

	const die = document.createElement("button")
	die.style = choicestyle + `top: 46%; left: 100px;`
	const dieimg = makeImg("choices.webp", `width: 180px; height: 224px; object-position: left; object-fit: none;`, false)
	die.appendChild(dieimg);
	main.appendChild(die);
	const dieup =()=> { animate(dieimg, 0.1, "linear up50"); dieimg.style.transform = "scale(1)" }
	const diedown =()=> { animate(dieimg, 0.1, "linear down50"); dieimg.style.transform = "scale(0.5)" }

	dieup()
	await speech("die.",
		"to fulfill our mutual desire to destroy christmas",
		"it has to be destroyed at the core",
		"the one thing this world revolves around")

	let timeAgo = secondsAgo(timeSinceImportance);
	if (timeAgo / 60 >= 2) { timeAgo = `${Math.ceil(timeAgo / 60)} minutes` }
	else if (timeAgo > 59) { timeAgo = `one minute` }
	else { timeAgo = `${Math.ceil(timeAgo)} seconds` }
	await speech(`a random guy with no importance to this universe up until ${timeAgo} ago`)

	diedown()
	await speech("or...", "if you don't want to join me")

	const form = document.createElement("button")
	form.style = choicestyle + `top: 47%; right: 100px;`
	const formimg = makeImg("choices.webp", `width: 181px; height: 208px; object-position: right top; object-fit: none;`, false)
	form.appendChild(formimg);
	main.appendChild(form);
	const formup =()=> { animate(formimg, 0.1, "linear up50"); formimg.style.transform = "scale(1)" }
	const formdown =()=> { animate(formimg, 0.1, "linear down50"); formimg.style.transform = "scale(0.5)" }

	formup()
	speechText.style.fontWeight = 900
	await speech("i'll change everything about who you are.")
	speechText.style.fontWeight = ""
	await speech(
		"you won't remember who you were",
		"you won't know anything happened at all.",
		"but every time you look in the mirror",
		"you'll see a reflection",
		"and it won't feel like yours.",
		"it will feel like a copyrighted cartoon character")

	formdown()
	await speech("those are your two choices.", "so what's it going to be?")
	await speechBlank("die, or take a new form", 1)


	const choicetextstyle = `position: absolute; top: 210px; font-size: 64px; font-weight: 900; pointer-events: none; opacity: 0;`
	volSounded = new Date().getTime()
	const dieactive =async ()=> {
		dieup();
		const curTime = new Date().getTime()
		if (curTime - volSounded < 100) return;

		playSfx("dee.ogg");
		volSounded = curTime

		const dee = document.createElement("p")
		dee.textContent = "dee";
		dee.style = choicetextstyle + "left: 150px;"
		main.appendChild(dee)
		await animate(dee, 1, "linear thechoices")
		dee.remove();
	}
	const formactive =async ()=> {
		formup();
		const curTime = new Date().getTime()
		if (curTime - volSounded < 100) return;

		playSfx("from.ogg")
		volSounded = curTime

		const from = document.createElement("p")
		from.textContent = "from";
		from.style = choicetextstyle + "right: 135px;"
		main.appendChild(from)
		await animate(from, 1, "linear thechoices")
		from.remove()
	}
	dieimg.addEventListener("mouseenter", dieactive);
	dieimg.addEventListener("mouseleave", diedown);
	die.addEventListener("focus", dieactive);
	die.addEventListener("blur", diedown);
	formimg.addEventListener("mouseenter", formactive);
	formimg.addEventListener("mouseleave", formdown);
	form.addEventListener("focus", formactive);
	form.addEventListener("blur", formdown);

	document.addEventListener("keydown", choicecontrols);
	function choicecontrols({ code }) {
		switch (code) {
			case "ArrowLeft":
			case "KeyA":
				die.focus()
				break;
			case "KeyD":
			case "ArrowRight":
				form.focus()
				break;
		}
	}
	const endFunc =()=> {
		die.remove(); form.remove();
		document.removeEventListener("keydown", choicecontrols);
		boxClose();
	}
	die.addEventListener("click", ()=>{
		endFunc(); genocideDie()
	}, {once:true});
	form.addEventListener("click", ()=>{
		endFunc(); genocideForm()
	}, {once:true});
}

async function genocideDie() {
	await timer(1500)
	musPause(false);
	await speech("wait what",
		"you actually picked die?",
		"uhhhhhhhhhhhh",
		"ok im ngl i dont actually feel like destroying the universe",
		"like i said all that shit to sound cool and mysterious and evil",
		"and i thought youd think i was so evil you'd side against me and pick the other one",
		"but uh. i just enjoy fucking with people and i think it'd be funny to transform you",
		"so uh.", "bye lol")
	genocideFinale()
}

async function genocideForm() {
	await timer(1500)
	await speech("fascinating.",
		"you came all this way.",
		"you went out of your way to kill the two people in this game you can kill as fast as possible",
		"and i offer you more death", "and you say no",
		"truly fascinating.", "then i will fucking TRANSFORM you.",
		"goodbye :D")
	musPause(false);
	genocideFinale()
}

async function genocideFinale() {
	localStorage.setItem("transformed", true)
	garfImg.style.display = "none"
	await timer(3000)
	garfImg.style.objectPosition = "-400px 0"
	garfImg.style.display = ""
	speechName.style.textAlign = "center"
	await timer(3000)
	speechSet("You?")
	await speech("Ah finally, I'm back home.")
	await speech("All this overtime at work is killing me...")
	await speech("It's worth it. The machine will work. With enough money, I can make it work.")
	await speech("At least I get to come home and use my favorite thing in the world...")
	speechSet("Red Grinch?")
	await speech("My Plugable USB Bluetooth 4.0 Low Energy Micro Adapter...")
	speechSet("You?")
	await speech("You never break, you're always there when I need you, you fit every USB-A slot...")
	speechSet("Red Grinch")
	await speech("You're the only Christmas gift I've ever gotten that didn't fail me...")
	speechSet("You")
	await speech("If only everyone could appreciate you the way I do...")

	main.remove();
	musPlay("ultimatum.ogg", 1, 0)
	music.loop = false;
}

if (localStorage.getItem("transformed")) {
	main.remove();
	overlay.remove();
	midload.remove();
	endScreen.remove();
	loading.remove();
	document.getElementById("reswarning").remove()
	document.getElementById("yet-another-preloader").remove()

	makeImg(fiftyby[0],
		"position: absolute; top: 50%; left: 50%; width: 50px; height: 50px; object-fit: none; object-position: -400px 0; transform: translate(-50%, -50%);", document.body)
} else if (localStorage.getItem("summoned")) loadbutton.onclick = endGameGenocide;

//#endregion

//#endregion


// #region Credits
function openCredits() { document.body.insertAdjacentHTML("beforeend", `
<div id="credits" class="overlay">
	<h1>Credits</h1>
	<h2>Programming, Design, "Art"</h2>
	<p><strong>Commenter25</strong> (<a href="https://commenter.cc">commenter.cc</a>)</p>
	<h2>Primary Playtester, Sanity Advisor, Design</h2>
	<p><strong>nano</strong> (<a href="https://nano.lgbt">nano.lgbt</a>)</p>
	<h2>Main Theme</h2>
	<p><strong>ZERO_1</strong> - "EasyFUZZ"<br>
		(<a href="https://www.jamendo.com/album/10910/">Guitar Amplex</a>)</p>
	<h2>Special Thanks</h2>
	<p><strong>Claoose</strong> - I made this for you!<br>
		<strong>Aarmastah</strong> - "Lended" his "image"<br>
		<strong>mystman12</strong> - baldi<br>
		<strong>random people</strong> on stackoverflow</p>
	<button onclick="this.parentElement.remove()">close</button>
</div>
`)}
//#endregion


// Now, let's begin
mainLoaded = true

/* @license-end */
