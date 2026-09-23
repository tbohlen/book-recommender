"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { IdentifiedBook } from "@/app/books/identify/types";

type SaveStatus = "idle" | "loading" | "error";

interface BookSearchResultItemProps {
  book: IdentifiedBook;
  isSaved: boolean;
  onSave: (book: IdentifiedBook) => Promise<void>;
}

/**
 * One row in the search results dialog. Owns only its own transient
 * loading/error state — once `onSave` succeeds, the parent's saved-books
 * list updates and this item re-renders as a disabled "Saved" badge via
 * the `isSaved` prop rather than tracking a separate success flag.
 */
export function BookSearchResultItem({
  book,
  isSaved,
  onSave,
}: BookSearchResultItemProps) {
  const [status, setStatus] = useState<SaveStatus>("idle");

  async function handleSave() {
    setStatus("loading");
    try {
      await onSave(book);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {book.title ?? "Untitled"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {book.authors?.join(", ") ?? "Unknown author"}
        </p>
        {status === "error" && (
          <p className="text-xs text-destructive">Failed to save. Try again.</p>
        )}
      </div>

      {isSaved ? (
        <Button variant="secondary" size="sm" disabled>
          <CheckIcon /> Saved
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={status === "loading"}
          onClick={handleSave}
        >
          {status === "loading" && <Spinner />}
          {status === "loading" ? "Saving..." : status === "error" ? "Retry" : "Save"}
        </Button>
      )}
    </div>
  );
}
