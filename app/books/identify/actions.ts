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
