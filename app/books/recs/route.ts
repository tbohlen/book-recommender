import { books } from "@googleapis/books";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import recPrompt from "./rec-prompt";
import { recSchema, RecommendedBookQuery } from "./types";
import { GoogleBook } from "../identify/types";
import { extractThemes } from "../../themes/extractThemes";

const booksApi = books("v1");
const anthropicClient = new Anthropic();

/**
 * API route that recommends books related to a theme and normalizes each
 * recommendation against the Google Books API.
 *
 * Reads a `theme` query parameter, asks Claude for a structured list of book
 * recommendations (title + author only), then looks up each recommendation
 * in the Google Books API and keeps the first match. Recommendations that
 * Google Books can't find are dropped from the result.
 *
 * @param req - The incoming request; must include a `theme` search param.
 * @returns JSON array of `GoogleBook` volume info, one per recommendation
 *   that was successfully found in Google Books.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const theme = searchParams.get("theme");

  if (!theme) {
    return NextResponse.json(
      { error: "Missing required 'theme' query parameter." },
      { status: 400 },
    );
  }

  let recommendations: RecommendedBookQuery[];
  try {
    recommendations = await getRecommendations(theme);
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
        console.error(
          `Error fetching themes for "${book.title}":`,
          error,
        );
        return book; // return book with no themes
      }
    }),
  );

  return NextResponse.json(booksWithThemes);
}

/**
 * Asks Claude Haiku for book recommendations related to a theme.
 *
 * @param theme - A short phrase describing the theme to recommend books for.
 * @returns The list of AI-recommended books (title + author only).
 * @throws {Error} If the model does not return a parsed `books` array.
 */
async function getRecommendations(
  theme: string,
): Promise<RecommendedBookQuery[]> {
  const response = await anthropicClient.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: recPrompt,
    output_config: {
      format: zodOutputFormat(recSchema),
    },
    messages: [
      {
        role: "user",
        content: theme,
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
): Promise<GoogleBook[]> {
  const results = await Promise.all(
    recommendations.map((recommendation) => findFirstMatch(recommendation)),
  );

  return results.filter((book): book is GoogleBook => book !== null);
}

/**
 * Searches the Google Books API for a single recommended book and returns
 * the top match, if any.
 *
 * @param recommendation - The book to search for, by title and author.
 * @returns The first matching book's volume info, or `null` if the search
 *   failed or found no results.
 */
async function findFirstMatch(
  recommendation: RecommendedBookQuery,
): Promise<GoogleBook | null> {
  try {
    const res = await booksApi.volumes.list({
      q: `intitle:${recommendation.title} inauthor:${recommendation.author}`,
      key: process.env.GOOGLE_API_KEY,
    });

    return res.data.items?.[0]?.volumeInfo ?? null;
  } catch (error) {
    console.error(
      `Error fetching "${recommendation.title}" from Google Books API:`,
      error,
    );
    return null;
  }
}
