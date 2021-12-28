const fs = require("fs").promises

const names = ["subscriptions", "settings"]
const icons = names.map(name => fs.readFile(`html/static/images/${name}.svg`, "utf8"))

module.exports.icons = Promise.all(icons).then(resolvedIcons => {
	return new Map(names.map((name, index) => [name, resolvedIcons[index]]))
})
