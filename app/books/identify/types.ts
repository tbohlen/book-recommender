import { books_v1 } from "@googleapis/books";
export type Book = NonNullable<books_v1.Schema$Volume["volumeInfo"]>;

export interface BookWithThemes extends Book {
  themes: string[] | null;
}

export interface IdentifyBookState {
  status: "idle" | "success" | "error";
  books: BookWithThemes[];
  errorMessage: string | null;
}

export interface State {
  books: Book[];
}

export interface OriginalBook {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  imageUrl: string | null;
  rating?: number;
  themes: string[];
}