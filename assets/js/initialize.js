/*! @license Crazy Chrimble Catastrophy - Initialization - v2.4.2 | Copyright (c) 2023 Commenter25 | MIT License */
/* @license magnet:?xt=urn:btih:d3d9a9a6595521f9666a5e94cc830dab83b65699&dn=expat.txt MIT License */
/* eslint-disable no-undef */ "use strict"

const params = new URLSearchParams(window.location.search)
const timer = ms => new Promise(res => setTimeout(res, ms)) // await this in milliseconds
const fast = params.has('fast');
let debug = params.has('debug'), assets = {}, mainLoaded, music; // eslint-disable-line

const favicon = document.querySelector('link[rel="icon"]');
function errormode() {
	favicon.setAttribute('href', 'assets/ico/favicon-dev.svg')
}
window.onerror = errormode

function localStorageBool(item) {
	return (localStorage.getItem(item) === "true")
}

document.addEventListener("DOMContentLoaded", async ()=> {

const reswarning = document.getElementById("reswarning")
const resstyle = window.getComputedStyle(reswarning);

if ((resstyle.getPropertyValue("display") !== "none")) {
	let string = "please play on something which can fit this whole square"
	if (window.screen.width >= 800 && window.screen.height >= 600) {
		string = "(perhaps try turning on fullscreen mode?)"
	} else if (window.screen.availWidth >= 600 && window.screen.availHeight >= 800) {
		string = "(perhaps try rotating your device?)"
	}
	reswarning.lastChild.textContent += string
}

// don't download stuff if they can't even play the game, but keep checking cause they might just have the window too small
while (resstyle.getPropertyValue("display") !== "none") await timer(1000)

const loadbutton = document.getElementById("loadbutton");
loadbutton.disabled = true;
if (!fast && localStorage.getItem("seenEndings")) {
	loadbutton.insertAdjacentHTML("afterend", `
	<button onclick="replay()">Switch to Fast Mode</button>`)
}

// preload fonts
YAPLtag.insertAdjacentHTML("beforeend", `
<span style="font-family: Ubuntu; font-style: italic">c</span>
<span style="font-family: 'Ubuntu Mono'">c</span>
`)

function script(i) {
	const tag = document.createElement('script');
	tag.src = `assets/js/${i}.js?v242`; tag.async = true;
	document.head.appendChild(tag);
}
script("main")
if (window.location.protocol !== "file:") {
	script("gapless5")
} else {
	script("localonly")
}

const folder = "assets"
assets.base = [
"img/speechBox.webp"
]

assets.intro = [
"mus/ecards.ogg",
"snd/doorclose.ogg",
"snd/doorkick.ogg",
"vid/intro.webm",
"img/mom.webp",
"img/intro/bart.webp",
"img/intro/chair.webp",
"img/intro/christmas.webp",
"img/intro/desk.webp",
"img/intro/door.webp",
"img/intro/house.webp",
"img/intro/man.webp",
"img/intro/player.webp",
"img/intro/puter.webp",
"img/intro/time.webp",
]

assets.map = [
"snd/eb/enterbattle.ogg",
"snd/batman.ogg",
"snd/carcrash.mp3",
"snd/takeoff.ogg",
"snd/damage.ogg",
"snd/dumbvictory.ogg",
"snd/trapped.ogg",
"snd/fedex-mmm.mp3",
"snd/fedex.mp3",
"snd/mysterygo.ogg",
"snd/coin.ogg",
"img/map1.png",
"img/50x50.webp",
"img/aaron.webp",
"img/ben.webp",
"img/store-screen.png",
"img/transition.png",
]

const intro = !fast && !params.has('nointro') && !params.has('novid')
let initial = intro ? assets.intro : assets.map.concat(["mus/fuzz-intro.ogg", "mus/fuzz.ogg"]);
initial = assets.base.concat(initial)

if (localStorageBool("summoned")) initial = [
"img/50x50.webp",
"mus/creepygarf.mp3",
"img/room-empty.webp",
"img/choices.webp",
"snd/dee.ogg", "snd/from.ogg",
"mus/ultimatum.ogg"
]

let warningAdded = false
function incr() {
	loadbutton.textContent = `Loading... ${YAPLloaded}/${initial.length}`
	if (!warningAdded && (new Date().getTime() - initLoadStarted) > 8000) {
		warningAdded = true
		loading.insertAdjacentHTML("beforeend", `
			<p>if you have a slow connection, you can avoid waits and weird bugs if you <a href="https://github.com/Commenter25/chrimble">download the game</a> directly!</p>
		`)
	}
}

function fail() {
	errormode()
	loadbutton.textContent = "Something has gone horribly wrong!"
	return true
}

async function done() {
	// wait for main and gapless5 to load
	loadbutton.textContent = "Loading scripts...";
	while (!mainLoaded || !music) await timer(200)

	loadbutton.textContent = "Start Game";
	if (fast) loadbutton.textContent += " in Fast Mode";
	if (!loadbutton.onclick) {
		loadbutton.onclick = intro ? startVerify : startGame;
	}
	loadbutton.disabled = false;
	loadbutton.focus({focusVisible: true});

	if (intro) document.addEventListener("introStarting", ()=>{
		YAPLload(folder, assets.map)
		preloadCount = assets.map.length
	}, {once: true})
}

YAPLload(folder, initial, done, incr, fail, fail)
const initLoadStarted = new Date().getTime()

}, {once: true})/* @license-end */
