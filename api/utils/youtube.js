const fetch = require("node-fetch")
const db = require("./db")

async function fetchChannel(ucid, instance) {
	if (!instance) throw new Error("No instance parameter provided")
	// fetch
	const channel = await fetch(`${instance}/api/v1/channels/${ucid}`).then(res => res.json())
	// update database
	const bestIcon = channel.authorThumbnails.slice(-1)[0]
	const iconURL = bestIcon ? bestIcon.url : null
	db.prepare("REPLACE INTO Channels (ucid, name, icon_url) VALUES (?, ?, ?)").run([channel.authorId, channel.author, iconURL])
	// return
	return channel
}

module.exports.fetchChannel = fetchChannel
