# Book Search Results Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `identifyBook`'s silent "take the first Google Books match" behavior with an explicit search-results dialog, so the user picks the right book from up to 10 candidates instead of trusting an automatic guess.

**Architecture:** A persistent search bar sits at the top of the page. Submitting it opens a `Dialog` anchored just below the bar (the bar stays above the dialog's overlay via z-index, so the query stays visible/editable). Editing the query while the dialog is open triggers a debounced, abortable re-search against a new `/books/search` route (raw Google Books data, no theme extraction). Each result has its own Save button; saving calls a new `selectBook` server action that runs Claude theme-extraction for just that one book, then adds it to the library.

**Tech Stack:** Next.js App Router, React 19, TypeScript (strict), shadcn/ui (`base-vega` style, `@base-ui/react` primitives), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-20-book-search-results-picker-design.md`

---

## Verification approach for this plan

This repo has no automated test framework, and the team wants to keep this build simple — no test infrastructure is being introduced for this feature. Instead, each task is verified with quick, concrete checks anyone can run without special tooling: TypeScript's `tsc --noEmit` (catches wiring/type mistakes immediately), `curl` against the dev server for the one plain HTTP endpoint, and — for the feature as a whole, once everything is wired together in Task 9 — a manual click-through in the browser. This mirrors how the rest of this codebase is verified today.

---

### Task 1: `/books/search` API route

**Files:**
- Create: `app/books/search/route.ts`

- [ ] **Step 1: Write the route**

> Mirrors the existing pattern in `app/books/recs/route.ts` (same `books("v1")` client, same try/catch-around-the-API-call shape), but returns a list of up to 10 raw results instead of resolving one AI recommendation. No theme extraction here — that's deferred to `selectBook` (Task 2), which only runs for the one book the user actually picks.

Create `app/books/search/route.ts`:
```ts
import { books } from "@googleapis/books";
import { NextResponse } from "next/server";
import { IdentifiedBook } from "../identify/types";

const booksApi = books("v1");

const MAX_RESULTS = 10;

/**
 * API route that searches the Google Books API for a free-text query and
 * returns the top matches, unmodified by AI (no theme extraction), so the
 * caller can let the user pick the right one before it's saved.
 *
 * @param req - The incoming request; must include a `q` search param.
 * @returns JSON array of up to `MAX_RESULTS` `IdentifiedBook` (Google
 *   Books volume info plus id), a 400 if `q` is missing, or a 502 if the
 *   Google Books API call fails.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json(
      { error: "Missing required 'q' query parameter." },
      { status: 400 },
    );
  }

  try {
    const res = await booksApi.volumes.list({
      q,
      maxResults: MAX_RESULTS,
      key: process.env.GOOGLE_API_KEY,
    });

    const books: IdentifiedBook[] = (res.data.items ?? [])
      .filter((item) => !!item.volumeInfo && !!item.id)
      .map((item) => ({ ...item.volumeInfo, id: item.id! }));

    return NextResponse.json(books);
  } catch (error) {
    console.error("Error searching Google Books API:", error);
    return NextResponse.json(
      { error: "Failed to search Google Books." },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify it works against the real API**

Run (in one terminal): `npm run dev`

In another terminal:
```bash
curl "http://localhost:3000/books/search?q=dune"
curl "http://localhost:3000/books/search"
```
Expected: the first command returns a JSON array of up to 10 books (each with `id`, `title`, etc.); the second returns `{"error":"Missing required 'q' query parameter."}` with a 400 status (add `-i` to `curl` to see the status code). Requires `GOOGLE_API_KEY` set in `.env.local` (see `.env.local.example`).

- [ ] **Step 4: Commit**

```bash
git add app/books/search/route.ts
git commit -m "feat: add /books/search route for raw Google Books results"
```

---

### Task 2: `selectBook` action; retire `identifyBook`

**Files:**
- Modify: `app/books/identify/actions.ts`
- Modify: `app/books/identify/types.ts`

- [ ] **Step 1: Replace `identifyBook` with `selectBook`**

> The old free-text-search-and-guess flow is fully retired in favor of `BookSearch` (built in later tasks), so `identifyBook` and the Google Books client it owned are removed rather than kept alongside the new action. `selectBook` only runs Claude's theme extraction — no Google Books call — since the caller already has full book data from `/books/search`. It throws on failure (rather than returning an error object) so the caller can catch it and show a per-row retryable error state.

Replace the entire contents of `app/books/identify/actions.ts`:
```ts
"use server";
import { IdentifiedBook, BookWithThemes } from "./types";
import { extractThemes } from "../../themes/extractThemes";

/**
 * Server action that extracts themes for a single book the user picked
 * from search results, so it's ready to be saved to the library.
 *
 * Only runs Claude's theme extraction — no Google Books lookup — since
 * the caller already has full book data from `/books/search`.
 *
 * @param book - The Google Books result the user chose to save.
 * @returns The book with its extracted themes attached.
 * @throws {Error} If theme extraction fails.
 */
export async function selectBook(
  book: IdentifiedBook,
): Promise<BookWithThemes> {
  const themes = await extractThemes(book);
  return { ...book, themes };
}
```

- [ ] **Step 2: Remove the now-unused `IdentifyBookState` type**

In `app/books/identify/types.ts`, delete this block (it was only used by the removed `useActionState` wiring):
```ts
export interface IdentifyBookState {
  status: "idle" | "success" | "error";
  books: BookWithThemes[];
  errorMessage: string | null;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `app/page.tsx` (it still imports `identifyBook`/`IdentifyBookState`) — this is expected and gets fixed in Task 9. Confirm there are no *other* errors.

- [ ] **Step 4: Commit**

```bash
git add app/books/identify/actions.ts app/books/identify/types.ts
git commit -m "refactor: replace identifyBook with selectBook action"
```

---

### Task 3: `useBookSearch` hook

**Files:**
- Create: `hooks/useBookSearch.ts`

- [ ] **Step 1: Write the hook**

> `search` (debounced, called on every keystroke while the results dialog is open) and `searchImmediate` (called on submit) share `runSearch`. Both abort any in-flight request up front — that's what guarantees a stale response from an earlier keystroke can never overwrite a fresher one. `search` additionally debounces via a ref-held timeout and skips firing if the query is too short or unchanged from the last one actually sent; `searchImmediate` only checks the length, since a deliberate submit should always run. See the design spec's "Search-trigger rules" for the full reasoning.

Create `hooks/useBookSearch.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { IdentifiedBook } from "@/app/books/identify/types";

export type BookSearchStatus = "idle" | "loading" | "success" | "error";

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

export interface UseBookSearchReturn {
  results: IdentifiedBook[];
  status: BookSearchStatus;
  errorMessage: string | null;
  /** Debounced search — call on every keystroke while editing. */
  search: (query: string) => void;
  /** Immediate (non-debounced) search — call on explicit submit. */
  searchImmediate: (query: string) => void;
  /** Aborts any in-flight/pending search, e.g. on dialog close. */
  cancel: () => void;
}

/**
 * Debounced, abortable search against `/books/search`. See
 * docs/superpowers/specs/2026-09-20-book-search-results-picker-design.md
 * ("Search-trigger rules") for the rules this implements.
 */
export function useBookSearch(): UseBookSearchReturn {
  const [results, setResults] = useState<IdentifiedBook[]>([]);
  const [status, setStatus] = useState<BookSearchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const abortInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const runSearch = useCallback(async (query: string) => {
    abortInFlight();
    const controller = new AbortController();
    abortRef.current = controller;
    lastQueryRef.current = query;
    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch(`/books/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Search failed.");
      const books: IdentifiedBook[] = await res.json();
      setResults(books);
      setStatus("success");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setStatus("error");
      setErrorMessage("Failed to search for books. Try again.");
    }
  }, [abortInFlight]);

  const search = useCallback(
    (query: string) => {
      abortInFlight();
      clearPendingTimeout();

      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setStatus("idle");
        setResults([]);
        lastQueryRef.current = null;
        return;
      }
      if (trimmed === lastQueryRef.current) return;

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        runSearch(trimmed);
      }, DEBOUNCE_MS);
    },
    [abortInFlight, clearPendingTimeout, runSearch],
  );

  const searchImmediate = useCallback(
    (query: string) => {
      abortInFlight();
      clearPendingTimeout();

      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setStatus("idle");
        setResults([]);
        lastQueryRef.current = null;
        return;
      }
      runSearch(trimmed);
    },
    [abortInFlight, clearPendingTimeout, runSearch],
  );

  const cancel = useCallback(() => {
    abortInFlight();
    clearPendingTimeout();
  }, [abortInFlight, clearPendingTimeout]);

  useEffect(() => cancel, [cancel]);

  return { results, status, errorMessage, search, searchImmediate, cancel };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors as Task 2, no new errors. This hook will be exercised end-to-end by the manual browser walkthrough in Task 9.

- [ ] **Step 3: Commit**

```bash
git add hooks/useBookSearch.ts
git commit -m "feat: add useBookSearch debounced search hook"
```

---

### Task 4: Add the shadcn `dialog` component

**Files:**
- Create: `components/ui/dialog.tsx` (generated by shadcn CLI)

- [ ] **Step 1: Run the shadcn CLI**

Run:
```bash
npx shadcn@latest add dialog --yes
```
Expected: `components/ui/dialog.tsx` is created, exporting `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`. It's built on `@base-ui/react/dialog` (matches this repo's `base-vega` shadcn style, same as the existing `Button`). It also includes a built-in close (X) button in the top-right of `DialogContent` by default.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors (pre-existing `app/page.tsx` errors from Task 2 are still expected until Task 9).

- [ ] **Step 3: Commit**

```bash
git add components/ui/dialog.tsx package.json package-lock.json
git commit -m "chore: add shadcn dialog component"
```

---

### Task 5: `BookSearchResultItem` component

**Files:**
- Create: `components/book-search/BookSearchResultItem.tsx`

- [ ] **Step 1: Write the component**

> Per the design spec, the "success state" after saving is represented by the `isSaved` prop flipping true (driven by the parent's `savedBooks` list updating once the save completes), not by a separate local success flag — so this component only needs local state for its own click's transient `loading`/`error` states.

Create `components/book-search/BookSearchResultItem.tsx`:
```tsx
"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { IdentifiedBook } from "@/app/books/identify/types";

type SaveStatus = "idle" | "loading" | "error";

interface BookSearchResultItemProps {
  book: IdentifiedBook;
  isSaved: boolean;
  onSave: (book: IdentifiedBook) => Promise<void>;
}

/**
 * One row in the search results dialog. Owns only its own transient
 * loading/error state — once `onSave` succeeds, the parent's saved-books
 * list updates and this item re-renders as a disabled "Saved" badge via
 * the `isSaved` prop rather than tracking a separate success flag.
 */
export function BookSearchResultItem({
  book,
  isSaved,
  onSave,
}: BookSearchResultItemProps) {
  const [status, setStatus] = useState<SaveStatus>("idle");

  async function handleSave() {
    setStatus("loading");
    try {
      await onSave(book);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {book.title ?? "Untitled"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {book.authors?.join(", ") ?? "Unknown author"}
        </p>
        {status === "error" && (
          <p className="text-xs text-destructive">Failed to save. Try again.</p>
        )}
      </div>

      {isSaved ? (
        <Button variant="secondary" size="sm" disabled>
          <CheckIcon /> Saved
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={status === "loading"}
          onClick={handleSave}
        >
          {status === "loading" && <Spinner />}
          {status === "loading" ? "Saving..." : status === "error" ? "Retry" : "Save"}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors, no new ones. This component will be exercised visually in the Task 9 browser walkthrough.

- [ ] **Step 3: Commit**

```bash
git add components/book-search/BookSearchResultItem.tsx
git commit -m "feat: add BookSearchResultItem component"
```

---

### Task 6: `BookSearchDialog` component

**Files:**
- Create: `components/book-search/BookSearchDialog.tsx`

- [ ] **Step 1: Write the component**

> Positioned with `top-20 translate-y-0` (overriding shadcn's default centered `top-1/2 -translate-y-1/2`) so the panel anchors below the fixed header instead of the screen center — see the design spec's "Layout approach". `tailwind-merge` (via `cn()`, used internally by the shadcn `Dialog` components) resolves the conflicting `top-*`/`translate-y-*` utilities correctly, keeping the later ones.

Create `components/book-search/BookSearchDialog.tsx`:
```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { BookSearchResultItem } from "./BookSearchResultItem";
import { IdentifiedBook } from "@/app/books/identify/types";
import { BookSearchStatus } from "@/hooks/useBookSearch";
import { bookKey } from "@/app/library/bookKey";

interface BookSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  results: IdentifiedBook[];
  status: BookSearchStatus;
  errorMessage: string | null;
  savedBookKeys: Set<string>;
  onSave: (book: IdentifiedBook) => Promise<void>;
}

/**
 * Results panel for the top-of-page book search. Anchored below the
 * header (rather than shadcn's default centered dialog) so the header's
 * search input stays visible above it while this is open.
 */
export function BookSearchDialog({
  open,
  onOpenChange,
  query,
  results,
  status,
  errorMessage,
  savedBookKeys,
  onSave,
}: BookSearchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-20 max-w-lg translate-y-0 gap-4">
        <DialogHeader>
          <DialogTitle>Search results</DialogTitle>
          <DialogDescription>
            {query ? `Results for "${query}"` : "Keep typing to search."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 divide-y divide-border overflow-y-auto">
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner /> Searching...
            </div>
          )}

          {status === "error" && (
            <p className="py-8 text-center text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          {status === "success" && results.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {`No books found for "${query}". Try a different search.`}
            </p>
          )}

          {status === "success" &&
            results.map((book) => (
              <BookSearchResultItem
                key={book.id}
                book={book}
                isSaved={savedBookKeys.has(bookKey(book))}
                onSave={onSave}
              />
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors, no new ones.

- [ ] **Step 3: Commit**

```bash
git add components/book-search/BookSearchDialog.tsx
git commit -m "feat: add BookSearchDialog component"
```

---

### Task 7: `BookSearchBar` component

**Files:**
- Create: `components/book-search/BookSearchBar.tsx`

- [ ] **Step 1: Write the component**

Create `components/book-search/BookSearchBar.tsx`:
```tsx
"use client";

import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BookSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: (query: string) => void;
}

/**
 * The single search input for the book-search system. Submitting it opens
 * the results dialog; edits made while the dialog is already open flow
 * back through `onQueryChange` to re-search live (handled by the parent).
 */
export function BookSearchBar({ query, onQueryChange, onSubmit }: BookSearchBarProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(query);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search for a book..."
        className="w-72 bg-stone-50"
      />
      <Button type="submit" size="icon" variant="outline" aria-label="Search">
        <SearchIcon />
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors, no new ones.

- [ ] **Step 3: Commit**

```bash
git add components/book-search/BookSearchBar.tsx
git commit -m "feat: add BookSearchBar component"
```

---

### Task 8: `BookSearch` container component

**Files:**
- Create: `components/book-search/BookSearch.tsx`

- [ ] **Step 1: Write the component**

> Ties `useBookSearch`, `BookSearchBar`, and `BookSearchDialog` together, and is where `selectBook` gets called on save. `z-[60]` on the header (an arbitrary value — `z-60` is not on Tailwind's default scale, which stops at `z-50`) is what keeps the header above the dialog's `z-50` overlay, so the search input stays visible while the dialog is open.

Create `components/book-search/BookSearch.tsx`:
```tsx
"use client";

import { useCallback, useState } from "react";
import { BookSearchBar } from "./BookSearchBar";
import { BookSearchDialog } from "./BookSearchDialog";
import { useBookSearch } from "@/hooks/useBookSearch";
import { selectBook } from "@/app/books/identify/actions";
import { BookWithThemes, IdentifiedBook } from "@/app/books/identify/types";
import { bookKey } from "@/app/library/bookKey";

interface BookSearchProps {
  savedBooks: BookWithThemes[];
  handleAddSavedBook: (book: BookWithThemes) => void;
}

/**
 * Top-of-page book search: a persistent search bar plus the results
 * dialog it opens on submit. The debounce/abort mechanics live in
 * `useBookSearch`; saving a result runs `selectBook` (theme extraction
 * for just that one book) before handing it to `handleAddSavedBook`.
 */
export function BookSearch({ savedBooks, handleAddSavedBook }: BookSearchProps) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const bookSearch = useBookSearch();

  // Compare by bookKey (title + first author), not volume id, so a
  // different edition of a saved book also shows as "Saved".
  const savedBookKeys = new Set(savedBooks.map(bookKey));

  function handleQueryChange(value: string) {
    setQuery(value);
    if (dialogOpen) bookSearch.search(value);
  }

  function handleSubmit(value: string) {
    setDialogOpen(true);
    bookSearch.searchImmediate(value);
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) bookSearch.cancel();
  }

  // TODO(dedupe): skip selectBook (a Claude call) when the book is already
  // in the library, e.g. as a recommendation — ADD_SAVED_BOOK keeps the
  // library's copy, so the freshly extracted themes are discarded. See TODO.md.
  const handleSave = useCallback(
    async (book: IdentifiedBook) => {
      const bookWithThemes = await selectBook(book);
      handleAddSavedBook(bookWithThemes);
    },
    [handleAddSavedBook],
  );

  return (
    <div className="fixed top-0 left-0 z-[60] flex w-full items-center gap-3 border-b border-stone-200 bg-white px-6 py-3">
      <BookSearchBar query={query} onQueryChange={handleQueryChange} onSubmit={handleSubmit} />
      <BookSearchDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        query={query}
        results={bookSearch.results}
        status={bookSearch.status}
        errorMessage={bookSearch.errorMessage}
        savedBookKeys={savedBookKeys}
        onSave={handleSave}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors, no new ones.

- [ ] **Step 3: Commit**

```bash
git add components/book-search/BookSearch.tsx
git commit -m "feat: add BookSearch container component"
```

---

### Task 9: Wire `BookSearch` into `page.tsx`; retire the footer search input

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/display.tsx:315` (one-line copy update)

- [ ] **Step 1: Replace the old identify wiring with `BookSearch`**

> This removes `useActionState`/`identifyBook` and the footer's hidden search input/submit button, and renders `<BookSearch>` as a fixed header instead — the same "fixed, overlaying the full-window canvas" pattern the footer already uses today, so no canvas-offset changes are needed.

Replace the entire contents of `app/page.tsx`:
```tsx
"use client";

/*
 * CHANGES FROM ORIGINAL to match new Display.tsx design
 *
 * State:
 *   - Added sharedThemes: string[]   — result of POST /themes, passed to Display to build the graph
 *   - Added selectionMode: boolean   — toggles select mode on graph nodes, passed to Display
 *   - Added isGenerating: boolean    — loading state for Generate Themes button
 *   - Added aiQuery: string          — text input for the AI query panel (placeholder)
 *   - Added showPanel: boolean       — controls bottom recommendations panel visibility (placeholder)
 *
 * Removed from useLibrary:
 *   - recommendedBooks, centeredBook, handleCenterBook
 *     (graph no longer anchors to a single centered book)
 *
 * Book search:
 *   - The old identifyBook/useActionState flow (free text -> silently take
 *     the first Google Books match) is replaced by <BookSearch>, a fixed
 *     header bar that opens a results dialog on submit and lets the user
 *     pick the right book. See
 *     docs/superpowers/specs/2026-09-20-book-search-results-picker-design.md.
 *
 * New functions:
 *   - handleGenerateThemes  — calls POST /themes with all saved books, stores themes in state
 *   - handleGetRecs         — placeholder, opens bottom panel (to wire to POST /api/books/ai-query)
 *
 * Display props removed: centeredBook, handleCenterBook, recommendedBooks
 * Display props added:   selectionMode, sharedThemes
 *
 * Layout:
 *   Header: <BookSearch> (fixed top bar)
 *   Footer left:  [Generate Themes]
 *   Footer right: [AI input] [Get Recommendations →] [Select]
 *
 * Bottom panel added above footer (placeholder — to fill with real API results).
 *
 * DEV: 5 mock books seeded on mount — remove when real search flow is tested.
 *
 * Placeholders for future work:
 *   - aiQuery + handleGetRecs → wire to POST /api/books/ai-query
 *     Body: { books: selectedBooks, themes: selectedThemeNodes, query: aiQuery }
 *   - Bottom panel → replace placeholder text with mapped book cards from API response
 */

import Display from "@/components/display";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookSearch } from "@/components/book-search/BookSearch";
import { useCallback, useEffect, useState } from "react";
import fetchRecommendations from "./books/recs/fetchRecommendations";
import { useLibrary } from "./library/useLibrary";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const {
    savedBooks,
    selectedBooks,
    handleAddSavedBook,
    handleUnsaveBook,
    handleAddRecommendedBooks,
    handleSelectBook,
  } = useLibrary();

  const [sharedThemes, setSharedThemes] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const defaults: import("./books/identify/types").BookWithThemes[] = [
      {
        id: "1",
        title: "The Alchemist",
        authors: ["Paulo Coelho"],
        themes: ["Journey", "Destiny", "Faith"],
      },
      {
        id: "2",
        title: "Siddhartha",
        authors: ["Hermann Hesse"],
        themes: ["Wisdom", "Identity", "Philosophy"],
      },
      {
        id: "3",
        title: "Beloved",
        authors: ["Toni Morrison"],
        themes: ["Memory", "Loss", "Freedom"],
      },
      {
        id: "4",
        title: "Man's Search for Meaning",
        authors: ["Viktor Frankl"],
        themes: ["Survival", "Purpose", "Redemption"],
      },
      {
        id: "5",
        title: "The Prophet",
        authors: ["Kahlil Gibran"],
        themes: ["Love", "Nature", "Time"],
      },
    ];
    defaults.forEach(handleAddSavedBook);
  }, []);

  const onFetchRecommendations = useCallback(
    async (theme: string) => {
      const books = await fetchRecommendations(theme);
      return handleAddRecommendedBooks(books, theme);
    },
    [handleAddRecommendedBooks],
  );

  async function handleGenerateThemes() {
    if (savedBooks.length === 0) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books: savedBooks }),
      });
      const { themes }: { themes: string[] } = await res.json();
      setSharedThemes(themes);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleGetRecs() {
    setShowPanel(true);
  }

  return (
    <main className="bg-white dark:bg-black w-full h-full">
      <BookSearch savedBooks={savedBooks} handleAddSavedBook={handleAddSavedBook} />

      <Display
        savedBooks={savedBooks}
        selectedBooks={selectedBooks}
        selectionMode={selectionMode}
        sharedThemes={sharedThemes}
        handleSaveBook={handleAddSavedBook}
        handleUnsaveBook={handleUnsaveBook}
        handleSelectBook={handleSelectBook}
        onFetchRecommendations={onFetchRecommendations}
      />

      {showPanel && (
        <div className="fixed left-0 right-0 bottom-[57px] z-9 bg-white border-t border-stone-200 px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">
              Recommended
            </span>
            <button
              onClick={() => setShowPanel(false)}
              className="text-stone-400 hover:text-stone-600 text-sm"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-stone-400">
            AI recommendations will appear here. Wire up POST
            /api/books/ai-query.
          </p>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 w-full bg-white border-t border-stone-200 px-6 py-3 flex items-center gap-3 z-10">
        <Button
          onClick={handleGenerateThemes}
          disabled={isGenerating || savedBooks.length === 0}
        >
          {isGenerating ? <Spinner /> : "Generate Themes"}
        </Button>

        <div className="flex-1" />

        <Input
          placeholder="Ask about selected books & themes..."
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          className="w-72 bg-stone-50"
        />

        <Button onClick={handleGetRecs}>Get Recommendations →</Button>

        <Button
          onClick={() => setSelectionMode((m) => !m)}
          variant={selectionMode ? "default" : "outline"}
        >
          {selectionMode ? "✓ Selecting" : "Select"}
        </Button>
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Update the now-stale empty-state copy in `Display`**

In `components/display.tsx`, the graph's empty state told users to add books "below" the (now-removed) footer input. Update it to point at the new top bar.

Modify `components/display.tsx:315`:
```tsx
        p.text("Search for a book above, then click Generate Themes", 0, 0);
```
(replaces `p.text("Add books below, then click Generate Themes", 0, 0);`)

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three pass clean (this resolves the `app/page.tsx` errors that were expected since Task 2).

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`, open `http://localhost:3000`, and walk through:
1. Type 1–2 characters in the top search bar — no dialog opens, no network request (check the Network tab).
2. Type a real book title (e.g. "dune") and press Enter, or click the search button — the results dialog opens below the bar, showing up to 10 candidates; the header/input stays visible above the dimmed backdrop.
3. Edit the query while the dialog is open — after a brief pause, the results list updates (debounced re-search); typing quickly doesn't fire a request per keystroke.
4. Click Save on a result — the button shows a loading state, then that row becomes a disabled "Saved" badge; the book appears in the saved-books dial in `Display`.
5. Close the dialog via the X button, then reopen with a new search — a book already saved shows the "Saved" badge immediately.
6. Search for something with no matches (e.g. a nonsense string) — the empty state message appears.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/display.tsx
git commit -m "feat: wire BookSearch into the top-level page, retire footer search"
```

---

### Task 10: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors (the pre-existing `react-hooks/exhaustive-deps` warning on the mock-books `useEffect` in `app/page.tsx` is expected and unrelated to this feature).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 4: Confirm no dead code remains**

Run: `grep -rn "identifyBook\|IdentifyBookState" --include="*.ts" --include="*.tsx" . | grep -v node_modules`
Expected: no matches.
