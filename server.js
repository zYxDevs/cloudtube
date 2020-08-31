const {Pinski} = require("pinski")
const {setInstance} = require("pinski/plugins")

;(async () => {
	await require("./api/utils/upgradedb")()

	const server = new Pinski({
		port: 10412,
		relativeRoot: __dirname,
		filesDir: "html"
	})

	setInstance(server)

	server.addSassDir("sass", ["sass/includes"])
	server.addRoute("/static/css/main.css", "sass/main.sass", "sass")

	server.addPugDir("pug", ["pug/includes"])
	server.addRoute("/", "pug/home.pug", "pug")

	server.addStaticHashTableDir("html/static/js")
	server.addStaticHashTableDir("html/static/js/elemjs")
	server.addStaticHashTableDir("html/static/images")
	server.addStaticHashTableDir("html/static/fonts")

	server.addAPIDir("api")

	server.startServer()

	require("./background/feed-update")
})()
