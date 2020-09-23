const {render} = require("pinski/plugins")
const db = require("../utils/db")
const {fetchChannelLatest} = require("../utils/youtube")
const {getUser} = require("../utils/getuser")
const converters = require("../utils/converters")

module.exports = [
	{
		route: `/subscriptions`, methods: ["GET"], code: async ({req}) => {
			const user = getUser(req)
			let hasSubscriptions = false
			let videos = []
			let channels = []
			if (user.token) {
				const subscriptions = user.getSubscriptions()
				const channelPrepared = db.prepare("SELECT * FROM Channels WHERE ucid = ?")
				channels = subscriptions.map(id => channelPrepared.get(id)).sort((a, b) => {
					if (a.name < b.name) return -1
					else if (b.name > a.name) return 1
					else return 0
				})
				if (subscriptions.length) {
					hasSubscriptions = true
					const template = Array(subscriptions.length).fill("?").join(", ")
					videos = db.prepare(`SELECT * FROM Videos WHERE authorId IN (${template}) ORDER BY published DESC LIMIT 60`).all(subscriptions)
						.map(video => {
							video.publishedText = converters.timeToPastText(video.published * 1000)
							return video
						})
				}
			}
			return render(200, "pug/subscriptions.pug", {hasSubscriptions, videos, channels})
		}
	}
]
