const {render} = require("pinski/plugins")
const {fetchChannel} = require("../utils/youtube")
const {getUser} = require("../utils/getuser")
const converters = require("../utils/converters")

module.exports = [
	{
		route: `/(c|channel|user)/(.+)`, methods: ["GET"], code: async ({req, fill, url}) => {
			const path = fill[0]
			const id = fill[1]
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			const data = await fetchChannel(path, id, settings.instance)
			const instanceOrigin = settings.instance

			// problem with the channel? fetchChannel has collected the necessary information for us.
			// we can render a skeleton page, display the message, and provide the option to unsubscribe.
			if (data.error) {
				const statusCode = data.missing ? 410 : 500
				const subscribed = user.isSubscribed(id)
				return render(statusCode, "pug/channel-error.pug", {req, settings, data, subscribed, instanceOrigin})
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
			const subscribed = user.isSubscribed(data.authorId)
			return render(200, "pug/channel.pug", {req, settings, data, subscribed, instanceOrigin})
		}
	}
]
