import { BookWithThemes } from "@/app/books/identify/types";
import { BookEntity } from "./types";

/**
 * Collapses a list of books to one entry per Google Books id, keeping the
 * first occurrence. A single recommendation batch can contain the same
 * volume twice (two AI suggestions resolving to the same Google Books
 * match), and the library must never hold two copies of one id.
 */
export function uniqueById(books: BookWithThemes[]): BookWithThemes[] {
  const seen = new Set<string>();
  return books.filter((book) => {
    if (seen.has(book.id)) return false;
    seen.add(book.id);
    return true;
  });
}

/**
 * Returns `themes` with `theme` appended, unless it's already present
 * (compared case-insensitively, since the AI isn't consistent about
 * capitalization). Never mutates the input array.
 */
export function appendTheme(
  themes: string[] | null,
  theme: string,
): string[] {
  const existing = themes ?? [];
  const normalized = theme.trim().toLowerCase();
  const alreadyPresent = existing.some(
    (t) => t.trim().toLowerCase() === normalized,
  );
  return alreadyPresent ? existing : [...existing, theme];
}

/**
 * Reconciles a freshly fetched batch of recommendations for `theme`
 * against what's already in the library, returning the books that should
 * be shown/stored as recommendations:
 *
 * - duplicates within the batch are collapsed (one entry per id);
 * - books the user has already saved are dropped entirely;
 * - books already in the library but not saved are replaced by the
 *   library's copy with `theme` appended to its themes, so repeated
 *   recommendations accumulate themes instead of creating a second entry
 *   or overwriting earlier data;
 * - books not yet in the library pass through unchanged.
 *
 * Pure: used both by the reducer (to update state) and by `useLibrary`
 * (to hand the graph the same reconciled list it will store).
 */
export function reconcileRecommendations(
  entities: Record<string, BookEntity>,
  books: BookWithThemes[],
  theme: string,
): BookWithThemes[] {
  return uniqueById(books)
    .filter((book) => !entities[book.id]?.saved)
    .map((book) => {
      const existing = entities[book.id];
      if (!existing) return book;
      return {
        ...existing.book,
        themes: appendTheme(existing.book.themes, theme),
      };
    });
}
