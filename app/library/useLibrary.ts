import { useCallback, useEffect, useReducer, useRef } from "react";
import { libraryReducer, initialLibraryState } from "./reducer";
import {
  selectSavedBooks,
  selectRecommendedBooks,
  selectSelectedBooks,
  selectCenteredBook,
} from "./selectors";
import { reconcileRecommendations } from "./dedupe";
import { bookKey } from "./bookKey";
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

  // Latest committed state, readable from async callbacks (e.g. a rec fetch
  // that resolves after the user saved more books) without re-creating
  // them on every state change.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleAddSavedBook = useCallback(
    (book: BookWithThemes) => dispatch({ type: "ADD_SAVED_BOOK", book }),
    [dispatch],
  );
  /**
   * Adds a batch of recommendations for `theme` and returns the reconciled
   * list the caller should display: saved books removed, duplicates
   * collapsed, and already-recommended books replaced by the library's
   * copy with `theme` appended to their themes.
   */
  const handleAddRecommendedBooks = useCallback(
    (books: BookWithThemes[], theme: string): BookWithThemes[] => {
      dispatch({ type: "ADD_RECOMMENDED_BOOKS", books, theme });
      return reconcileRecommendations(stateRef.current.entities, books, theme);
    },
    [dispatch],
  );
  const handleSaveBook = useCallback(
    (book: BookWithThemes) =>
      dispatch({ type: "SAVE_BOOK", bookKey: bookKey(book) }),
    [dispatch],
  );
  const handleUnsaveBook = useCallback(
    (book: BookWithThemes) =>
      dispatch({ type: "UNSAVE_BOOK", bookKey: bookKey(book) }),
    [dispatch],
  );
  const handleSelectBook = useCallback(
    (book: BookWithThemes) =>
      dispatch({ type: "TOGGLE_SELECTED", bookKey: bookKey(book) }),
    [dispatch],
  );
  const handleCenterBook = useCallback(
    (book: BookWithThemes) =>
      dispatch({ type: "SET_CENTERED", bookKey: bookKey(book) }),
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
