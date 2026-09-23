import { IdentifiedBook } from "@/app/books/identify/types";

/**
 * Normalizes a title or author name for identity comparison: strips
 * diacritics and parenthetical/bracketed asides (e.g. "(Deluxe Edition)"),
 * lowercases, drops punctuation, and collapses whitespace.
 */
function normalizeForKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[([][^)\]]*[)\]]/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The library's identity for a book: normalized title plus normalized
 * first author.
 *
 * Google Books assigns a different volume id to every edition of a book, so
 * keying by id would let a paperback and a hardcover of the same work sit
 * in the library as two books. Title + first author treats editions as the
 * same book. Books missing either field fall back to their volume id,
 * since a title-only key could merge two different works that share a
 * title.
 */
export function bookKey(book: IdentifiedBook): string {
  const title = normalizeForKey(book.title ?? "");
  const author = normalizeForKey(book.authors?.[0] ?? "");
  if (!title || !author) return `id:${book.id}`;
  return `${title}|${author}`;
}
