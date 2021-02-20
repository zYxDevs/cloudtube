const {request} = require("../utils/request")
const fetch = require("node-fetch")
const {render} = require("pinski/plugins")
const db = require("../utils/db")
const {getToken, getUser} = require("../utils/getuser")
const pug = require("pug")
const converters = require("../utils/converters")
const constants = require("../utils/constants")

class InstanceError extends Error {
	constructor(error, identifier) {
		super(error)
		this.identifier = identifier
	}
}

function formatOrder(format) {
	// most significant to least significant
	// key, max, order, transform
	// asc: lower number comes first, desc: higher number comes first
	const spec = [
		{key: "second__height", max: 8000, order: "desc", transform: x => x ? Math.floor(x/96) : 0},
		{key: "fps", max: 100, order: "desc", transform: x => x ? Math.floor(x/10) : 0},
		{key: "type", max: " ".repeat(60), order: "asc", transform: x => x.length}
	]
	let total = 0
	for (let i = 0; i < spec.length; i++) {
		const s = spec[i]
		let diff = s.transform(format[s.key])
		if (s.order === "asc") diff = s.transform(s.max) - diff
		total += diff
		if (i+1 < spec.length) { // not the last spec item?
			const s2 = spec[i+1]
			total *= s2.transform(s2.max)
		}
	}
	return -total
}

function rewriteVideoDescription(descriptionHtml, id) {
	// replace timestamps to clickable links and rewrite youtube links to stay on the instance instead of pointing to YouTube
	// test cases
	// https://www.youtube.com/watch?v=VdPsJW6AHqc 00:00 timestamps, youtu.be/<videoid>
	// https://www.youtube.com/watch?v=FDMq9ie0ih0 00:00 & 00:00:00 timestamps
	// https://www.youtube.com/watch?v=fhum63fAwrI www.youtube.com/watch?v=<videoid>
	// https://www.youtube.com/watch?v=i-szWOrc3Mo www.youtube.com/<channelname> (unsupported by cloudtube currently)
	// https://www.youtube.com/watch?v=LSG71wbKpbQ www.youtube.com/channel/<id>
	descriptionHtml = descriptionHtml.replace(new RegExp(`<a href="https?:\/\/(www\.)?youtu\.be\/(${constants.regex.video_id})([^"]*)">([^<]+)<\/a>`, "g"), `<a href="/watch?v=$2$3">$4</a>`)
	descriptionHtml = descriptionHtml.replace(new RegExp(`<a href="https?:\/\/(www\.)?youtu(\.be|be\.com)\/([^"]*)">([^<]+)<\/a>`, "g"), `<a href="/$3">$4</a>`)
	descriptionHtml = descriptionHtml.replace(new RegExp(`(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])`, "g"), function(match, p1, p2, p3, offset, string){
		if (p1 === undefined) {
			return `<a href=\"/watch?v=${id}&t=${p2}m${p3}s\">${p2}:${p3}</a>`
		}
		return `<a href=\"/watch?v=${id}&t=${p1}h${p2}m${p3}s\">${p1}:${p2}:${p3}</a>`
	})
	return descriptionHtml
}

async function renderVideo(videoPromise, {user, id, instanceOrigin}, locals = {}) {
	try {
		// resolve video
		const video = await videoPromise
		if (!video) throw new Error("The instance returned null.")
		if (video.error) throw new InstanceError(video.error, video.identifier)
		// process stream list ordering
		for (const format of video.formatStreams.concat(video.adaptiveFormats)) {
			if (!format.second__height && format.resolution) format.second__height = +format.resolution.slice(0, -1)
			if (!format.second__order) format.second__order = formatOrder(format)
		}
		// process length text and view count
		for (const rec of video.recommendedVideos) {
			converters.normaliseVideoInfo(rec)
		}
		// get subscription data
		const subscribed = user.isSubscribed(video.authorId)
		// process watched videos
		user.addWatchedVideoMaybe(video.videoId)
		const watchedVideos = user.getWatchedVideos()
		if (watchedVideos.length) {
			for (const rec of video.recommendedVideos) {
				rec.watched = watchedVideos.includes(rec.videoId)
			}
		}
		// normalise view count
		if (!video.second__viewCountText && video.viewCount) {
			video.second__viewCountText = converters.viewCountToText(video.viewCount)
		}
		video.descriptionHtml = rewriteVideoDescription(video.descriptionHtml, id)
		return render(200, "pug/video.pug", Object.assign(locals, {video, subscribed, instanceOrigin}))
	} catch (e) {
		// show an appropriate error message
		// these should probably be split out to their own files
		let message = pug.render("pre= error", {error: e.stack || e.toString()})
		if (e instanceof fetch.FetchError) {
			const template = `
p The selected instance, #[code= instanceOrigin], did not respond correctly.
`
			message = pug.render(template, {instanceOrigin})
		} else if (e instanceof InstanceError) {
			if (e.identifier === "RATE_LIMITED_BY_YOUTUBE" || e.message === "Could not extract video info. Instance is likely blocked.") {
				const template = `
.blocked-explanation
	img(src="/static/images/instance-blocked.svg" width=552 height=96)
	.rows
		.row
			h3.actor You
			| Working
		.row
			h3.actor CloudTube
			| Working
		.row
			h3.actor Instance
			| Blocked by YouTube
		.row
			h3.actor YouTube
			| Working
p.
	CloudTube needs to a working Second/Invidious instance in order to get data about videos.
	However, the selected instance, #[code= instanceOrigin], has been temporarily blocked by YouTube.
p.
	You will be able to watch this video if you select a working instance in settings.
	#[br]#[a(href="/settings") Go to settings →]
p.
	(Tip: Try #[code https://invidious.snopyta.org] or #[code https://invidious.site].)
p.
	This situation #[em will] be improved in the future!
`
				message = pug.render(template, {instanceOrigin})
			} else {
				const template = `
p #[strong= error.message]
if error.identifier
	p #[code= error.identifier]
p That error was generated by #[code= instanceOrigin].
`
				message = pug.render(template, {instanceOrigin, error: e})
			}
		}
		return render(500, "pug/video.pug", {video: {videoId: id}, error: true, message})
	}
}

module.exports = [
	{
		route: "/watch", methods: ["GET", "POST"], upload: true, code: async ({req, url, body}) => {
			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			const id = url.searchParams.get("v")
			const t = url.searchParams.get("t")
			let mediaFragment = converters.tToMediaFragment(t)
			if (req.method === "GET") {
				if (!settings.local) {
					const instanceOrigin = settings.instance
					const outURL = `${instanceOrigin}/api/v1/videos/${id}`
					const videoPromise = request(outURL).then(res => res.json())
					return renderVideo(videoPromise, {user, id, instanceOrigin}, {mediaFragment})
				} else {
					return render(200, "pug/local-video.pug", {id})
				}
			} else { // req.method === "POST"
				const video = JSON.parse(new URLSearchParams(body.toString()).get("video"))
				const videoPromise = Promise.resolve(video)
				const instanceOrigin = "http://localhost:3000"
				return renderVideo(videoPromise, {user, id, instanceOrigin}, {mediaFragment})
			}
		}
	}
]
