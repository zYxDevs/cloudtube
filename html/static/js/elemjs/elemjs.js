/**
 * Shortcut for querySelector.
 * @template {HTMLElement} T
 * @returns {T}
 */
const q = s => document.querySelector(s);
/**
 * Shortcut for querySelectorAll.
 * @template {HTMLElement} T
 * @returns {T[]}
 */
const qa = s => document.querySelectorAll(s);

/**
 * An easier, chainable, object-oriented way to create and update elements
 * and children according to related data. Subclass ElemJS to create useful,
 * advanced data managers, or just use it inline to quickly make a custom element.
 */
class ElemJS {
	constructor(type) {
		if (type instanceof HTMLElement) {
			// If passed an existing element, bind to it
			this.bind(type);
		} else if (typeof type === "string") {
			// Otherwise, create a new detached element to bind to
			this.bind(document.createElement(type));
		} else {
			throw new Error("Cannot create an element of type ${type}")
		}
		this.children = [];
	}

	/** Bind this construct to an existing element on the page. */
	bind(element) {
		this.element = element;
		this.element.js = this;
		return this;
	}

	/** Add a class. */
	class() {
		for (let name of arguments) if (name) this.element.classList.add(name);
		return this;
	}

	/** Remove a class. */
	removeClass() {
		for (let name of arguments) if (name) this.element.classList.remove(name);
		return this;
	}

	/** Set a JS property on the element. */
	direct(name, value) {
		if (name) this.element[name] = value;
		return this;
	}

	/** Set an attribute on the element. */
	attribute(name, value) {
		if (name) this.element.setAttribute(name, value);
		return this;
	}

	/** Set a style on the element. */
	style(name, value) {
		if (name) this.element.style[name] = value;
		return this;
	}

	/** Set the element's ID. */
	id(name) {
		if (name) this.element.id = name;
		return this;
	}

	/** Attach a callback function to an event on the element. */
	on(name, callback) {
		this.element.addEventListener(name, callback);
		return this;
	}

	/** Set the element's text. */
	text(name) {
		this.element.innerText = name;
		return this;
	}

	/** Create a text node and add it to the element. */
	addText(name) {
		const node = document.createTextNode(name);
		this.element.appendChild(node);
		return this;
	}

	/** Set the element's HTML content. */
	html(name) {
		this.element.innerHTML = name;
		return this;
	}

	/**
	 * Add children to the element.
	 * Children can either be an instance of ElemJS, in
	 * which case the element will be appended as a child,
	 * or a string, in which case the string will be added as a text node.
	 * Each child should be a parameter to this method.
	 */
	child(...children) {
		for (const toAdd of children) {
			if (typeof toAdd === "object" && toAdd !== null) {
				// Should be an instance of ElemJS, so append as child
				toAdd.parent = this;
				this.element.appendChild(toAdd.element);
				this.children.push(toAdd);
			} else if (typeof toAdd === "string") {
				// Is a string, so add as text node
				this.addText(toAdd);
			}
		}
		return this;
	}

	/**
	 * Remove all children from the element.
	 */
	clearChildren() {
		this.children.length = 0;
		while (this.element.lastChild) this.element.removeChild(this.element.lastChild);
	}
}

/** Shortcut for `new ElemJS`. */
function ejs(tag) {
	return new ElemJS(tag);
}

export {q, qa, ElemJS, ejs};
