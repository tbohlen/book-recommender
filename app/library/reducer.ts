import { LibraryState, LibraryAction, BookEntity } from "./types";

export const initialLibraryState: LibraryState = {
  entities: {},
  centeredBookId: null,
};

/**
 * Reducer for the user's library of saved/recommended books.
 *
 * Books are stored once, keyed by id, and referenced by status rather than
 * duplicated across separate saved/recommended arrays — see `BookEntity`.
 */
export function libraryReducer(
  state: LibraryState,
  action: LibraryAction,
): LibraryState {
  switch (action.type) {
    // Adding a saved book (from the identify search) also centers it, since
    // that's the book the user just asked to look at.
    case "ADD_SAVED_BOOK":
      return {
        ...upsertEntity(state, action.book, "saved"),
        centeredBookId: action.book.id,
      };

    // Recommended books are added without disturbing books already known to
    // the library, so a rec fetch never downgrades an already-saved book.
    case "ADD_RECOMMENDED_BOOKS":
      return action.books.reduce(
        (s, book) =>
          s.entities[book.id] ? s : upsertEntity(s, book, "recommended"),
        state,
      );

    case "SAVE_BOOK":
      return updateEntity(state, action.bookId, (entity) => ({
        ...entity,
        status: "saved",
      }));

    case "UNSAVE_BOOK":
      return updateEntity(state, action.bookId, (entity) => ({
        ...entity,
        status: "recommended",
      }));

    case "TOGGLE_SELECTED":
      return updateEntity(state, action.bookId, (entity) => ({
        ...entity,
        selected: !entity.selected,
      }));

    case "SET_CENTERED":
      return { ...state, centeredBookId: action.bookId };

    default:
      return state;
  }
}

function upsertEntity(
  state: LibraryState,
  book: BookEntity["book"],
  status: BookEntity["status"],
): LibraryState {
  return {
    ...state,
    entities: {
      ...state.entities,
      [book.id]: { book, status, selected: false },
    },
  };
}

function updateEntity(
  state: LibraryState,
  bookId: string,
  update: (entity: BookEntity) => BookEntity,
): LibraryState {
  const entity = state.entities[bookId];
  if (!entity) return state;
  return {
    ...state,
    entities: { ...state.entities, [bookId]: update(entity) },
  };
}
