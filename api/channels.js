const {render} = require("pinski/plugins")
const constants = require("../utils/constants")
const {fetchChannel} = require("../utils/youtube")
const {getUser} = require("../utils/getuser")
const converters = require("../utils/converters")

module.exports = [
	{
		route: `/channel/(${constants.regex.ucid})`, methods: ["GET"], code: async ({req, fill}) => {
			const id = fill[0]
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			const data = await fetchChannel(id, settings.instance)
			const subscribed = user.isSubscribed(id)
			const instanceOrigin = settings.instance
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
			return render(200, "pug/channel.pug", {data, subscribed, instanceOrigin})
		}
	}
]
