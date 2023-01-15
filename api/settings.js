const {render, redirect} = require("pinski/plugins")
const db = require("../utils/db")
const {getToken, getUser} = require("../utils/getuser")
const constants = require("../utils/constants")
const {instancesList} = require("../background/instances")
const validate = require("../utils/validate")
const V = validate.V

module.exports = [
	{
		route: "/api/settings", methods: ["GET"], code: async ({req}) => {
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			return {
				statusCode: 200,
				contentType: "application/json",
				content: settings
			}
		}
	},
	{
		route: "/settings", methods: ["GET"], code: async ({req}) => {
			const user = getUser(req)
			const settings = user.getSettings()
			const instances = instancesList.get()
			return render(200, "pug/settings.pug", {req, constants, user, settings, instances})
		}
	},
	{
		route: "/settings", methods: ["POST"], upload: true, code: async ({req, body}) => {
			return new V()
				.with(validate.presetLoad({body}))
				.with(validate.presetURLParamsBody())
				.last(async state => {
					const {params} = state
					const responseHeaders = {
						Location: "/settings"
					}
					const token = getToken(req, responseHeaders)
					const data = {}

					for (const key of Object.keys(constants.user_settings)) {
						const setting = constants.user_settings[key]
						if (params.has(key)) {
							let provided = params.get(key)

							// Correct common errors in instance URL
							if (key === "instance") {
								provided = provided.replace(/\/+$/, "")
							}

							// Delete existing watch history when it's disabled
							if (key === "save_history") {
								if (provided !== "1") {
									db.prepare("DELETE FROM WatchedVideos WHERE token = ?").run(token)
								}
							}

							if (setting.type === "string") {
								if (provided) data[key] = provided
								else data[key] = null
							} else if (setting.type === "integer") {
								if (isNaN(provided)) data[key] = null
								else data[key] = +provided
							} else if (setting.type === "boolean") {
								if (provided === "1") data[key] = 1
								else data[key] = 0
							} else {
								throw new Error("Unsupported setting type: "+setting.type)
							}
						} else {
							data[key] = null
						}
					}

					db.prepare("DELETE FROM Settings WHERE token = ?").run(token)
					const keys = ["token", ...Object.keys(constants.user_settings)]
					const baseFields = keys.join(", ")
					const atFields = keys.map(k => "@"+k).join(", ")
					db.prepare(`INSERT INTO Settings (${baseFields}) VALUES (${atFields})`).run({token, ...data})

					return {
						statusCode: 303,
						headers: responseHeaders,
						contentType: "text/html",
						content: "Redirecting..."
					}
				})
				.go()
		}
	}
]
