import {ElemJS, q} from "./elemjs/elemjs.js"

class FilterType extends ElemJS {
	constructor(element) {
		super(element)
		this.notice = q("#title-pattern-matching")
		this.on("input", this.updateNotice.bind(this))
		this.updateNotice()
	}

	updateNotice() {
		this.notice.style.display = this.element.value !== "title" ? "none" : ""
	}
}

new FilterType(q("#filter-type"))
