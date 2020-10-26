const constants = {
	user_settings: {
		instance: {
			type: "string",
			default: "https://second.cadence.moe"
		},
		save_history: {
			type: "boolean",
			default: false
		},
		local: {
			type: "boolean",
			default: false
		}
	},

	caching: {
		csrf_time: 4*60*60*1000,
		seen_token_subscriptions_eligible: 40*60*60*1000,
		subscriptions_refresh_loop_min: 5*60*1000,
	},

	regex: {
		ucid: "[A-Za-z0-9-_]+",
		video_id: "[A-Za-z0-9-_]+"
	},

	symbols: {
		refresher: {
			ACTIVE: Symbol("ACTIVE"),
			WAITING: Symbol("WAITING"),
			EMPTY: Symbol("EMPTY")
		}
	}
}

module.exports = constants
