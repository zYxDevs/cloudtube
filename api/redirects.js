const constants = require("../utils/constants")
const {redirect} = require("pinski/plugins")

module.exports = [
	{
		route: `/(${constants.regex.video_id})`, priority: -1, methods: ["GET"], code: async ({fill}) => {
			return redirect(`/watch?v=${fill[0]}`, 301)
		}
	}
]
