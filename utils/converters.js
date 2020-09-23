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
	].reduce((acc, [unitName, unitValue]) => {
		if (acc) return acc
		if (difference > unitValue) {
			const number = Math.floor(difference / unitValue)
			const pluralUnit = unitName + (number == 1 ? "" : "s")
			return `${number} ${pluralUnit} ago`
		}
	}, null) || "just now"
}

module.exports.timeToPastText = timeToPastText
