const constants = require("../utils/constants")
const {render} = require("pinski/plugins")

module.exports = [
	{
		route: "/takedown", methods: ["GET"], code: async ({req}) => {
			return render(200, "pug/takedown.pug", {req, constants})
		}
	}
]
