---
title: Editor Update: Dropdowns, Nested Blocks, and a Few Things Still Cooking
date: 2026-08-18
summary: We overhauled the editor's formatting engine — dropdowns, copyable code blocks, text highlighting, custom fonts, section markers, and properly working nested blocks no matter how deep you go. Plus an honest look at what's not ready yet, including a live-editable preview and document compression.
---

# A big editor update

We've been heads-down on the editor for the past little while, and there's a lot to show for it. This is probably the biggest jump in what you can actually *write* in Doclix since we launched.

## Dropdowns

You can now drop a collapsible section into your docs. Click the title, it opens. Click again, it closes. Good for FAQs, "advanced" sections you don't want cluttering the page, optional context — anything you want available but not shoved in someone's face by default.

## Named code blocks with a copy button

Code blocks can now have a name on them (like `server.ts` or `install.sh`) and a copy button in the corner, so people can grab the snippet without selecting text by hand. Small thing, but it's one of those details that makes docs feel finished.

## Highlighting and fonts

Two things people have been asking for:

- You can highlight text now, either with your own color or just the document's default accent.
- You can change the font of a run of text and switch back whenever you want. Handy if you want a heading, a code-style label, or a quote to stand out from the rest of the page.

## Section markers

There's now a way to explicitly mark a section, subsection, or subsubsection in a document, and it shows up as a clean little divider with a jump-to link. Makes long docs easier to navigate without doing anything fancy.

## Nesting, finally done properly

This one's more "under the hood" but it matters a lot if you build complex pages: you can now put blocks inside blocks inside blocks — a dropdown inside a box, columns inside that, code inside that — as deep as you want, and it all renders correctly. Before this, nesting only worked one level deep and would quietly mess up anything more complicated than that. Now it just works, no matter how deep you go.

## A few things we're still chewing on

Not everything made it in this round, and we'd rather tell you that than let you find out the hard way:

- **A proper searchable font picker.** Right now typing a font name gives you some suggestions, but it's not the polished dropdown experience we want yet.
- **Editing directly in the live preview.** Right now the preview is just a preview — you write on the left, see it render on the right. Making the right side directly editable (without breaking any boxes or complex content already there) is a bigger job we haven't tackled yet.
- **Compressing documents to save space.** We looked hard at this one. The honest answer is that doing it *properly* — without breaking search, the API, revision history, or anything else that reads your docs — is a bigger project than we want to rush, so we're holding off until we can do it right instead of half-right.

That's it for now. As always, if something in the editor feels off or missing, tell us — a lot of what's in this update came directly from things people asked for.