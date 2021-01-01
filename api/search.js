const fetch = require("node-fetch")
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
			const results = await fetch(fetchURL.toString()).then(res => res.json())

			for (const video of results) {
				if (!video.second__lengthText && video.lengthSeconds > 0) {
					video.second__lengthText = converters.lengthSecondsToLengthText(video.lengthSeconds)
				}
				if (!video.second__lengthText && video.lengthSeconds === 0) {
					video.second__lengthText = "LIVE"
					video.liveNow = true
				}
				if (video.publishedText === "0 seconds ago") {
					video.publishedText = "Live now"
				}
			}

			return render(200, "pug/search.pug", {query, results, instanceOrigin})
		}
	}
]
