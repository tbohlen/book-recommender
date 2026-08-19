import { books_v1 } from "@googleapis/books";
export type GoogleBook = NonNullable<books_v1.Schema$Volume["volumeInfo"]>;

export interface BookWithThemes extends GoogleBook {
  themes: string[] | null;
}

export interface IdentifyBookState {
  status: "idle" | "success" | "error";
  books: BookWithThemes[];
  errorMessage: string | null;
}