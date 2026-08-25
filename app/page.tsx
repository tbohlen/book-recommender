'use client';
import Display from "@/components/display";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useActionState, useCallback, useEffect } from "react";
import identifyBook from "./books/identify/actions";
import fetchRecommendations from "./books/recs/fetchRecommendations";
import { useLibrary } from "./library/useLibrary";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const [state, bookFormAction, isPending] = useActionState(identifyBook, {
    status: "idle",
    books: [],
    errorMessage: null,
  });

  const {
    savedBooks,
    recommendedBooks,
    selectedBooks,
    centeredBook,
    handleAddSavedBook,
    handleAddRecommendedBooks,
    handleSaveBook,
    handleSelectBook,
    handleCenterBook,
  } = useLibrary();

  // Every book the identify action successfully resolves becomes a saved
  // book (and, per the reducer, the newly centered one).
  useEffect(() => {
    const latest = state.books.at(-1);
    if (state.status === "success" && latest) handleAddSavedBook(latest);
  }, [state.books, state.status, handleAddSavedBook]);

  const onFetchRecommendations = useCallback(
    async (theme: string) => {
      const books = await fetchRecommendations(theme);
      handleAddRecommendedBooks(books);
      return books;
    },
    [handleAddRecommendedBooks],
  );

  return (
    <main className="bg-white dark:bg-black w-full h-full">
      <Display
        savedBooks={savedBooks}
        recommendedBooks={recommendedBooks}
        selectedBooks={selectedBooks}
        centeredBook={centeredBook}
        handleCenterBook={handleCenterBook}
        handleSaveBook={handleSaveBook}
        handleSelectBook={handleSelectBook}
        onFetchRecommendations={onFetchRecommendations}
      />
      <footer className="fixed bottom-0 left-0 w-full bg-stone-200 dark:bg-gray-800 p-4 flex justify-center">
        <form action={bookFormAction}>
          <Field orientation="horizontal" className="w-auto">
            <Input
              name="book"
              placeholder="Describe a book to add"
              className="max-w-150 min-w-120 bg-stone-100"
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Add"}
            </Button>
          </Field>
        </form>
      </footer>
    </main>
  );
}
