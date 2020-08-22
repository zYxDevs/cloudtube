import {q, ElemJS} from "/static/js/elemjs/elemjs.js"

const video = q("#video")
const audio = q("#audio")

const videoFormats = new Map()
const audioFormats = new Map()
for (const f of [].concat(
	data.formatStreams.map(f => (f.isAdaptive = false, f)),
	data.adaptiveFormats.map(f => (f.isAdaptive = true, f))
)) {
	if (f.type.startsWith("video")) {
		videoFormats.set(f.itag, f)
	} else {
		audioFormats.set(f.itag, f)
	}
}

function getBestAudioFormat() {
	let best = null
	for (const f of audioFormats.values()) {
		if (best === null || f.bitrate > best.bitrate) {
			best = f
		}
	}
	return best
}

class FormatLoader {
	constructor() {
		this.npv = videoFormats.get(q("#video").getAttribute("data-itag"))
		this.npa = null
	}

	play(itag) {
		this.npv = videoFormats.get(itag)
		if (this.npv.isAdaptive) {
			this.npa = getBestAudioFormat()
		} else {
			this.npa = null
		}
		this.update()
	}

	update() {
		const lastTime = video.currentTime
		video.src = this.npv.url
		video.currentTime = lastTime
		if (this.npa) {
			audio.src = this.npa.url
			audio.currentTime = lastTime
		}
	}
}

const formatLoader = new FormatLoader()

class QualitySelect extends ElemJS {
	constructor() {
		super(q("#quality-select"))
		this.on("input", this.onInput.bind(this))
	}

	onInput() {
		const itag = this.element.value
		formatLoader.play(itag)
	}
}

const qualitySelect = new QualitySelect()

function playbackIntervention(event) {
	console.log(event.target.tagName.toLowerCase(), event.type)
	if (audio.src) {
		let target = event.target
		let targetName = target.tagName.toLowerCase()
		let other = (event.target === video ? audio : video)
		switch (event.type) {
		case "durationchange":
			target.ready = false;
			break;
		case "seeked":
			target.ready = false;
			target.pause();
			other.currentTime = target.currentTime;
			break;
		case "play":
			other.currentTime = target.currentTime;
			other.play();
			break;
		case "pause":
			other.currentTime = target.currentTime;
			other.pause();
		case "playing":
			other.currentTime = target.currentTime;
			break;
		case "ratechange":
			other.rate = target.rate;
			break;
		// case "stalled":
		// case "waiting":
			// target.pause();
			// break;
		}
	} else {
		// @ts-ignore this does exist
		// if (event.type == "canplaythrough" && !video.manualPaused) video.play();
	}
}

for (let eventName of ["pause", "play", "seeked"]) {
	video.addEventListener(eventName, playbackIntervention)
}
for (let eventName of ["canplaythrough", "waiting", "stalled"]) {
	video.addEventListener(eventName, playbackIntervention)
	audio.addEventListener(eventName, playbackIntervention)
}
