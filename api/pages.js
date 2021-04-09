const {render} = require("pinski/plugins")

module.exports = [
	{
		route: "/", methods: ["GET"], code: async ({req}) => {
			const userAgent = req.headers["user-agent"] || ""
			const mobile = userAgent.toLowerCase().includes("mobile")
			return render(200, "pug/home.pug", {mobile})
		}
	}
]
