const {Pinski} = require("pinski")
const {setInstance} = require("pinski/plugins")
const constants = require("./utils/constants")

;(async () => {
	await require("./utils/upgradedb")()

	const server = new Pinski({
		port: 10412,
		relativeRoot: __dirname,
		filesDir: "html"
	})

	setInstance(server)
	server.pugDefaultLocals.constants = constants

	server.muteLogsStartingWith("/vi/")
	server.muteLogsStartingWith("/favicon")
	server.muteLogsStartingWith("/static")

	server.addSassDir("sass", ["sass/includes"])
	server.addRoute("/static/css/main.css", "sass/main.sass", "sass")

	server.addPugDir("pug", ["pug/includes"])
	server.addPugDir("pug/errors")
	server.addRoute("/cant-think", "pug/cant-think.pug", "pug")
	server.addRoute("/privacy", "pug/privacy.pug", "pug")
	server.addRoute("/licenses", "pug/licenses.pug", "pug")

	server.addStaticHashTableDir("html/static/js")
	server.addStaticHashTableDir("html/static/js/elemjs")
	server.addStaticHashTableDir("html/static/images")
	server.addStaticHashTableDir("html/static/fonts")

	server.addAPIDir("api")

	server.startServer()

	require("./background/feed-update")
})()
