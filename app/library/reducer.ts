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
    // that's the book the user just asked to look at. It was never
    // recommended by the system, so `recommended` starts false.
    case "ADD_SAVED_BOOK":
      return {
        ...upsertEntity(state, action.book, {
          saved: true,
          recommended: false,
        }),
        centeredBookId: action.book.id,
      };

    // Recommended books are added without disturbing books already known to
    // the library, so a rec fetch never downgrades an already-saved book.
    case "ADD_RECOMMENDED_BOOKS":
      return action.books.reduce(
        (s, book) =>
          s.entities[book.id]
            ? s
            : upsertEntity(s, book, { saved: false, recommended: true }),
        state,
      );

    // Only touches `saved` — `recommended` is provenance and doesn't change
    // just because the user (un)saved the book.
    case "SAVE_BOOK":
      return updateEntity(state, action.bookId, (entity) => ({
        ...entity,
        saved: true,
      }));

    case "UNSAVE_BOOK":
      return updateEntity(state, action.bookId, (entity) => ({
        ...entity,
        saved: false,
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
  flags: Pick<BookEntity, "saved" | "recommended">,
): LibraryState {
  return {
    ...state,
    entities: {
      ...state.entities,
      [book.id]: { book, ...flags, selected: false },
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
