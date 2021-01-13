const {request} = require("../utils/request")

let globalList = []

function execute() {
	return request("https://instances.invidio.us/instances.json?sort_by=health").then(res => res.json()).then(list => {
		list = list.filter(i => i[1].type === "https").map(i => i[1].uri)
		globalList = list
	}).catch(error => {
		console.error(error)
	})
}

function getInstances() {
	return globalList
}

execute()
setInterval(() => {
	execute()
}, 60*60*1000)

module.exports.getInstances = getInstances
