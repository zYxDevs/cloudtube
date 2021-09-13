const constants = require("./constants")
const pug = require("pug")
const {Matcher} = require("./matcher")

function timeToPastText(timestamp) {
	const difference = Date.now() - timestamp
	return [
		["year", 365 * 24 * 60 * 60 * 1000],
		["month", 30 * 24 * 60 * 60 * 1000],
		["week", 7 * 24 * 60 * 60 * 1000],
		["day", 24 * 60 * 60 * 1000],
		["hour", 60 * 60 * 1000],
		["minute", 60 * 1000],
		["second", 1 * 1000]
	].reduce((acc, /** @type {[string, number]} */ [unitName, unitValue]) => {
		if (acc) return acc
		if (difference > unitValue) {
			const number = Math.floor(difference / unitValue)
			const pluralUnit = unitName + (number == 1 ? "" : "s")
			return `${number} ${pluralUnit} ago`
		}
	}, null) || "just now"
}

function lengthSecondsToLengthText(seconds) {
	let parts = [Math.floor(seconds/3600), Math.floor(seconds/60)%60, seconds%60]
	if (parts[0] === 0) parts = parts.slice(1)
	return parts.map((x, i) => i === 0 ? x : (x+"").padStart(2, "0")).join(":")
}

/**
 * NewLeaf and Invidious don't return quite the same data. This
 * function normalises them so that all the useful properties are
 * available no matter the kind of instance. The video is modified
 * in-place.
 *
 * Changes:
 * - second__lengthText is added, may be [hh:]mm:ss or "LIVE"
 * - publishedText may be changed to "Live now"
 * - second__viewCountText is added
 */
function normaliseVideoInfo(video) {
	if (!video.second__lengthText && video.lengthSeconds > 0) {
		video.second__lengthText = lengthSecondsToLengthText(video.lengthSeconds)
	}
	if (!video.second__lengthText && video.lengthSeconds === 0) {
		video.second__lengthText = "LIVE"
		video.liveNow = true
	}
	if (video.publishedText === "0 seconds ago") {
		video.publishedText = "Live now"
	}
	if (!video.second__viewCountText) {
		video.second__viewCountText = viewCountToText(video.viewCount)
	}
	if (video.descriptionHtml) {
		video.descriptionHtml = rewriteVideoDescription(video.descriptionHtml, video.videoId)
	}
}

const timeDisplayCompiled = pug.compile(`a(href=url data-clickable-timestamp=timeSeconds)= timeDisplay`)
function rewriteVideoDescription(descriptionHtml, id) {
	// replace timestamps to clickable links and rewrite youtube links to stay on the instance instead of pointing to YouTube
	// test cases
	// https://www.youtube.com/watch?v=VdPsJW6AHqc 00:00 timestamps, youtu.be/<videoid>
	// https://www.youtube.com/watch?v=FDMq9ie0ih0 00:00 & 00:00:00 timestamps
	// https://www.youtube.com/watch?v=fhum63fAwrI www.youtube.com/watch?v=<videoid>
	// https://www.youtube.com/watch?v=i-szWOrc3Mo www.youtube.com/<channelname> (unsupported by cloudtube currently)
	// https://www.youtube.com/watch?v=LSG71wbKpbQ www.youtube.com/channel/<id>
	// https://www.youtube.com/watch?v=RiEkOKFOG3s youtu.be/<videoid> with params

	descriptionHtml = descriptionHtml.replace(new RegExp(`<a href="https?://(?:www\\.)?youtu\\.be/(${constants.regex.video_id})[?]?([^"]*)">([^<]+)</a>`, "g"), (_, id, params, innerText) => {
		if (params) {
			return `<a href="/watch?v=${id}&${params}">${innerText}</a>`
		} else {
			return `<a href="/watch?v=${id}">${innerText}</a>`
		}
	})
	descriptionHtml = descriptionHtml.replace(new RegExp(`<a href="https?://(?:www\\.)?youtu(?:\\.be|be\\.com)/([^"]*)">([^<]+)<\/a>`, "g"), `<a href="/$1">$2</a>`)
	descriptionHtml = descriptionHtml.replace(new RegExp(`(?:([0-9]*):)?([0-5]?[0-9]):([0-5][0-9])`, "g"), (_, hours, minutes, seconds) => {
		let timeURL, timeDisplay, timeSeconds
		if (hours === undefined) {
			timeURL = `${minutes}m${seconds}s`
			timeDisplay = `${minutes}:${seconds}`
			timeSeconds = minutes*60 + + seconds
		} else {
			timeURL = `${hours}h${minutes}m${seconds}s`
			timeDisplay = `${hours}:${minutes}:${seconds}`
			timeSeconds = hours*60*60 + minutes*60 + + seconds
		}

		const params = new URLSearchParams()
		params.set("v", id)
		params.set("t", timeURL)
		const url = "/watch?" + params

		return timeDisplayCompiled({url, timeURL, timeDisplay, timeSeconds})
	})

	return descriptionHtml
}

/**
 * YT supports a time parameter t in these possible formats:
 * - [digits] -> seconds
 * - ([digits]:)?[digits]:[digits] -> hours?, minutes, seconds
 * - ([digits]h)?([digits]m)?([digits]s)? -> hours?, minutes?, seconds
 *
 * Try our best to get something suitable out. Fail by returning empty
 * string, meaning nothing suitable was recognised.
 */
function tToMediaFragment(t) {
	let resolved = ""

	if (!t || t.length > 10) { // don't parse missing values, don't parse too long strings
		// skip processing
	} else if (t.match(/^[0-9.,]+$/)) {
		resolved = t
	} else if (t.includes(":")) {
		resolved = t.split(":").map(s => s.padStart(2, "0")).join(":") // need to pad each to length 2 for npt
	} else if (t.match(/[hms]/)) {
		let buffer = ""
		let sum = 0
		const multipliers = new Map([
			["h", 60*60],
			["m", 60],
			["s", 1]
		])
		for (const char of t) {
			if (char.match(/[0-9]/)) {
				buffer += char
			} else if (char.match(/[hms]/)) {
				sum += +buffer * multipliers.get(char)
				buffer = ""
			} else {
				buffer = ""
			}
		}
		resolved = String(sum)
	}

	if (resolved) {
		return "#t=npt:" + resolved
	} else {
		return ""
	}
}

function viewCountToText(viewCount) {
	if (typeof viewCount !== "number") return null
	return viewCount.toLocaleString("en-US") + " views"
}

/**
 * YT does not give the exact count sometimes but a rounded value,
 * e.g. for the subscriber count.
 *
 * This function returns the text version of the rounded count.
 */
function preroundedCountToText(count) {
	for (const scale of [[1e9, "B"], [1e6, "M"], [1e3, "K"]]) {
		if (count >= scale[0]) {
			// YouTube returns 3 significant figures. At least it does for channels.
			const rounded = (count/+scale[0]).toPrecision(3)
			return `${rounded}${scale[1]}`
		}
	}
	return String(count)
}

function subscriberCountToText(count) {
	return preroundedCountToText(count) + " subscribers"
}

function applyVideoFilters(videos, filters) {
	const originalCount = videos.length
	for (const filter of filters) {
		if (filter.type === "channel-id") {
			videos = videos.filter(v => v.authorId !== filter.data)
		} else if (filter.type === "channel-name") {
			videos = videos.filter(v => v.author !== filter.data)
		} else if (filter.type === "title") {
			const matcher = new Matcher(filter.data)
			matcher.compilePattern()
			videos = videos.filter(v => !matcher.match(v.title))
		}
	}
	const filteredCount = originalCount - videos.length
	//TODO: actually display if things were filtered, and give the option to disable filters one time
	return {videos, filteredCount}
}

module.exports.timeToPastText = timeToPastText
module.exports.lengthSecondsToLengthText = lengthSecondsToLengthText
module.exports.normaliseVideoInfo = normaliseVideoInfo
module.exports.rewriteVideoDescription = rewriteVideoDescription
module.exports.tToMediaFragment = tToMediaFragment
module.exports.viewCountToText = viewCountToText
module.exports.subscriberCountToText = subscriberCountToText
module.exports.applyVideoFilters = applyVideoFilters
