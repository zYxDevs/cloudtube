const crypto = require("crypto")
const {parse: parseCookie} = require("cookie")

const constants = require("./constants")
const db = require("./db")

function getToken(req, responseHeaders) {
	if (!req.headers.cookie) req.headers.cookie = ""
	const cookie = parseCookie(req.headers.cookie)
	const token = cookie.token
	if (token) return token
	if (responseHeaders) { // we should create a token
		const setCookie = responseHeaders["set-cookie"] || []
		const token = crypto.randomBytes(18).toString("base64").replace(/\W/g, "_")
		setCookie.push(`token=${token}; Path=/; Max-Age=2147483648; HttpOnly; SameSite=Lax`)
		responseHeaders["set-cookie"] = setCookie
		return token
	}
	return null
}

class User {
	constructor(token) {
		this.token = token
	}

	getSubscriptions() {
		if (this.token) {
			return db.prepare("SELECT ucid FROM Subscriptions WHERE token = ?").pluck().all(ucid)
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
}

/**
 * @param {any} responseHeaders supply this to create a token
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
module.exports.generateCSRF = generateCSRF
module.exports.checkCSRF = checkCSRF
module.exports.getUser = getUser
