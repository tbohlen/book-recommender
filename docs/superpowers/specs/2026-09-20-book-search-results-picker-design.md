# Book Search Results Picker — Design

## Problem

`identifyBook` (`app/books/identify/actions.ts`) currently resolves a
free-text search to a single book by silently taking the first Google
Books API match. This is often wrong — the user has no way to see or
correct the match. We're replacing this with a search-results picker: the
user submits a search, sees up to 10 candidates, and explicitly picks
(saves) the one(s) they mean.

## Layout approach

A single search bar lives in a persistent header at the top of the page,
replacing the footer's current hidden search input. On submit, a shadcn
`Dialog` opens as a panel anchored directly below that header rather than
centered full-screen — the header sits above the dialog's dim overlay (via
z-index), so the query the user typed stays visible and editable the whole
time results are showing. Editing it (debounced) re-searches live and
updates the results below, inside the same dialog.

This one input is both "the search bar" and "the thing that refines the
open dialog" — there's no second, duplicate input inside the dialog to
keep in sync.

*Alternative considered and rejected:* a non-modal `Popover`/dropdown
instead of `Dialog`. Simpler primitive, no background dimming, but doesn't
match the "modal/dialog" requirement as literally, and loses the Radix
`Dialog`'s focus-trap and Esc-to-close for free.

## Components

New `components/book-search/` folder:

- **`BookSearch.tsx`** — container. Owns `query` and `dialogOpen` state;
  renders the header bar and the dialog. Replaces the footer's current
  hidden search input + submit button entirely (rendered from `page.tsx`
  in that spot).
- **`BookSearchBar.tsx`** — the visible `Input` + form. Submitting opens
  the dialog and fires the first (non-debounced) search.
- **`BookSearchDialog.tsx`** — shadcn `Dialog`, positioned as a panel below
  the header (custom overlay/content classes rather than the default
  centered layout). Renders loading / empty / error / results-list states.
  Has an X close control (in addition to the Dialog's built-in Esc /
  backdrop-click close).
- **`BookSearchResultItem.tsx`** — one result row: title, authors, cover
  (if available). Owns its own local save button state (idle / loading /
  success / error). Compares `book.id` against `savedBooks` (from
  `useLibrary`) to render a disabled "Saved" badge instead of an active
  Save button when the book is already in the library.
- **`hooks/useBookSearch.ts`** — debounced, abortable search against the
  new `/books/search` route. Owns `results`, `status`
  (`idle`/`loading`/`success`/`error`), `errorMessage`.

## Data flow & API changes

**New route — `app/books/search/route.ts`** (`GET /books/search?q=...`):
calls the Google Books API directly (`maxResults: 10`), returns up to 10
`IdentifiedBook[]` (raw `volumeInfo` + `id`). **No theme extraction** —
mirrors the existing `findFirstMatch` pattern in `app/books/recs/route.ts`,
returning the full list instead of just the first item.

**Save action** — a new server action, `selectBook(book: IdentifiedBook):
Promise<BookWithThemes>` (added to `app/books/identify/actions.ts`),
called directly from `BookSearchResultItem`'s Save button (server actions
are callable as plain async functions from client components, not only
via `useActionState`). It runs `extractThemes` on just the one chosen
book — no second Google Books call needed, since `/books/search` already
returned full `volumeInfo`. On success, the component calls
`handleAddSavedBook` (already exposed by `useLibrary`) with the result.

**Why defer theme extraction to save-time:** running `extractThemes`
(a Claude call) on all 10 results up front, on every keystroke-triggered
search, would be far too slow and costly. Deferring it to the single
book the user actually picks keeps the same one-Claude-call-per-saved-book
cost as today, just split into two steps (search, then save).

**Retiring the old flow** — `identifyBook`, `IdentifyBookState`, and their
`useActionState` wiring in `page.tsx` are removed. `BookSearch` fully
replaces that entry point; no dead code is left behind.

**State ownership for Save:** each `BookSearchResultItem` manages its own
local loading/success/error state for its click — no coordination needed
across items or lifting to the dialog. The "already saved" check is a
simple lookup against the `savedBooks` array already flowing through
`useLibrary`.

## Search-trigger rules

To avoid overwhelming the Google Books API:

- **Debounce 400ms** after the user stops typing before firing a search.
- **Minimum 3 characters** required before a search fires at all.
- **Skip firing if the trimmed query is unchanged** from the last query
  actually sent (e.g. typing then deleting a trailing space).
- **Abort any in-flight request immediately on every keystroke** (not just
  when the next debounced search actually fires) via `AbortController`, so
  a request that was already sent before the latest edit can't finish
  late and overwrite fresher results with stale ones.
- Also abort any in-flight request when the dialog closes.
- The initial submit-triggered search bypasses the debounce and fires
  immediately, since that's a deliberate, discrete user action.
- No client-side result caching for MVP (YAGNI) — debounce + the above
  already cut request volume substantially.

## Error & empty states

- No results → `No books found for "<query>". Try a different search.`
- Google Books API failure (search) → inline error text in the dialog;
  the user retries simply by continuing to edit the query (auto-retry via
  the existing re-search behavior), no separate retry button needed.
- Save failure (theme extraction or the action throwing) → error text on
  that specific result row; its Save button resets to a retryable state.

## Explicitly out of scope for this change

- The footer's other controls (Generate Themes, AI query input, Select
  mode) are untouched.
- No client-side caching of search results.
- Themes are not shown in the results list — they only appear after a
  book is saved, same as today.
