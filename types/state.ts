export interface State {
  books: Book[];
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  imageUrl: string | null;
  rating?: number;
  themes: string[];
}