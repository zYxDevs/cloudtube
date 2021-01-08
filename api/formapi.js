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
						await fetchChannel(ucid, settings.instance)
						db.prepare("INSERT OR IGNORE INTO Subscriptions (token, ucid) VALUES (?, ?)").run(token, ucid)
					} else {
						db.prepare("DELETE FROM Subscriptions WHERE token = ? AND ucid = ?").run(token, ucid)
					}

					if (params.has("referrer")) {
						return {
							statusCode: 303,
							contentType: "application/json",
							headers: Object.assign(responseHeaders, {
								Location: params.get("referrer")
							}),
							content: {
								status: "ok"
							}
						}
						return redirect(params.get("referrer"), 303)
					} else {
						return {
							statusCode: 200,
							contentType: "application/json",
							headers: responseHeaders,
							content: {
								status: "ok"
							}
						}
					}
				})
				.go()
		}
	},
	{
		route: `/formapi/erase`, methods: ["POST"], upload: true, code: async ({req, fill, body}) => {
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
						headers: {
							location: "/",
							"set-cookie": `token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
						},
						content: {
							status: "ok"
						}
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
				contentType: "application/json",
				content: {
					status: "ok"
				}
			}
		}
	}
]
