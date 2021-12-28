const {Pinski} = require("pinski")
const {setInstance} = require("pinski/plugins")
const constants = require("./utils/constants")
const iconLoader = require("./utils/icon-loader").icons

;(async () => {
	await require("./utils/upgradedb")()
	const icons = await iconLoader

	const server = new Pinski({
		port: 10412,
		relativeRoot: __dirname,
		filesDir: "html"
	})

	setInstance(server)
	server.pugDefaultLocals.constants = constants
	server.pugDefaultLocals.icons = icons

	server.muteLogsStartingWith("/vi/")
	server.muteLogsStartingWith("/favicon")
	server.muteLogsStartingWith("/static")

	server.addSassDir("sass", ["sass/includes", "sass/themes", "sass/theme-modules"])
	server.addRoute("/static/css/dark.css", "sass/dark.sass", "sass")
	server.addRoute("/static/css/light.css", "sass/light.sass", "sass")
	server.addRoute("/static/css/edgeless-light.css", "sass/edgeless-light.sass", "sass")

	server.addPugDir("pug", ["pug/includes"])
	server.addPugDir("pug/errors")

	server.addStaticHashTableDir("html/static/js")
	server.addStaticHashTableDir("html/static/js/elemjs")
	server.addStaticHashTableDir("html/static/images")
	server.addStaticHashTableDir("html/static/fonts")

	server.addAPIDir("api")

	server.startServer()

	require("./background/feed-update")
})()
