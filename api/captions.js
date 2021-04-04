const fetch = require("node-fetch")
const {getUser} = require("../utils/getuser")
const constants = require("../utils/constants.js")

module.exports = [
	{
		route: `/api/v1/captions/(${constants.regex.video_id})`, methods: ["GET"], code: async ({req, fill, url}) => {
			const instanceOrigin = getUser(req).getSettingsOrDefaults().instance
			const fetchURL = new URL(`${url.pathname}${url.search}`, instanceOrigin)
			return fetch(fetchURL.toString()).then(res => {
				return res.text().then(text => {
					if (res.status === 200) {
						// Remove the position annotations that youtube unhelpfully provides
						text = text.replace(/(--> \S+).*/g, "$1")
					}
					return {
						statusCode: res.status,
						contentType: res.headers.get("content-type"),
						content: text
					}
				})
			})
		}
	}
]
