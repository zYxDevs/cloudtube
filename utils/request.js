/** @type {import("node-fetch").default} */
// @ts-ignore
const fetch = require("node-fetch")

function request(url, options = {}) {
	if (!options.headers) options.headers = {}
	options.headers = {
		"user-agent": "CloudTubeBackend/1.0"
	}
	return fetch(url, options)
}

module.exports.request = request
