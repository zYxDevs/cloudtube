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
}

module.exports.timeToPastText = timeToPastText
module.exports.lengthSecondsToLengthText = lengthSecondsToLengthText
module.exports.normaliseVideoInfo = normaliseVideoInfo
