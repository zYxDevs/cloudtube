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
	},
	// 4: Fixup stored instance settings
	function() {
		db.prepare("UPDATE Settings SET instance = REPLACE(REPLACE(instance, '/', ''), ':', '://') WHERE instance LIKE '%/'")
			.run()
	},
	// 5: Settings +quality
	function() {
		db.prepare("ALTER TABLE Settings ADD COLUMN quality INTEGER DEFAULT 0")
			.run()
	},
	// 6: +Filters
	function() {
		db.prepare("CREATE TABLE Filters (id INTEGER, token TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, label TEXT, PRIMARY KEY (id))")
			.run()
	},
	// 7: Settings +recommended_mode
	function() {
		db.prepare("ALTER TABLE Settings ADD COLUMN recommended_mode INTEGER DEFAULT 0")
			.run()
	},
	// 8: Subscriptions +channel_missing
	function() {
		db.prepare("ALTER TABLE Subscriptions ADD COLUMN channel_missing INTEGER DEFAULT 0")
			.run()
	},
	// 9: add index Videos (authorID)
	function() {
		db.prepare("CREATE INDEX Videos_authorID ON Videos (authorID)")
			.run()
	},
	// 10: +TakedownVideos, +TakedownChannels
	function() {
		db.prepare("CREATE TABLE TakedownVideos (id TEXT NOT NULL, org TEXT, url TEXT, PRIMARY KEY (id))")
			.run()
		db.prepare("CREATE TABLE TakedownChannels (ucid TEXT NOT NULL, org TEXT, url TEXT, PRIMARY KEY (ucid))")
			.run()
	},
	// 11: Settings +theme
	function() {
		db.prepare("ALTER TABLE Settings ADD COLUMN theme INTEGER DEFAULT 0")
			.run()
	},
	// 12: Channels +missing +missing_reason, Subscriptions -
	// Better management for missing channels
	// We totally discard the existing Subscriptions.channel_missing since it is unreliable.
	function() {
		db.prepare("ALTER TABLE Channels ADD COLUMN missing INTEGER NOT NULL DEFAULT 0")
			.run()
		db.prepare("ALTER TABLE Channels ADD COLUMN missing_reason TEXT")
			.run()
		// https://www.sqlite.org/lang_altertable.html#making_other_kinds_of_table_schema_changes
		db.transaction(() => {
			db.prepare("CREATE TABLE NEW_Subscriptions (token TEXT NOT NULL, ucid TEXT NOT NULL, PRIMARY KEY (token, ucid))")
				.run()
			db.prepare("INSERT INTO NEW_Subscriptions (token, ucid) SELECT token, ucid FROM Subscriptions")
				.run()
			db.prepare("DROP TABLE Subscriptions")
				.run()
			db.prepare("ALTER TABLE NEW_Subscriptions RENAME TO Subscriptions")
				.run()
		})()
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
 * @param {boolean} [log]
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
