import {ElemJS} from "/static/js/elemjs/elemjs.js"

class MarkWatchedButton extends ElemJS {
	constructor(element) {
		super(element)
		this.on("click", this.onClick.bind(this))
	}

	onClick(event) {
		event.preventDefault()
		let video = this.element
		while (!video.classList.contains("subscriptions-video")) {
			video = video.parentElement
		}
		video.classList.add("video-list-item--watched")
		const form = this.element.parentElement
		fetch(form.getAttribute("action"), {method: "POST"})
		form.remove()
	}
}

export {
	MarkWatchedButton
}
