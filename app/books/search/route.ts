import { books } from "@googleapis/books";
import { NextResponse } from "next/server";
import { IdentifiedBook } from "../identify/types";

const booksApi = books("v1");

const MAX_RESULTS = 10;

/**
 * API route that searches the Google Books API for a free-text query and
 * returns the top matches, unmodified by AI (no theme extraction), so the
 * caller can let the user pick the right one before it's saved.
 *
 * @param req - The incoming request; must include a `q` search param.
 * @returns JSON array of up to `MAX_RESULTS` `IdentifiedBook` (Google
 *   Books volume info plus id), a 400 if `q` is missing, or a 502 if the
 *   Google Books API call fails.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json(
      { error: "Missing required 'q' query parameter." },
      { status: 400 },
    );
  }

  try {
    const res = await booksApi.volumes.list({
      q,
      maxResults: MAX_RESULTS,
      key: process.env.GOOGLE_API_KEY,
    });

    const books: IdentifiedBook[] = (res.data.items ?? [])
      .filter((item) => !!item.volumeInfo && !!item.id)
      .map((item) => ({ ...item.volumeInfo, id: item.id! }));

    return NextResponse.json(books);
  } catch (error) {
    console.error("Error searching Google Books API:", error);
    return NextResponse.json(
      { error: "Failed to search Google Books." },
      { status: 502 },
    );
  }
}
