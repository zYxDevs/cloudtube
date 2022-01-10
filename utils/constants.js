const mixin = require("mixin-deep")

// Configuration is in the following block.

let constants = {
	// The default user settings. Should be self-explanatory.
	user_settings: {
		instance: {
			type: "string",
			default: "http://localhost:3000"
		},
		theme: {
			type: "integer",
			default: 0
		},
		save_history: {
			type: "boolean",
			default: false
		},
		local: {
			type: "boolean",
			default: false
		},
		quality: {
			type: "integer",
			default: 0
		},
		recommended_mode: {
			type: "integer",
			default: 0
		}
	},

	// Settings for the server to use internally.
	server_setup: {
		// The URL of the local NewLeaf instance, which is always used for subscription updates.
		local_instance_origin: "http://localhost:3000",
		// Whether users may filter videos by regular expressions. Unlike square patterns, regular expressions are _not_ bounded in complexity, so this can be used for denial of service attacks. Only enable if this is a private instance and you trust all the members.
		allow_regexp_filters: false,
		// Audio narration on the "can't think" page. `null` to disable narration, or a URL to enable with that audio file.
		cant_think_narration_url: null
	},

	// ***                                                 ***
	// *** You shouldn't change anything below this point. ***
	// ***                                                 ***

	// Various caching timers.
	caching: {
		csrf_time: 4*60*60*1000,
		seen_token_subscriptions_eligible: 40*60*60*1000,
		subscriptions_refresh_loop_min: 5*60*1000,
		subscriptions_refesh_fake_not_found_cooldown: 10*60*1000,
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
	console.error("Missing config file /config/config.js\nDocumentation: https://git.sr.ht/~cadence/tube-docs/tree/main/item/docs")
	process.exit(1)
}

module.exports = constants
