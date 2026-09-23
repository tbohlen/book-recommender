# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js (App Router) app that visualizes book recommendations as an interactive node graph. A user identifies a book, an AI extracts themes from it, and clicking a theme fetches AI-recommended books for that theme — all rendered on a p5.js canvas.

## Commands

```bash
npm run dev     # start dev server (localhost:3000)
npm run build   # production build
npm run lint    # eslint
```

There is no test suite configured in this repo yet.

Required env vars (see `.env.local.example`): `GOOGLE_API_KEY` (Google Books API), `ANTHROPIC_API_KEY` (Claude).

## Architecture: "AI extracts a small structured signal, Google Books fills in the rest"

This is the core pattern behind every AI integration in the app, and it's deliberate — Claude is good at judging relevance/themes but bad at reliably producing accurate bibliographic metadata (covers, ISBNs, descriptions), so it's never trusted for that. Google Books is always the source of truth for book records; AI output is only ever used as a search query or a tag.

Concretely:
- `app/books/identify/actions.ts` — server action (`identifyBook`, driven by `useActionState` from `app/page.tsx`) that takes free-text search input, resolves it to a real book via the Google Books API (top match only), then calls `extractThemes` to tag it.
- `app/books/recs/route.ts` (`POST /books/recs` with a JSON body of `{ theme?, books?, prompt? }`, at least one required) — asks Claude for a small structured list of `{title, author}` recommendations (schema in `types.ts`), then re-resolves each one against Google Books (`intitle:/inauthor:` query) and keeps only the first match. The system prompt used depends on the request shape: `rec-prompt.ts` for theme/books-only requests, `rec-from-prompt-prompt.ts` when a free-text `prompt` is provided (theme/books are folded in as supporting context, not the primary instruction). Recommendations Google Books can't find are silently dropped rather than surfaced as broken entries. Each surviving book is also run through theme extraction before being returned.
- `app/themes/extractThemes.ts` — two Claude calls, both constrained via `zodOutputFormat` structured outputs against `claude-haiku-4-5`:
  - `extractThemes(book)` — themes for one book (system prompt: `theme-prompt.ts`)
  - `findCommonThemes(books)` — the throughline across several books a user has liked (system prompt: `common-themes-prompt.ts`), exposed via `POST /themes` (not yet wired into the UI)
- All AI-recommendation/theme schemas are intentionally minimal (e.g. `recSchema` in `app/books/recs/types.ts` is just title+author) — the AI schema is a query, not a record. Don't expand these to carry more book metadata; that belongs in `GoogleBook`.

### Core types

- `GoogleBook` (`app/books/identify/types.ts`) — `NonNullable<books_v1.Schema$Volume["volumeInfo"]>`, i.e. whatever the `@googleapis/books` client returns. Treat this as the canonical book shape; don't invent a parallel one.
- `BookWithThemes` — `GoogleBook & { themes: string[] | null }`. This is what flows through the UI.
- `bookWithThemesSchema` (Zod) — a `looseObject` validator for `BookWithThemes` at the `/themes` request boundary. It only enumerates the `volumeInfo` fields the theme prompts actually read (title, authors, description, categories, publishedDate, publisher) rather than mirroring all of `GoogleBook`, since that type is generated from Google's API spec and has dozens of fields not worth hand-maintaining a schema for.

### UI / visualization

- `app/page.tsx` — the only page. Holds `identifyBook` action state and renders `Display` plus a search form in a fixed footer.
- `components/display.tsx` — a p5.js sketch mounted via `useEffect` (dynamic `import("p5")`, client-only). All canvas state (current book, theme node positions, expanded/loading state, fetched rec books) lives in closures inside the p5 sketch function, not in React state; React only pushes a new book in via `sketchRef.current.setBook(book)` in a `useEffect` keyed on `books[0]`. When modifying the graph interaction, this file is the single place to look — layout (`getLayout`), node building (`buildThemeNodes`/`buildRecNodes`), drawing, and mouse handling (`mousePressed`/`doubleClicked`) are all colocated there rather than split across components.
- Theme nodes arc above the book card; clicking one calls `fetchRecommendations` (`POST /books/recs`) and radiates rec nodes around it (cached on the node after first fetch). Double-clicking a rec node calls `setBook` to navigate into it — this does not go through `identifyBook`/Google Books again, it reuses the `BookWithThemes` already returned by the recs route.
- `lib/mock-data.ts` (`MOCK_BOOK`, `MOCK_REC_BOOKS`) is leftover from before the real API routes existed and is currently unused/dead — the README's description of it as a required scaffold to replace is stale.

### shadcn/ui

Components in `components/ui/` are shadcn (`style: base-vega`, base color `stone`, icons from `lucide-react`) — add more via the `shadcn` CLI rather than hand-rolling, and keep using the `@/*` path alias (see `components.json`).
