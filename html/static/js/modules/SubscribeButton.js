import {ElemJS} from "/static/js/elemjs/elemjs.js"

class SubscribeButton extends ElemJS {
	constructor(element) {
		super(element)
		this.subscribed = this.element.getAttribute("data-subscribed") === "1"
		this.ucid = this.element.getAttribute("data-ucid")
		this.on("click", this.onClick.bind(this))
		this.render()
	}

	onClick(event) {
		event.preventDefault()
		this.subscribed = !this.subscribed
		const path = this.subscribed ? "subscribe" : "unsubscribe"
		fetch(`/formapi/${path}/${this.ucid}`, {method: "POST"})
		this.render()
	}

	render() {
		if (!this.subscribed) this.text("Subscribe")
		else this.text("Unsubscribe")
	}
}

export {
	SubscribeButton
}
