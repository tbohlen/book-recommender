"use client";

/*
 * CHANGES FROM ORIGINAL to match new Display.tsx design
 *
 * State:
 *   - Added sharedThemes: string[]   — result of POST /themes, passed to Display to build the graph
 *   - Added selectionMode: boolean   — toggles select mode on graph nodes, passed to Display
 *   - Added isGenerating: boolean    — loading state for Generate Themes button
 *   - Added aiQuery: string          — text input for the AI query panel (placeholder)
 *   - Added showPanel: boolean       — controls bottom recommendations panel visibility (placeholder)
 *
 * Removed from useLibrary:
 *   - recommendedBooks, centeredBook, handleCenterBook
 *     (graph no longer anchors to a single centered book)
 *
 * Book search:
 *   - The old identifyBook/useActionState flow (free text -> silently take
 *     the first Google Books match) is replaced by <BookSearch>, a fixed
 *     header bar that opens a results dialog on submit and lets the user
 *     pick the right book. See
 *     docs/superpowers/specs/2026-09-20-book-search-results-picker-design.md.
 *
 * New functions:
 *   - handleGenerateThemes  — calls POST /themes with all saved books, stores themes in state
 *   - handleGetRecs         — placeholder, opens bottom panel (to wire to POST /api/books/ai-query)
 *
 * Display props removed: centeredBook, handleCenterBook, recommendedBooks
 * Display props added:   selectionMode, sharedThemes
 *
 * Layout:
 *   Header: <BookSearch> (fixed top bar)
 *   Footer left:  [Generate Themes]
 *   Footer right: [AI input] [Get Recommendations →] [Select]
 *
 * Bottom panel added above footer (placeholder — to fill with real API results).
 *
 * DEV: 5 mock books seeded on mount — remove when real search flow is tested.
 *
 * Placeholders for future work:
 *   - aiQuery + handleGetRecs → wire to POST /api/books/ai-query
 *     Body: { books: selectedBooks, themes: selectedThemeNodes, query: aiQuery }
 *   - Bottom panel → replace placeholder text with mapped book cards from API response
 */

import Display from "@/components/display";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookSearch } from "@/components/book-search/BookSearch";
import { useCallback, useEffect, useState } from "react";
import fetchRecommendations from "./books/recs/fetchRecommendations";
import { useLibrary } from "./library/useLibrary";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const {
    savedBooks,
    selectedBooks,
    handleAddSavedBook,
    handleUnsaveBook,
    handleAddRecommendedBooks,
    handleSelectBook,
  } = useLibrary();

  const [sharedThemes, setSharedThemes] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const defaults: import("./books/identify/types").BookWithThemes[] = [
      {
        id: "1",
        title: "The Alchemist",
        authors: ["Paulo Coelho"],
        themes: ["Journey", "Destiny", "Faith"],
      },
      {
        id: "2",
        title: "Siddhartha",
        authors: ["Hermann Hesse"],
        themes: ["Wisdom", "Identity", "Philosophy"],
      },
      {
        id: "3",
        title: "Beloved",
        authors: ["Toni Morrison"],
        themes: ["Memory", "Loss", "Freedom"],
      },
      {
        id: "4",
        title: "Man's Search for Meaning",
        authors: ["Viktor Frankl"],
        themes: ["Survival", "Purpose", "Redemption"],
      },
      {
        id: "5",
        title: "The Prophet",
        authors: ["Kahlil Gibran"],
        themes: ["Love", "Nature", "Time"],
      },
    ];
    defaults.forEach(handleAddSavedBook);
  }, []);

  const onFetchRecommendations = useCallback(
    async (theme: string) => {
      const books = await fetchRecommendations(theme);
      handleAddRecommendedBooks(books);
      return books;
    },
    [handleAddRecommendedBooks],
  );

  async function handleGenerateThemes() {
    if (savedBooks.length === 0) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books: savedBooks }),
      });
      const { themes }: { themes: string[] } = await res.json();
      setSharedThemes(themes);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleGetRecs() {
    setShowPanel(true);
  }

  return (
    <main className="bg-white dark:bg-black w-full h-full">
      <BookSearch
        savedBooks={savedBooks}
        handleAddSavedBook={handleAddSavedBook}
      />

      <Display
        savedBooks={savedBooks}
        selectedBooks={selectedBooks}
        selectionMode={selectionMode}
        sharedThemes={sharedThemes}
        handleSaveBook={handleAddSavedBook}
        handleUnsaveBook={handleUnsaveBook}
        handleSelectBook={handleSelectBook}
        onFetchRecommendations={onFetchRecommendations}
      />

      {showPanel && (
        <div className="fixed left-0 right-0 bottom-[57px] z-9 bg-white border-t border-stone-200 px-6 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">
              Recommended
            </span>
            <button
              onClick={() => setShowPanel(false)}
              className="text-stone-400 hover:text-stone-600 text-sm"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-stone-400">
            AI recommendations will appear here. Wire up POST
            /api/books/ai-query.
          </p>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 w-full bg-white border-t border-stone-200 px-6 py-3 flex items-center gap-3 z-10">
        <Button
          onClick={handleGenerateThemes}
          disabled={isGenerating || savedBooks.length === 0}
        >
          {isGenerating ? <Spinner /> : "Generate Themes"}
        </Button>

        <div className="flex-1" />

        <Input
          placeholder="Ask about selected books & themes..."
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
          className="w-72 bg-stone-50"
        />

        <Button onClick={handleGetRecs}>Get Recommendations →</Button>

        <Button
          onClick={() => setSelectionMode((m) => !m)}
          variant={selectionMode ? "default" : "outline"}
        >
          {selectionMode ? "✓ Selecting" : "Select"}
        </Button>
      </footer>
    </main>
  );
}
