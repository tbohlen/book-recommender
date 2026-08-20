import { z } from "zod";

export const recSchema = z.object({
  books: z.array(
    z.object({
      title: z.string().describe("The title of the recommended book."),
      author: z
        .string()
        .describe("The primary author of the recommended book."),
    }),
  ),
});

export type RecommendedBookQuery = z.infer<typeof recSchema>["books"][number];
