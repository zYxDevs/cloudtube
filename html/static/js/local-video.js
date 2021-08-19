const q = s => document.querySelector(s) // write this directly rather than importing to avoid an extra round-trip

let status = q("#status")
const form = q("#form")
const data = q("#video-data")

function displayError(root) {
	let contents
	if (root instanceof Error) { // error in our code here, or fetch API promise rejection
		contents = root.toString()
		if (root.stack) contents += root.stack
	} else { // some JSON something
		if (root.error) { // a descriptive report from the instance
			contents = root.error.message || root.error
			if (root.error.identifier) contents += `\nIdentifier: ${root.error.identifier}`
		} else {
			contents = JSON.stringify(root, null, 2)
		}
	}

	console.log(contents)

	const newStatus = document.createElement("pre")
	newStatus.id = "status"
	newStatus.textContent = contents
	status.replaceWith(newStatus)
	status = newStatus
}

fetch(`http://localhost:3000/api/v1/videos/${id}`).then(res => res.json()).then(root => {
	if (root.error) {
		throw root // it's ok to throw this, it will be caught and displayed
	}

	data.value = JSON.stringify(root)
	form.submit()
	status.textContent = "Submitting..."
}).catch(e => {
	if (e.message && e.message.includes("NetworkError")) {
		status.textContent = "Connection failed. Make sure you're running your own instance locally."
	} else {
		displayError(e)
	}
})
