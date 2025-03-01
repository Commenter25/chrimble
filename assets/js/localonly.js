/*! @license Crazy Chrimble Catastrophy - Local Only | Copyright (c) 2023 Commenter25 | MIT License */
/* @license magnet:?xt=urn:btih:d3d9a9a6595521f9666a5e94cc830dab83b65699&dn=expat.txt MIT License */
/* global mainLoaded, timer, fast, dud, defVol, defFade, musVolume, userVol, musCurVol:writeable, musCurrent:writeable, music:writeable, musPlay:writeable */
"use strict"

if (window.location.protocol !== "file:") throw new Error("Somehow, the local only file has loaded from a server!");
// This file should only be called when (window.location.protocol === "file:")
// Since file loads are effectively instant locally, it's worth making a new file so online users don't have to download this code
// also i get to fucking rant about fucking stupid bullshit without bloating main.js (see below)

// this function is the whole file lol
(async function() {
while (!mainLoaded) await timer(100);


if (!fast && navigator.userAgent.includes("Chrome")) {
	document.body.insertAdjacentHTML("beforeend", `
	<div class="overlay warning">
		<h1>CHROMIUM DETECTED</h1>
		<p>it seems like you're using google chrome, or something based on its engine, and playing the game from a local install. this is what some people in the industry might call a "Bad Idea".
		unfortunately, despite HTML5 existing for over a decade, google has still implemented it incorrectly. therefore, if you play from here, you will unfortunately have slight audio issues and stutters.</p>
		<p>i won't stop you from having a subpar experience, but it's highly recommended to install <a href="https://firefox.com">firefox</a> or a derivative for the best experience.</p>
		<button onclick="this.parentElement.remove()">close</button>
	</div>
	`)
}


/*
so it turns out audio on browsers is fucking HORRIBLE. like. DREADFUL. like. WHAT THE FUCK.
i had a whole audio system set up (which is below), and when i was only testing on firefox, it was perfect. everything was fine.
then i test it on chrome. i fucking test it on chrome. and GUESS WHAT. THE LOOP ATTRIBUTE FOR AUDIO ELEMENTS???
YKNOW, THE BASIC FUCKING FEATURE OF HTML5???? YEAH IT JUST DOESNT LOOP PROPERLY IN CHROME!!!! THERES A GAP!!!!!
THIS HAS BEEN AN ISSUE FOR LIKE, A DECADE AND A HALF???? HOW IS THIS FUCKING REAL IM SO FUCKING UPSET

but it's like, mere days before i wanna release this fucking thing, i have no time, and i just want my god damn game to work. so against the philosophy
i've taken through this whole project of "i'm going to learn to do things my way that i understand even if it's weird and freaky and unusual",
i just fuckin used a library off of github. and it's a great library! it's not massive, it's well documented, it doesn't confuse me.
and it actually worked too! both firefox and chrome can loop audio just fine now that i've implemented it.

...if it's running on a server! this was originally made to run as a local file, and i wanted it to stay that way, because i think its cool!
so i've got the online aspect figured out, which is what i was most worried about, but how do i maintain compatibility locally like i want?
well, its simple! i tell chrome users they're just fucked and i reimplement my old system! why is it always audio. why does audio suck. everything else was fine
*/

music = new Audio();
let musicBuffer = new Audio();

musPlay = (snd, vol = defVol, fade = defFade, intro = false, introvol = false) => {
	// do nothing if this song is already playing
	if (!snd || (music.src.endsWith(snd) && music.volume !== 0)) return;
	music.pause();
	music.src = ""

	music.src = `assets/mus/${intro || snd}`;
	music.addEventListener('canplay', startPlay, {once: true});
	music.loop = (intro === false);

	async function startPlay() {
		music.play();

		musCurVol = introvol || vol;
		if (fade) {
			music.volume = 0;
			musVolume(introvol || vol, fade)
		} else {
			music.volume = (introvol || vol) * userVol;
		}

		if (intro) {
			await timer( (music.duration * 1000) );
			if (!music.src.endsWith(intro) || music.paused) return
			musicBuffer.volume = vol * userVol;
			musCurVol = vol;
			musicBuffer.play();
			// swap them
			[music, musicBuffer] = [musicBuffer, music];
		}
	}

	if (intro) {
		musicBuffer.src = `assets/mus/${snd}`;
		musicBuffer.addEventListener('canplay', dud, {once: true}); // forces music to preload
		musicBuffer.loop = true;
	}
}

musCurrent =(isthisit)=> {
	if (!isthisit) return music.src

	return music.src.endsWith(isthisit)
}

musTime =()=> { return music.currentTime }





})()
