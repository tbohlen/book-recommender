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
import { BookWithThemes } from "./books/identify/types";

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
  const [recBooks, setRecBooks] = useState<BookWithThemes[]>([]);

  useEffect(() => {}, [savedBooks]);

  useEffect(() => {
    const seedQueries = [
      "The Alchemist Paulo Coelho",
      "Siddhartha Hermann Hesse",
      "Beloved Toni Morrison",
      "Man's Search for Meaning Viktor Frankl",
      "The Prophet Kahlil Gibran",
    ];

    Promise.all(
      seedQueries.map((q) =>
        fetch(`/books/search?q=${encodeURIComponent(q)}`)
          .then((r) => r.json())
          .then((books) => {
            if (books[0]) handleAddSavedBook({ ...books[0], themes: null });
          }),
      ),
    );
  }, []);

  const onFetchRecommendations = useCallback(
    async (theme: string) => {
      const books = await fetchRecommendations(theme);
      return handleAddRecommendedBooks(books, theme);
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
      if (!res.ok) return;
      const { themes }: { themes: string[] } = await res.json();
      if (themes) setSharedThemes(themes);
    } finally {
      setIsGenerating(false);
    }
  }
  const handleGetRecs = useCallback(async () => {
    console.log("Generating recs with:", {
      books: selectedBooks,
      themes: sharedThemes,
      prompt: aiQuery,
    });
    const recommendedBooks = await fetchRecommendations(
      null,
      selectedBooks,
      aiQuery,
    );
    console.log("Returned recommended books:", recommendedBooks);

    const selectedTitles = new Set(
      selectedBooks.map((b) => b.title?.toLowerCase()),
    );
    const overlap = recommendedBooks.filter((b) =>
      selectedTitles.has(b.title?.toLowerCase()),
    );
    console.log("Overlap with selected books:", overlap);

    setRecBooks(recommendedBooks);
    handleAddRecommendedBooks(recommendedBooks, aiQuery || "recommended");
    setShowPanel(true);
  }, [selectedBooks, aiQuery]);

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
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recBooks.map((book, i) => {
              const palette = [
                "#abcd5e",
                "#14976b",
                "#2b67af",
                "#62b6de",
                "#f589a3",
                "#ef562f",
                "#fc8405",
                "#f9d531",
              ];
              return (
                <div
                  key={book.id ?? i}
                  className="flex-none w-44 rounded-xl            
  overflow-hidden border border-stone-100 shadow-sm bg-white"
                >
                  {book.imageLinks?.thumbnail ? (
                    <img
                      src={book.imageLinks.thumbnail}
                      alt={book.title ?? ""}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-24"
                      style={{ backgroundColor: palette[i % palette.length] }}
                    />
                  )}
                  <div className="p-3 flex flex-col gap-1">
                    <p
                      className="text-xs font-bold text-stone-800 leading-tight        
  line-clamp-2"
                    >
                      {book.title}
                    </p>
                    <p
                      className="text-xs text-stone-400 leading-tight                
  line-clamp-1"
                    >
                      {book.authors?.join(", ")}
                    </p>
                    {book.themes && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {book.themes.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[9px] bg-stone-100            
  text-stone-500 px-1.5 py-0.5 rounded-full"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
