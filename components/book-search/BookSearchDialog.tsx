"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { BookSearchResultItem } from "./BookSearchResultItem";
import { IdentifiedBook } from "@/app/books/identify/types";
import { BookSearchStatus } from "@/hooks/useBookSearch";

interface BookSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  results: IdentifiedBook[];
  status: BookSearchStatus;
  errorMessage: string | null;
  savedBookIds: Set<string>;
  onSave: (book: IdentifiedBook) => Promise<void>;
}

/**
 * Results panel for the top-of-page book search. Anchored below the
 * header (rather than shadcn's default centered dialog) so the header's
 * search input stays visible above it while this is open.
 */
export function BookSearchDialog({
  open,
  onOpenChange,
  query,
  results,
  status,
  errorMessage,
  savedBookIds,
  onSave,
}: BookSearchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-20 max-w-lg translate-y-0 gap-4">
        <DialogHeader>
          <DialogTitle>Search results</DialogTitle>
          <DialogDescription>
            {query ? `Results for "${query}"` : "Keep typing to search."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 divide-y divide-border overflow-y-auto">
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner /> Searching...
            </div>
          )}

          {status === "error" && (
            <p className="py-8 text-center text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          {status === "success" && results.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {`No books found for "${query}". Try a different search.`}
            </p>
          )}

          {status === "success" &&
            results.map((book) => (
              <BookSearchResultItem
                key={book.id}
                book={book}
                isSaved={savedBookIds.has(book.id)}
                onSave={onSave}
              />
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
