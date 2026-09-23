import { books } from "@googleapis/books";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import recPrompt from "./rec-prompt";
import recFromPromptPrompt from "./rec-from-prompt-prompt";
import { recSchema, RecommendedBookQuery } from "./types";
import {
  IdentifiedBook,
  BookWithThemes,
  bookWithThemesSchema,
} from "../identify/types";
import { extractThemes } from "../../themes/extractThemes";

const booksApi = books("v1");
const anthropicClient = new Anthropic();

const requestBodySchema = z.object({
  books: z
    .array(bookWithThemesSchema)
    .optional()
    .describe(
      "A list of books that provide context on what to recommend. The prompt, if provided, will explain how to use them. If it does not, the system will attempt to recommend books like them.",
    ),
  theme: z.string().optional().describe("The theme to recommend books for."),
  prompt: z
    .string()
    .optional()
    .describe(
      "An optional free-text description of what to recommend, evaluated alongside any theme/books context.",
    ),
});

/**
 * API route that recommends books based on a theme, a list of books, a
 * free-text prompt, or any combination of the three, and normalizes each
 * recommendation against the Google Books API.
 *
 * Accepts a JSON body with optional `theme`, `books`, and `prompt` fields
 * (at least one is required), asks Claude for a structured list of book
 * recommendations (title + author only) using a system prompt selected
 * based on whether a free-text `prompt` was provided, then looks up each
 * recommendation in the Google Books API and keeps the first match.
 * Recommendations Google Books can't find are silently dropped rather than
 * surfaced as broken entries. Each surviving book is also run through theme
 * extraction before being returned.
 *
 * @param req - The incoming request; body must include at least one of
 *   `theme`, `books`, or `prompt`.
 * @returns JSON array of `BookWithThemes`, one per recommendation that was
 *   successfully found in Google Books.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const parsedBody = requestBodySchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: z.treeifyError(parsedBody.error) },
      { status: 400 },
    );
  }

  const { theme, prompt, books } = parsedBody.data;

  if (!theme && !books && !prompt) {
    return NextResponse.json(
      {
        error:
          "At least one of 'theme', 'books', or 'prompt' must be provided.",
      },
      { status: 400 },
    );
  }

  let recommendations: RecommendedBookQuery[];
  try {
    const systemPrompt = prompt ? recFromPromptPrompt : recPrompt;
    recommendations = await requestRecommendations(
      systemPrompt,
      theme,
      books,
      prompt,
    );
  } catch (error) {
    console.error("Error getting book recommendations:", error);
    return NextResponse.json(
      { error: "Failed to get book recommendations." },
      { status: 502 },
    );
  }

  const normalizedBooks = await normalizeRecommendations(recommendations);

  const booksWithThemes = await Promise.all(
    normalizedBooks.map(async (book) => {
      try {
        const themes = await extractThemes(book);
        return { ...book, themes };
      } catch (error) {
        console.error(`Error fetching themes for "${book.title}":`, error);
        return book; // return book with no themes
      }
    }),
  );

  return NextResponse.json(booksWithThemes);
}

/**
 * Composes the user message content for a recommendation request from the
 * optional theme, book, and prompt context, since the model expects a
 * single string rather than separate fields.
 *
 * @param theme - A short phrase describing the theme to recommend books for.
 * @param books - Books that provide context on what to recommend.
 * @param prompt - Free-text guidance on what to recommend.
 * @returns The composed message content, with "Theme:", "Books:", and/or
 *   "Prompt:" sections depending on what was provided.
 */
function buildRecommendationContent(
  theme: string | undefined,
  books: BookWithThemes[] | undefined,
  prompt: string | undefined,
): string {
  const sections: string[] = [];
  if (theme) {
    sections.push(`Theme: ${theme}`);
  }
  if (books) {
    sections.push(`Books: ${JSON.stringify(books)}`);
  }
  if (prompt) {
    sections.push(`Prompt: ${prompt}`);
  }

  return sections.join("\n");
}

/**
 * Asks Claude Haiku for book recommendations given some combination of a
 * theme, book list, and free-text prompt, using the supplied system prompt.
 *
 * @param systemPrompt - The system prompt to steer the model with; the
 *   caller picks this based on whether a free-text `prompt` was provided.
 * @param theme - A short phrase describing the theme to recommend books for.
 * @param books - Books that provide context on what to recommend.
 * @param prompt - Free-text guidance on what to recommend.
 * @returns The list of AI-recommended books (title + author only).
 * @throws {Error} If the model does not return a parsed `books` array.
 */
async function requestRecommendations(
  systemPrompt: string,
  theme: string | undefined,
  books: BookWithThemes[] | undefined,
  prompt: string | undefined,
): Promise<RecommendedBookQuery[]> {
  const response = await anthropicClient.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    output_config: {
      format: zodOutputFormat(recSchema),
    },
    messages: [
      {
        role: "user",
        content: buildRecommendationContent(theme, books, prompt),
      },
    ],
  });

  const recommendedBooks = response.parsed_output?.books;

  if (!recommendedBooks) {
    throw new Error("Failed to get book recommendations from the model.");
  }

  return recommendedBooks;
}

/**
 * Looks up each AI-recommended book in the Google Books API and keeps the
 * first match, normalizing the AI's freeform output into real book data.
 *
 * @param recommendations - Books to look up, by title and author.
 * @returns The first Google Books match for each recommendation that was
 *   found; recommendations with no match are omitted.
 */
async function normalizeRecommendations(
  recommendations: RecommendedBookQuery[],
): Promise<IdentifiedBook[]> {
  const results = await Promise.all(
    recommendations.map((recommendation) => findFirstMatch(recommendation)),
  );

  return results.filter((book): book is IdentifiedBook => book !== null);
}

/**
 * Searches the Google Books API for a single recommended book and returns
 * the top match, if any.
 *
 * @param recommendation - The book to search for, by title and author.
 * @returns The first matching book's volume info plus its id, or `null` if
 *   the search failed or found no results.
 */
async function findFirstMatch(
  recommendation: RecommendedBookQuery,
): Promise<IdentifiedBook | null> {
  try {
    const res = await booksApi.volumes.list({
      q: `intitle:${recommendation.title} inauthor:${recommendation.author}`,
      key: process.env.GOOGLE_API_KEY,
    });

    const item = res.data.items?.[0];
    if (!item?.volumeInfo || !item.id) return null;
    return { ...item.volumeInfo, id: item.id };
  } catch (error) {
    console.error(
      `Error fetching "${recommendation.title}" from Google Books API:`,
      error,
    );
    return null;
  }
}
