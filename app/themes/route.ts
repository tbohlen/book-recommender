import { NextResponse } from "next/server";
import { z } from "zod";
import { findCommonThemes } from "./extractThemes";
import { bookWithThemesSchema } from "../books/identify/types";

const requestBodySchema = z.object({
  books: z
    .array(bookWithThemesSchema)
    .min(1, "'books' must be a non-empty array."),
});

/**
 * API route that identifies the common themes across a set of books.
 *
 * Validates the request body against `requestBodySchema`, then asks Claude
 * Haiku to find the throughlines across the books' themes and metadata.
 *
 * @param req - The incoming request; the JSON body must be
 *   `{ books: BookWithThemes[] }` with at least one book.
 * @returns JSON `{ themes: string[] }` on success, or `{ error }` with a
 *   400 for a malformed body or 502 if theme extraction fails.
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

  try {
    const themes = await findCommonThemes(parsedBody.data.books);
    return NextResponse.json({ themes });
  } catch (error) {
    console.error("Error getting common themes:", error);
    return NextResponse.json(
      { error: "Failed to get common book themes." },
      { status: 502 },
    );
  }
}