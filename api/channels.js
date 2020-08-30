const {render} = require("pinski/plugins")
const constants = require("./utils/constants")
const {fetchChannel} = require("./utils/youtube")
const {getUser} = require("./utils/getuser")

module.exports = [
	{
		route: `/channel/(${constants.regex.ucid})`, methods: ["GET"], code: async ({req, fill}) => {
			const id = fill[0]
			const data = await fetchChannel(id)
			const user = getUser(req)
			const subscribed = user.isSubscribed(id)
			return render(200, "pug/channel.pug", {data, subscribed})
		}
	}
]
