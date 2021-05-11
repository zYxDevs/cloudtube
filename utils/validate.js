class V {
	constructor() {
		this.chain = []
		this.state = {}
		this.finished = false
		this.endValue = null
	}

	with(preset) {
		this.check(...preset)
		return this
	}

	check(conditionCallback, elseCallback) {
		this.chain.push(() => {
			if (!conditionCallback(this.state)) this._end(elseCallback(this.state))
		})
		return this
	}

	last(callback) {
		this.chain.push(() => {
			this._end(callback(this.state))
		})
		return this
	}

	go() {
		for (const s of this.chain) {
			s()
			if (this.finished) return this.endValue
		}
		return {
			statusCode: 500,
			contentType: "application/json",
			content: {
				error: "Reached end of V chain without response"
			}
		}
	}

	_end(value) {
		this.finished = true
		this.endValue = value
	}
}

function presetLoad(additions) {
	return [
		state => {
			Object.assign(state, additions)
			return true
		},
		null
	]
}

function presetURLParamsBody() {
	return [
		state => {
			try {
				state.params = new URLSearchParams(state.body.toString())
				return true
			} catch (e) {
				console.error(e)
				return false
			}
		},
		() => {
			return {
				statusCode: 400,
				contentType: "application/json",
				content: {
					error: "Could not parse body as URLSearchParams"
				}
			}
		}
	]
}

function presetEnsureParams(list) {
	return [
		state => {
			return list.every(name => state.params.has(name))
		},
		() => ({
			statusCode: 400,
			contentType: "application/json",
			content: {
				error: `Some required body parameters were missing. Required parameters: ${list.join(", ")}`
			}
		})
	]
}

module.exports.V = V
module.exports.presetLoad = presetLoad
module.exports.presetURLParamsBody = presetURLParamsBody
module.exports.presetEnsureParams = presetEnsureParams
