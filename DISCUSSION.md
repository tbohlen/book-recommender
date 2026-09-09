# Discussion

## Architecture

**Select mode should live in React, not p5**
Right now selected nodes (`n.selected`, `r.selected`) are tracked inside the p5 sketch closure and React never sees them. Selection is a user intent — it should live in React state. The sketch should call a callback like `onSelectionChange(books, themes)` to push selections up, and React owns the list. This unblocks the AI query flow.

**AI query endpoint needs to be built**
`POST /api/books/ai-query` doesn't exist yet. Body should be `{ books: selectedBooks, themes: selectedThemes, query: aiQuery }`. Once built, wire `handleGetRecs` in `page.tsx` to call it and populate the bottom panel.

**Bottom panel needs real book cards**
Currently a placeholder. Once the AI query endpoint exists, the panel should render a horizontal scrollable row of book cards (title, author, color swatch, + Save button) — same shape as the sketch2 bottom panel.

---

## Dial behavior

**Unsaving a book**
Clicking a bookmark twice toggles `r.saved` back to false locally, but the book stays in `savedBooks` forever — there's no `UNSAVE_BOOK` reducer action. Decisions needed:
- Should unsaving remove the book from the dial immediately?
- Should its rec nodes disappear from the graph too?

**Max books on arc**
Currently shows all saved books on the arc. If the library grows large, it gets crowded. Options: cap at a number, shrink covers as count grows, or paginate.

**Duplicate books**
Same book added twice (searching again, or a rec matching an already-saved book) silently overwrites. Should there be visible feedback?

---

## Graph behavior

**Dropped rec books are silent**
When Claude suggests books for a theme, each one gets looked up on Google Books. If Google can't find a match, that book is quietly skipped with no indication to the user. Should dropped books be surfaced somehow?

**Theme expansion errors are silent**
If a network error occurs while expanding a theme node, nothing shows. Should the node show an error state?

---

## Search

**Top result is auto-selected**
`identifyBook` takes the first Google Books result with no confirmation. Wrong editions slip through easily. Proposal: return top 3–5 candidates and show a picker before committing to the dial.

**Search input has no loading indicator**
When a book is being identified (slow API call), the input just sits there. No spinner, no feedback.
