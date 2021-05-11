/** @type {import("node-fetch").default} */
// @ts-ignore
const fetch = require("node-fetch")
const constants = require("../utils/constants.js")

module.exports = [
	{
		route: `/vi/(${constants.regex.video_id})/(\\w+\\.jpg)`, methods: ["GET"], code: ({fill}) => {
			const videoID = fill[0]
			const file = fill[1]
			return fetch(`https://i.ytimg.com/vi/${videoID}/${file}`).then(res => {
				return {
					statusCode: 200,
					contentType: "image/jpeg",
					stream: res.body
				}
			})
		}
	}
]
