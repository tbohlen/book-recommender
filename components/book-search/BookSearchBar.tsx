"use client";

import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BookSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: (query: string) => void;
}

/**
 * The single search input for the book-search system. Submitting it opens
 * the results dialog; edits made while the dialog is already open flow
 * back through `onQueryChange` to re-search live (handled by the parent).
 */
export function BookSearchBar({ query, onQueryChange, onSubmit }: BookSearchBarProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(query);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search for a book..."
        className="w-72 bg-stone-50"
      />
      <Button type="submit" size="icon" variant="outline" aria-label="Search">
        <SearchIcon />
      </Button>
    </form>
  );
}
