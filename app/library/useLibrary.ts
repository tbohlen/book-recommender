import { useCallback, useReducer } from "react";
import { libraryReducer, initialLibraryState } from "./reducer";
import {
  selectSavedBooks,
  selectRecommendedBooks,
  selectSelectedBooks,
  selectCenteredBook,
} from "./selectors";
import { BookWithThemes } from "@/app/books/identify/types";

/**
 * Owns the user's library state (saved books, recommended-but-unsaved
 * books, the selected-for-chat set, and which book is centered in the
 * graph) and exposes it as ready-to-use arrays plus stable action
 * dispatchers, so callers never touch the reducer or action objects
 * directly.
 */
export function useLibrary() {
  const [state, dispatch] = useReducer(libraryReducer, initialLibraryState);

  const handleAddSavedBook = useCallback(
    (book: BookWithThemes) => dispatch({ type: "ADD_SAVED_BOOK", book }),
    [dispatch],
  );
  const handleAddRecommendedBooks = useCallback(
    (books: BookWithThemes[]) =>
      dispatch({ type: "ADD_RECOMMENDED_BOOKS", books }),
    [dispatch],
  );
  const handleSaveBook = useCallback(
    (book: BookWithThemes) =>
      dispatch({ type: "SAVE_BOOK", bookId: book.id }),
    [dispatch],
  );
  const handleUnsaveBook = useCallback(
    (book: BookWithThemes) =>
      dispatch({ type: "UNSAVE_BOOK", bookId: book.id }),
    [dispatch],
  );
  const handleSelectBook = useCallback(
    (book: BookWithThemes) =>
      dispatch({ type: "TOGGLE_SELECTED", bookId: book.id }),
    [dispatch],
  );
  const handleCenterBook = useCallback(
    (book: BookWithThemes) =>
      dispatch({ type: "SET_CENTERED", bookId: book.id }),
    [dispatch],
  );

  return {
    savedBooks: selectSavedBooks(state),
    recommendedBooks: selectRecommendedBooks(state),
    selectedBooks: selectSelectedBooks(state),
    centeredBook: selectCenteredBook(state),
    handleAddSavedBook,
    handleAddRecommendedBooks,
    handleSaveBook,
    handleUnsaveBook,
    handleSelectBook,
    handleCenterBook,
  };
}
