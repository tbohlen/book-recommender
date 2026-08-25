import { books_v1 } from "@googleapis/books";
import { z } from "zod";

export type GoogleBook = NonNullable<books_v1.Schema$Volume["volumeInfo"]>;

/**
 * A `GoogleBook` plus the stable Google Books volume id (`Schema$Volume.id`,
 * which lives alongside `volumeInfo` rather than inside it). This id is what
 * lets app state key/dedupe books by identity instead of by object reference.
 */
export interface IdentifiedBook extends GoogleBook {
  id: string;
}

export interface BookWithThemes extends IdentifiedBook {
  themes: string[] | null;
}

/**
 * Validates a single `BookWithThemes` entry from untrusted input (e.g. an
 * API request body).
 *
 * Enumerates only the `volumeInfo` fields our theme-extraction prompts
 * actually rely on (see `app/themes/common-themes-prompt.ts`), plus the
 * `themes` field added by our own pipeline. Uses `looseObject` rather than
 * mirroring all of `GoogleBook`, since that type has dozens of other fields
 * (`imageLinks`, `industryIdentifiers`, etc.) that are legitimate to pass
 * through as extra model context but aren't worth hand-maintaining a schema
 * for — and since `GoogleBook` is generated from Google's API spec rather
 * than owned by us, there's no single source of truth to derive this schema
 * from automatically.
 */
export const bookWithThemesSchema = z.looseObject({
  id: z.string(),
  title: z.string().optional(),
  authors: z.array(z.string()).optional(),
  description: z.string().optional(),
  categories: z.array(z.string()).optional(),
  publishedDate: z.string().optional(),
  publisher: z.string().optional(),
  themes: z.array(z.string()).nullable(),
});

export interface IdentifyBookState {
  status: "idle" | "success" | "error";
  books: BookWithThemes[];
  errorMessage: string | null;
}