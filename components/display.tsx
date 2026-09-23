"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";
import { BookWithThemes } from "../app/books/identify/types";

/** The callback-shaped props, cached in a ref so the p5 sketch (built once
 * on mount) always calls the latest version rather than a stale closure. */
interface DisplayCallbacks {
  savedBooks: BookWithThemes[];
  selectedBooks: BookWithThemes[];
  selectionMode: boolean;
  sharedThemes: string[];
  handleSaveBook: (book: BookWithThemes) => void;
  handleUnsaveBook: (book: BookWithThemes) => void;
  handleSelectBook: (book: BookWithThemes) => void;
  onFetchRecommendations: (theme: string) => Promise<BookWithThemes[]>;
}

interface ThemeNode {
  x: number;
  y: number;
  parentX: number;
  parentY: number;
  label: string;
  angle: number;
  expanded: boolean;
  loading: boolean;
  selected: boolean;
  recBooks: BookWithThemes[] | null;
  recNodes: RecNode[];
}

interface RecNode {
  x: number;
  y: number;
  parentX: number;
  parentY: number;
  label: string;
  angle: number;
  book: BookWithThemes;
  saved: boolean;
  selected: boolean;
  expanded: boolean;
  themeNodes: ThemeNode[];
}

const CARD_W = 220;
const CARD_H = 300;
const THEME_R = 28;
const REC_R = 22;
const SAVE_BTN_R = 8;
const ARC_DIST = 180;
const REC_DIST = 150;

const PALETTE = [
  "#abcd5e",
  "#14976b",
  "#2b67af",
  "#62b6de",
  "#f589a3",
  "#ef562f",
  "#fc8405",
  "#f9d531",
];

const DIAL_DIAMETER = 900;
const DIAL_R = DIAL_DIAMETER / 2;
const DIAL_ARC_SPAN = 1.1;

export default function Display({
  savedBooks,
  selectedBooks,
  selectionMode,
  sharedThemes,
  handleSaveBook,
  handleUnsaveBook,
  handleSelectBook,
  onFetchRecommendations,
}: DisplayCallbacks) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<{ setThemes: (themes: string[]) => void } | null>(
    null,
  );

  // Kept fresh every render so the p5 sketch below — built once on mount —
  // always reads the latest callback props instead of capturing stale ones.
  const propsRef = useRef<DisplayCallbacks>({
    savedBooks,
    selectedBooks,
    selectionMode,
    sharedThemes,
    handleSaveBook,
    handleUnsaveBook,
    handleSelectBook,
    onFetchRecommendations,
  });
  useEffect(() => {
    propsRef.current = {
      savedBooks,
      selectedBooks,
      selectionMode,
      sharedThemes,
      handleSaveBook,
      handleUnsaveBook,
      handleSelectBook,
      onFetchRecommendations,
    };
  });

  useEffect(() => {
    let instance: p5 | null = null;
    let cancelled = false;

    import("p5").then(({ default: P5 }) => {
      if (cancelled || !containerRef.current) return;
      instance = new P5((p: p5) => {
        let ARC_START: number;
        let ARC_END: number;
        let themeNodes: ThemeNode[] = [];

        // zoom & pan
        let panX = 0,
          panY = 0;
        let zoom = 1.0;
        let isPanning = false;
        let panStartX = 0,
          panStartY = 0,
          panOriginX = 0,
          panOriginY = 0;

        // dial
        let dialRotation = 0;
        let isDraggingDial = false;
        let dialDragStartAngle = 0;
        let dialDragStartRotation = 0;
        let expandedDialBook: {
          book: BookWithThemes;
          flipped: boolean;
          x: number;
          y: number;
          targetX: number;
          targetY: number;
          color: string;
        } | null = null;

        // ─── Coordinate helper ────────────────────────────────────────────────────
        function toWorld(sx: number, sy: number) {
          return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
        }

        // ─── setThemes ────────────────────────────────────────────────────────────
        function setThemes(themes: string[]) {
          themeNodes = buildThemeNodes({ x: 0, y: 0 }, themes);
        }

        sketchRef.current = { setThemes };

        // ─── Build nodes ──────────────────────────────────────────────────────────
        function buildThemeNodes(
          center: { x: number; y: number },
          themes: string[],
        ): ThemeNode[] {
          const n = themes.length;
          return themes.map((label, i) => {
            const t = n === 1 ? 0.5 : i / (n - 1);
            const angle = p.lerp(ARC_START, ARC_END, t);
            return {
              x: center.x + ARC_DIST * p.cos(angle),
              y: center.y + ARC_DIST * p.sin(angle),
              parentX: center.x,
              parentY: center.y,
              label,
              angle,
              expanded: false,
              loading: false,
              selected: false,
              recBooks: null,
              recNodes: [],
            };
          });
        }

        function buildRecNodes(
          theme: ThemeNode,
          recBooks: BookWithThemes[],
        ): RecNode[] {
          const spreadMax = Math.max(recBooks.length - 1, 1);
          return recBooks.map((book, i) => {
            const spread = p.map(i, 0, spreadMax, -0.4, 0.4);
            const angle = theme.angle + spread;
            const words = (book.title ?? "").split(" ");
            const label = (words[0] === "The" ? words[1] : words[0]).substring(
              0,
              7,
            );
            return {
              x: theme.x + REC_DIST * p.cos(angle),
              y: theme.y + REC_DIST * p.sin(angle),
              parentX: theme.x,
              parentY: theme.y,
              label,
              angle,
              book,
              saved: false,
              selected: false,
              expanded: false,
              themeNodes: [],
            };
          });
        }

        /**
         * Expands or collapses a theme node's recommendations. On first
         * expansion, fetches recommendations from the `/books/recs` route
         * and caches them on the node so later toggles don't re-fetch.
         */

        function toggleTheme(theme: ThemeNode) {
          if (theme.expanded) {
            theme.expanded = false;
            theme.recNodes = [];
            return;
          }

          theme.expanded = true;

          if (theme.recBooks) {
            theme.recNodes = buildRecNodes(theme, theme.recBooks);
            return;
          }

          theme.loading = true;
          propsRef.current
            .onFetchRecommendations(theme.label)
            .then((recBooks) => {
              theme.recBooks = recBooks;
              theme.loading = false;
              if (theme.expanded) {
                theme.recNodes = buildRecNodes(theme, recBooks);
              }
            })
            .catch((error) => {
              console.error(
                `Error fetching recommendations for "${theme.label}":`,
                error,
              );
              theme.loading = false;
            });
        }

        // ─── Setup ────────────────────────────────────────────────────────────────
        p.setup = () => {
          ARC_START = -p.PI * 0.85;
          ARC_END = -p.PI * 0.15;
          p.createCanvas(p.windowWidth, p.windowHeight);
          panX = p.width / 2;
          panY = p.height * 0.42;
        };

        p.windowResized = () => {
          p.resizeCanvas(p.windowWidth, p.windowHeight);
        };

        // ─── Tree traversal ───────────────────────────────────────────────────────
        function getAllThemeNodes(
          nodes: ThemeNode[] = themeNodes,
        ): ThemeNode[] {
          const result: ThemeNode[] = [];
          for (const t of nodes) {
            result.push(t);
            for (const r of t.recNodes)
              if (r.expanded) result.push(...getAllThemeNodes(r.themeNodes));
          }
          return result;
        }

        function getAllRecNodes(nodes: ThemeNode[] = themeNodes): RecNode[] {
          const result: RecNode[] = [];
          for (const t of nodes)
            for (const r of t.recNodes) {
              result.push(r);
              if (r.expanded) result.push(...getAllRecNodes(r.themeNodes));
            }
          return result;
        }

        // ─── Draw ─────────────────────────────────────────────────────────────────
        p.draw = () => {
          p.background(245, 240, 235);

          p.push();
          p.translate(panX, panY);
          p.scale(zoom);

          if (themeNodes.length === 0) {
            drawEmptyState();
          } else {
            drawGraphRecursive(themeNodes);
          }

          p.pop();

          drawDial();
          drawExpandedDialBook();
          updateCursor();
        };

        function drawEmptyState() {
          p.noStroke();
          p.fill(190);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(14);
          p.textStyle(p.NORMAL);
          p.text("Search for a book above, then click Generate Themes", 0, 0);
        }

        // ─── Recursive graph ──────────────────────────────────────────────────────
        function drawGraphRecursive(nodes: ThemeNode[]) {
          for (const t of nodes) {
            p.stroke(210);
            p.strokeWeight(1.5 / zoom);
            p.line(t.parentX, t.parentY, t.x, t.y);
            drawThemeNode(t);
            if (t.expanded)
              for (const r of t.recNodes) {
                p.stroke(220);
                p.strokeWeight(1 / zoom);
                p.line(r.parentX, r.parentY, r.x, r.y);
                drawRecNode(r);
                if (r.expanded) drawGraphRecursive(r.themeNodes);
              }
          }
        }

        function drawThemeNode(n: ThemeNode) {
          const m = toWorld(p.mouseX, p.mouseY);
          const hovered = p.dist(m.x, m.y, n.x, n.y) < THEME_R;
          p.fill(n.expanded ? "#6366f1" : hovered ? "#818cf8" : "#c7d2fe");
          p.stroke(255);
          p.strokeWeight(1.5 / zoom);
          p.ellipse(n.x, n.y, THEME_R * 2, THEME_R * 2);
          p.noStroke();
          p.fill(n.expanded ? 255 : 40);
          p.textAlign(p.CENTER, p.BOTTOM);
          p.textSize(10);
          p.textStyle(p.NORMAL);
          p.text(n.label, n.x, n.y - THEME_R - 5);

          if (n.loading) {
            p.fill(150);
            p.textAlign(p.CENTER, p.TOP);
            p.textSize(8);
            p.text("loading...", n.x, n.y + THEME_R + 6);
          }

          if (propsRef.current.selectionMode) {
            drawSelectBadge(
              n.x + THEME_R * 0.7,
              n.y - THEME_R * 0.7,
              n.selected,
            );
          }
        }

        function drawRecNode(r: RecNode) {
          const m = toWorld(p.mouseX, p.mouseY);
          const hovered = p.dist(m.x, m.y, r.x, r.y) < REC_R;
          const badgeX = r.x + REC_R * 0.72,
            badgeY = r.y - REC_R * 0.72;
          const overBadge = p.dist(m.x, m.y, badgeX, badgeY) < SAVE_BTN_R;

          p.fill(
            r.expanded
              ? "#c4b5fd"
              : hovered && !overBadge
                ? "#fcd34d"
                : "#fde68a",
          );
          p.stroke(255);
          p.strokeWeight(1.5 / zoom);
          p.ellipse(r.x, r.y, REC_R * 2, REC_R * 2);

          if (r.saved) {
            p.noFill();
            p.stroke("#14976b");
            p.strokeWeight(2 / zoom);
            p.ellipse(r.x, r.y, (REC_R + 4) * 2, (REC_R + 4) * 2);
          }

          p.noStroke();
          p.fill(40);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(9);
          p.textStyle(p.NORMAL);
          p.text(r.label, r.x, r.y);

          if (propsRef.current.selectionMode) {
            drawSelectBadge(badgeX, badgeY, r.selected);
          } else if (hovered) {
            drawBookmark(badgeX, badgeY, r.saved);
            p.noStroke();
            p.fill(30);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(10);
            p.textStyle(p.NORMAL);
            p.text(r.book.title ?? "", r.x, r.y - REC_R - 6, 140);
            p.fill(120);
            p.textSize(8);
            p.textAlign(p.CENTER, p.TOP);
            p.text(
              r.expanded ? "click to collapse" : "click to explore",
              r.x,
              r.y + REC_R + 6,
            );
          }
        }

        function drawSelectBadge(x: number, y: number, selected: boolean) {
          p.fill(selected ? "#14976b" : "#888");
          p.noStroke();
          p.ellipse(x, y, SAVE_BTN_R * 2, SAVE_BTN_R * 2);
          p.fill(255);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(11);
          p.textStyle(p.BOLD);
          p.text(selected ? "−" : "+", x, y - 0.5);
        }

        function drawBookmark(x: number, y: number, saved: boolean) {
          const w = 9,
            h = 12;
          p.push();
          p.translate(x, y);
          p.scale(1 / zoom);
          if (saved) {
            p.fill("#14976b");
            p.stroke("#14976b");
          } else {
            p.noFill();
            p.stroke("#666");
          }
          p.strokeWeight(1.4);
          p.beginShape();
          p.vertex(-w / 2, -h / 2);
          p.vertex(w / 2, -h / 2);
          p.vertex(w / 2, h / 2);
          p.vertex(0, h / 2 - 4);
          p.vertex(-w / 2, h / 2);
          p.endShape(p.CLOSE);
          p.pop();
        }

        // ─── Dial ─────────────────────────────────────────────────────────────────
        function dialGeometry() {
          const footerH = 57;
          const topY = p.height - footerH - 120;
          const cx = p.width / 2;
          const cy = topY + DIAL_R;
          return { cx, cy, topY };
        }

        function dialAngleForSlot(i: number, total: number, rotation: number) {
          const centerSlot = (total - 1) / 2;
          const slotAngle = total > 1 ? DIAL_ARC_SPAN / (total - 1) : 0;
          return -p.PI / 2 + (i - centerSlot) * slotAngle + rotation;
        }

        function drawDial() {
          const books = propsRef.current.savedBooks;
          if (books.length === 0) return;
          const { cx, cy, topY } = dialGeometry();
          const visible = books.length;

          p.noStroke();
          p.fill(180);
          p.textAlign(p.CENTER, p.BOTTOM);
          p.textSize(9);
          p.textStyle(p.NORMAL);
          p.text("saved books", cx, topY - 14);

          for (let i = 0; i < visible; i++) {
            const book = books[i];
            const angle = dialAngleForSlot(i, visible, dialRotation);
            const bx = cx + DIAL_R * p.cos(angle);
            const by = cy + DIAL_R * p.sin(angle);

            const distFromTop = p.abs(angle - -p.PI / 2);
            const sc = p.map(distFromTop, 0, DIAL_ARC_SPAN / 2, 1.0, 0.62);
            const bw = 38 * sc,
              bh = 52 * sc;
            const tilt = angle + p.PI / 2;

            const hovered =
              !expandedDialBook &&
              p.abs(p.mouseX - bx) < bw / 2 + 6 &&
              p.abs(p.mouseY - by) < bh / 2 + 6;

            const ctx = p.drawingContext as CanvasRenderingContext2D;
            ctx.shadowOffsetY = 3;
            ctx.shadowBlur = hovered ? 14 : 5;
            ctx.shadowColor = "rgba(0,0,0,0.14)";

            p.push();
            p.translate(bx, by);
            p.rotate(tilt);
            p.rectMode(p.CENTER);
            if (hovered) p.stroke("#6366f1");
            else p.stroke(255);
            p.strokeWeight(hovered ? 2 : 1.5);
            p.fill(PALETTE[i % PALETTE.length]);
            p.rect(0, 0, bw, bh, 3);
            p.pop();

            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            if (hovered) {
              p.noStroke();
              p.fill(40);
              p.textAlign(p.CENTER, p.TOP);
              p.textSize(9);
              p.textStyle(p.NORMAL);
              p.text(book.title ?? "", bx, by + bh * sc * 0.5 + 6, 100);
            }

            (
              book as BookWithThemes & {
                _screenX?: number;
                _screenY?: number;
                _screenW?: number;
                _screenH?: number;
              }
            )._screenX = bx;
            (
              book as BookWithThemes & {
                _screenX?: number;
                _screenY?: number;
                _screenW?: number;
                _screenH?: number;
              }
            )._screenY = by;
            (
              book as BookWithThemes & {
                _screenX?: number;
                _screenY?: number;
                _screenW?: number;
                _screenH?: number;
              }
            )._screenW = bw;
            (
              book as BookWithThemes & {
                _screenX?: number;
                _screenY?: number;
                _screenH?: number;
              }
            )._screenH = bh;
          }
        }

        function drawExpandedDialBook() {
          if (!expandedDialBook) return;
          const e = expandedDialBook;

          e.x = p.lerp(e.x, e.targetX, 0.12);
          e.y = p.lerp(e.y, e.targetY, 0.12);

          p.rectMode(p.CORNER);
          p.noStroke();
          p.fill(0, 0, 0, 80);
          p.rect(0, 0, p.width, p.height);

          const ctx = p.drawingContext as CanvasRenderingContext2D;
          ctx.shadowOffsetY = 8;
          ctx.shadowBlur = 30;
          ctx.shadowColor = "rgba(0,0,0,0.18)";

          p.rectMode(p.CENTER);
          if (!e.flipped) {
            p.fill(255);
            p.noStroke();
            p.rect(e.x, e.y, CARD_W, CARD_H, 14);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            p.fill(e.color);
            p.noStroke();
            p.rect(e.x, e.y - CARD_H * 0.12, CARD_W - 24, CARD_H * 0.55, 8);

            p.noStroke();
            p.fill(30);
            p.textAlign(p.CENTER, p.TOP);
            p.textSize(13);
            p.textStyle(p.BOLD);
            p.text(e.book.title ?? "", e.x, e.y + CARD_H * 0.3, CARD_W - 32);
            p.fill(120);
            p.textSize(10);
            p.textStyle(p.NORMAL);
            p.text("click to flip", e.x, e.y + CARD_H / 2 - 24);
          } else {
            p.fill(255);
            p.noStroke();
            p.rect(e.x, e.y, CARD_W, CARD_H, 14);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            const pad = 20,
              mw = CARD_W - pad * 2;
            p.push();
            p.translate(e.x - CARD_W / 2 + pad, e.y - CARD_H / 2 + pad);
            p.rectMode(p.CORNER);
            p.textAlign(p.LEFT, p.TOP);
            p.noStroke();
            let y = 0;

            p.fill(30);
            p.textSize(12);
            p.textStyle(p.BOLD);
            p.text(e.book.title ?? "", 0, y, mw);
            y += 28;

            p.fill(120);
            p.textSize(10);
            p.textStyle(p.NORMAL);
            p.text(e.book.authors?.join(", ") ?? "Author unknown", 0, y, mw);
            y += 22;

            p.stroke(220);
            p.strokeWeight(0.8);
            p.line(0, y, mw, y);
            p.noStroke();
            y += 12;

            p.fill(80);
            p.textSize(9);
            p.text(e.book.themes?.join(" · ") ?? "", 0, y, mw);
            p.pop();

            p.noStroke();
            p.fill(120);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(10);
            p.textStyle(p.NORMAL);
            p.text("click to flip back", e.x, e.y + CARD_H / 2 - 10);
          }

          const closeX = e.x + CARD_W / 2 - 2,
            closeY = e.y - CARD_H / 2 - 2;
          p.fill(80);
          p.noStroke();
          p.ellipse(closeX, closeY, 22, 22);
          p.fill(255);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(12);
          p.textStyle(p.NORMAL);
          p.text("✕", closeX, closeY - 0.5);
        }

        // ─── Cursor ───────────────────────────────────────────────────────────────
        function updateCursor() {
          if (expandedDialBook) {
            const e = expandedDialBook;
            const onCard =
              p.abs(p.mouseX - e.x) < CARD_W / 2 &&
              p.abs(p.mouseY - e.y) < CARD_H / 2;
            p.cursor(onCard ? "pointer" : "default");
            return;
          }
          const m = toWorld(p.mouseX, p.mouseY);
          const allThemes = getAllThemeNodes();
          const allRecs = getAllRecNodes();
          const overTheme = allThemes.some(
            (n) => p.dist(m.x, m.y, n.x, n.y) < THEME_R,
          );
          const overRec = allRecs.some(
            (r) => p.dist(m.x, m.y, r.x, r.y) < REC_R,
          );
          const overDial = propsRef.current.savedBooks.some((b) => {
            const sb = b as BookWithThemes & {
              _screenX?: number;
              _screenY?: number;
              _screenW?: number;
              _screenH?: number;
            };
            return (
              sb._screenX !== undefined &&
              p.abs(p.mouseX - sb._screenX!) < (sb._screenW ?? 0) + 4 &&
              p.abs(p.mouseY - sb._screenY!) < (sb._screenH ?? 0) + 4
            );
          });
          p.cursor(overTheme || overRec || overDial ? "pointer" : "default");
        }

        // ─── Mouse ────────────────────────────────────────────────────────────────
        p.mousePressed = () => {
          if (expandedDialBook) {
            const e = expandedDialBook;
            const closeX = e.x + CARD_W / 2 - 2,
              closeY = e.y - CARD_H / 2 - 2;
            if (p.dist(p.mouseX, p.mouseY, closeX, closeY) < 13) {
              expandedDialBook = null;
              return;
            }
            if (
              p.abs(p.mouseX - e.x) < CARD_W / 2 &&
              p.abs(p.mouseY - e.y) < CARD_H / 2
            ) {
              e.flipped = !e.flipped;
              return;
            }
            expandedDialBook = null;
            return;
          }

          // Dial book click
          for (const b of propsRef.current.savedBooks) {
            const sb = b as BookWithThemes & {
              _screenX?: number;
              _screenY?: number;
              _screenW?: number;
              _screenH?: number;
            };
            if (sb._screenX === undefined) continue;
            if (
              p.abs(p.mouseX - sb._screenX) < (sb._screenW ?? 0) / 2 + 6 &&
              p.abs(p.mouseY - sb._screenY!) < (sb._screenH ?? 0) / 2 + 6
            ) {
              const bookIdx = propsRef.current.savedBooks.findIndex(bk => bk.id === b.id);
              expandedDialBook = {
                book: b,
                flipped: false,
                x: sb._screenX,
                y: sb._screenY!,
                targetX: p.width / 2,
                targetY: (p.height - 57) / 2,
                color: PALETTE[bookIdx >= 0 ? bookIdx % PALETTE.length : 0],
              };
              return;
            }
          }

          const m = toWorld(p.mouseX, p.mouseY);
          const allRecs = getAllRecNodes();
          const allThemes = getAllThemeNodes();

          if (propsRef.current.selectionMode) {
            for (const t of allThemes) {
              const bx = t.x + THEME_R * 0.7,
                by = t.y - THEME_R * 0.7;
              if (p.dist(m.x, m.y, bx, by) < SAVE_BTN_R) {
                t.selected = !t.selected;
                return;
              }
            }
            for (const r of allRecs) {
              const bx = r.x + REC_R * 0.72,
                by = r.y - REC_R * 0.72;
              if (p.dist(m.x, m.y, bx, by) < SAVE_BTN_R) {
                r.selected = !r.selected;
                return;
              }
            }
          } else {
            for (const r of allRecs) {
              const bx = r.x + REC_R * 0.72,
                by = r.y - REC_R * 0.72;
              if (p.dist(m.x, m.y, bx, by) < SAVE_BTN_R) {
                r.saved = !r.saved;
                if (r.saved) {
                  propsRef.current.handleSaveBook(r.book);
                }
                return;
              }
            }
          }

          for (const r of allRecs) {
            if (p.dist(m.x, m.y, r.x, r.y) < REC_R) {
              r.expanded = !r.expanded;
              if (r.expanded && r.themeNodes.length === 0)
                r.themeNodes = buildThemeNodes(r, r.book.themes ?? []);
              return;
            }
          }

          for (const t of allThemes) {
            if (p.dist(m.x, m.y, t.x, t.y) < THEME_R) {
              toggleTheme(t);
              return;
            }
          }

          if (propsRef.current.savedBooks.length > 1) {
            const { cx, cy } = dialGeometry();
            if (p.abs(p.dist(p.mouseX, p.mouseY, cx, cy) - DIAL_R) < 90) {
              isDraggingDial = true;
              dialDragStartAngle = p.atan2(p.mouseY - cy, p.mouseX - cx);
              dialDragStartRotation = dialRotation;
              return;
            }
          }

          isPanning = true;
          panStartX = p.mouseX;
          panStartY = p.mouseY;
          panOriginX = panX;
          panOriginY = panY;
        };

        p.mouseDragged = () => {
          if (isDraggingDial) {
            const { cx, cy } = dialGeometry();
            const curAngle = p.atan2(p.mouseY - cy, p.mouseX - cx);
            dialRotation = dialDragStartRotation + (curAngle - dialDragStartAngle);
            return;
          }
          if (isPanning) {
            panX = panOriginX + (p.mouseX - panStartX);
            panY = panOriginY + (p.mouseY - panStartY);
          }
        };

        p.mouseReleased = () => {
          isDraggingDial = false;
          isPanning = false;
        };

        p.mouseWheel = (event: WheelEvent) => {
          if (expandedDialBook) return;
          const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
          const newZoom = p.constrain(zoom * zoomFactor, 0.2, 4.0);
          panX = p.mouseX - (p.mouseX - panX) * (newZoom / zoom);
          panY = p.mouseY - (p.mouseY - panY) * (newZoom / zoom);
          zoom = newZoom;
        };
      }, containerRef.current);
    });

    return () => {
      cancelled = true;
      instance?.remove();
    };
  }, []);

  useEffect(() => {
    sketchRef.current?.setThemes(sharedThemes);
  }, [sharedThemes]);

  return <div ref={containerRef} className="w-full h-full relative" />;
}
