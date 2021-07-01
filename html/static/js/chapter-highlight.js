import {q, qa, ElemJS} from "./elemjs/elemjs.js"

class Chapter {
	constructor(linkElement) {
		this.link = new ElemJS(linkElement)
		this.time = +linkElement.getAttribute("data-clickable-timestamp")
	}
}

let chapters = [...document.querySelectorAll("[data-clickable-timestamp]")].map(linkElement => new Chapter(linkElement))
chapters.sort((a, b) => a.time - b.time)

function getCurrentChapter(time) {
	const candidates = chapters.filter(chapter => chapter.time <= time)
	if (candidates.length > 0) {
		return candidates[candidates.length - 1]
	} else {
		return null
	}
}

const video = q("#video")
const description = q("#description")
const regularBackground = "var(--regular-background)"
const highlightBackground = "var(--highlight-background)"
const paddingWidth = 4
let lastChapter = null
setInterval(() => {
	const currentChapter = getCurrentChapter(video.currentTime)

	if (currentChapter !== lastChapter) {
		// Style link
		if (lastChapter) {
			lastChapter.link.removeClass("timestamp--active")
		}
		if (currentChapter) {
			currentChapter.link.class("timestamp--active")
		}
		// Style background
		if (currentChapter) {
			const {offsetTop, offsetHeight} = currentChapter.link.element;
			const offsetBottom = offsetTop + offsetHeight
			let gradient = `linear-gradient(to bottom,`
				+ ` ${regularBackground} ${offsetTop - paddingWidth}px, ${highlightBackground} ${offsetTop - paddingWidth}px,`
				+ ` ${highlightBackground} ${offsetBottom + paddingWidth}px, ${regularBackground} ${offsetBottom + paddingWidth}px)`
			console.log(gradient)
			description.style.background = gradient
		} else {
			description.style.background = ""
		}
	}
	lastChapter = currentChapter
}, 1000)
