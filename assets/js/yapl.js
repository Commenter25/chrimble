/*! @license Yet Another PreLoader v2.0.0 | Copyright (c) 2023 Commenter25 | MIT License */
/* @license magnet:?xt=urn:btih:d3d9a9a6595521f9666a5e94cc830dab83b65699&dn=expat.txt MIT License */
"use strict";

let YAPLloaded = 0, YAPLfailed = 0;

const YAPLtag = document.createElement("div");
YAPLtag.id = "yet-another-preloader";
YAPLtag.style = "position: fixed; top: 99.9vh; left: 0; display: flex; opacity: 0.01; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; pointer-events: none; cursor: default;";
YAPLtag.setAttribute("aria-hidden", "true");
document.body.prepend(YAPLtag);


/**
 * Adds a series of files to the DOM so the browser caches them
 * @param {string} location - Path containing all files, relative to the current page
 * @param {array} files - Array of strings with file paths relative to folder param - If using in ANY non-localhost context, KEEP AS SHORT AS POSSIBLE!!!!
 * @param {function} whenDone - Optional - Runs when all files have been parsed
 * @param {function} whenIncr - Optional - Runs every time a file is parsed, useful for progress indication
 * @param {function} whenErr - Optional - Runs when a file is unable to load, return true to prevent running whenDone
 * @param {function} totalFail - Optional - For the event of complete failure - Using the phrase "Something has gone horribly wrong!" somewhere is recommended
 * @returns {Promise} Promise resolving when all files have been parsed
 * @throws Returns false and logs an exception to console if not given an array
 */
function YAPLload( location, files, whenDone = false, whenIncr = false, whenFail = false, totalFail = false ) {
try { return new Promise( (resolve)=> {
	if (files === undefined || !Array.isArray(files)) {
		throw "Was not given an array in the files parameter!";
	}

	YAPLloaded = 0; YAPLfailed = 0;
	let shouldStop = false;

	// always have folder end in a slash, unless blank, so it makes a file path
	let folder = location;
	if (folder !== "" && folder.slice(-1) !== "/") folder += "/";

	const increment = worked => {
		worked ? YAPLloaded++ : YAPLfailed++;

		if (shouldStop) return;
		if (whenIncr) whenIncr();

		if (YAPLloaded + YAPLfailed === files.length) {
			// console.log(`YAPL: Execution complete! ${YAPLloaded} successful, ${YAPLfailed} failed`);
			if (whenDone) whenDone();
			resolve();
		}
	};

	const loadTag =(tag, file)=> {
		let done = false;
		function good() {
			if (done) return;
			YAPLtag.appendChild(tag);
			// console.log(`YAPL: ${file} loaded successfully!`);
			done = true; increment(true);
			tag.removeEventListener("error", bad);
		}
		function bad() {
			if (done) return;
			if (whenFail) shouldStop = whenFail();
			console.error(`YAPL: ${file} couldn't load!`);
			done = true; increment(false);
		}


		tag.style.width = "2px"; tag.style.height = "2px";
		tag.tabIndex = -1;
		tag.setAttribute("aria-hidden", "true");
		tag.src = file;

		tag.addEventListener("error", bad, {once: true});
		switch (tag.tagName) {
			case "AUDIO": case "VIDEO":
				tag.addEventListener("canplay", good, {once: true});
				break;
			case "IMG":
				tag.alt = "";
				tag.addEventListener("load", good, {once: true});
				break;
		}

		return true; // returns loadFile as true
	};

	const loadFile =(file, type)=> {
		let tag;
		switch (type) {
			// images
			case "webp": case "png": case "gif":
			case "jpg": case "jpeg": case "avif": case "jxl":
				tag = new Image();
				return loadTag(tag, file);
			// sounds
			case "ogg": case "mp3": case "wav":
				tag = new Audio();
				return loadTag(tag, file);
			// videos
			case "webm": case "mp4":
				tag = document.createElement("video");
				return loadTag(tag, file);
			default:
				if (whenFail) shouldStop = whenFail();
				console.error(`YAPL: ${file} is unrecognized file type ${type}!`);
				return false;
		}
	};

	for (const file of files) {
		const ext = (/(?:\.([^.]+))?$/u).exec(file)[1]; // credit for this horrid regex to https://stackoverflow.com/a/680982
		const validFile = loadFile(folder + file, ext);
		if (!validFile && shouldStop) break;
	}

	// console.log(`YAPL: Attempting to load files...`);
});} catch (err) {
	console.error(`YAPL: Execution failure! ${err}`);
	if (totalFail) totalFail();
	return false;
}}

/* @license-end */
