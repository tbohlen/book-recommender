import { LibraryState } from "./types";
import { BookWithThemes } from "@/app/books/identify/types";

export function selectSavedBooks(state: LibraryState): BookWithThemes[] {
  return Object.values(state.entities)
    .filter((entity) => entity.status === "saved")
    .map((entity) => entity.book);
}

export function selectRecommendedBooks(state: LibraryState): BookWithThemes[] {
  return Object.values(state.entities)
    .filter((entity) => entity.status === "recommended")
    .map((entity) => entity.book);
}

export function selectSelectedBooks(state: LibraryState): BookWithThemes[] {
  return Object.values(state.entities)
    .filter((entity) => entity.selected)
    .map((entity) => entity.book);
}

export function selectCenteredBook(state: LibraryState): BookWithThemes | null {
  if (!state.centeredBookId) return null;
  return state.entities[state.centeredBookId]?.book ?? null;
}
