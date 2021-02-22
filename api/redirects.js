const constants = require("../utils/constants")
const {redirect} = require("pinski/plugins")

module.exports = [
	{
		route: `/(?:watch/|w/|v/|shorts/|e/)?(${constants.regex.video_id})`, priority: -1, methods: ["GET"], code: async ({fill, url}) => {
			/*
			 Why not URLSearchParams?
			 URLSearchParams is an unordered map, and URLs are more
			 aesthetic if the video ID is at the start of them.
			 This code makes the video ID always the first parameter, and
			 then adds on the `search` from the original URL, with the
			 leading ? replaced.
			 If the original URL had no parameters, there will be no
			 additional text added here.
			*/
			return redirect(`/watch?v=${fill[0]}${url.search.replace(/^\?/, "&")}`, 301)
		}
	}
]
