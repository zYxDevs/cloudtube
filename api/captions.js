const {getUser} = require("../utils/getuser")
const constants = require("../utils/constants.js")
const {proxy} = require("pinski/plugins")

module.exports = [
	{
		route: `/api/v1/captions/(${constants.regex.video_id})`, methods: ["GET"], code: async ({req, fill, url}) => {
			const instanceOrigin = getUser(req).getSettingsOrDefaults().instance
			const fetchURL = new URL(`${url.pathname}${url.search}`, instanceOrigin)
			return proxy(fetchURL.toString())
		}
	}
]
