import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import type { Paragraph, Quiz, QuizQuestion, SubjectContent } from "./types";
import { decodeQuestionsFromFirestore } from "../quizzes/firestoreCodec";

function safeString(v: any) {
  return v == null ? "" : String(v);
}

function toParagraph(doc: any): Paragraph {
  const quizRefs = Array.isArray(doc?.quizzes)
    ? doc.quizzes
        .map((r: any) => ({ id: safeString(r?.id), title: r?.title != null ? safeString(r.title) : undefined }))
        .filter((r: any) => r.id)
    : [];

  return {
    id: safeString(doc?.legacyId || doc?.id),
    title: safeString(doc?.title || ""),
    summary: doc?.summary != null ? safeString(doc.summary) : undefined,
    image: doc?.image != null ? safeString(doc.image) : null,
    sections: Array.isArray(doc?.sections) ? doc.sections : [],
    dates: Array.isArray(doc?.dates) ? doc.dates : [],
    terms: Array.isArray(doc?.terms) ? doc.terms : [],
    people: Array.isArray(doc?.people) ? doc.people : [],
    quizzes: quizRefs,
  } as Paragraph;
}

function toQuiz(doc: any): Quiz {
  return {
    id: safeString(doc?.id),
    title: safeString(doc?.title || "Тест"),
    source: doc?.source != null ? safeString(doc.source) : undefined,
    difficulty: doc?.difficulty != null ? safeString(doc.difficulty) : undefined,
    questions: decodeQuestionsFromFirestore(doc?.questions),
  };
}

export async function fetchSubjectContentFirestore(classId: string, subjectId: string): Promise<SubjectContent> {
  const cid = String(classId);
  const sid = String(subjectId);

  const tryGet = async <T,>(mk: () => Promise<T>, fallback: () => Promise<T>) => {
    try {
      return await mk();
    } catch (e: any) {
      const code = e?.code ? String(e.code) : "";
      if (code && code !== "failed-precondition") throw e;
      return await fallback();
    }
  };

  const paragraphsRaw = await tryGet(
    async () => {
      const pq = query(collection(db, "paragraphs"), where("classId", "==", cid), where("subjectId", "==", sid));
      const snap = await getDocs(pq);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    },
    async () => {
      const pq = query(collection(db, "paragraphs"), where("classId", "==", cid));
      const snap = await getDocs(pq);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((p) => String(p?.subjectId || "") === sid);
    }
  );

  const quizzesRaw = await tryGet(
    async () => {
      const qq = query(collection(db, "quizzes"), where("classId", "==", cid), where("subjectId", "==", sid));
      const snap = await getDocs(qq);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    },
    async () => {
      const qq = query(collection(db, "quizzes"), where("classId", "==", cid));
      const snap = await getDocs(qq);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((q) => String(q?.subjectId || "") === sid);
    }
  );

  const paragraphs = paragraphsRaw.map((d) => toParagraph(d));

  // Sort like adminContent (by numeric legacyId when possible)
  paragraphs.sort((a: any, b: any) => {
    const na = Number(a.id);
    const nb = Number(b.id);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.id).localeCompare(String(b.id));
  });

  const quizzes = quizzesRaw.map((d) => toQuiz(d)).sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: 1,
    meta: {
      classId: String(classId),
      subjectId: String(subjectId),
      title: `${classId}/${subjectId}`,
      updated: new Date().toISOString(),
    },
    paragraphs,
    quizzes,
  };
}

