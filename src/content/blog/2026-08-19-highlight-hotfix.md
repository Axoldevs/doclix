---
title: Highlight text, and a search snippet fix
date: 2026-08-19
summary: You can now highlight text in your docs with ==double equals==. Shipped alongside it — a fix for raw syntax leaking into search result previews.
---

Two small things today.

**Text highlighting is now supported.** Wrap any inline text in `==double equals==` and it renders as ==highlighted text== — a tinted background using your current theme colour, so it looks right in both light and dark mode. The toolbar has a new highlighter button sitting next to Strikethrough, and if you prefer the keyboard there's Ctrl+Shift+H. It works everywhere markdown renders: section content, blog posts, tables, inside boxes, inside columns.

**Hotfix: highlighted text was leaking `==` into search snippets.** When you search for something, Doclix strips markdown syntax from the surrounding text before showing you a preview snippet — so you see plain readable prose instead of raw `**bold**` or `## Heading`. The stripping list just didn't include `=`, meaning any content using the new highlight syntax would have shown up in search results with the raw `==` still visible. Fixed in the same release.

Nothing to update on your end — both changes are live now.
