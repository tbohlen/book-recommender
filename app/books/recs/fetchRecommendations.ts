import { BookWithThemes } from "../identify/types";

/**
 * Fetches book recommendations for a theme from the `/books/recs` API
 * route (client-side; called from `page.tsx` via `Display`'s
 * `onFetchRecommendations` prop).
 */
export default async function fetchRecommendations(
  theme: string,
): Promise<BookWithThemes[]> {
  const res = await fetch(`/books/recs?theme=${encodeURIComponent(theme)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch recommendations for "${theme}".`);
  }
  return await res.json();
}
