# Development Log

## 2026-08-18 — Book recommendation route: AI recs normalized through Google Books

**Context:** `app/books/recs/route.ts` needed to turn a theme into a list of real, displayable books, following the same "AI extracts a small structured signal, Google Books fills in the rest" shape already used by `app/books/identify`.

**What happened:** The route asks Claude Haiku for book recommendations constrained to a minimal Zod schema — just `title` and `author` — rather than the full `BookWithThemes` shape. That's deliberate: the model is bad at reliably producing full, accurate bibliographic metadata (covers, ISBNs, descriptions), but it's a fine source for "what books relate to this theme." Google Books is the source of truth for everything else. Each AI recommendation becomes a `intitle:/inauthor:` query against `@googleapis/books`, and we keep only the first hit — same "take the top match" normalization pattern as the existing `identifyBook` action. Recommendations Google Books can't find are silently dropped rather than surfaced as partial/broken entries.

**Ideas & decisions:**
- Split the AI's output schema (title/author) from the app's full book type (`GoogleBook`/`BookWithThemes`) on purpose — the AI schema is a query, not a record. Keeping it minimal makes the model's job easier and avoids inventing fake metadata.
- Reused `GoogleBook` from `app/books/identify/types.ts` instead of introducing a parallel type, since both routes are normalizing the same Google Books volume-info shape.
- Verified against live Anthropic + Google Books APIs (`theme=redemption` returned "The Shawshank Redemption" and "Les Misérables") rather than trusting types alone.

---
