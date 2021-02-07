const constants = require("../utils/constants")
const {redirect} = require("pinski/plugins")

module.exports = [
	{
		route: `/(${constants.regex.video_id})`, priority: -1, methods: ["GET"], code: async ({fill, url}) => {
			return redirect(`/watch?v=${fill[0]}${url.search.replace(/^\?/, "&")}`, 301)
		}
	}
]
