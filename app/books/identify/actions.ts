"use server";
import { IdentifyBookState, IdentifiedBook, BookWithThemes } from "./types";
import { books } from "@googleapis/books";
import { extractThemes } from "../../themes/extractThemes";


const booksApi = books("v1");

/**
 * Server Action that looks up a book by the user's search text and appends it,
 * along with AI-extracted themes, to the running list of identified books.
 *
 * Searches the Google Books API for the query in `formData`'s "book" field,
 * takes the top match, and asks Claude Haiku to extract its themes before
 * returning the updated state. Intended for use with React's `useActionState`.
 *
 * @param prevState - The previous action state; its `books` list is carried
 *   forward (appended to on success, returned unchanged on error).
 * @param formData - Form data from the client; must contain a "book" field
 *   with the search text.
 * @returns The updated state: `status: "success"` with the new book appended,
 *   or `status: "error"` with an `errorMessage` describing what failed (no
 *   matching books, a Google Books API failure, or a theme-extraction failure).
 */
export default async function identifyBook(
  prevState: IdentifyBookState,
  formData: FormData,
): Promise<IdentifyBookState> {
  const search = formData.get("book") as string;

  // validator?

  let firstBook: IdentifiedBook;
  try {
    const res = await booksApi.volumes.list({
      q: search,
      key: process.env.GOOGLE_API_KEY,
    });
    const item = res.data.items?.[0];

    if (!item?.volumeInfo || !item.id) {
      return {
        status: "error",
        books: prevState.books,
        errorMessage: "No matching books found.",
      };
    }
    firstBook = { ...item.volumeInfo, id: item.id };
  } catch (error) {
    console.error("Error fetching from Google Books API:", error);
    return {
      status: "error",
      books: prevState.books,
      errorMessage: "Error fetching from Google Books API.",
    };
  }

  try {
    const themes = await extractThemes(firstBook as BookWithThemes);
    const firstBookWithThemes = { ...firstBook, themes } as BookWithThemes;
    return {
      status: "success",
      books: prevState.books.concat(firstBookWithThemes),
      errorMessage: null,
    };
  } catch (error) {
    console.error("Error extracting themes:", error);
    return {
      status: "error",
      books: prevState.books,
      errorMessage: "Error extracting themes from the book.",
    };
  }
}