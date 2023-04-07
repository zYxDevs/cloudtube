const {request} = require("./request")
const db = require("./db")

async function fetchChannel(path, ucid, instance) {
	function updateGoodData(channel) {
		const bestIcon = channel.authorThumbnails.slice(-1)[0]
		const iconURL = bestIcon ? bestIcon.url : null
		db.prepare("REPLACE INTO Channels (ucid, name, icon_url, missing, missing_reason) VALUES (?, ?, ?, 0, NULL)").run(channel.authorId, channel.author, iconURL)
	}

	function updateBadData(channel) {
		if (channel.identifier === "NOT_FOUND" || channel.identifier === "ACCOUNT_TERMINATED") {
			db.prepare("UPDATE Channels SET missing = 1, missing_reason = ? WHERE ucid = ?").run(channel.error, channel.authorId)
			return {
				missing: true,
				message: channel.error
			}
		} else {
			return {
				missing: false,
				message: channel.error
			}
		}
	}

	if (!instance) throw new Error("No instance parameter provided")

	const row = db.prepare("SELECT * FROM Channels WHERE ucid = ?").get(ucid)
	// can branch on row.missing if needed, but account termination is not permanent,
	// so we need to fetch new data from the web either way...

	/** @type {any} */
	const channel = await request(`${instance}/api/v1/channels/${ucid}?second__path=${path}`).then(res => res.json())

	// handle the case where the just-fetched channel has an error
	if (channel.error) {
		const missingData = updateBadData(channel)
		return {
			error: true,
			ucid,
			row,
			...missingData
		}
	}

	// handle the case where the just-fetched channel does not have an error
	updateGoodData(channel)
	return channel
}

module.exports.fetchChannel = fetchChannel
