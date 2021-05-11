import {q, ejs, ElemJS} from "/static/js/elemjs/elemjs.js"

const video = q("#video")

video.addEventListener("ended", () => {
	if (data.continuous) {
		const first = q("#continuous-first")
		const url = first.querySelector(".title-link").href
		location.assign(url)
	}
})

class ContinuousControls extends ElemJS {
	constructor() {
		super(q("#continuous-controls"))
		this.button = ejs(q("#continuous-stop"))
		this.button.on("click", this.onClick.bind(this))
	}

	onClick(event) {
		event.preventDefault()
		this.element.style.display = "none"
		data.continuous = false
		q("#continuous-related-videos").remove()
		q("#standard-related-videos").style.display = ""
		const url = new URL(location)
		url.searchParams.delete("continuous")
		url.searchParams.delete("session-watched")
		history.replaceState(null, "", url.toString())
	}
}

new ContinuousControls(q("#continuous-stop"))
