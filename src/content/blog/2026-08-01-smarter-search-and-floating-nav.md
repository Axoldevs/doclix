---
title: Smarter search, floating navigation, and your own project icon
date: 2026-08-01
summary: Search results are now ranked instead of just matched, Previous/Next has a new floating design, and projects can finally look like themselves.
---

This release is mostly about the small things that add up to a docs site feeling like *yours* instead of a generic template — plus one long-overdue fix to search.

**Search actually ranks results now.** Until this update, search matched on title and content but returned whatever order the database happened to give back. Now every result is scored — an exact title match beats a title that merely starts with your query, which beats a word-boundary match, which beats a match buried somewhere in the body. Shorter, more specific titles get a small edge over long ones that happen to mention the same word once. The result is that the page you're actually looking for shows up first far more often. The search dropdown also got a visual pass: keyboard navigation with the arrow keys, a highlighted active row, and an Enter-to-open shortcut.

**Previous/Next is now a floating control.** The old footer bar sat pinned to the bottom of the page no matter how long the section was. It's been replaced with a small pill-shaped control that scrolls with your content and appears right after it — not a bar that follows you around. It's got the subtle hover animation you'd expect from a modern reading experience, and stays out of the way until you actually reach the end of a page.

**Your project, your identity.** Every documentation project now shows its own name as the main title in the header and sidebar — the DOCLIX name has moved to a small "Powered by DOCLIX" credit at the bottom of the section list, right where a platform credit belongs. And if you'd rather have your project's own logo instead of the default book icon, you can now upload one from Project Settings; it'll show up everywhere your project appears, from the sidebar to your dashboard card to search results.

Smaller polish went into spacing, transitions, and responsiveness across the board, including on mobile. As always, if something looks off, we want to hear about it.
