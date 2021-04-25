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

function sortFormats(video, preference) {
	const standard = video.formatStreams.slice().sort((a, b) => b.second__height - a.second__height)
	const adaptive = video.adaptiveFormats.filter(f => f.type.startsWith("video") && f.qualityLabel).sort((a, b) => a.second__order - b.second__order)
	let formats = standard.concat(adaptive)

	for (const format of formats) {
		if (!format.second__height && format.resolution) format.second__height = +format.resolution.slice(0, -1)
		if (!format.second__order) format.second__order = formatOrder(format)
		format.cloudtube__label = `${format.qualityLabel} ${format.container}`
	}
	for (const format of adaptive) {
		format.cloudtube__label += " *"
	}

	if (preference === 1) { // best dash
		formats.sort((a, b) => {
			const a1 = a.second__height + a.fps / 100
			const b1 = b.second__height + b.fps / 100
			return b1 - a1
		})
	} else if (preference === 2) { // best <=1080p
		formats.sort((a, b) => {
			const a1 = a.second__height + a.fps / 100
			const b1 = b.second__height + b.fps / 100
			if (b1 > 1081) {
				if (a1 > 1081) return b1 - a1
				return -1
			}
			if (a1 > 1081) return 1
			return b1 - a1
		})
	} else if (preference === 3) { // best low-fps
		formats.sort((a, b) => {
			if (b.fps > 30) {
				if (a.fps < 30) return b.second__height - a.second__height
				return -1
			}
			if (a.fps > 30) return 1
			return b.second__height - a.second__height
		})
	} else if (preference === 4) { // 360p only
		formats.sort((a, b) => {
			if (a.itag == 18) return -1
			if (b.itag == 18) return 1
			return 0
		})
	} else { // preference === 0, best combined
		// should already be correct
	}

	return formats
}

async function renderVideo(video, {user, settings, id, instanceOrigin}, locals = {}) {
	try {
		if (!video) throw new Error("The instance returned null.")
		if (video.error) throw new InstanceError(video.error, video.identifier)

		// process stream list ordering
		const formats = sortFormats(video, settings.quality)

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

		// rewrite description
		video.descriptionHtml = converters.rewriteVideoDescription(video.descriptionHtml, id)

		return render(200, "pug/video.pug", Object.assign(locals, {video, formats, subscribed, instanceOrigin}))
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
	CloudTube needs a working NewLeaf/Invidious instance in order to get data about videos.
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

			// Media fragment
			const t = url.searchParams.get("t")
			let mediaFragment = converters.tToMediaFragment(t)

			// Continuous mode
			const continuous = url.searchParams.get("continuous") === "1"
			const swp = url.searchParams.get("session-watched")
			const sessionWatched = swp ? swp.split(" ") : []
			const sessionWatchedNext = sessionWatched.concat([id]).join("+")
			if (continuous) settings.quality = 0 // autoplay with synced streams does not work

			if (req.method === "GET") {
				if (settings.local) { // skip to the local fetching page, which will then POST video data in a moment
					return render(200, "pug/local-video.pug", {id})
				}
				var instanceOrigin = settings.instance
				var outURL = `${instanceOrigin}/api/v1/videos/${id}`
				var video = await request(outURL).then(res => res.json())
			} else { // req.method === "POST"
				var instanceOrigin = "http://localhost:3000"
				var video = JSON.parse(new URLSearchParams(body.toString()).get("video"))
			}

			return renderVideo(video, {
				user, settings, id, instanceOrigin
			}, {
				mediaFragment, continuous, sessionWatched, sessionWatchedNext
			})
		}
	}
]
