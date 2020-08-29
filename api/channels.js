const fetch = require("node-fetch")
const {render} = require("pinski/plugins")

module.exports = [
	{
		route: "/channel/([A-Za-z0-9-_]+)", methods: ["GET"], code: async ({fill}) => {
			const id = fill[0]
			const data = await fetch(`http://localhost:3000/api/v1/channels/${id}`).then(res => res.json())
			return render(200, "pug/channel.pug", {data})
		}
	}
]
