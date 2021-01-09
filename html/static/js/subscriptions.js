import {qa} from "/static/js/elemjs/elemjs.js"
import {MarkWatchedButton} from "/static/js/mark-watched.js"

for (const button of qa(".mark-watched__button")) {
	new MarkWatchedButton(button)
}
