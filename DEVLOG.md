# Development Log

## 2026-08-18 — Book recommendation route: AI recs normalized through Google Books

**Context:** `app/books/recs/route.ts` needed to turn a theme into a list of real, displayable books, following the same "AI extracts a small structured signal, Google Books fills in the rest" shape already used by `app/books/identify`.

**What happened:** The route asks Claude Haiku for book recommendations constrained to a minimal Zod schema — just `title` and `author` — rather than the full `BookWithThemes` shape. That's deliberate: the model is bad at reliably producing full, accurate bibliographic metadata (covers, ISBNs, descriptions), but it's a fine source for "what books relate to this theme." Google Books is the source of truth for everything else. Each AI recommendation becomes a `intitle:/inauthor:` query against `@googleapis/books`, and we keep only the first hit — same "take the top match" normalization pattern as the existing `identifyBook` action. Recommendations Google Books can't find are silently dropped rather than surfaced as partial/broken entries.

**Ideas & decisions:**
- Split the AI's output schema (title/author) from the app's full book type (`GoogleBook`/`BookWithThemes`) on purpose — the AI schema is a query, not a record. Keeping it minimal makes the model's job easier and avoids inventing fake metadata.
- Reused `GoogleBook` from `app/books/identify/types.ts` instead of introducing a parallel type, since both routes are normalizing the same Google Books volume-info shape.
- Verified against live Anthropic + Google Books APIs (`theme=redemption` returned "The Shawshank Redemption" and "Les Misérables") rather than trusting types alone.

---

## 2026-08-25 — Visual redesign prototyped in p5.js (sketch2.js)

**Context:** The first display prototype (`display.tsx`) centered the whole experience on a single book — you searched for one, it appeared as a card, themes arced above it, and recs radiated outward. In practice this felt too narrow: you'd naturally want to explore across several books you love, not just one. We also found the interaction model confusing (double-click to navigate into a rec, no way to build up a personal list).

**What we explored:** A standalone p5.js sketch (`sketch/sketch2.js`) to try a completely different shape before touching the app. Key questions we wanted to answer visually:

- What if saved books lived in a persistent **arc dial** at the bottom, always visible, instead of being the "current" book?
- What if **Generate Themes pulled from all saved books together** (via `findCommonThemes`) rather than one at a time?
- How do we handle a graph that grows infinitely without becoming unreadable?
- How do we separate "save this book" from "select this book for an AI query" — two different intents that look similar?

**Decisions made through sketching:**

- **Frown-arc dial** (books sit on top of a large circle, center below the screen): gives a natural shelf feel without a straight list. Books tilt to follow the arc tangent. Click a book → it floats up to center screen as a flippable card.
- **Graph radiates from world origin, not a book**: themes spread in a fixed arc, rec nodes orbit around themes. No single anchor book. Clicking Generate Themes resets and rebuilds the graph from all saved books' shared themes.
- **Zoom & pan** as the answer to graph clutter: `translate + scale` world transform, zoom toward mouse cursor on scroll, drag to pan. Keeps the "discovery" feeling of an expanding tree without forcing auto-collapse.
- **Bookmark icon for save, +/− badge only in Select mode**: separates the two intents visually. The bookmark (top-right of a rec node, hover-only) saves to the dial. The +/− badge only appears when Select mode is active — so users never confuse "I'm saving this" with "I'm selecting this for a query."
- **No double-click navigation**: removed entirely. You don't "travel into" a rec book — you just keep expanding the tree from where you are. The dial is your library; the graph is your exploration space.
- **Rec node expansion uses the book's own themes**: clicking a rec node opens its themes (already attached from the API pipeline) as sub-theme nodes, which can then fetch their own rec books. The tree is infinite but never re-fetches data unnecessarily.

**Bugs found and fixed during sketching:**
- Dial invisible: circle center was above books (`cy = topY - DIAL_R`) instead of below them — fixed to `cy = topY + DIAL_R`
- Division by zero when only 1 book in dial: `DIAL_ARC_SPAN / (total - 1)` — guarded with `total > 1 ? ... : 0`
- Black rectangle on expanded card: `rectMode(CENTER)` from graph drawing persisted into the overlay rect — fixed with explicit `rectMode(CORNER)` before the dim overlay

**What's next:** Port sketch2.js into `display.tsx` once Turner adds three things to `page.tsx` (Generate Themes button, Select Mode toggle, handleAddSavedBook fix). See `HANDOFF.md`.

---
