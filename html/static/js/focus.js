document.body.classList.remove("show-focus")

document.addEventListener("mousedown", () => {
	document.body.classList.remove("show-focus")
})

document.addEventListener("keydown", event => {
	if (event.key === "Tab") {
		document.body.classList.add("show-focus")
	}
})
