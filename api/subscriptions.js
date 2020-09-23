const {render} = require("pinski/plugins")
const db = require("../utils/db")
const {fetchChannelLatest} = require("../utils/youtube")
const {getUser} = require("../utils/getuser")
const {timeToPastText} = require("../utils/converters")

module.exports = [
	{
		route: `/subscriptions`, methods: ["GET"], code: async ({req}) => {
			const user = getUser(req)
			let hasSubscriptions = false
			let videos = []
			let channels = []
			let refreshed = null
			if (user.token) {
				// get channels
				const subscriptions = user.getSubscriptions()
				const template = Array(subscriptions.length).fill("?").join(", ")
				channels = db.prepare(`SELECT * FROM Channels WHERE ucid IN (${template}) ORDER BY name`).all(subscriptions)
				// get refreshed status
				refreshed = db.prepare(`SELECT min(refreshed) as min, max(refreshed) as max, count(refreshed) as count FROM Channels WHERE ucid IN (${template})`).get(subscriptions)
				// get videos
				if (subscriptions.length) {
					hasSubscriptions = true
					const template = Array(subscriptions.length).fill("?").join(", ")
					videos = db.prepare(`SELECT * FROM Videos WHERE authorId IN (${template}) ORDER BY published DESC LIMIT 60`).all(subscriptions)
						.map(video => {
							video.publishedText = timeToPastText(video.published * 1000)
							return video
						})
				}
			}
			return render(200, "pug/subscriptions.pug", {hasSubscriptions, videos, channels, refreshed, timeToPastText})
		}
	}
]
