const {redirect} = require("pinski/plugins")
const db = require("./utils/db")
const constants = require("./utils/constants")
const {getUser} = require("./utils/getuser")
const validate = require("./utils/validate")
const V = validate.V
const {fetchChannel} = require("./utils/youtube")

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
	}
]
