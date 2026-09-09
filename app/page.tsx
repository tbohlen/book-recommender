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
 *   - Added submitRef                — lets Enter key trigger the hidden search form submit
 *
 * Removed from useLibrary:
 *   - recommendedBooks, centeredBook, handleCenterBook
 *     (graph no longer anchors to a single centered book)
 *
 * handleSaveBook → handleAddSavedBook:
 *   - SAVE_BOOK silently fails if the book isn't already in entities as "recommended"
 *   - ADD_SAVED_BOOK always upserts, so bookmarking a rec node always works
 *
 * New functions:
 *   - handleGenerateThemes  — calls POST /themes with all saved books, stores themes in state
 *   - handleGetRecs         — placeholder, opens bottom panel (to wire to POST /api/books/ai-query)
 *
 * Display props removed: centeredBook, handleCenterBook, recommendedBooks
 * Display props added:   selectionMode, sharedThemes
 *
 * Footer layout changed to match sketch2:
 *   Left:  [search input] | [Generate Themes]
 *   Right: [AI input] [Get Recommendations →] [Select]
 *   A flex spacer separates the two groups.
 *   Search now submits on Enter (no visible Add button).
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
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
    selectedBooks,
    handleAddSavedBook,
    handleAddRecommendedBooks,
    handleSelectBook,
  } = useLibrary();

  const [sharedThemes, setSharedThemes] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [showPanel, setShowPanel] = useState(false);

  const submitRef = useRef<HTMLButtonElement>(null);

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
      <Display
        savedBooks={savedBooks}
        selectedBooks={selectedBooks}
        selectionMode={selectionMode}
        sharedThemes={sharedThemes}
        handleSaveBook={handleAddSavedBook}
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
        <form action={bookFormAction} className="contents">
          <Input
            name="book"
            placeholder="Type a book title, press Enter..."
            className="w-60 bg-stone-50"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRef.current?.click();
            }}
          />
          <button
            ref={submitRef}
            type="submit"
            className="hidden"
            disabled={isPending}
          />
        </form>

        <div className="w-px h-6 bg-stone-300 mx-1" />

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
