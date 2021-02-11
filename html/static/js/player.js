import {q, ElemJS} from "/static/js/elemjs/elemjs.js"
import {SubscribeButton} from "/static/js/subscribe.js"

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
			audio.pause()
			audio.currentTime = lastTime
		} else {
			audio.pause()
			audio.removeAttribute("src")
		}
	}
}

const formatLoader = new FormatLoader()

class PlayManager {
	constructor(media, isAudio) {
		this.media = media
		this.isAudio = isAudio
	}

	isActive() {
		return !this.isAudio || formatLoader.npa
	}

	play() {
		if (this.isActive()) this.media.play()
	}

	pause() {
		if (this.isActive()) this.media.pause()
	}
}

const playManagers = {
	video: new PlayManager(video, false),
	audio: new PlayManager(audio, true)
}

class QualitySelect extends ElemJS {
	constructor() {
		super(q("#quality-select"))
		this.on("input", this.onInput.bind(this))
	}

	onInput() {
		const itag = this.element.value
		formatLoader.play(itag)
		video.focus()
	}
}

const qualitySelect = new QualitySelect()

const ignoreNext = {
	play: 0
}

function playbackIntervention(event) {
	console.log(event.target.tagName.toLowerCase(), event.type)
	if (audio.src) {
		let target = event.target
		let other = (event.target === video ? audio : video)
		let targetPlayManager = playManagers[target.tagName.toLowerCase()]
		let otherPlayManager = playManagers[other.tagName.toLowerCase()]
		if (ignoreNext[event.type] > 0) {
			ignoreNext[event.type]--
			return
		}
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
			otherPlayManager.play();
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

function relativeSeek(seconds) {
	video.currentTime += seconds
}

function playVideo() {
	audio.currentTime = video.currentTime
	let lastTime = video.currentTime
	ignoreNext.play++
	video.play().then(() => {
		const interval = setInterval(() => {
			console.log("checking video", video.currentTime, lastTime)
			if (video.currentTime !== lastTime) {
				clearInterval(interval)
				playManagers.audio.play()
				return
			}
		}, 15)
	})
}

function togglePlaying() {
	if (video.paused) playVideo()
	else video.pause()
}

function toggleFullScreen() {
	if (document.fullscreen) document.exitFullscreen()
	else video.requestFullscreen()
}

video.addEventListener("click", event => {
	event.preventDefault()
	togglePlaying()
})

video.addEventListener("dblclick", event => {
	event.preventDefault()
	toggleFullScreen()
})

document.addEventListener("keydown", event => {
	if (["INPUT", "SELECT", "BUTTON"].includes(event.target.tagName)) return
	if (event.ctrlKey || event.shiftKey || event.altKey) return
	let caught = true
	if (event.key === "j" || event.key === "n") {
		relativeSeek(-10)
	} else if (["k", "p", " ", "e"].includes(event.key)) {
		togglePlaying()
	} else if (event.key === "l" || event.key === "o") {
		relativeSeek(10)
	} else if (event.key === "ArrowLeft") {
		relativeSeek(-5)
	} else if (event.key === "ArrowRight") {
		relativeSeek(5)
	} else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
		// no-op
	} else if (event.key >= "0" && event.key <= "9") {
		video.currentTime = video.duration * (+event.key) / 10
	} else if (event.key === "f") {
		toggleFullScreen()
	} else {
		caught = false
	}
	if (caught) event.preventDefault()
})

new SubscribeButton(q("#subscribe"))
