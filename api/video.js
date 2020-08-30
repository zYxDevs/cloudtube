const fetch = require("node-fetch")
const {render} = require("pinski/plugins")
const db = require("./utils/db")
const {getToken} = require("./utils/getuser")

module.exports = [
	{
		route: "/watch", methods: ["GET"], code: async ({req, url}) => {
			const id = url.searchParams.get("v")
			const video = await fetch(`http://localhost:3000/api/v1/videos/${id}`).then(res => res.json())
			let subscribed = false
			const token = getToken(req)
			if (token) {
				subscribed = !!db.prepare("SELECT * FROM Subscriptions WHERE token = ? AND ucid = ?").get([token, video.authorId])
			}
			return render(200, "pug/video.pug", {video, subscribed})
		}
	}
]
