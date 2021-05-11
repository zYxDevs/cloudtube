const {Parser} = require("./parser")
const constants = require("./constants")

class PatternCompileError extends Error {
	constructor(position, message) {
		super(message)
		this.position = position
	}
}

class PatternRuntimeError extends Error {
}

class Matcher {
	constructor(pattern) {
		this.pattern = pattern
		this.compiled = null
		this.anchors = null
	}

	compilePattern() {
		// Calculate anchors (starts or ends with -- to allow more text)
		this.anchors = {start: true, end: true}
		if (this.pattern.startsWith("--")) {
			this.anchors.start = false
			this.pattern = this.pattern.slice(2)
		}
		if (this.pattern.endsWith("--")) {
			this.anchors.end = false
			this.pattern = this.pattern.slice(0, -2)
		}

		this.compiled = []

		// Check if the pattern is a regular expression, only if regexp filters are enabled by administrator
		if (this.pattern.match(/^\/.*\/$/) && constants.server_setup.allow_regexp_filters) {
			this.compiled.push({
				type: "regexp",
				expr: new RegExp(this.pattern.slice(1, -1), "i")
			})
			return // do not proceed to step-by-step
		}

		// Step-by-step pattern compilation
		const patternParser = new Parser(this.pattern.toLowerCase())

		while (patternParser.hasRemaining()) {
			if (patternParser.swallow("[") > 0) { // there is a special command
				let index = patternParser.seek("]")
				if (index === -1) {
					throw new PatternCompileError(patternParser.cursor, "Command is missing closing square bracket")
				}
				let command = patternParser.get({split: "]"})
				let args = command.split("|")
				if (args[0] === "digits") {
					this.compiled.push({type: "regexp", expr: /\d+/})
				} else if (args[0] === "choose") {
					this.compiled.push({type: "choose", choices: args.slice(1).sort((a, b) => (b.length - a.length))})
				} else {
					throw new PatternCompileError(patternParser.cursor - command.length - 1 + args[0].length, `Unknown command name: \`${args[0]}\``)
				}
			} else { // no special command
				let next = patternParser.get({split: "["})
				this.compiled.push({type: "text", text: next})
				if (patternParser.hasRemaining()) patternParser.cursor-- // rewind to before the [
			}
		}
	}

	match(string) {
		if (this.compiled === null) {
			throw new Error("Pattern was not compiled before matching. Compiling must be done explicitly.")
		}

		const stringParser = new Parser(string.toLowerCase())

		let flexibleStart = !this.anchors.start

		for (const fragment of this.compiled) {
			if (fragment.type === "text") {
				let index = stringParser.seek(fragment.text, {moveToMatch: true}) // index, and move to, start of match
				if (index === -1) return false
				if (index !== 0 && !flexibleStart) return false // allow matching anywhere if flexible start
				stringParser.cursor += fragment.text.length // move to end of match.
			}
			else if (fragment.type === "regexp") {
				const match = stringParser.remaining().match(fragment.expr)
				if (!match) return false
				if (match.index !== 0 && !flexibleStart) return false // allow matching anywhere if flexible start
				stringParser.cursor += match.index + match[0].length
			}
			else if (fragment.type === "choose") {
				const ok = fragment.choices.some(choice => {
					let index = stringParser.seek(choice)
					if (index === -1) return false // try next choice
					if (index !== 0 && !flexibleStart) return false // try next choice
					// otherwise, good enough for us! /shrug
					stringParser.cursor += index + choice.length
					return true
				})
				if (!ok) return false
			}
			else {
				throw new PatternRuntimeError(`Unknown fragment type ${fragment.type}`)
			}

			flexibleStart = false // all further sequences must be anchored to the end of the last one.
		}

		if (stringParser.hasRemaining() && this.anchors.end) {
			return false // pattern did not end when expected
		}

		return true
	}
}

module.exports.Matcher = Matcher
module.exports.PatternCompileError = PatternCompileError
module.exports.PatternRuntimeError = PatternRuntimeError
