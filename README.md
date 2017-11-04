# Contenteditable pitfalls
This project was meant to be a "universal" pure-DOM tag input.

It has been developed following these principles:
* no dependencies should be required: no jQuery, no Angular, etc, so that one could use this tag with her/his favourite library;
* its user should have been able to customize completely its appearance without too much pain;
* the library must make easy adding some kind of autocomplete (though no one is provided, as a library and design independent autocomplete is harder to create).

I decided to use a div with `contenteditable="true"` property, since it's been available for ages (even IE 6, the plague of an era) and couple it with the `MutationObserver` class to handle the various modifications made to this div.

However I didn't do a crucial test: how browsers behave with a `contenteditable="true"` container and `contenteditable="false"` children, at least before writing the JS. I supposed other browser behaves as Chrome, and so I began writing the scripts.

Finally, I remembered to do a cross-browser test and I discovered that there are too discrepancies between renderings and especially between the behaviour of backspace:
* Chrome deletes a single tag (desidered behaviour)
* Firefox adds some white spaces (I still don't understand the sense of this thing, see `firefox_backspace.html`)
* Edge deletes all tags.

Eventually, I found another project that makes everything I needed, so I won't fix this script anymore, however I'm still publishing the code, because it took me quite a while to implement it and as a warning for other people who might have this idea.

## TL; DR
I began working on this a tag input based on contenteditable, but after some development I discovered this property has lots of problems.

So **don't use this project**, unless you're interested in Chrome only compatibility (and even in that case, some things need to be fixed...).
