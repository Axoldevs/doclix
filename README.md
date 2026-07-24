# DOCLIX

A collaborative documentation platform — Wikipedia's community-driven spirit
with GitBook's polished structure. Build game wikis, technical guides,
tutorials, and knowledge bases organized into ordered sections.

## Stack

- React 18 + TypeScript + Vite
- React Router
- Tailwind CSS + shadcn/ui-style primitives
- Lucide icons
- Supabase (auth + Postgres database)
- Cloudflare Pages (hosting) + Cloudflare Secrets (credential storage)
- `@dnd-kit` for drag-and-drop section reordering

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `supabase/schema.sql` from this repo — it
   creates the `projects` and `sections` tables with Row Level Security
   policies (public read, owner-only write).
3. Copy your project's **URL** and **anon public key** from
   Project Settings → API.

### 3. Configure environment variables locally

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the values from
step 2. This `.env` file is git-ignored and is only for local development.

### 4. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:5173`.

## Secrets management (production)

Per the project spec, credentials are never committed or stored in a
tracked `.env` file. In production they live in **Cloudflare Secrets**:

```bash
wrangler pages secret put SUPABASE_URL
wrangler pages secret put SUPABASE_ANON_KEY
```

At build time, wire these into Vite's expected `VITE_` prefixed variables in
your CI/deploy step, e.g.:

```bash
VITE_SUPABASE_URL="$SUPABASE_URL" VITE_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" npm run build
```

Cloudflare Pages' build environment variable settings (Pages dashboard →
Settings → Environment variables) can also map `SUPABASE_URL` /
`SUPABASE_ANON_KEY` secrets to `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
directly for the build step. Never log or expose these values, and never
hardcode them in source.

## Deploying to Cloudflare Pages

```bash
npm run build
wrangler pages deploy dist --project-name doclix
```

Or connect the repo in the Cloudflare dashboard for git-based deploys —
build command `npm run build`, output directory `dist`.

## Troubleshooting: "Expected a JavaScript module but got application/octet-stream"

This happens when the built `dist/` folder is served by something that
doesn't send the right `Content-Type` for `.js` files — it's a server
configuration issue, not an app bug. Common fixes:

- **Local preview**: don't serve `dist/` with a generic static server
  (e.g. `python -m http.server`, some `serve` configs, or a bare nginx
  block without a mime.types file). Use Vite's own preview server instead,
  which sets correct MIME types automatically:
  ```bash
  npm run build
  npm run preview
  ```
- **Cloudflare Pages**: this repo includes `public/_headers`, which Pages
  applies automatically at deploy time to force the correct
  `Content-Type` on `.js`/`.css`/`.svg` assets.
- **Other static hosts**: make sure the server's MIME type map includes
  `.js` → `application/javascript` (or `text/javascript`) and `.css` →
  `text/css`. Most modern static hosts (Netlify, Vercel, Cloudflare Pages,
  GitHub Pages) handle this correctly out of the box; only bare-bones or
  misconfigured servers hit this error.

A `404` on `/favicon.svg` is unrelated and harmless — it's just a missing
icon file; one is included in `public/favicon.svg` in this repo.

## Data model

- **projects**: title, description, unique slug, owner_id, timestamps.
- **sections**: belongs to a project, title, slug, markdown content,
  `position` (for ordering), timestamps.

Row Level Security enforces: anyone can *read* projects/sections; only the
owner (`auth.uid() = owner_id`) can create, update, delete their own
projects and sections.

## Features implemented

- Supabase email/password auth (sign up, sign in, sign out)
- Create unlimited documentation projects, each with unlimited sections
- GitBook-style layout: sidebar navigation, content area, prev/next footer
- Discord-style Markdown (bold, italic, underline, strikethrough, inline
  code, code blocks, headings, lists, blockquotes, links, horizontal rules)
  with real-time live preview (split/edit/preview modes)
- Drag-and-drop section reordering (owner only)
- Import section content from **.md or .txt file uploads**:
  - **New section dialog**: drag-and-drop or browse a file. If the file
    contains two or more top-level headings (a single `# Heading` line —
    `##`/`###` don't count), DOCLIX detects them and offers to **split the
    file into one section per heading**, previewing the detected titles
    before you confirm; any text before the first heading becomes a leading
    "Introduction" section. You can opt to keep the whole file as one
    section instead.
  - **Editor toolbar** (existing section): upload replaces that section's
    content with the whole file, without splitting.
  - `.txt` files are converted to markdown-safe text — special characters
    (`*`, `_`, `#`, `` ` ``, etc.) are escaped so plain text renders
    unchanged instead of being reinterpreted as formatting. `.md` files are
    imported as-is.
- Debounced auto-save with visible save status, plus undo/redo
  (Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z) and formatting shortcuts (Ctrl/Cmd+B/I/U)
- Client-side routing (`/docs/:projectSlug/:sectionSlug`) with no full-page
  reloads and working browser back/forward
- Responsive layout: collapsible sidebar on mobile
- Read-only public viewing; edit/delete/reorder gated to the project owner
- Loading, empty, and error states throughout

## Project structure

```
src/
  components/       # Sidebar, MarkdownEditor, dialogs, shared UI primitives
  components/ui/     # Button, Input, Textarea, Dialog, Label
  contexts/          # AuthContext, ToastContext
  hooks/             # useProjects, useProject, useSections, useAutoSave, useHistory
  lib/               # supabase client, markdown renderer, utils
  pages/             # DashboardPage, LoginPage, SignupPage, DocProjectPage, NotFoundPage
  types/             # Supabase database types
supabase/
  schema.sql         # Table definitions + RLS policies
```

## Out of scope (by design)

Search, tags/categories, comments, notifications, ratings, analytics, admin
dashboard, and premium/paywall features are intentionally excluded — this is
the core documentation engine only, ready to be extended later.
