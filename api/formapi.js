const {redirect} = require("pinski/plugins")
const db = require("../utils/db")
const constants = require("../utils/constants")
const {getUser, setToken} = require("../utils/getuser")
const validate = require("../utils/validate")
const V = validate.V
const {fetchChannel} = require("../utils/youtube")

module.exports = [
	{
		route: `/formapi/(un|)subscribe/(${constants.regex.ucid})`, methods: ["POST"], upload: true, code: async ({req, fill, body}) => {
			const add = !fill[0]
			const ucid = fill[1]

			return new V()
				.with(validate.presetLoad({body}))
				.with(validate.presetURLParamsBody())
				.last(async state => {
					const {params} = state
					const responseHeaders = {}
					const user = getUser(req, responseHeaders)
					const settings = user.getSettingsOrDefaults()
					const token = user.token

					if (add) {
						await fetchChannel("channel", ucid, settings.instance)
						db.prepare(
							"INSERT INTO Subscriptions (token, ucid) VALUES (?, ?)"
						).run(token, ucid)
					} else {
						db.prepare("DELETE FROM Subscriptions WHERE token = ? AND ucid = ?").run(token, ucid)
					}

					if (params.has("referrer")) {
						return {
							statusCode: 303,
							contentType: "text/plain",
							headers: Object.assign(responseHeaders, {
								Location: params.get("referrer")
							}),
							content: "Success, redirecting..."
						}
					} else {
						return {
							statusCode: 200,
							contentType: "text/plain",
							headers: responseHeaders,
							content: "Success."
						}
					}
				})
				.go()
		}
	},
	{
		route: `/formapi/markwatched/(${constants.regex.video_id})`, methods: ["POST"], code: async ({req, fill}) => {
			const videoID = fill[0]
			const user = getUser(req)
			const token = user.token
			if (token) {
				db.prepare("INSERT OR IGNORE INTO WatchedVideos (token, videoID) VALUES (?, ?)").run(token, videoID)
			}
			return {
				statusCode: 303,
				contentType: "text/plain",
				headers: {
					Location: "/subscriptions"
				},
				content: {
					status: "Success, redirecting..."
				}
			}
		}
	},
	{
		route: "/formapi/erase", methods: ["POST"], upload: true, code: async ({req, fill, body}) => {
			return new V()
				.with(validate.presetLoad({body}))
				.with(validate.presetURLParamsBody())
				.with(validate.presetEnsureParams(["token"]))
				.last(async state => {
					const {params} = state
					const token = params.get("token")
					;["Subscriptions", "Settings", "SeenTokens", "WatchedVideos"].forEach(table => {
						db.prepare(`DELETE FROM ${table} WHERE token = ?`).run(token)
					})
					return {
						statusCode: 303,
						contentType: "text/plain",
						headers: {
							location: "/",
							"set-cookie": `token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
						},
						content: "Success, redirecting..."
					}
				})
				.go()
		}
	},
	{
		route: "/formapi/importsession/(\\w+)", methods: ["GET"], code: async ({req, fill}) => {
			return {
				statusCode: 303,
				headers: setToken({
					location: "/subscriptions"
				}, fill[0]).responseHeaders,
				contentType: "text/plain",
				content: "Success, redirecting..."
			}
		}
	}
]
