const constants = {
	user_settings: {
		instance: {
			type: "string",
			default: "https://invidious.snopyta.org"
		},
		save_history: {
			type: "boolean",
			default: false
		}
	},

	caching: {
		csrf_time: 4*60*60*1000
	},

	regex: {
		ucid: "[A-Za-z0-9-_]+",
		video_id: "[A-Za-z0-9-_]+"
	}
}

module.exports = constants
