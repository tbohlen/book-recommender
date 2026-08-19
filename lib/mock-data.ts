import { BookWithThemes } from "../app/books/identify/types";

export const MOCK_BOOK: BookWithThemes = {
  title: "The Alchemist",
  authors: ["Paulo Coelho"],
  averageRating: 4.5,
  description:
    "A shepherd travels from Spain to Egypt in search of treasure — and finds something far greater.",
  imageLinks: {
    thumbnail: "https://covers.openlibrary.org/b/id/8739161-M.jpg",
  },
  themes: ["Journey", "Destiny", "Philosophy"],
};

export const MOCK_REC_BOOKS: BookWithThemes[] = [
  {
    title: "Siddhartha",
    authors: ["Hermann Hesse"],
    averageRating: 4.4,
    imageLinks: {
      thumbnail: "https://covers.openlibrary.org/b/id/8226191-M.jpg",
    },
    themes: ["Enlightenment", "Sacrifice", "Self"],
    description: "A young man leaves home in search of spiritual enlightenment.",
  },
  {
    title: "The Prophet",
    authors: ["Kahlil Gibran"],
    averageRating: 4.4,
    imageLinks: {
      thumbnail: "https://covers.openlibrary.org/b/id/8228008-M.jpg",
    },
    themes: ["Wisdom", "Life", "Philosophy"],
    description: "Poetic prose on love, freedom, and the nature of existence.",
  },
  {
    title: "Life of Pi",
    authors: ["Yann Martel"],
    averageRating: 4.2,
    imageLinks: {
      thumbnail: "https://covers.openlibrary.org/b/id/8406786-M.jpg",
    },
    themes: ["Survival", "Faith", "Storytelling"],
    description: "A boy and a Bengal tiger survive 227 days adrift on the Pacific.",
  },
  {
    title: "Illusions",
    authors: ["Richard Bach"],
    averageRating: 4.1,
    imageLinks: {
      thumbnail: "https://covers.openlibrary.org/b/id/8091016-M.jpg",
    },
    themes: ["Illusion", "Freedom", "Philosophy"],
    description: "A reluctant messiah teaches that the world is an illusion of our making.",
  },
  {
    title: "Eat Pray Love",
    authors: ["Elizabeth Gilbert"],
    averageRating: 3.9,
    imageLinks: {
      thumbnail: "https://covers.openlibrary.org/b/id/7222246-M.jpg",
    },
    themes: ["Healing", "Journey", "Identity"],
    description: "A woman travels the world to rediscover herself after a painful divorce.",
  },
  {
    title: "The Power of Now",
    authors: ["Eckhart Tolle"],
    averageRating: 4.3,
    imageLinks: {
      thumbnail: "https://covers.openlibrary.org/b/id/8406791-M.jpg",
    },
    themes: ["Mindfulness", "Presence", "Awareness"],
    description: "A guide to spiritual enlightenment through present-moment living.",
  },
  {
    title: "Jonathan Seagull",
    authors: ["Richard Bach"],
    averageRating: 4.0,
    imageLinks: {
      thumbnail: "https://covers.openlibrary.org/b/id/8094861-M.jpg",
    },
    themes: ["Freedom", "Perfection", "Growth"],
    description: "A seagull learns about life and the power of self-perfection.",
  },
  {
    title: "The Celestines",
    authors: ["James Redfield"],
    averageRating: 3.8,
    imageLinks: {
      thumbnail: "https://covers.openlibrary.org/b/id/8094862-M.jpg",
    },
    themes: ["Spirituality", "Destiny", "Adventure"],
    description: "Ancient insights in Peru offer a new understanding of life.",
  },
  {
    title: "Tuesdays w/Morrie",
    authors: ["Mitch Albom"],
    averageRating: 4.5,
    imageLinks: {
      thumbnail: "https://covers.openlibrary.org/b/id/8406789-M.jpg",
    },
    themes: ["Mortality", "Wisdom", "Friendship"],
    description: "A dying professor shares his final lessons on what truly matters.",
  },
];
