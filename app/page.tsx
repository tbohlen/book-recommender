"use client";
import { useState } from "react";
import { State, Book } from "../types/state";
import Display from "../components/display";
import { Input } from "../components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { v4 as uuidv4 } from "uuid";
import { MOCK_BOOK } from "@/lib/mock-data";

export default function Home() {
  const [state, setState] = useState({ books: [] } as State);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const book = formData.get("book") as string;

    const newBook = { ...MOCK_BOOK, title: book } as Book;
    setState((prevState) => ({
      books: [newBook, ...prevState.books],
    }));
    form.reset();
  };

  return (
    <main className="bg-white dark:bg-black w-full h-full overflow-hidden">
      <Display state={state} />
      <footer className="fixed bottom-0 left-0 w-full bg-stone-200 dark:bg-gray-800 p-4 flex justify-center">
        <form onSubmit={handleSubmit}>
          <Field orientation="horizontal" className="w-auto">
            <Input
              name="book"
              placeholder="Describe a book to add"
              className="max-w-150 min-w-120 bg-stone-100"
            />
            <Button type="submit">Add</Button>
          </Field>
        </form>
      </footer>
    </main>
  );
}
