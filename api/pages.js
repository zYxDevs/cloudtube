const {render} = require("pinski/plugins")
const {getUser} = require("../utils/getuser")

module.exports = [
	{
		route: "/", methods: ["GET"], code: async ({req}) => {
			const userAgent = req.headers["user-agent"] || ""
			const mobile = userAgent.toLowerCase().includes("mobile")
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			return render(200, "pug/home.pug", {req, settings, mobile})
		}
	},
	{
		route: "/(?:js-)?licenses", methods: ["GET"], code: async ({req}) => {
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			return render(200, "pug/licenses.pug", {req, settings})
		}
	},
	{
		route: "/cant-think", methods: ["GET"], code: async ({req}) => {
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			return render(200, "pug/cant-think.pug", {req, settings})
		}
	},
	{
		route: "/privacy", methods: ["GET"], code: async ({req}) => {
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			return render(200, "pug/privacy.pug", {req, settings})
		}
	}
]
