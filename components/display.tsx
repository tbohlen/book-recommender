"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";
import { State, Book } from "../types/state";
import { MOCK_REC_BOOKS } from "../lib/mock-data";

interface ThemeNode {
  x: number;
  y: number;
  label: string;
  angle: number;
  expanded: boolean;
  recNodes: RecNode[];
}

interface RecNode {
  x: number;
  y: number;
  label: string;
  angle: number;
  mockBook: Book;
}

const CARD_W = 230;
const CARD_H = 230;

export default function Display({ state }: { state: State }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<{ setBook: (b: Book) => void } | null>(null);

  useEffect(() => {
    let instance: InstanceType<typeof import("p5").default> | null = null;
    let cancelled = false;

    import("p5").then(({ default: P5 }) => {
      if (cancelled || !containerRef.current) return;
      instance = new P5((p: p5) => {
        let ARC_START: number;
        let ARC_END: number;
        let book: Book | null = null;
        let bookImg: p5.Image | "failed" | null = null;
        let themeNodes: ThemeNode[] = [];
        let isFlipped = false;
        let mockBookIdx = 0;

        // ─── Layout ───────────────────────────────────────────────────────────────
        function getLayout() {
          const bx = p.width / 2;
          const by = p.height * 0.52;
          const arcR = p.constrain(p.height * 0.28, 180, 300);
          const themeR = 30;
          const recR = p.constrain(p.height * 0.18, 140, 210);
          const recNodeR = 24;
          const sideThemeBottom = by + arcR * p.sin(ARC_START) + themeR;
          const cardCY = p.constrain(
            sideThemeBottom + 24 + CARD_H / 2,
            by + 20,
            p.height - CARD_H / 2 - 70,
          );
          return { bx, by, arcR, themeR, recR, recNodeR, cardCY };
        }

        // ─── setBook ──────────────────────────────────────────────────────────────
        function setBook(b: Book) {
          book = b;
          isFlipped = false;
          bookImg = null;
          themeNodes = buildThemeNodes(b.themes);
          p.loadImage(
            b.imageUrl ?? "",
            (img) => {
              bookImg = img;
            },
            () => {
              bookImg = "failed";
            },
          );
        }

        sketchRef.current = { setBook };

        // ─── Build nodes ──────────────────────────────────────────────────────────
        function buildThemeNodes(themes: string[]): ThemeNode[] {
          const { bx, by, arcR } = getLayout();
          const n = themes.length;
          return themes.map((label, i) => {
            const t = n === 1 ? 0.5 : i / (n - 1);
            const angle = p.lerp(ARC_START, ARC_END, t);
            return {
              x: bx + arcR * p.cos(angle),
              y: by + arcR * p.sin(angle),
              label,
              angle,
              expanded: false,
              recNodes: [],
            };
          });
        }

        function buildRecNodes(theme: ThemeNode, recR: number): RecNode[] {
          return Array.from({ length: 3 }, (_, i) => {
            const spread = p.map(i, 0, 2, -0.5, 0.5);
            const angle = theme.angle + spread;
            const mockBook =
              MOCK_REC_BOOKS[mockBookIdx % MOCK_REC_BOOKS.length];
            mockBookIdx++;
            const words = mockBook.title.split(" ");
            const label = (words[0] === "The" ? words[1] : words[0]).substring(
              0,
              7,
            );
            return {
              x: theme.x + recR * p.cos(angle),
              y: theme.y + recR * p.sin(angle),
              label,
              angle,
              mockBook,
            };
          });
        }

        // ─── Setup ────────────────────────────────────────────────────────────────
        p.setup = () => {
          ARC_START = -p.PI * 0.85;
          ARC_END = -p.PI * 0.15;
          p.createCanvas(p.windowWidth, p.windowHeight);
        };

        p.windowResized = () => {
          p.resizeCanvas(p.windowWidth, p.windowHeight);
          if (book) themeNodes = buildThemeNodes(book.themes);
        };

        // ─── Draw ─────────────────────────────────────────────────────────────────
        p.draw = () => {
          p.background(245, 240, 235);
          if (!book) return;
          const L = getLayout();
          updateCursor(L);
          drawArcPath(L);
          drawThemeNodes(L);
          drawRecNodes(L);
          drawBookCard(L);
        };

        // ─── Cursor ───────────────────────────────────────────────────────────────
        function updateCursor({
          bx,
          cardCY,
          themeR,
          recNodeR,
        }: ReturnType<typeof getLayout>) {
          const overCard =
            p.abs(p.mouseX - bx) < CARD_W / 2 &&
            p.abs(p.mouseY - cardCY) < CARD_H / 2;
          const overTheme = themeNodes.some(
            (n) => p.dist(p.mouseX, p.mouseY, n.x, n.y) < themeR,
          );
          const overRec = themeNodes.some(
            (t) =>
              t.expanded &&
              t.recNodes.some(
                (r) => p.dist(p.mouseX, p.mouseY, r.x, r.y) < recNodeR,
              ),
          );
          p.cursor(overCard || overTheme || overRec ? "pointer" : "default");
        }

        // ─── Arc path ─────────────────────────────────────────────────────────────
        function drawArcPath({ bx, by, arcR }: ReturnType<typeof getLayout>) {
          p.noFill();
          p.stroke(200);
          p.strokeWeight(1.5);
          p.beginShape();
          for (let a = ARC_START; a <= ARC_END; a += 0.04) {
            p.vertex(bx + arcR * p.cos(a), by + arcR * p.sin(a));
          }
          p.endShape();
        }

        // ─── Card ─────────────────────────────────────────────────────────────────
        function drawBookCard({ bx, cardCY }: ReturnType<typeof getLayout>) {
          if (!isFlipped) drawCardFront(bx, cardCY);
          else drawCardBack(bx, cardCY);
        }

        function drawCardFront(cx: number, cy: number) {
          const ctx = p.drawingContext as CanvasRenderingContext2D;
          ctx.shadowOffsetY = 4;
          ctx.shadowBlur = 14;
          ctx.shadowColor = "rgba(0,0,0,0.10)";
          p.fill(255);
          p.noStroke();
          p.rectMode(p.CENTER);
          p.rect(cx, cy, CARD_W, CARD_H, 12);
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          const covW = 120,
            covH = 168;
          if (bookImg && bookImg !== "failed") {
            p.imageMode(p.CENTER);
            p.image(bookImg as p5.Image, cx, cy - 8, covW, covH);
          } else {
            p.fill(210);
            p.noStroke();
            p.rectMode(p.CENTER);
            p.rect(cx, cy - 8, covW, covH, 4);
            p.fill(160);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(9);
            p.textStyle(p.NORMAL);
            p.text("loading...", cx, cy - 8);
          }

          p.noStroke();
          p.fill(180);
          p.textAlign(p.CENTER, p.TOP);
          p.textSize(8);
          p.textStyle(p.NORMAL);
          p.text("click to flip", cx, cy + CARD_H / 2 + 6);
        }

        function drawCardBack(cx: number, cy: number) {
          const ctx = p.drawingContext as CanvasRenderingContext2D;
          ctx.shadowOffsetY = 6;
          ctx.shadowBlur = 20;
          ctx.shadowColor = "rgba(0,0,0,0.10)";
          p.fill(255);
          p.noStroke();
          p.rectMode(p.CENTER);
          p.rect(cx, cy, CARD_W, CARD_H, 12);
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          const pad = 18;
          const mw = CARD_W - pad * 2;

          p.push();
          p.translate(cx - CARD_W / 2 + pad, cy - CARD_H / 2 + pad);
          p.rectMode(p.CORNER);
          p.textAlign(p.LEFT, p.TOP);
          p.noStroke();
          let y = 0;

          p.fill(20);
          p.textSize(11);
          p.textStyle(p.BOLD);
          p.text(book!.title, 0, y, mw);
          y += estimateTextH(book!.title, 11, mw) + 4;

          p.textStyle(p.NORMAL);
          p.fill(110);
          p.textSize(10);
          p.text(book!.author ?? "", 0, y, mw);
          y += 15;

          p.fill(90);
          p.textSize(10);
          p.text("★ " + (book!.rating ?? "—") + " / 5", 0, y, mw);
          y += 16;

          p.stroke(220);
          p.strokeWeight(0.8);
          p.line(0, y, mw, y);
          p.noStroke();
          y += 9;

          p.fill(80);
          p.textSize(9);
          p.text(book!.description ?? "", 0, y, mw);
          y += estimateTextH(book!.description ?? "", 9, mw) + 6;

          if (book!.themes?.length) {
            p.fill(110);
            p.textSize(9);
            p.text("Themes: " + book!.themes.join(", "), 0, y, mw);
          }

          p.pop();

          p.fill(180);
          p.textAlign(p.CENTER, p.TOP);
          p.textSize(8);
          p.textStyle(p.NORMAL);
          p.noStroke();
          p.text("click to flip back", cx, cy + CARD_H / 2 + 6);
        }

        function estimateTextH(str: string, sz: number, mw: number): number {
          p.textSize(sz);
          const lineH = sz * 1.5;
          const words = (str || "").split(" ");
          let lineW = 0;
          let lines = 1;
          for (const w of words) {
            const ww = p.textWidth(w + " ");
            if (lineW + ww > mw) {
              lines++;
              lineW = ww;
            } else lineW += ww;
          }
          return lines * lineH;
        }

        // ─── Theme nodes ──────────────────────────────────────────────────────────
        function drawThemeNodes({ themeR }: ReturnType<typeof getLayout>) {
          for (const n of themeNodes) {
            const hovered = p.dist(p.mouseX, p.mouseY, n.x, n.y) < themeR;
            p.fill(n.expanded ? "#6366f1" : hovered ? "#818cf8" : "#c7d2fe");
            p.stroke(255);
            p.strokeWeight(1.5);
            p.ellipse(n.x, n.y, themeR * 2, themeR * 2);
            p.noStroke();
            p.fill(n.expanded ? 255 : 50);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(11);
            p.textStyle(p.NORMAL);
            p.text(n.label, n.x, n.y - themeR - 6);
          }
        }

        // ─── Rec nodes ────────────────────────────────────────────────────────────
        function drawRecNodes({ recNodeR }: ReturnType<typeof getLayout>) {
          for (const theme of themeNodes) {
            if (!theme.expanded) continue;
            for (const rec of theme.recNodes) {
              p.stroke(200);
              p.strokeWeight(1);
              p.line(theme.x, theme.y, rec.x, rec.y);

              const hovered =
                p.dist(p.mouseX, p.mouseY, rec.x, rec.y) < recNodeR;
              p.fill(hovered ? "#f59e0b" : "#fde68a");
              p.stroke(255);
              p.strokeWeight(1);
              p.ellipse(rec.x, rec.y, recNodeR * 2, recNodeR * 2);

              p.noStroke();
              p.fill(50);
              p.textAlign(p.CENTER, p.CENTER);
              p.textSize(9);
              p.textStyle(p.NORMAL);
              p.text(rec.label, rec.x, rec.y);

              if (hovered) {
                p.fill(30);
                p.textAlign(p.CENTER, p.BOTTOM);
                p.textSize(10);
                p.text(rec.mockBook.title, rec.x, rec.y - recNodeR - 6, 150);
                p.fill(150);
                p.textSize(8);
                p.text("double-click to explore", rec.x, rec.y + recNodeR + 12);
              }
            }
          }
        }

        // ─── Mouse ────────────────────────────────────────────────────────────────
        p.mousePressed = () => {
          if (!book) return;
          const { bx, cardCY, themeR, recR, recNodeR } = getLayout();

          for (const theme of themeNodes) {
            if (!theme.expanded) continue;
            for (const rec of theme.recNodes) {
              if (p.dist(p.mouseX, p.mouseY, rec.x, rec.y) < recNodeR) return;
            }
          }

          if (
            p.abs(p.mouseX - bx) < CARD_W / 2 &&
            p.abs(p.mouseY - cardCY) < CARD_H / 2
          ) {
            isFlipped = !isFlipped;
            return;
          }

          for (const n of themeNodes) {
            if (p.dist(p.mouseX, p.mouseY, n.x, n.y) < themeR) {
              n.expanded = !n.expanded;
              if (n.expanded) n.recNodes = buildRecNodes(n, recR);
              else n.recNodes = [];
              return;
            }
          }
        };

        p.doubleClicked = () => {
          if (!book) return;
          const { recNodeR } = getLayout();
          for (const theme of themeNodes) {
            if (!theme.expanded) continue;
            for (const rec of theme.recNodes) {
              if (p.dist(p.mouseX, p.mouseY, rec.x, rec.y) < recNodeR) {
                setBook(rec.mockBook);
              }
            }
          }
        };
      }, containerRef.current);
    });

    return () => {
      cancelled = true;
      instance?.remove();
    };
  }, []);

  useEffect(() => {
    const book = state.books[0];
    if (book) sketchRef.current?.setBook(book);
  }, [state.books]);

  return <div ref={containerRef} className="w-full h-full relative" />;
}