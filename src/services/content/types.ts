export type ContentMeta = {
  classId: string;
  subjectId: string;
  title: string;
  updated?: string;
};

export type QuizRef = {
  id: string;
  title?: string;
  source?: string;
};

export type Term = {
  id: string;
  term: string;
  definition: string;
  image: string | null;
};

export type Person = {
  id: string;
  name: string;
  description?: string;
  image?: string | null;
};

export type Paragraph = {
  id: string;
  title: string;
  summary?: string;
  image: string | null;
  sections: unknown[];
  dates: unknown[];
  terms: Term[];
  people: Person[];
  quizzes: QuizRef[];
};

export type QuizQuestion =
  | {
      type: "choice";
      q: string;
      a: Array<string | { text: string }>;
      c: number;
      image?: string;
    }
  | {
      type: "multiple_choice";
      q: string;
      a: Array<string | { text: string }>;
      c: number[];
      image?: string;
    }
  | {
      type: "match";
      q: string;
      pairs: Array<[string, string]>;
    }
  | {
      type: "fill_words";
      q: string;
      answers: string[];
    }
  | {
      type: "input";
      q: string;
      answer: string;
    }
  | {
      // forward-compatible
      type: string;
      [key: string]: unknown;
    };

export type Quiz = {
  id: string;
  title: string;
  source?: string;
  difficulty?: string;
  questions: QuizQuestion[];
};

export type SubjectContent = {
  version: number;
  meta: ContentMeta;
  paragraphs: Paragraph[];
  quizzes: Quiz[];
};

