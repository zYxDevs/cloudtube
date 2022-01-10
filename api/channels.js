const {render} = require("pinski/plugins")
const constants = require("../utils/constants")
const {fetchChannel} = require("../utils/youtube")
const {getUser} = require("../utils/getuser")
const converters = require("../utils/converters")

module.exports = [
	{
		route: `/channel/(${constants.regex.ucid})`, methods: ["GET"], code: async ({req, fill, url}) => {
			const id = fill[0]
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			const data = await fetchChannel(id, settings.instance)
			const subscribed = user.isSubscribed(id)
			const instanceOrigin = settings.instance

			// problem with the channel? fetchChannel has collected the necessary information for us.
			// we can render a skeleton page, display the message, and provide the option to unsubscribe.
			if (data.error) {
				const statusCode = data.missing ? 410 : 500
				return render(statusCode, "pug/channel-error.pug", {settings, data, subscribed, instanceOrigin})
			}

			// everything is fine

			// normalise info, apply watched status
			if (!data.second__subCountText && data.subCount) {
				data.second__subCountText = converters.subscriberCountToText(data.subCount)
			}
			const watchedVideos = user.getWatchedVideos()
			if (data.latestVideos) {
				data.latestVideos.forEach(video => {
					converters.normaliseVideoInfo(video)
					video.watched = watchedVideos.includes(video.videoId)
				})
			}
			return render(200, "pug/channel.pug", {settings, data, subscribed, instanceOrigin})
		}
	}
]
