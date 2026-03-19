import type { QuizQuestion } from "../content/types";

type MatchPairObject = { left: string; right: string };

function safeString(v: any) {
  return v == null ? "" : String(v);
}

export function encodeQuestionsForFirestore(questions: QuizQuestion[]): any[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((q: any) => {
    if (!q || typeof q !== "object") return q;

    if (q.type === "match") {
      const pairs = Array.isArray(q.pairs) ? q.pairs : [];
      const encoded: MatchPairObject[] = pairs
        .map((p: any) => {
          if (Array.isArray(p)) return { left: safeString(p[0]), right: safeString(p[1]) };
          if (p && typeof p === "object") return { left: safeString(p.left), right: safeString(p.right) };
          return { left: "", right: "" };
        })
        .filter((p) => p.left || p.right);
      return { ...q, pairs: encoded };
    }

    // Firestore doesn't allow nested arrays anywhere; keep other question types as-is.
    return q;
  });
}

export function decodeQuestionsFromFirestore(raw: any): QuizQuestion[] {
  const questions = Array.isArray(raw) ? raw : [];
  return questions.map((q: any) => {
    if (!q || typeof q !== "object") return q;

    if (q.type === "match") {
      const pairs = Array.isArray(q.pairs) ? q.pairs : [];
      const decoded: Array<[string, string]> = pairs
        .map((p: any) => {
          if (Array.isArray(p)) return [safeString(p[0]), safeString(p[1])] as [string, string];
          if (p && typeof p === "object") return [safeString(p.left), safeString(p.right)] as [string, string];
          return ["", ""] as [string, string];
        })
        .filter((p) => p[0] || p[1]);
      return { ...q, pairs: decoded };
    }

    return q;
  });
}

