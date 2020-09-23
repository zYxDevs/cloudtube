const {render} = require("pinski/plugins")
const constants = require("../utils/constants")
const {fetchChannel} = require("../utils/youtube")
const {getUser} = require("../utils/getuser")

module.exports = [
	{
		route: `/channel/(${constants.regex.ucid})`, methods: ["GET"], code: async ({req, fill}) => {
			const id = fill[0]
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			const data = await fetchChannel(id, settings.instance)
			const subscribed = user.isSubscribed(id)
			return render(200, "pug/channel.pug", {data, subscribed})
		}
	}
]
