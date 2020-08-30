const {render} = require("pinski/plugins")
const db = require("./utils/db")
const {fetchChannelLatest} = require("./utils/youtube")
const {getUser} = require("./utils/getuser")

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
					const all = await Promise.all(subscriptions.map(id => fetchChannelLatest(id)))
					videos = all.flat(1).sort((a, b) => b.published - a.published).slice(0, 60)
				}
			}
			return render(200, "pug/subscriptions.pug", {hasSubscriptions, videos, channels})
		}
	}
]
