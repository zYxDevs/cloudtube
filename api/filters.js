const constants = require("../utils/constants")
const db = require("../utils/db")
const {render} = require("pinski/plugins")
const {getUser, getToken} = require("../utils/getuser")
const validate = require("../utils/validate")
const V = validate.V
const {Matcher, PatternCompileError} = require("../utils/matcher")

const filterMaxLength = 160
const regexpEnabledText = constants.server_setup.allow_regexp_filters ? "" : "not"

function getCategories(user) {
	const filters = user.getFilters()

	// Sort filters into categories for display. Titles are already sorted.
	const categories = {
		title: {name: "Title", filters: []},
		channel: {name: "Channel", filters: []}
	}
	for (const filter of filters) {
		if (filter.type === "title") {
			categories.title.filters.push(filter)
		} else { // filter.type is some kind of channel
			categories.channel.filters.push(filter)
		}
	}
	categories.channel.filters.sort((a, b) => {
		if (a.label && b.label) {
			if (a.label < b.label) return -1
			else if (a.label > b.label) return 1
		}
		return 0
	})

	return categories
}

module.exports = [
	{
		route: "/filters", methods: ["GET"], code: async ({req, url}) => {
			const user = getUser(req)
			const categories = getCategories(user)
			const settings = user.getSettingsOrDefaults()
			let referrer = url.searchParams.get("referrer") || null

			let type = null
			let contents = ""
			let label = null
			if (url.searchParams.has("title")) {
				type = "title"
				contents = url.searchParams.get("title")
			} else if (url.searchParams.has("channel-id")) {
				type = "channel-id"
				contents = url.searchParams.get("channel-id")
				label = url.searchParams.get("label")
			}

			return render(200, "pug/filters.pug", {req, settings, categories, type, contents, label, referrer, filterMaxLength, regexpEnabledText})
		}
	},
	{
		route: "/filters", methods: ["POST"], upload: true, code: async ({req, body}) => {
			return new V()
				.with(validate.presetLoad({body}))
				.with(validate.presetURLParamsBody())
				.with(validate.presetEnsureParams(["filter-type", "new-filter"]))
				.check(state => {
					// Extract fields
					state.type = state.params.get("filter-type")
					state.contents = state.params.get("new-filter").slice(0, filterMaxLength)
					state.label = state.params.get("label")
					if (state.label) {
						state.label = state.label.slice(0, filterMaxLength)
					} else {
						state.label = null
					}
					state.referrer = state.params.get("referrer")
					// Check type
					return ["title", "channel-name", "channel-id"].includes(state.type)
				}, () => ({
					statusCode: 400,
					contentType: "application/json",
					content: {
						error: "type parameter is not in the list of filter types."
					}
				}))
				.check(state => {
					// If title, check that pattern compiles
					if (state.type === "title") {
						try {
							const matcher = new Matcher(state.contents)
							matcher.compilePattern()
						} catch (e) {
							if (e instanceof PatternCompileError) {
								state.compileError = e
								return false
							}
							throw e
						}
					}
					return true
				}, state => {
					const {type, contents, label, compileError} = state
					const user = getUser(req)
					const categories = getCategories(user)
					const settings = user.getSettingsOrDefaults()
					return render(400, "pug/filters.pug", {req, settings, categories, type, contents, label, compileError, filterMaxLength, regexpEnabledText})
				})
				.last(state => {
					const {type, contents, label} = state
					const responseHeaders = {
						Location: state.referrer || "/filters"
					}
					const token = getToken(req, responseHeaders)

					db.prepare("INSERT INTO Filters (token, type, data, label) VALUES (?, ?, ?, ?)").run(token, type, contents, label)

					return {
						statusCode: 303,
						headers: responseHeaders,
						contentType: "text/html",
						content: "Redirecting..."
					}
				})
				.go()
			}
		},
		{
			route: "/filters/delete", methods: ["POST"], upload: true, code: async ({req, body}) => {
				return new V()
				.with(validate.presetLoad({body}))
				.with(validate.presetURLParamsBody())
				.with(validate.presetEnsureParams(["delete-id"]))
				.check(state => {
					state.deleteID = +state.params.get("delete-id")
					return !!state.deleteID
				}, () => ({
					statusCode: 400,
					contentType: "application/json",
					content: {
						error: "delete-id parameter must be a number"
					}
				}))
				.last(state => {
					const {deleteID} = state
					const token = getToken(req)

					// the IDs are unique, but can likely be guessed, so also use the token for actual authentication
					db.prepare("DELETE FROM Filters WHERE token = ? and id = ?").run(token, deleteID)

					return {
						statusCode: 303,
						headers: {
							Location: "/filters"
						},
						contentType: "text/html",
						content: "Redirecting..."
					}
				})
				.go()
		}
	}
]
