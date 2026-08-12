'use client';
import { useState } from "react";
import { State, Book } from "../types/state";
import Display from "../components/display";
import { Input } from "../components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const [state, setState] = useState({ books: [] } as State);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const book = formData.get("book") as string;
    // this is just for testing
    const themeExamples = [
      "Science Fiction",
      "Historical Fiction",
      "Non-Fiction",
      "Sad",
      "Funny",
      "Italy",
      "South Africa",
      "Japan",
      "Complex Characters",
      "Literary References",
    ];
    const imageExamples = [
      "https://placekittens.com/g/200/300",
      "https://placekittens.com/g/200/200",
    ];
    const newBook = {
      id: uuidv4(),
      title: book,
      description: "This is a description of the book.",
      imageUrl: imageExamples[Math.floor(Math.random() * imageExamples.length)],
      themes: [
        themeExamples[Math.floor(Math.random() * themeExamples.length)],
        themeExamples[Math.floor(Math.random() * themeExamples.length)],
        themeExamples[Math.floor(Math.random() * themeExamples.length)],
      ],
    } as Book;
    setState((prevState) => ({
      books: [newBook, ...prevState.books],
    }));
    form.reset();
  };

  return (
    <main className="bg-white dark:bg-black w-full h-full">
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
