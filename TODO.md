# TODO

Known follow-ups we've chosen to defer. Each item notes where the fix
belongs so it's easy to pick back up.

## Library deduplication follow-ups

### Graph rec nodes go stale relative to the library
`components/display.tsx` keeps its own copy of recommendation state that
never re-syncs with `useLibrary`:
- `ThemeNode.recBooks` caches a theme's recommendations on first fetch.
  If the user saves one of those books later (from search or another
  theme), it keeps showing as a recommendation under this theme, even
  though rule "saved books are removed from recommendations" says it
  shouldn't.
- `RecNode.saved` is a local flag set by clicking the bookmark. Unsaving
  the book from the dial doesn't clear it, and saving the same book under
  another theme doesn't set it.
- The themes appended to a repeat recommendation don't reach rec nodes
  built from an earlier fetch.

**Fix direction:** have the sketch derive saved state and visible rec
books from the library (e.g. pass `savedBooks` / a `bookKey` lookup via
`propsRef` and filter at draw time) instead of caching them on nodes.

### Skip theme extraction when saving a book already in the library
Saving a search result always runs `selectBook` (a Claude theme-extraction
call) before `ADD_SAVED_BOOK`. When the book is already in the library
(e.g. as a recommendation, possibly a different edition), the reducer
keeps the library's copy and the new themes are thrown away. The
`BookSearch` save handler should check `bookKey(book)` against the
library first and skip `selectBook` in that case. (The planned
`handleSave` in `docs/superpowers/plans/2026-09-20-book-search-results-picker.md`
is marked with this TODO.)

### Recommendation slots wasted on saved books (accepted for now)
Saved books are filtered out *after* Claude recommends them, so a
recommendation batch can come back smaller than requested. Could be fixed
by passing saved titles to the rec prompt as exclusions and deduping by
`bookKey` in `app/books/recs/route.ts`. Deliberately not doing this yet.
