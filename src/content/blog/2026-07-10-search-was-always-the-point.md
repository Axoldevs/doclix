---
title: Search was always the point
date: 2026-07-10
summary: Why global search across every project and section shipped early, and how it stays fast without a separate search service.
---

Docs you can't find are worse than no docs at all. That's the whole reason global search shipped before most of the editing features people usually ask for first.

Search in DOCLIX runs directly against project titles, descriptions, section titles, and section content — no separate search index to keep in sync, no stale results. Every write is immediately searchable, because there's nothing standing between the database and the search bar.

Press ⌘K from anywhere in the app to try it. It's the same search that now sits on the homepage.
