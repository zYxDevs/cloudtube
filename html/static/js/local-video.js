import {q} from "./elemjs/elemjs.js"

const status = q("#status")
const form = q("#form")
const data = q("#video-data")

fetch(`http://localhost:3000/api/v1/videos/${id}`).then(res => res.json()).then(root => {
	if (root.error) throw new Error(root)
	data.value = JSON.stringify(root)
	form.submit()
	status.textContent = "Submitting..."
}).catch(e => {
	if (e.message.includes("NetworkError")) {
		status.textContent = "Connection failed. Make sure you're running your own instance locally."
	} else {
		status.innerText = e.toString()
	}
})
