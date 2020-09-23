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

const refreshQueue = new RefreshQueue()

function refreshChannel(ucid) {
	return fetch(`http://localhost:3000/api/v1/channels/${ucid}/latest`).then(res => res.json()).then(root => {
		if (Array.isArray(root)) {
			root.forEach(video => {
				// organise
				video.descriptionHtml = video.descriptionHtml.replace(/<a /g, '<a tabindex="-1" ') // should be safe
				video.viewCountText = null //TODO?
				// store
				prepared.video_insert.run(video)
			})
			console.log(`updated ${root.length} videos for channel ${ucid}`)
		} else if (root.identifier === "PUBLISHED_DATES_NOT_PROVIDED") {
			return [] // nothing we can do. skip this iteration.
		} else {
			throw new Error(root.error)
		}
	})
}

function refreshNext() {
	if (refreshQueue.isEmpty()) {
		const timeSinceLastLoop = Date.now() - refreshQueue.lastLoadTime
		if (timeSinceLastLoop < constants.caching.subscriptions_refresh_loop_min) {
			const timeToWait = constants.caching.subscriptions_refresh_loop_min - timeSinceLastLoop
			console.log(`waiting ${timeToWait} before next loop`)
			return setTimeout(refreshNext, timeToWait)
		} else {
			refreshQueue.load()
		}
	}

	const ucid = refreshQueue.next()
	refreshChannel(ucid).then(refreshNext)
}

refreshNext()
