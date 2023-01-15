const {render} = require("pinski/plugins")
const db = require("../utils/db")
const {getUser} = require("../utils/getuser")
const {timeToPastText, rewriteVideoDescription, applyVideoFilters} = require("../utils/converters")
const {refresher} = require("../background/feed-update")

module.exports = [
	{
		route: `/subscriptions`, methods: ["GET"], code: async ({req, url}) => {
			const user = getUser(req)
			let hasSubscriptions = false
			let videos = []
			let channels = []
			let missingChannelCount = 0
			let refreshed = null
			if (user.token) {
				// trigger a background refresh, needed if they came back from being inactive
				refresher.skipWaiting()
				// get channels
				channels = db.prepare(`SELECT Channels.* FROM Channels INNER JOIN Subscriptions ON Channels.ucid = Subscriptions.ucid WHERE token = ? ORDER BY name`).all(user.token)
				missingChannelCount = channels.reduce((a, c) => a + c.missing, 0)
				// get refreshed status
				refreshed = db.prepare(`SELECT min(refreshed) as min, max(refreshed) as max, count(refreshed) as count FROM Channels INNER JOIN Subscriptions ON Channels.ucid = Subscriptions.ucid WHERE token = ?`).get(user.token)
				// get watched videos
				const watchedVideos = user.getWatchedVideos()
				// get videos
				if (channels.length) {
					hasSubscriptions = true
					videos = db.prepare(`SELECT Videos.* FROM Videos INNER JOIN Subscriptions ON Videos.authorID = Subscriptions.ucid WHERE token = ? ORDER BY published DESC LIMIT 60`).all(user.token)
						.map(video => {
							video.publishedText = timeToPastText(video.published * 1000)
							video.watched = watchedVideos.includes(video.videoId)
							video.descriptionHtml = rewriteVideoDescription(video.descriptionHtml, video.videoId)
							return video
						})
				}
				const filters = user.getFilters()
				;({videos} = applyVideoFilters(videos, filters))
			}
			const settings = user.getSettingsOrDefaults()
			const instanceOrigin = settings.instance
			return render(200, "pug/subscriptions.pug", {req, url, settings, hasSubscriptions, videos, channels, missingChannelCount, refreshed, timeToPastText, instanceOrigin})
		}
	}
]
