/**
 * Universal Tag Input: a pure DOM tag input.
 *
 * This library helps creating a very customizable tag input and it isn't
 * dependendt on any framework, so you can use it with jQuery, Vue etc.
 *
 * The library relies on "contenteditable" HTML attribute, that has been there
 * forever, and on MutationObserver, a class that has been released in mid of
 * 2012 in Firefox and has been added in 2013 to all other major browsers.
 *
 * See the examples for information on how to use the library.
 *
 * I, Pier Angelo Vendrame, am the only author of this library and I release it
 * in the public domain.
 */

'use strict'

/**
 * The constructor.
 *
 * \param target The div that will contain the tags
 * \param config The configuration of this input. Allows to set some callbacks
 * \param tags The tag to use to populate the input (optional)
 */
function UniversalTagInput(target, config, tags) {
	this.container = target
	this.tags = []
	this.monitoring = false

	// The default configuration
	this.config = {
		// The pattern to split tags (by default only comma and newline)
		pattern: /,+|\n+/,

		// A function to call when a tag is added
		added: function (tagName) {},

		// A function to call when a tag is removed
		removed: function (tagName) {},

		// The function called to show suggestions
		suggest: function (text) {},

		/* A function that will be called on enter pression, to let autocomplete
		add the tag (true: autocomplete will fill the tag, false: this class
		will fill it). */
		enterAutocomplete: function() {
			return false
		}
	}

	// Add user configuration to the default one
	if(typeof(config) == typeof({})) {
		for(var i in config) {
			this.config[i] = config[i]
		}
	}

	// Allow editing of the input
	target.setAttribute('contenteditable', 'true')

	// Copy the tag model. Note that we want only one
	var model = target.querySelector('[data-tag-model]')
	if(!model || !this._getPlaceholder(model)) {
		return false
	}

	// We know it's the model, so we don't need this attribute anymore
	model.removeAttribute('data-tag-model')
	// We don't want users to modify already added tags
	model.setAttribute('contenteditable', 'false')
	/* We set this attribute to distinguish what HTML elements we have created
	from elements that coulhd have been accidentaly created from others. */
	model.setAttribute('data-tag-managed', 'true')

	this.model = model.cloneNode(true)

	// Having found the model, we can clean the tag input
	target.innerHTML = ''

	// We need this variable to call methods from some callbacks
	var manager = this

	/* Compatibility issue: save some ancient versions of browsers.
	https://hacks.mozilla.org/2012/05/dom-mutationobserver-reacting-to-dom-changes-without-killing-browser-performance/ */
	var MutationObserver = window.MutationObserver ||
			window.WebKitMutationObserver || window.MozMutationObserver

	// The class that allows to being notified of every tag modification
	this.observer = new MutationObserver(function (mutations) {
		manager.handleMutation(mutations)
	})

	// We have to intercept enter and prevent it
	target.onkeydown = function(event) {
		return manager.keydown(event)
	}

	if(typeof(tags) == typeof([])) {
		this.add(tags)
	}

	// Finally we can start observing
	this.start()
}

/**
 * Start observing mutations.
 */
UniversalTagInput.prototype.start = function () {
	// The configuration of the observer
	var config = {
		// Compulsory attributes
		attributes: true,
		childList: true,
		characterData: true,

		// Needed to get char by char addition
		subtree: true,
	}

	this.observer.observe(this.container, config)
	this.monitoring = true
}

/**
 * Stop observing mutations.
 */
UniversalTagInput.prototype.stop = function () {
	this.observer.disconnect()
	this.monitoring = false
}

/**
 * Add a tag or some tags.
 *
 * \param tags An array of string or a string
 * \param trigger Should this function trigger the callback specified in config?
 */
UniversalTagInput.prototype.add = function (tags, trigger) {
	if(typeof(tags) == 'string') {
		tags = [tags]
	}

	if(typeof(tags) != typeof([])) {
		return false
	}

	if(trigger == undefined) {
		trigger = false
	}

	var running = this.monitoring
	if(running) {
		this.stop()
	}

	tags.forEach(function (tag) {
		this._addTag(tag, null, null, trigger)
	}, this)

	if(running) {
		this.start()
	}

	return true
}

/**
 * Delete a tag.
 *
 * \param tag The tag to remove
 * \param trigger Tell whether to call the callback specified in the config
 */
UniversalTagInput.prototype.delete = function(tag, trigger) {
	// Force a boolean
	trigger = !(!trigger)

	// Trigger the delete event only at the end of the deletion
	if(!this._deleteFromList(tag, false)) {
		return false
	}

	var running = this.monitoring
	if(running) {
		this.stop()
	}

	var tags = this.container.children
	for(var i = 0; i < tags.length; i++) {
		var textElem = this._getPlaceholder(tags[i])
		if(!textElem || textElem.textContent != tag) {
			continue
		}

		this.container.removeChild(tags[i])
		break
	}

	if(trigger) {
		this.config.removed(tag)
	}

	if(running) {
		this.start()
	}

	return true
}

/**
 * Clear the tag input.
 */
UniversalTagInput.prototype.clear = function (trigger) {
	var running = this.monitoring
	if(running) {
		this.stop()
	}

	this.container.innerHTML = ''

	if(trigger) {
		this.tags.forEach(function(tag) {
			/* Don't call directly the function because actually forEach pass
			other parameters, too. */
			this.config.removed(tag)
		}, this)
	}

	this.tags = []

	if(running) {
		this.start()
	}
}

/**
 * Allow completing a suggestion, i. e. change the current text with the one
 * that the suggestor gives.
 *
 * \note The function checks neither the tag that has been passed, nor the
 * current value of the field, so if there are commas or other separators, both
 * in the passed tag or in the field (which should not happen), they will be
 * ignored.
 *
 * \param tag The tag that will be added to the field
 * \param add Add the tag or simply write it in the filed? By default add it
 * \return true if the tag has been added, false if the tag already existed
 */
UniversalTagInput.prototype.completeSuggestion = function(tag, add) {
	if(add == undefined) {
		add = true
	}

	var sel = window.getSelection(),
		textElem = sel.anchorNode,
		ret = true

	this.stop()

	if(add) {
		ret = this._addTag(tag, textElem, true, true)
	} else {
		textElem.textContent = tag
	}

	/* If the suggestion has been called, it means that before the call of this
	function, the observer was running. */
	this.start()

	return ret
}

/**
 * Handle some mutations.
 *
 * \param mutations The mutations to handle
 */
UniversalTagInput.prototype.handleMutation = function (mutations) {
	mutations.forEach(function (element) {
		if(element.type == 'characterData' || element.type == 'childList') {
			this[element.type](element)
		}
	}, this)
}

/**
 * Handle the insertion of new characters in the tag field.
 *
 * \param mutation A single MutationRecord related to this insertion
 */
UniversalTagInput.prototype.characterData = function (mutation) {
	var sel = window.getSelection(),
		textElem = mutation.target
	/* We take the offset relatively to the end because it's likely that we'll
	remove the beginning of the text.
	We're taking granted that the selection is on the same element as the
	mutation. */
	var offset = textElem.textContent.length - sel.anchorOffset

	this._checkText(textElem, false)

	/* With the modification of the data, the caret position is reset to the
	beginning of the text element.
	This problem is actually observable only in special cases, such as paste,
	but for sake of completion and perfection, let's do it. */
	offset = textElem.data.length - offset

	var range = document.createRange()
	range.setStart(sel.anchorNode, offset)
	range.setEnd(sel.anchorNode, offset)

	sel.removeAllRanges()
	sel.addRange(range)

	if(textElem.textContent != '') {
		this.config.suggest(textElem.textContent.trim())
	}
}

/**
 * Handles the insertion and removal of children from the tag container.
 *
 * \param mutation A single MutationRecord related to this insertion
 */
UniversalTagInput.prototype.childList = function(mutation) {
	var removedList = Array.from(mutation.removedNodes)
	removedList.forEach(function (removed) {
		/* We don't care of this node, as we didn't create it, or text element
		(so it hasn't hasAttribute function) */
		if(!removed.hasAttribute || !removed.hasAttribute('data-tag-managed')) {
			return
		}

		var textContainer = this._getPlaceholder(removed)
		if(!textContainer) {
			return
		}

		var tag = textContainer.textContent
		this._deleteFromList(tag, true)
	}, this)

	var addedList = Array.from(mutation.addedNodes)
	addedList.forEach(function (added) {
		if(added.nodeType != Node.ELEMENT_NODE) {
			// We really care only about elements
			return
		}

		this.stop()

		if(added.hasAttribute('data-tag-managed')) {
			var textContainer = this._getPlaceholder(added)
			if(!textContainer ||
					this.tags.indexOf(textContainer.textContent) > -1) {
				this.container.removeChild(added)
			}

			var newTag = textContainer.textContent
			this.tags.push(newTag)
			this.config.added(newTag)
		} else if(added.previousSibling &&
				added.previousSibling.nodeType == Node.TEXT_NODE) {
			var text = added.previousSibling
			// If there's already a text node, merge the new text with it
			text.textContent += added.textContent
			this.container.removeChild(added)
			this._checkText(text, false)
		} else {
			var text = document.createTextNode(added.textContent)
			this.container.replaceChild(text, added)
			this._checkText(text, false)
		}

		this.start()
	}, this)
}

/**
 * A private function that helps finding the placeholder in the model.
 *
 * \private
 * \param elem The container of the single tag
 * \return The needed element
 */
UniversalTagInput.prototype._getPlaceholder = function (elem) {
	return elem.querySelector('[data-tag-placeholder]')
}

/**
 * Check on the text if there are tag to add.
 *
 * \private
 *
 * \param textElem The node to look tags in
 * \param forceLast Add last item, even though if there isn't a comma at the end
 */
UniversalTagInput.prototype._checkText = function (textElem, forceLast) {
	/* Suspend the observing, otherwise the modification we do will trigger it,
	thus generating an infinite loop. */
	this.stop()

	if(!textElem) {
		this.start()
		return
	}

	var tokens = textElem.textContent.split(this.config.pattern)
	tokens = tokens.filter(function(element, index, tokens) {
		/* Always keep the last element, to promptly response to commas: if we
		don't leave it, last tag isn't added until you start writing the next
		one. */
		return (element.trim() != '' || index == (tokens.length - 1))
	})

	// Just one token? Wait for it to be complete before doing anything
	if(tokens.length < 2 && !forceLast) {
		this.start()
		return
	}

	var forStop = tokens.length - 1

	if(forceLast) {
		forStop++
	}

	for(var i = 0; i < forStop; i++) {
		this._addTag(tokens[i], textElem, false)
	}

	if(!forceLast) {
		textElem.data = tokens[tokens.length - 1]
	}

	// Everything is done, we can observe again
	this.start()
}


/**
 * Transform a text node into a tag.
 *
 * \private
 *
 * \param tag The tag name
 * \param node The node to replace/insert before. If it isn't valid, a new node
 *             will be created
 * \param delete Delete the original node or insert the tag before?
 * \param trigger Trigger the callback specified in the configuration?
 * \return true if the tag has been created, false if the tag already existed
 */
UniversalTagInput.prototype._addTag = function(tag, node, del, trigger) {
	var newElem = this.model.cloneNode(true),
		placeholder = this._getPlaceholder(newElem),
		manager = this

	tag = tag.trim()

	if(this.tags.indexOf(tag) != -1 || tag == '') {
		return false
	}

	var delButton = newElem.querySelector('[data-tag-delete]')
	if(delButton) {
		delButton.onclick = function (event) {
			manager.container.removeChild(newElem)
			manager._deleteFromList(tag, true)
		}
	}

	placeholder.textContent = tag
	if(!node || !node.parentNode || node.parentNode != this.container) {
		this.container.appendChild(newElem)
	} else if(del) {
		this.container.replaceChild(newElem, node)
	} else {
		this.container.insertBefore(newElem, node)
	}

	this.tags.push(tag)

	if(trigger == undefined || trigger) {
		this.config.added(tag)
	}

	return true
}

/**
 * Remove a tag from the list.
 *
 * \private
 * \param tag The tag name
 * \param trigger Trigger the elimination
 * \return true if the tag was in the list and has been removed, false otherwise
 */
UniversalTagInput.prototype._deleteFromList = function (tag, trigger) {
	var index = this.tags.indexOf(tag)

	if(index < 0) {
		return false
	}

	this.tags.splice(index, 1)

	if(trigger) {
		this.config.removed(tag)
	}

	return true
}

/**
 * Intercept enter key and use it to confirm a new tag, instead of adding a new
 * line.
 *
 * \param event The object related to the keydown event
 * \return Should continue handling the event?
 */
UniversalTagInput.prototype.keydown = function (event) {
	// We want to handle only the enter key
	if(event.keyCode != 13) {
		return true
	}

	// Now that we know that it's enter, stop it
	event.preventDefault()

	if(this.config.enterAutocomplete()) {
		// The autocomplete handled this enter
		return false
	}

	var sel = window.getSelection()

	/* Enter without content: the selection will be associated to the container
	itself. */
	if(sel.anchorNode == this.container) {
		return false
	}

	this._checkText(sel.anchorNode, true)
	this.container.removeChild(sel.anchorNode)

	return false
}

/**
 * Get a copy of the array which contains all the tags.
 *
 * \return A copy of the tags array (can be modified without problems)
 */
UniversalTagInput.prototype.getTags = function() {
	return this.tags.slice()
}
