"use server";
import { IdentifyBookState, Book, BookWithThemes } from "./types";
import { books } from "@googleapis/books";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import themePrompt from "./theme-prompt";


const booksApi = books("v1");
const anthropicClient = new Anthropic();
const themeSchema = z.object({
  themes: z
    .array(z.string())
    .describe(
      "A list of themes that this book is related to, where theme is defined quite broadly.",
    ),
});

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

  let firstBook: Book;
  try {
    const res = await booksApi.volumes.list({
      q: search,
      key: process.env.GOOGLE_API_KEY,
    });
    const items = res.data.items;

    if (!items?.[0]?.volumeInfo) {
      return {
        status: "error",
        books: prevState.books,
        errorMessage: "No matching books found.",
      };
    }
    firstBook = items[0].volumeInfo;
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

/**
 * Extracts a list of thematic tags for a book using Claude Haiku.
 *
 * Sends the book's Google Books metadata to the model as context, constrained
 * via structured outputs to return JSON matching `themeSchema`.
 *
 * @param book - The book to extract themes for (Google Books volume info).
 * @returns The list of extracted themes.
 * @throws {Error} If the model does not return a parsed `themes` array.
 */
async function extractThemes(book: BookWithThemes): Promise<string[]> {
  const response = await anthropicClient.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: themePrompt,
    output_config: {
      format: zodOutputFormat(themeSchema),
    },
    messages: [
      {
        role: "user",
        content: JSON.stringify(book),
      },
    ],
  });

  const themes = response.parsed_output?.themes;

  if (!themes) {
    throw new Error("Failed to extract themes from the book.");
  }

  return themes;
}