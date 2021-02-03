const constants = require("../utils/constants")
const {redirect} = require("pinski/plugins")

module.exports = [
	{
		route: `/(${constants.regex.video_id})`, priority: -1, methods: ["GET"], code: async ({fill, url}) => {
			const target = new URLSearchParams(url.search)
			target.set("v", fill[0])
			return redirect(`/watch?${target}`, 301)
		}
	}
]
