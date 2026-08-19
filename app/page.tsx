'use client';
import Display from "@/components/display";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useActionState } from "react";
import identifyBook from "./books/identify/actions";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const [state, bookFormAction, isPending] = useActionState(identifyBook, {
    status: "idle",
    books: [],
    errorMessage: null,
  });

  return (
    <main className="bg-white dark:bg-black w-full h-full">
      <Display books={state.books} />
      <footer className="fixed bottom-0 left-0 w-full bg-stone-200 dark:bg-gray-800 p-4 flex justify-center">
        <form action={bookFormAction}>
          <Field orientation="horizontal" className="w-auto">
            <Input
              name="book"
              placeholder="Describe a book to add"
              className="max-w-150 min-w-120 bg-stone-100"
            />
            <Button type="submit" disabled={isPending}>
              { isPending ? <Spinner /> : "Add" }
              </Button>
          </Field>
        </form>
      </footer>
    </main>
  );
}
