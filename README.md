# Book Recommender

A Next.js app that visualizes book recommendations as an interactive node graph.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Visuals

The `components/display.tsx` component is a p5.js sketch that renders an interactive canvas:

- **Book card** — shows cover image on the front, flips to show title, author, rating, description, and themes on the back
- **Theme nodes** — arc of clickable circles, one per theme on the current book. Click to expand.
- **Rec nodes** — 3 nodes radiate from each expanded theme node, showing related books. Double-click a rec node to navigate into that book.

The form in the footer submits a title → React state updates → the sketch receives the new book via `sketchRef`.

---

## AI Integration

Everything uses mock data in `lib/mock-data.ts`. There are two things to replace:

**1. `MOCK_BOOK`** — used in `app/page.tsx` when the user submits a title. Currently spreads mock fields onto whatever title was typed. Replace the `handleSubmit` logic with a real call to your `/api/book` route that returns a full `Book` object.

**2. `MOCK_REC_BOOKS`** — used in `display.tsx` to populate rec nodes when a theme is expanded. Replace `buildRecNodes` in `display.tsx` with a fetch to your `/api/recs` route, passing the current book + theme label.

### The data shape

Both routes need to return objects matching the `Book` type in `types/state.ts`:

```ts
{
  id: string
  title: string
  author: string | null
  description: string | null
  imageUrl: string | null
  rating?: number
  themes: string[]
}
```
