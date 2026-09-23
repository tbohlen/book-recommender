import { BookWithThemes } from "@/app/books/identify/types";

/**
 * A single book's status within the user's library. `saved` and
 * `recommended` are independent: `saved` tracks whether the user has
 * explicitly kept the book (via search or a "save" click on a
 * recommendation), while `recommended` is provenance — whether the system
 * ever surfaced this book as a recommendation. Keeping them separate means
 * unsaving a book the user found via search (never recommended) doesn't
 * mislabel it as a recommendation. `selected` tracks whether it's currently
 * selected as AI chat context.
 */
export interface BookEntity {
  book: BookWithThemes;
  saved: boolean;
  recommended: boolean;
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
  | { type: "ADD_RECOMMENDED_BOOKS"; books: BookWithThemes[]; theme: string }
  | { type: "SAVE_BOOK"; bookId: string }
  | { type: "UNSAVE_BOOK"; bookId: string }
  | { type: "TOGGLE_SELECTED"; bookId: string }
  | { type: "SET_CENTERED"; bookId: string };
