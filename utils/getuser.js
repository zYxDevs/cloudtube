const crypto = require("crypto")
const {parse: parseCookie} = require("cookie")
const constants = require("./constants")
const db = require("./db")

function getToken(req, responseHeaders) {
	if (!req.headers.cookie) req.headers.cookie = ""
	const cookie = parseCookie(req.headers.cookie)
	let token = cookie.token
	if (!token) {
		if (responseHeaders) { // we should create a token
			token = setToken(responseHeaders).token
		} else {
			return null
		}
	}
	db.prepare(
		"INSERT INTO SeenTokens (token, seen) VALUES (?, ?)"
			+ " ON CONFLICT (token) DO UPDATE SET seen = excluded.seen"
	).run([token, Date.now()])
	return token
}

function setToken(responseHeaders, token) {
	const setCookie = responseHeaders["set-cookie"] || []
	if (!token) token = crypto.randomBytes(18).toString("base64").replace(/\W/g, "_")
	setCookie.push(`token=${token}; Path=/; Max-Age=2147483647; HttpOnly; SameSite=Lax`)
	responseHeaders["set-cookie"] = setCookie
	return {token, responseHeaders}
}

class User {
	constructor(token) {
		this.token = token
	}

	/** @return {{instance?: string, save_history?: boolean, local?: boolean, quality?: number}} */
	getSettings() {
		if (this.token) {
			return db.prepare("SELECT * FROM Settings WHERE token = ?").get(this.token) || {}
		} else {
			return {}
		}
	}

	/** @return {{instance?: string, save_history?: boolean, local?: boolean, quality?: number}} */
	getSettingsOrDefaults() {
		const settings = this.getSettings()
		for (const key of Object.keys(constants.user_settings)) {
			if (settings[key] == null) settings[key] = constants.user_settings[key].default
		}
		return settings
	}

	getSubscriptions() {
		if (this.token) {
			return db.prepare("SELECT ucid FROM Subscriptions WHERE token = ?").pluck().all(this.token)
		} else {
			return []
		}
	}

	isSubscribed(ucid) {
		if (this.token) {
			return !!db.prepare("SELECT * FROM Subscriptions WHERE token = ? AND ucid = ?").get([this.token, ucid])
		} else {
			return false
		}
	}

	getWatchedVideos() {
		const settings = this.getSettingsOrDefaults()
		if (this.token && settings.save_history) {
			return db.prepare("SELECT videoID FROM WatchedVideos WHERE token = ?").pluck().all(this.token)
		} else {
			return []
		}
	}

	addWatchedVideoMaybe(videoID) {
		const settings = this.getSettingsOrDefaults()
		if (videoID && this.token && settings.save_history) {
			db.prepare("INSERT OR IGNORE INTO WatchedVideos (token, videoID) VALUES (?, ?)").run([this.token, videoID])
		}
	}

	getFilters() {
		if (this.token) {
			return db.prepare("SELECT * FROM Filters WHERE token = ? ORDER BY data ASC").all(this.token)
		} else {
			return []
		}
	}
}

/**
 * @param {any} [responseHeaders] supply this to create a token
 */
function getUser(req, responseHeaders) {
	const token = getToken(req, responseHeaders)
	return new User(token)
}

function generateCSRF() {
	const token = crypto.randomBytes(16).toString("hex")
	const expires = Date.now() + constants.caching.csrf_time
	db.prepare("INSERT INTO CSRFTokens (token, expires) VALUES (?, ?)").run(token, expires)
	return token
}

function checkCSRF(token) {
	const row = db.prepare("SELECT * FROM CSRFTokens WHERE token = ? AND expires > ?").get(token, Date.now())
	if (row) {
		db.prepare("DELETE FROM CSRFTokens WHERE token = ?").run(token)
		return true
	} else {
		return false
	}
}

function cleanCSRF() {
	db.prepare("DELETE FROM CSRFTokens WHERE expires <= ?").run(Date.now())
}
cleanCSRF()
setInterval(cleanCSRF, constants.caching.csrf_time).unref()

module.exports.getToken = getToken
module.exports.setToken = setToken
module.exports.generateCSRF = generateCSRF
module.exports.checkCSRF = checkCSRF
module.exports.getUser = getUser
