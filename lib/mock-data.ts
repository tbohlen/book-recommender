import { Book } from '../types/state';

export const MOCK_BOOK: Book = {
    id: 'mock-1',                                                                  
    title: 'The Alchemist',                                 
    author: 'Paulo Coelho',                                                      
    rating: 4.5,
    description: 'A shepherd travels from Spain to Egypt in search of treasure — and finds something far greater.',          
    imageUrl: 'https://covers.openlibrary.org/b/id/8739161-M.jpg',
    themes: ['Journey', 'Destiny', 'Philosophy'],
};

export const MOCK_REC_BOOKS: Book[] = [
  {
    id: 'rec-1',
    title: 'Siddhartha',
    author: 'Hermann Hesse',
    rating: 4.4,
    imageUrl: 'https://covers.openlibrary.org/b/id/8226191-M.jpg',
    themes: ['Enlightenment', 'Sacrifice', 'Self'],
    description: 'A young man leaves home in search of spiritual enlightenment.'
  },
  {
    id: 'rec-2',
    title: 'The Prophet',
    author: 'Kahlil Gibran',
    rating: 4.4,
    imageUrl: 'https://covers.openlibrary.org/b/id/8228008-M.jpg',
    themes: ['Wisdom', 'Life', 'Philosophy'],
    description: 'Poetic prose on love, freedom, and the nature of existence.'
  },
  {
    id: 'rec-3',
    title: 'Life of Pi',
    author: 'Yann Martel',
    rating: 4.2,
    imageUrl: 'https://covers.openlibrary.org/b/id/8406786-M.jpg',
    themes: ['Survival', 'Faith', 'Storytelling'],
    description: 'A boy and a Bengal tiger survive 227 days adrift on the Pacific.'
  },
  {
    id: 'rec-4',
    title: 'Illusions',
    author: 'Richard Bach',
    rating: 4.1,
    imageUrl: 'https://covers.openlibrary.org/b/id/8091016-M.jpg',
    themes: ['Illusion', 'Freedom', 'Philosophy'],
    description: 'A reluctant messiah teaches that the world is an illusion of our making.'
  },
  {
    id: 'rec-5',
    title: 'Eat Pray Love',
    author: 'Elizabeth Gilbert',
    rating: 3.9,
    imageUrl: 'https://covers.openlibrary.org/b/id/7222246-M.jpg',
    themes: ['Healing', 'Journey', 'Identity'],
    description: 'A woman travels the world to rediscover herself after a painful divorce.'
  },
  {
    id: 'rec-6',
    title: 'The Power of Now',
    author: 'Eckhart Tolle',
    rating: 4.3,
    imageUrl: 'https://covers.openlibrary.org/b/id/8406791-M.jpg',
    themes: ['Mindfulness', 'Presence', 'Awareness'],
    description: 'A guide to spiritual enlightenment through present-moment living.'
  },
  {
    id: 'rec-7',
    title: 'Jonathan Seagull',
    author: 'Richard Bach',
    rating: 4.0,
    imageUrl: 'https://covers.openlibrary.org/b/id/8094861-M.jpg',
    themes: ['Freedom', 'Perfection', 'Growth'],
    description: 'A seagull learns about life and the power of self-perfection.'
  },
  {
    id: 'rec-8',
    title: 'The Celestines',
    author: 'James Redfield',
    rating: 3.8,
    imageUrl: 'https://covers.openlibrary.org/b/id/8094862-M.jpg',
    themes: ['Spirituality', 'Destiny', 'Adventure'],
    description: 'Ancient insights in Peru offer a new understanding of life.'
  },
  {
    id: 'rec-9',
    title: 'Tuesdays w/Morrie',
    author: 'Mitch Albom',
    rating: 4.5,
    imageUrl: 'https://covers.openlibrary.org/b/id/8406789-M.jpg',
    themes: ['Mortality', 'Wisdom', 'Friendship'],
    description: 'A dying professor shares his final lessons on what truly matters.'
  }
];
