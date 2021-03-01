const {request} = require("../utils/request")

class InstancesList {
	constructor() {
		this.list = []
		this.inflight = null
		this.update()
		setInterval(() => {
			this.update()
		}, 60*60*1000)
	}

	/**
	 * Updates the list. Returns a promise of the new list. Called
	 * automatically.
	 */
	update() {
		return this.inflight = request("https://api.invidious.io/instances.json?sort_by=health").then(res => res.json()).then(list => {
			list = list.filter(i => i[1].type === "https").map(i => i[1].uri.replace(/\/+$/, ""))
			this.list = list
			this.inflight = null
			return this.list
		})
	}

	/**
	 * Return a promise of the list. If updates are in progress, wait
	 * for them.
	 */
	fetch() {
		if (this.inflight) return this.inflight
		else return Promise.resolve(this.list)
	}

	/**
	 * Return the current list, no matter whether it's been updated at all.
	 */
	get() {
		return this.list
	}
}

const instancesList = new InstancesList()

module.exports.instancesList = instancesList
