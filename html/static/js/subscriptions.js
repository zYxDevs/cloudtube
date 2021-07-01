import {qa} from "/static/js/elemjs/elemjs.js"
import {MarkWatchedButton} from "/static/js/modules/MarkWatchedButton.js"

for (const button of qa(".mark-watched__button")) {
	new MarkWatchedButton(button)
}
