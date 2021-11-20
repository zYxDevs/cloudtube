const {request} = require("../utils/request")
/** @type {import("node-fetch").default} */
// @ts-ignore
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

class MessageError extends Error {
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
	// Add second__ extensions to format objects, required if Invidious was the extractor
	let formats = video.formatStreams.concat(video.adaptiveFormats)
	for (const format of formats) {
		if (!format.second__height && format.resolution) format.second__height = +format.resolution.slice(0, -1)
		if (!format.second__order) format.second__order = formatOrder(format)
		format.cloudtube__label = `${format.qualityLabel} ${format.container}`
	}

	// Properly build and order format list
	const standard = video.formatStreams.slice().sort((a, b) => b.second__height - a.second__height)
	const adaptive = video.adaptiveFormats.filter(f => f.type.startsWith("video") && f.qualityLabel).sort((a, b) => a.second__order - b.second__order)
	for (const format of adaptive) {
		if (!format.cloudtube__label.endsWith("*")) format.cloudtube__label += " *"
	}
	formats = standard.concat(adaptive)

	// Reorder fomats based on user preference
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

module.exports = [
	{
		route: "/watch", methods: ["GET", "POST"], upload: true, code: async ({req, url, body}) => {
			// Prepare data needed to render video page

			const user = getUser(req)
			const settings = user.getSettingsOrDefaults()
			const id = url.searchParams.get("v")

			// Check if playback is allowed
			const videoTakedownInfo = db.prepare("SELECT id, org, url FROM TakedownVideos WHERE id = ?").get(id)
			if (videoTakedownInfo) {
				return render(451, "pug/takedown-video.pug", videoTakedownInfo)
			}

			// Media fragment
			const t = url.searchParams.get("t")
			let mediaFragment = converters.tToMediaFragment(t)

			// Continuous mode
			const continuous = url.searchParams.get("continuous") === "1"
			const autoplay = url.searchParams.get("autoplay") === "1"
			const swp = url.searchParams.get("session-watched")
			const sessionWatched = swp ? swp.split(" ") : []
			const sessionWatchedNext = sessionWatched.concat([id]).join("+")
			if (continuous) settings.quality = 0 // autoplay with synced streams does not work

			// Work out how to fetch the video
			if (req.method === "GET") {
				if (settings.local) { // skip to the local fetching page, which will then POST video data in a moment
					return render(200, "pug/local-video.pug", {id})
				}
				var instanceOrigin = settings.instance
				var outURL = `${instanceOrigin}/api/v1/videos/${id}`
				var videoFuture = request(outURL).then(res => res.json())
			} else { // req.method === "POST"
				var instanceOrigin = "http://localhost:3000"
				var videoFuture = JSON.parse(new URLSearchParams(body.toString()).get("video"))
			}

			try {
				// Fetch the video
				const video = await videoFuture

				// Error handling
				if (!video) throw new MessageError("The instance returned null.")
				if (video.error) throw new InstanceError(video.error, video.identifier)

				// Check if channel playback is allowed
				const channelTakedownInfo = db.prepare("SELECT ucid, org, url FROM TakedownChannels WHERE ucid = ?").get(video.authorId)
				if (channelTakedownInfo) {
					// automatically add the entry to the videos list, so it won't be fetched again
					const args = {id, ...channelTakedownInfo}
					db.prepare("INSERT INTO TakedownVideos (id, org, url) VALUES (@id, @org, @url)").run(args)
					return render(451, "pug/takedown-video.pug", channelTakedownInfo)
				}

				// process stream list ordering
				const formats = sortFormats(video, settings.quality)

				// process length text and view count
				for (const rec of video.recommendedVideos) {
					converters.normaliseVideoInfo(rec)
				}

				// filter list
				const {videos, filteredCount} = converters.applyVideoFilters(video.recommendedVideos, user.getFilters())
				video.recommendedVideos = videos

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

				// apply media fragment to all sources
				for (const format of formats) {
					format.url += mediaFragment
				}

				// rewrite description
				video.descriptionHtml = converters.rewriteVideoDescription(video.descriptionHtml, id)

				// rewrite captions urls so they are served on the same domain via the /proxy route
				for (const caption of video.captions) {
					caption.url = `/proxy?${new URLSearchParams({"url": caption.url})}`
				}

				return render(200, "pug/video.pug", {
					url, video, formats, subscribed, instanceOrigin, mediaFragment, autoplay, continuous,
					sessionWatched, sessionWatchedNext, settings
				})

			} catch (error) {
				// Something went wrong, somewhere! Find out where.

				let errorType = "unrecognised-error"
				const locals = {instanceOrigin, error}

				// Sort error category
				if (error instanceof fetch.FetchError) {
					errorType = "fetch-error"
				} else if (error instanceof MessageError) {
					errorType = "message-error"
				} else if (error instanceof InstanceError) {
					if (error.identifier === "RATE_LIMITED_BY_YOUTUBE" || error.message === "Could not extract video info. Instance is likely blocked.") {
						errorType = "rate-limited"
					} else {
						errorType = "instance-error"
					}
				}

				// Create appropriate formatted message
				const message = render(0, `pug/errors/${errorType}.pug`, locals).content

				return render(500, "pug/video.pug", {video: {videoId: id}, error: true, message})
			}
		}
	}
]
