const fetch = require("node-fetch")
const {render} = require("pinski/plugins")
const {getUser} = require("../utils/getuser")

module.exports = [
	{
		route: "/(?:search|results)", methods: ["GET"], code: async ({req, url}) => {
			const query = url.searchParams.get("q") || url.searchParams.get("search_query")
			const fetchURL = new URL("http://localhost:3000/api/v1/search")
			fetchURL.searchParams.set("q", query)
			const results = await fetch(fetchURL.toString()).then(res => res.json())
			const instanceOrigin = getUser(req).getSettingsOrDefaults().instance
			return render(200, "pug/search.pug", {query, results, instanceOrigin})
		}
	}
]
