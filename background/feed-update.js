const Denque = require("denque")
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
	unsubscribe_all_from_channel: db.prepare(
		"DELETE FROM Subscriptions WHERE ucid = ?"
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
			"SELECT DISTINCT Subscriptions.ucid FROM SeenTokens INNER JOIN Subscriptions ON SeenTokens.token = Subscriptions.token AND SeenTokens.seen > ? ORDER BY SeenTokens.seen DESC"
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
		this.next()
	}

	refreshChannel(ucid) {
		return fetch(`${constants.server_setup.local_instance_origin}/api/v1/channels/${ucid}/latest`).then(res => res.json()).then(root => {
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
				console.log(`updated ${root.length} videos for channel ${ucid}`)
			} else if (root.identifier === "PUBLISHED_DATES_NOT_PROVIDED") {
				return [] // nothing we can do. skip this iteration.
			} else if (root.identifier === "NOT_FOUND") {
				// the channel does not exist. we should unsubscribe all users so we don't try again.
				console.log(`channel ${ucid} does not exist, unsubscribing all users`)
				prepared.unsubscribe_all_from_channel.run(ucid)
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
				console.log(`waiting ${timeToWait} before next loop`)
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
			this.refreshChannel(ucid).then(() => this.next())
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
