import { BookWithThemes, GoogleBook } from "../books/identify/types";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import themePrompt from "./theme-prompt";
import commonThemesPrompt from "./common-themes-prompt";
import z from "zod";

const anthropicClient = new Anthropic();
const themeSchema = z.object({
  themes: z
    .array(z.string())
    .describe(
      "A list of themes that this book is related to, where theme is defined quite broadly.",
    ),
});
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
export async function extractThemes(
  book: GoogleBook,
): Promise<string[]> {
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

export async function findCommonThemes(
  books: BookWithThemes[],
): Promise<string[]> {
  const response = await anthropicClient.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: commonThemesPrompt,
    output_config: {
      format: zodOutputFormat(themeSchema),
    },
    messages: [
      {
        role: "user",
        content: JSON.stringify(books),
      },
    ],
  });

  const themes = response.parsed_output?.themes;

  if (!themes) {
    throw new Error("Failed to extract common themes from books.");
  }

  return themes;


}