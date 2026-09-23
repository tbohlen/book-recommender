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

  const runSearch = useCallback(
    async (query: string) => {
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
    },
    [abortInFlight],
  );

  /**
   * Shared setup for both `search` and `searchImmediate`: aborts any
   * in-flight/pending request immediately, then validates the query.
   * Returns the trimmed query, or `null` if it's too short (and resets to
   * the idle/empty state in that case).
   */
  const prepareQuery = useCallback(
    (query: string): string | null => {
      abortInFlight();
      clearPendingTimeout();

      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setStatus("idle");
        setResults([]);
        lastQueryRef.current = null;
        return null;
      }
      return trimmed;
    },
    [abortInFlight, clearPendingTimeout],
  );

  const search = useCallback(
    (query: string) => {
      const trimmed = prepareQuery(query);
      if (trimmed === null) return;
      if (trimmed === lastQueryRef.current) return;

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        runSearch(trimmed);
      }, DEBOUNCE_MS);
    },
    [prepareQuery, runSearch],
  );

  const searchImmediate = useCallback(
    (query: string) => {
      const trimmed = prepareQuery(query);
      if (trimmed === null) return;
      runSearch(trimmed);
    },
    [prepareQuery, runSearch],
  );

  const cancel = useCallback(() => {
    abortInFlight();
    clearPendingTimeout();
  }, [abortInFlight, clearPendingTimeout]);

  useEffect(() => cancel, [cancel]);

  return { results, status, errorMessage, search, searchImmediate, cancel };
}
