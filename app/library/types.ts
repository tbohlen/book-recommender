import { BookWithThemes } from "@/app/books/identify/types";

/**
 * A single book's status within the user's library: whether it has been
 * explicitly saved (via search or a "save" click on a recommendation) or is
 * merely a recommendation the user has discovered but not yet saved, plus
 * whether it's currently selected as AI chat context.
 */
export interface BookEntity {
  book: BookWithThemes;
  status: "saved" | "recommended";
  selected: boolean;
}

/**
 * The full library state: all known books keyed by their Google Books id
 * (so the same book can't end up duplicated across a "saved" list and a
 * "recommended" list), plus which one is currently centered in the graph.
 */
export interface LibraryState {
  entities: Record<string, BookEntity>;
  centeredBookId: string | null;
}

export type LibraryAction =
  | { type: "ADD_SAVED_BOOK"; book: BookWithThemes }
  | { type: "ADD_RECOMMENDED_BOOKS"; books: BookWithThemes[] }
  | { type: "SAVE_BOOK"; bookId: string }
  | { type: "TOGGLE_SELECTED"; bookId: string }
  | { type: "SET_CENTERED"; bookId: string };
