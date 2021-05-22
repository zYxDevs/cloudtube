const {proxy} = require("pinski/plugins")
const {getUser} = require("../utils/getuser")
const constants = require("../utils/constants.js")

// list of paths relative to the backend this route is authorized to serve
const authorizedPaths = [`/api/v1/captions/(${constants.regex.video_id})`]

// headers relayed as-is from the proxied backend to the client
const proxiedHeaders = ["content-type", "date", "last-modified", "expires", "cache-control", "accept-ranges", "content-range", "origin", "etag", "content-length", "transfer-encoding"]

module.exports = [
	{
		route: `/proxy`, methods: ["GET"], code: async ({req, fill, url}) => {
			const instanceOrigin = getUser(req).getSettingsOrDefaults().instance
			const remotePath = url.searchParams.get("url")
			const fetchURL = new URL(remotePath, instanceOrigin)
			if (!fetchURL.toString().startsWith(instanceOrigin) || !authorizedPaths.some(element => fetchURL.pathname.match(new RegExp(`^${element}$`)))) {
				return {
					statusCode: 401,
					content: "CloudTube: Unauthorized",
					contentType: "text/plain"
				}
			}
			return proxy(fetchURL, {}, (h) => Object.keys(h).filter(key => proxiedHeaders.includes(key)).reduce((res, key) => (res[key] = h[key], res), {}))
		}
	}
]
