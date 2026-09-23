"use client";

import { useCallback, useState } from "react";
import { BookSearchBar } from "./BookSearchBar";
import { BookSearchDialog } from "./BookSearchDialog";
import { useBookSearch } from "@/hooks/useBookSearch";
import { selectBook } from "@/app/books/identify/actions";
import { BookWithThemes, IdentifiedBook } from "@/app/books/identify/types";

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

  const savedBookIds = new Set(savedBooks.map((b) => b.id));

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
        savedBookIds={savedBookIds}
        onSave={handleSave}
      />
    </div>
  );
}
