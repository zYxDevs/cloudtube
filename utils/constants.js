const mixin = require("mixin-deep")

// Configuration is in the following block.

let constants = {
	// The default user settings. Should be self-explanatory.
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

	// Settings for the server to use internally.
	server_setup: {
		// The URL of the local NewLeaf instance, which is always used for subscription updates.
		local_instance_origin: "http://localhost:3000"
	},

	// ***                                                 ***
	// *** You shouldn't change anything below this point. ***
	// ***                                                 ***

	// Various caching timers.
	caching: {
		csrf_time: 4*60*60*1000,
		seen_token_subscriptions_eligible: 40*60*60*1000,
		subscriptions_refresh_loop_min: 5*60*1000,
	},

	// Pattern matching.
	regex: {
		ucid: "[A-Za-z0-9-_]+",
		video_id: "[A-Za-z0-9-_]{11,}"
	},

	// State symbols.
	symbols: {
		refresher: {
			ACTIVE: Symbol("ACTIVE"),
			WAITING: Symbol("WAITING"),
			EMPTY: Symbol("EMPTY")
		}
	}
}

try {
	const overrides = require("../config/config.js")
	constants = mixin(constants, overrides)
} catch (e) {
	console.log("Note: overrides file `config/config.js` ignored, file not found.")
}

module.exports = constants
