const {request} = require("../utils/request")
const {render} = require("pinski/plugins")
const {getUser} = require("../utils/getuser")
const converters = require("../utils/converters")

module.exports = [
	{
		route: "/(?:search|results)", methods: ["GET"], code: async ({req, url}) => {
			const query = url.searchParams.get("q") || url.searchParams.get("search_query")
			const instanceOrigin = getUser(req).getSettingsOrDefaults().instance
			const fetchURL = new URL(`${instanceOrigin}/api/v1/search`)
			fetchURL.searchParams.set("q", query)
			const results = await request(fetchURL.toString()).then(res => res.json())
			const error = results.error || results.message || results.code

			if (error) throw new Error(`Instance said: ${error}`)

			for (const video of results) {
				converters.normaliseVideoInfo(video)
			}

			return render(200, "pug/search.pug", {query, results, instanceOrigin})
		}
	}
]
