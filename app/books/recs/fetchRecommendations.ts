import { BookWithThemes } from "../identify/types";

/**
 * Fetches book recommendations for a theme from the `/books/recs` API
 * route (client-side; called from `page.tsx` via `Display`'s
 * `onFetchRecommendations` prop).
 */
export default async function fetchRecommendations(
  theme: string | null,
  books: BookWithThemes[] | null = [],
  prompt?: string | null,
): Promise<BookWithThemes[]> {
  const res = await fetch("/books/recs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme, books, prompt }),
  });
  if (!res.ok) {
    console.log("Error: ", await res.text());
    throw new Error(`Failed to fetch recommendations for "${theme}".`);
  }
  return await res.json();
}
