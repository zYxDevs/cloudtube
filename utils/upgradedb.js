const pj = require("path").join
const db = require("./db")

const deltas = [
	// 0: from empty file, +DatabaseVersion, +Subscriptions
	function() {
		db.prepare("CREATE TABLE DatabaseVersion (version INTEGER NOT NULL, PRIMARY KEY (version))")
			.run()
		db.prepare("CREATE TABLE Subscriptions (token TEXT NOT NULL, ucid TEXT NOT NULL, PRIMARY KEY (token, ucid))")
			.run()
		db.prepare("CREATE TABLE Channels (ucid TEXT NOT NULL, name TEXT NOT NULL, icon_url TEXT, PRIMARY KEY (ucid))")
			.run()
		db.prepare("CREATE TABLE Videos (videoId TEXT NOT NULL, title TEXT NOT NULL, author TEXT, authorId TEXT NOT NULL, published INTEGER, publishedText TEXT, lengthText TEXT, viewCountText TEXT, descriptionHtml TEXT, PRIMARY KEY (videoId))")
			.run()
		db.prepare("CREATE TABLE CSRFTokens (token TEXT NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY (token))")
			.run()
		db.prepare("CREATE TABLE SeenTokens (token TEXT NOT NULL, seen INTEGER NOT NULL, PRIMARY KEY (token))")
			.run()
		db.prepare("CREATE TABLE Settings (token TEXT NOT NULL, instance TEXT, save_history INTEGER, PRIMARY KEY (token))")
			.run()
	},
	// 1: Channels +refreshed
	function() {
		db.prepare("ALTER TABLE Channels ADD COLUMN refreshed INTEGER")
			.run()
	},
	// 2: Settings +local
	function() {
		db.prepare("ALTER TABLE Settings ADD COLUMN local INTEGER DEFAULT 0")
			.run()
	},
	// 3: +WatchedVideos
	function() {
		db.prepare("CREATE TABLE WatchedVideos (token TEXT NOT NULL, videoID TEXT NOT NULL, PRIMARY KEY (token, videoID))")
			.run()
	}
]

async function createBackup(entry) {
	const filename = `db/backups/cloudtube.db.bak-v${entry-1}`
	process.stdout.write(`Backing up current to ${filename}... `)
	await db.backup(pj(__dirname, "../", filename))
	process.stdout.write("done.\n")
}

/**
 * @param {number} entry
 * @param {boolean} log
 */
function runDelta(entry, log) {
	process.stdout.write(`Upgrading database to version ${entry}... `)
	deltas[entry]()
	db.prepare("DELETE FROM DatabaseVersion").run()
	db.prepare("INSERT INTO DatabaseVersion (version) VALUES (?)").run(entry)
	process.stdout.write("done.\n")
}

module.exports = async function() {
	let currentVersion = -1
	const newVersion = deltas.length - 1

	try {
		currentVersion = db.prepare("SELECT version FROM DatabaseVersion").pluck().get()
	} catch (e) {} // if the table doesn't exist yet then we don't care

	if (currentVersion !== newVersion) {
		// go through the entire upgrade sequence
		for (let entry = currentVersion+1; entry <= newVersion; entry++) {
			// Back up current version
			if (entry > 0) await createBackup(entry)

			// Run delta
			runDelta(entry)
		}
	}
}
