import { LibraryState, LibraryAction, BookEntity } from "./types";
import { reconcileRecommendations } from "./dedupe";
import { bookKey } from "./bookKey";

export const initialLibraryState: LibraryState = {
  entities: {},
  centeredBookKey: null,
};

/**
 * Reducer for the user's library of saved/recommended books.
 *
 * Books are stored once, keyed by `bookKey` (title + first author), and referenced by
 * status rather than duplicated across separate saved/recommended arrays —
 * see `BookEntity`. Every action that adds books goes through an existence
 * check so a book can never be stored twice or silently overwritten.
 */
export function libraryReducer(
  state: LibraryState,
  action: LibraryAction,
): LibraryState {
  switch (action.type) {
    // Saving a book from search (or bookmarking a rec node):
    // - already saved: no-op (the search UI shows it as "Saved" instead);
    // - already known but unsaved (e.g. recommended): mark it saved,
    //   keeping the library's copy so themes accumulated from earlier
    //   recommendations and its `recommended` provenance survive;
    // - new: add it as saved, never recommended.
    case "ADD_SAVED_BOOK": {
      const key = bookKey(action.book);
      const existing = state.entities[key];
      if (existing?.saved) return state;
      const withSaved = existing
        ? updateEntity(state, key, (entity) => ({
            ...entity,
            saved: true,
          }))
        : upsertEntity(state, action.book, { saved: true, recommended: false });
      return { ...withSaved, centeredBookKey: key };
    }

    // Saved books are dropped from the batch and already-known unsaved
    // books get the new theme appended (see `reconcileRecommendations`),
    // so a rec fetch never duplicates or downgrades a book.
    case "ADD_RECOMMENDED_BOOKS":
      return reconcileRecommendations(
        state.entities,
        action.books,
        action.theme,
      ).reduce(
        (s, book) => upsertEntity(s, book, { saved: false, recommended: true }),
        state,
      );

    // Only touches `saved` — `recommended` is provenance and doesn't change
    // just because the user (un)saved the book.
    case "SAVE_BOOK":
      return updateEntity(state, action.bookKey, (entity) => ({
        ...entity,
        saved: true,
      }));

    case "UNSAVE_BOOK":
      return updateEntity(state, action.bookKey, (entity) => ({
        ...entity,
        saved: false,
      }));

    case "TOGGLE_SELECTED":
      return updateEntity(state, action.bookKey, (entity) => ({
        ...entity,
        selected: !entity.selected,
      }));

    case "SET_CENTERED":
      return { ...state, centeredBookKey: action.bookKey };

    default:
      return state;
  }
}

/**
 * Writes `book` under its `bookKey` with the given status flags, preserving any
 * existing `selected` state so re-recommending a book doesn't silently
 * drop it from the chat-context selection.
 */
function upsertEntity(
  state: LibraryState,
  book: BookEntity["book"],
  flags: Pick<BookEntity, "saved" | "recommended">,
): LibraryState {
  const key = bookKey(book);
  const selected = state.entities[key]?.selected ?? false;
  return {
    ...state,
    entities: {
      ...state.entities,
      [key]: { book, ...flags, selected },
    },
  };
}

/**
 * Applies `update` to the entity stored under `key`, or returns `state`
 * unchanged if no such entity exists.
 */
function updateEntity(
  state: LibraryState,
  key: string,
  update: (entity: BookEntity) => BookEntity,
): LibraryState {
  const entity = state.entities[key];
  if (!entity) return state;
  return {
    ...state,
    entities: { ...state.entities, [key]: update(entity) },
  };
}
