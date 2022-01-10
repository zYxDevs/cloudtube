const Denque = require("denque")
/** @type {import("node-fetch").default} */
// @ts-ignore
const fetch = require("node-fetch")
const constants = require("../utils/constants")
const db = require("../utils/db")

const prepared = {
	video_insert: db.prepare(
		"INSERT OR IGNORE INTO Videos"
			+ " ( videoId,  title,  author,  authorId,  published,  viewCountText,  descriptionHtml)"
			+ " VALUES"
			+ " (@videoId, @title, @author, @authorId, @published, @viewCountText, @descriptionHtml)"
	),
	channel_refreshed_update: db.prepare(
		"UPDATE Channels SET refreshed = ? WHERE ucid = ?"
	),
	channel_mark_as_missing: db.prepare(
		"UPDATE Channels SET missing = 1, missing_reason = ? WHERE ucid = ?"
	)
}

class RefreshQueue {
	constructor() {
		this.set = new Set()
		this.queue = new Denque()
		this.lastLoadTime = 0
	}

	isEmpty() {
		return this.queue.isEmpty()
	}

	load() {
		// get the next set of scheduled channels to refresh
		const afterTime = Date.now() - constants.caching.seen_token_subscriptions_eligible
		const channels = db.prepare(
			"SELECT DISTINCT Subscriptions.ucid FROM SeenTokens INNER JOIN Subscriptions ON SeenTokens.token = Subscriptions.token INNER JOIN Channels ON Channels.ucid = Subscriptions.ucid WHERE Channels.missing = 0 AND SeenTokens.seen > ? ORDER BY SeenTokens.seen DESC"
		).pluck().all(afterTime)
		this.addLast(channels)
		this.lastLoadTime = Date.now()
	}

	addNext(items) {
		for (const i of items) {
			this.queue.unshift(i)
			this.set.add(i)
		}
	}

	addLast(items) {
		for (const i of items) {
			this.queue.push(i)
			this.set.add(i)
		}
	}

	next() {
		if (this.isEmpty()) {
			throw new Error("Cannot get next of empty refresh queue")
		}

		const item = this.queue.shift()
		this.set.delete(item)
		return item
	}
}

class Refresher {
	constructor() {
		this.sym = constants.symbols.refresher
		this.refreshQueue = new RefreshQueue()
		this.state = this.sym.ACTIVE
		this.waitingTimeout = null
		this.lastFakeNotFoundTime = 0
		this.next()
	}

	refreshChannel(ucid) {
		return fetch(`${constants.server_setup.local_instance_origin}/api/v1/channels/${ucid}/latest`).then(res => res.json()).then(/** @param {any} root */ root => {
			if (Array.isArray(root)) {
				root.forEach(video => {
					// organise
					video.descriptionHtml = video.descriptionHtml.replace(/<a /g, '<a tabindex="-1" ') // should be safe
					video.viewCountText = null //TODO?
					// store
					prepared.video_insert.run(video)
				})
				// update channel refreshed
				prepared.channel_refreshed_update.run(Date.now(), ucid)
				// console.log(`updated ${root.length} videos for channel ${ucid}`)
			} else if (root.identifier === "PUBLISHED_DATES_NOT_PROVIDED") {
				// nothing we can do. skip this iteration.
			} else if (root.identifier === "NOT_FOUND") {
				// YouTube sometimes returns not found for absolutely no reason.
				// There is no way to distinguish between a fake missing channel and a real missing channel without requesting the real endpoint.
				// These fake missing channels often happen in bursts, which is why there is a cooldown.
				const timeSinceLastFakeNotFound = Date.now() - this.lastFakeNotFoundTime
				if (timeSinceLastFakeNotFound >= constants.caching.subscriptions_refesh_fake_not_found_cooldown) {
					// We'll request the real endpoint to verify.
					fetch(`${constants.server_setup.local_instance_origin}/api/v1/channels/${ucid}`).then(res => res.json()).then(/** @param {any} root */ root => {
						if (root.error && (root.identifier === "NOT_FOUND" || root.identifier === "ACCOUNT_TERMINATED")) {
							// The channel is really gone, and we should mark it as missing for everyone.
							prepared.channel_mark_as_missing.run(root.error, ucid)
						} else {
							// The channel is not actually gone and YouTube is trolling us.
							this.lastFakeNotFoundTime = Date.now()
						}
					})
				} // else youtube is currently trolling us, skip this until later.
			} else {
				throw new Error(root.error)
			}
		})
	}

	next() {
		if (this.refreshQueue.isEmpty()) {
			const timeSinceLastLoop = Date.now() - this.refreshQueue.lastLoadTime
			if (timeSinceLastLoop < constants.caching.subscriptions_refresh_loop_min) {
				const timeToWait = constants.caching.subscriptions_refresh_loop_min - timeSinceLastLoop
				// console.log(`waiting ${timeToWait} before next loop`)
				this.state = this.sym.WAITING
				this.waitingTimeout = setTimeout(() => this.next(), timeToWait)
				return
			} else {
				this.refreshQueue.load()
			}
		}

		if (!this.refreshQueue.isEmpty()) {
			this.state = this.sym.ACTIVE
			const ucid = this.refreshQueue.next()
			this.refreshChannel(ucid).then(() => this.next()).catch(error => {
				// Problems related to fetching from the instance?
				// All we can do is retry later.
				// However, skip this channel this time in case the problem will occur every time.
				console.error("Error in background refresh:\n", error)
				setTimeout(() => {
					this.next()
				}, 10e3)
			})
		} else {
			this.state = this.sym.EMPTY
		}
	}

	skipWaiting() {
		if (this.state !== this.sym.ACTIVE) {
			clearTimeout(this.waitingTimeout)
			this.refreshQueue.lastLoadTime = 0
			this.next()
		}
	}
}

const refresher = new Refresher()

module.exports.refresher = refresher
