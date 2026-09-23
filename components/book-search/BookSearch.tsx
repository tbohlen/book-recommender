"use client";

import { useCallback, useState } from "react";
import { BookSearchBar } from "./BookSearchBar";
import { BookSearchDialog } from "./BookSearchDialog";
import { useBookSearch } from "@/hooks/useBookSearch";
import { selectBook } from "@/app/books/identify/actions";
import { BookWithThemes, IdentifiedBook } from "@/app/books/identify/types";
import { bookKey } from "@/app/library/bookKey";

interface BookSearchProps {
  savedBooks: BookWithThemes[];
  handleAddSavedBook: (book: BookWithThemes) => void;
}

/**
 * Top-of-page book search: a persistent search bar plus the results
 * dialog it opens on submit. The debounce/abort mechanics live in
 * `useBookSearch`; saving a result runs `selectBook` (theme extraction
 * for just that one book) before handing it to `handleAddSavedBook`.
 */
export function BookSearch({ savedBooks, handleAddSavedBook }: BookSearchProps) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const bookSearch = useBookSearch();

  // Compare by bookKey (title + first author), not volume id, so a
  // different edition of a saved book also shows as "Saved".
  const savedBookKeys = new Set(savedBooks.map(bookKey));

  function handleQueryChange(value: string) {
    setQuery(value);
    if (dialogOpen) bookSearch.search(value);
  }

  function handleSubmit(value: string) {
    setDialogOpen(true);
    bookSearch.searchImmediate(value);
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) bookSearch.cancel();
  }

  // TODO(dedupe): skip selectBook (a Claude call) when the book is already
  // in the library, e.g. as a recommendation — ADD_SAVED_BOOK keeps the
  // library's copy, so the freshly extracted themes are discarded. See TODO.md.
  const handleSave = useCallback(
    async (book: IdentifiedBook) => {
      const bookWithThemes = await selectBook(book);
      handleAddSavedBook(bookWithThemes);
    },
    [handleAddSavedBook],
  );

  return (
    <div className="fixed top-0 left-0 z-[60] flex w-full items-center gap-3 border-b border-stone-200 bg-white px-6 py-3">
      <BookSearchBar query={query} onQueryChange={handleQueryChange} onSubmit={handleSubmit} />
      <BookSearchDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        query={query}
        results={bookSearch.results}
        status={bookSearch.status}
        errorMessage={bookSearch.errorMessage}
        savedBookKeys={savedBookKeys}
        onSave={handleSave}
      />
    </div>
  );
}
