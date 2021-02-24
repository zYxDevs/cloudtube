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
 * Second and Invidious don't return quite the same data. This
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
			const rounded = (count/scale[0]).toPrecision(3)
			return `${rounded}${scale[1]}`
		}
	}
	return String(count)
}

function subscriberCountToText(count) {
	return preroundedCountToText(count) + " subscribers"
}

module.exports.timeToPastText = timeToPastText
module.exports.lengthSecondsToLengthText = lengthSecondsToLengthText
module.exports.normaliseVideoInfo = normaliseVideoInfo
module.exports.tToMediaFragment = tToMediaFragment
module.exports.viewCountToText = viewCountToText
module.exports.subscriberCountToText = subscriberCountToText
