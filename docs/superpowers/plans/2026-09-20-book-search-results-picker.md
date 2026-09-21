# Book Search Results Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `identifyBook`'s silent "take the first Google Books match" behavior with an explicit search-results dialog, so the user picks the right book from up to 10 candidates instead of trusting an automatic guess.

**Architecture:** A persistent search bar sits at the top of the page. Submitting it opens a `Dialog` anchored just below the bar (the bar stays above the dialog's overlay via z-index, so the query stays visible/editable). Editing the query while the dialog is open triggers a debounced, abortable re-search against a new `/books/search` route (raw Google Books data, no theme extraction). Each result has its own Save button; saving calls a new `selectBook` server action that runs Claude theme-extraction for just that one book, then adds it to the library.

**Tech Stack:** Next.js App Router, React 19, TypeScript (strict), shadcn/ui (`base-vega` style, `@base-ui/react` primitives), Tailwind v4, Vitest + React Testing Library (new — this repo has no test suite yet).

**Spec:** `docs/superpowers/specs/2026-09-20-book-search-results-picker-design.md`

---

## Testing approach for this plan

This repo has no test framework configured yet (`package.json` has no test script; confirmed via `find . -iname "*.test.*"` returning nothing). Task 1 sets up Vitest + React Testing Library — a lightweight, fast, Vite-native stack that needs no Babel config and plays well with React 19 — scoped to unit/integration coverage of the new code in this feature (the search route, the save action, the debounce/abort hook, and the new components). This plan does **not** add end-to-end/Playwright infrastructure or attempt to backfill tests for pre-existing code — that's a larger, separate initiative outside this feature's scope. The one page-level composition task (Task 10) is verified by type-check/lint/build plus a manual browser walkthrough instead of an automated test, since RTL-testing `page.tsx` would require heavily mocking the browser-only, dynamically-imported p5 sketch in `Display` for no real return in confidence.

---

### Task 1: Set up Vitest + React Testing Library

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `lib/utils.test.ts`

- [ ] **Step 1: Install test dependencies**

Run:
```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
Expected: `package.json`'s `devDependencies` gains these six packages; `package-lock.json` updates.

- [ ] **Step 2: Add test scripts**

Modify `package.json`'s `"scripts"` block:
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

- [ ] **Step 4: Create the setup file**

Create `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Write a smoke test to verify the harness works**

> `cn()` (`lib/utils.ts`) is a pure function — a good, real (not throwaway) first test that proves Vitest, TypeScript, and the `@/*` path alias are all wired correctly.

Create `lib/utils.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and drops falsy values", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("lets a later conflicting Tailwind class win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
```

- [ ] **Step 6: Run it and verify it passes**

Run: `npm run test`
Expected: `lib/utils.test.ts (2 tests)` passes, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts lib/utils.test.ts
git commit -m "test: set up Vitest and React Testing Library"
```

---

### Task 2: `/books/search` API route

**Files:**
- Create: `app/books/search/route.ts`
- Test: `app/books/search/route.test.ts`

- [ ] **Step 1: Write the failing tests**

> The route calls the Google Books client instantiated at module scope, so we mock `@googleapis/books` with a shared `listMock` we control per test, matching the existing pattern in `app/books/recs/route.ts`. `// @vitest-environment node` is set because this is server code, not DOM code.

Create `app/books/search/route.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const listMock = vi.fn();
vi.mock("@googleapis/books", () => ({
  books: () => ({ volumes: { list: (...args: unknown[]) => listMock(...args) } }),
}));

import { GET } from "./route";

describe("GET /books/search", () => {
  beforeEach(() => {
    listMock.mockReset();
    process.env.GOOGLE_API_KEY = "test-key";
  });

  it("returns 400 when q is missing", async () => {
    const req = new Request("http://localhost/books/search");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns identified books on success, capped at 10 via maxResults", async () => {
    listMock.mockResolvedValue({
      data: {
        items: [
          { id: "1", volumeInfo: { title: "Book One" } },
          { id: "2", volumeInfo: { title: "Book Two" } },
        ],
      },
    });
    const req = new Request("http://localhost/books/search?q=test");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([
      { id: "1", title: "Book One" },
      { id: "2", title: "Book Two" },
    ]);
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: "test", maxResults: 10 }),
    );
  });

  it("filters out items missing volumeInfo or id", async () => {
    listMock.mockResolvedValue({
      data: {
        items: [
          { id: "1", volumeInfo: { title: "Ok" } },
          { volumeInfo: { title: "No id" } },
          { id: "3" },
        ],
      },
    });
    const req = new Request("http://localhost/books/search?q=test");
    const res = await GET(req);
    const body = await res.json();
    expect(body).toEqual([{ id: "1", title: "Ok" }]);
  });

  it("returns 502 when the Google Books API throws", async () => {
    listMock.mockRejectedValue(new Error("boom"));
    const req = new Request("http://localhost/books/search?q=test");
    const res = await GET(req);
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/books/search/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (file doesn't exist yet).

- [ ] **Step 3: Write the route implementation**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/books/search/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/books/search/route.ts app/books/search/route.test.ts
git commit -m "feat: add /books/search route for raw Google Books results"
```

---

### Task 3: `selectBook` action; retire `identifyBook`

**Files:**
- Modify: `app/books/identify/actions.ts`
- Modify: `app/books/identify/types.ts`
- Test: `app/books/identify/actions.test.ts`

- [ ] **Step 1: Write the failing tests**

> `selectBook` only calls `extractThemes` (no Google Books call — the caller already has full `volumeInfo` from `/books/search`). It throws on failure rather than swallowing the error, so the caller (`BookSearchResultItem`, built in Task 6) can show a per-row retryable error state.

Create `app/books/identify/actions.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const extractThemesMock = vi.fn();
vi.mock("../../themes/extractThemes", () => ({
  extractThemes: (...args: unknown[]) => extractThemesMock(...args),
}));

import { selectBook } from "./actions";
import { IdentifiedBook } from "./types";

describe("selectBook", () => {
  const book: IdentifiedBook = { id: "1", title: "Dune", authors: ["Frank Herbert"] };

  beforeEach(() => {
    extractThemesMock.mockReset();
  });

  it("returns the book with extracted themes attached", async () => {
    extractThemesMock.mockResolvedValue(["Power", "Destiny"]);
    const result = await selectBook(book);
    expect(result).toEqual({ ...book, themes: ["Power", "Destiny"] });
    expect(extractThemesMock).toHaveBeenCalledWith(book);
  });

  it("propagates errors from theme extraction", async () => {
    extractThemesMock.mockRejectedValue(new Error("Claude is down"));
    await expect(selectBook(book)).rejects.toThrow("Claude is down");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/books/identify/actions.test.ts`
Expected: FAIL — `selectBook` is not exported (old file only exports `identifyBook` as default).

- [ ] **Step 3: Replace `identifyBook` with `selectBook`**

> The old free-text-search-and-guess flow is fully retired in favor of `BookSearch` (built in later tasks), so `identifyBook` and the Google Books client it owned are removed rather than kept alongside the new action.

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

- [ ] **Step 4: Remove the now-unused `IdentifyBookState` type**

In `app/books/identify/types.ts`, delete this block (it was only used by the removed `useActionState` wiring):
```ts
export interface IdentifyBookState {
  status: "idle" | "success" | "error";
  books: BookWithThemes[];
  errorMessage: string | null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run app/books/identify/actions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `app/page.tsx` (it still imports `identifyBook`/`IdentifyBookState`) — this is expected and gets fixed in Task 10. Confirm there are no *other* errors.

- [ ] **Step 7: Commit**

```bash
git add app/books/identify/actions.ts app/books/identify/types.ts app/books/identify/actions.test.ts
git commit -m "refactor: replace identifyBook with selectBook action"
```

---

### Task 4: `useBookSearch` hook

**Files:**
- Create: `hooks/useBookSearch.ts`
- Test: `hooks/useBookSearch.test.ts`

- [ ] **Step 1: Write the failing tests**

> This hook is the trickiest logic in the feature: debounce, a minimum query length, skipping a no-op re-search, and — per the design spec — aborting any in-flight request on *every* keystroke (not just when the next debounced search actually fires), so a request already sent before the latest edit can never resolve late and overwrite fresher results. Each behavior gets its own test rather than one big one, so a failure points at exactly which rule broke.

Create `hooks/useBookSearch.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBookSearch } from "./useBookSearch";

function mockFetchOk(body: unknown) {
  return vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) }),
  );
}

describe("useBookSearch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetchOk([{ id: "1", title: "Book" }]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not search below the minimum query length", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBookSearch());
    act(() => result.current.search("ab"));
    act(() => vi.advanceTimersByTime(500));
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("debounces rapid edits into a single request for the latest query", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBookSearch());
    act(() => result.current.search("harry"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.search("harry p"));
    act(() => vi.advanceTimersByTime(400));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("harry p")),
      expect.anything(),
    );
  });

  it("fires immediately on searchImmediate, bypassing the debounce", () => {
    const { result } = renderHook(() => useBookSearch());
    act(() => result.current.searchImmediate("dune"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("skips a debounced search if the query is unchanged from the last one sent", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBookSearch());
    act(() => result.current.searchImmediate("dune"));
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => result.current.search("dune"));
    act(() => vi.advanceTimersByTime(400));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts an in-flight request as soon as the user edits again", () => {
    const { result } = renderHook(() => useBookSearch());
    act(() => result.current.searchImmediate("dune"));
    const firstCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const firstSignal = (firstCall[1] as RequestInit).signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    act(() => result.current.search("dune messiah"));
    expect(firstSignal.aborted).toBe(true);
  });

  it("cancel aborts and clears any pending debounced search", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBookSearch());
    act(() => result.current.search("dune"));
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(500));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sets results and status success on a successful search", async () => {
    const { result } = renderHook(() => useBookSearch());
    act(() => result.current.searchImmediate("dune"));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.results).toEqual([{ id: "1", title: "Book" }]);
  });

  it("sets status error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
    const { result } = renderHook(() => useBookSearch());
    act(() => result.current.searchImmediate("dune"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run hooks/useBookSearch.test.ts`
Expected: FAIL — `Cannot find module './useBookSearch'`.

- [ ] **Step 3: Write the hook implementation**

> `search` (debounced) and `searchImmediate` (submit) share `runSearch`. Both abort any in-flight request up front — that's what guarantees a stale response can never win. `search` additionally debounces via a ref-held timeout and applies the min-length/unchanged-query skip rules; `searchImmediate` applies only the min-length check, since a deliberate submit should always run.

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run hooks/useBookSearch.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors as Task 3 (fixed in Task 10), no new errors.

- [ ] **Step 6: Commit**

```bash
git add hooks/useBookSearch.ts hooks/useBookSearch.test.ts
git commit -m "feat: add useBookSearch debounced search hook"
```

---

### Task 5: Add the shadcn `dialog` component

**Files:**
- Create: `components/ui/dialog.tsx` (generated by shadcn CLI)

- [ ] **Step 1: Run the shadcn CLI**

Run:
```bash
npx shadcn@latest add dialog --yes
```
Expected: `components/ui/dialog.tsx` is created, exporting `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`. It's built on `@base-ui/react/dialog` (matches this repo's `base-vega` shadcn style, same as the existing `Button`).

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors (pre-existing `app/page.tsx` errors from Task 3 are still expected until Task 10).

- [ ] **Step 3: Commit**

```bash
git add components/ui/dialog.tsx package.json package-lock.json
git commit -m "chore: add shadcn dialog component"
```

---

### Task 6: `BookSearchResultItem` component

**Files:**
- Create: `components/book-search/BookSearchResultItem.tsx`
- Test: `components/book-search/BookSearchResultItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

> Per the design spec, the "success state" after saving is represented by the `isSaved` prop flipping true (driven by the parent's `savedBooks` list updating), not by a separate local success flag — so this component only needs local state for the transient `loading`/`error` states of its own click.

Create `components/book-search/BookSearchResultItem.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookSearchResultItem } from "./BookSearchResultItem";
import { IdentifiedBook } from "@/app/books/identify/types";

const book: IdentifiedBook = { id: "1", title: "Dune", authors: ["Frank Herbert"] };

describe("BookSearchResultItem", () => {
  it("renders title and author", () => {
    render(<BookSearchResultItem book={book} isSaved={false} onSave={vi.fn()} />);
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();
  });

  it("shows a disabled Saved badge when isSaved is true", () => {
    render(<BookSearchResultItem book={book} isSaved onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: /saved/i })).toBeDisabled();
  });

  it("calls onSave with the book when Save is clicked", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BookSearchResultItem book={book} isSaved={false} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith(book);
  });

  it("shows an error and lets the user retry when onSave rejects", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("fail"));
    const user = userEvent.setup();
    render(<BookSearchResultItem book={book} isSaved={false} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/book-search/BookSearchResultItem.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the component**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/book-search/BookSearchResultItem.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors, no new ones.

- [ ] **Step 6: Commit**

```bash
git add components/book-search/BookSearchResultItem.tsx components/book-search/BookSearchResultItem.test.tsx
git commit -m "feat: add BookSearchResultItem component"
```

---

### Task 7: `BookSearchDialog` component

**Files:**
- Create: `components/book-search/BookSearchDialog.tsx`
- Test: `components/book-search/BookSearchDialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

> These tests cover the loading/error/empty/results states this component is responsible for rendering. The custom "anchored below the header" positioning is CSS-only and not asserted on here — it's covered by manual browser verification in Task 10.

Create `components/book-search/BookSearchDialog.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookSearchDialog } from "./BookSearchDialog";
import { IdentifiedBook } from "@/app/books/identify/types";
import type { ComponentProps } from "react";

const book: IdentifiedBook = { id: "1", title: "Dune", authors: ["Frank Herbert"] };

function renderDialog(overrides: Partial<ComponentProps<typeof BookSearchDialog>> = {}) {
  return render(
    <BookSearchDialog
      open
      onOpenChange={vi.fn()}
      query="dune"
      results={[]}
      status="idle"
      errorMessage={null}
      savedBookIds={new Set()}
      onSave={vi.fn()}
      {...overrides}
    />,
  );
}

describe("BookSearchDialog", () => {
  it("shows a loading state while searching", () => {
    renderDialog({ status: "loading" });
    expect(screen.getByText(/searching/i)).toBeInTheDocument();
  });

  it("shows the error message on failure", () => {
    renderDialog({
      status: "error",
      errorMessage: "Failed to search for books. Try again.",
    });
    expect(
      screen.getByText("Failed to search for books. Try again."),
    ).toBeInTheDocument();
  });

  it("shows an empty state naming the query when there are no results", () => {
    renderDialog({ status: "success", results: [] });
    expect(screen.getByText(/no books found for "dune"/i)).toBeInTheDocument();
  });

  it("renders one result row per book", () => {
    renderDialog({ status: "success", results: [book] });
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();
  });

  it("marks a result as saved when its id is in savedBookIds", () => {
    renderDialog({ status: "success", results: [book], savedBookIds: new Set(["1"]) });
    expect(screen.getByRole("button", { name: /saved/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/book-search/BookSearchDialog.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the component**

> Positioned with `top-20 translate-y-0` (overriding shadcn's default centered `top-1/2 -translate-y-1/2`) so the panel anchors below the fixed header instead of the screen center — see the design spec's "Layout approach". `tailwind-merge` (via `cn()`) resolves the conflicting `top-*`/`translate-y-*` utilities correctly.

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

interface BookSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  results: IdentifiedBook[];
  status: BookSearchStatus;
  errorMessage: string | null;
  savedBookIds: Set<string>;
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
  savedBookIds,
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
                isSaved={savedBookIds.has(book.id)}
                onSave={onSave}
              />
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/book-search/BookSearchDialog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors, no new ones.

- [ ] **Step 6: Commit**

```bash
git add components/book-search/BookSearchDialog.tsx components/book-search/BookSearchDialog.test.tsx
git commit -m "feat: add BookSearchDialog component"
```

---

### Task 8: `BookSearchBar` component

**Files:**
- Create: `components/book-search/BookSearchBar.tsx`
- Test: `components/book-search/BookSearchBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `components/book-search/BookSearchBar.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookSearchBar } from "./BookSearchBar";

describe("BookSearchBar", () => {
  it("calls onQueryChange as the user types", async () => {
    const onQueryChange = vi.fn();
    const user = userEvent.setup();
    render(<BookSearchBar query="" onQueryChange={onQueryChange} onSubmit={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/search for a book/i), "d");
    expect(onQueryChange).toHaveBeenCalledWith("d");
  });

  it("calls onSubmit with the current query when the form is submitted", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<BookSearchBar query="dune" onQueryChange={vi.fn()} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(onSubmit).toHaveBeenCalledWith("dune");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/book-search/BookSearchBar.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the component**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/book-search/BookSearchBar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors, no new ones.

- [ ] **Step 6: Commit**

```bash
git add components/book-search/BookSearchBar.tsx components/book-search/BookSearchBar.test.tsx
git commit -m "feat: add BookSearchBar component"
```

---

### Task 9: `BookSearch` container component

**Files:**
- Create: `components/book-search/BookSearch.tsx`
- Test: `components/book-search/BookSearch.test.tsx`

- [ ] **Step 1: Write the failing tests**

> This wires the pieces together, so `useBookSearch` and `selectBook` are mocked here — their own behavior is already covered by Tasks 3 and 4. What's under test is `BookSearch`'s own logic: not searching before the dialog opens, opening + immediate-searching on submit, debounced-searching further edits, and the save → `handleAddSavedBook` hand-off.

Create `components/book-search/BookSearch.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookSearch } from "./BookSearch";

vi.mock("@/app/books/identify/actions", () => ({
  selectBook: vi.fn(),
}));
vi.mock("@/hooks/useBookSearch", () => ({
  useBookSearch: vi.fn(),
}));

import { selectBook } from "@/app/books/identify/actions";
import { useBookSearch } from "@/hooks/useBookSearch";

describe("BookSearch", () => {
  const searchMock = vi.fn();
  const searchImmediateMock = vi.fn();
  const cancelMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBookSearch).mockReturnValue({
      results: [],
      status: "idle",
      errorMessage: null,
      search: searchMock,
      searchImmediate: searchImmediateMock,
      cancel: cancelMock,
    });
  });

  it("does not call search before the dialog has been opened", async () => {
    const user = userEvent.setup();
    render(<BookSearch savedBooks={[]} handleAddSavedBook={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/search for a book/i), "dune");
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("opens the dialog and searches immediately on submit", async () => {
    const user = userEvent.setup();
    render(<BookSearch savedBooks={[]} handleAddSavedBook={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/search for a book/i), "dune");
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(searchImmediateMock).toHaveBeenCalledWith("dune");
    expect(screen.getByText("Search results")).toBeInTheDocument();
  });

  it("debounce-searches further edits once the dialog is open", async () => {
    const user = userEvent.setup();
    render(<BookSearch savedBooks={[]} handleAddSavedBook={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search for a book/i);
    await user.type(input, "dune");
    await user.click(screen.getByRole("button", { name: /search/i }));
    await user.type(input, "!");
    expect(searchMock).toHaveBeenCalledWith("dune!");
  });

  it("calls selectBook then handleAddSavedBook when a result is saved", async () => {
    const book = { id: "1", title: "Dune", authors: ["Frank Herbert"] };
    const bookWithThemes = { ...book, themes: ["Sci-Fi"] };
    vi.mocked(selectBook).mockResolvedValue(bookWithThemes);
    vi.mocked(useBookSearch).mockReturnValue({
      results: [book],
      status: "success",
      errorMessage: null,
      search: searchMock,
      searchImmediate: searchImmediateMock,
      cancel: cancelMock,
    });
    const handleAddSavedBook = vi.fn();
    const user = userEvent.setup();
    render(<BookSearch savedBooks={[]} handleAddSavedBook={handleAddSavedBook} />);
    await user.type(screen.getByPlaceholderText(/search for a book/i), "dune");
    await user.click(screen.getByRole("button", { name: /search/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(selectBook).toHaveBeenCalledWith(book);
    await waitFor(() => expect(handleAddSavedBook).toHaveBeenCalledWith(bookWithThemes));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/book-search/BookSearch.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the component**

Create `components/book-search/BookSearch.tsx`:
```tsx
"use client";

import { useCallback, useState } from "react";
import { BookSearchBar } from "./BookSearchBar";
import { BookSearchDialog } from "./BookSearchDialog";
import { useBookSearch } from "@/hooks/useBookSearch";
import { selectBook } from "@/app/books/identify/actions";
import { BookWithThemes, IdentifiedBook } from "@/app/books/identify/types";

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

  const savedBookIds = new Set(savedBooks.map((b) => b.id));

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
        savedBookIds={savedBookIds}
        onSave={handleSave}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/book-search/BookSearch.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing `app/page.tsx` errors, no new ones.

- [ ] **Step 6: Commit**

```bash
git add components/book-search/BookSearch.tsx components/book-search/BookSearch.test.tsx
git commit -m "feat: add BookSearch container component"
```

---

### Task 10: Wire `BookSearch` into `page.tsx`; retire the footer search input

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
      handleAddRecommendedBooks(books);
      return books;
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
Expected: all three pass clean (this resolves the `app/page.tsx` errors that were expected since Task 3).

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: all tests from Tasks 1–9 pass.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`, open `http://localhost:3000`, and walk through:
1. Type 1–2 characters in the top search bar — no dialog opens, no network request (check the Network tab).
2. Type a real book title (e.g. "dune") and press Enter, or click the search button — the results dialog opens below the bar, showing up to 10 candidates; the header/input stays visible above the dimmed backdrop.
3. Edit the query while the dialog is open — after a brief pause, the results list updates (debounced re-search); typing quickly doesn't fire a request per keystroke.
4. Click Save on a result — the button shows a loading state, then that row becomes a disabled "Saved" badge; the book appears in the saved-books dial in `Display`.
5. Close the dialog via the X button, then reopen with a new search — a book already saved shows the "Saved" badge immediately.
6. Search for something with no matches (e.g. a nonsense string) — the empty state message appears.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/display.tsx
git commit -m "feat: wire BookSearch into the top-level page, retire footer search"
```

---

### Task 11: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, 0 failures.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors (the pre-existing `react-hooks/exhaustive-deps` warning on the mock-books `useEffect` in `app/page.tsx` is expected and unrelated to this feature).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 5: Confirm no dead code remains**

Run: `grep -rn "identifyBook\|IdentifyBookState" --include="*.ts" --include="*.tsx" . | grep -v node_modules`
Expected: no matches.
