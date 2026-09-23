import { BookWithThemes } from "@/app/books/identify/types";
import { BookEntity } from "./types";
import { bookKey } from "./bookKey";

/**
 * Collapses a list of books to one entry per `bookKey`, keeping the first
 * occurrence. A single recommendation batch can contain the same book twice
 * (two AI suggestions resolving to the same work, possibly different
 * editions), and the library must never hold two copies of one book.
 */
export function uniqueByKey(books: BookWithThemes[]): BookWithThemes[] {
  const seen = new Set<string>();
  return books.filter((book) => {
    const key = bookKey(book);
    if (seen.has(key)) return false;
    seen.add(key);
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
 * - duplicates within the batch are collapsed (one entry per `bookKey`);
 * - books the user has already saved are dropped entirely;
 * - every remaining book gets `theme` appended to its themes, so a
 *   book's themes always include each theme it was recommended for;
 * - books already in the library but not saved use the library's copy as
 *   the base, so repeated recommendations accumulate themes instead of
 *   creating a second entry or overwriting earlier data.
 *
 * Pure: used both by the reducer (to update state) and by `useLibrary`
 * (to hand the graph the same reconciled list it will store).
 */
export function reconcileRecommendations(
  entities: Record<string, BookEntity>,
  books: BookWithThemes[],
  theme: string,
): BookWithThemes[] {
  return uniqueByKey(books)
    .filter((book) => !entities[bookKey(book)]?.saved)
    .map((book) => {
      const base = entities[bookKey(book)]?.book ?? book;
      return { ...base, themes: appendTheme(base.themes, theme) };
    });
}
