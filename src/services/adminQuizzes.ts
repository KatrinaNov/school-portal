import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Quiz, QuizQuestion } from "./content/types";
import { decodeQuestionsFromFirestore, encodeQuestionsForFirestore } from "./quizzes/firestoreCodec";

export async function listQuizzesBySubject(classId: string, subjectId: string): Promise<Quiz[]> {
  const cid = String(classId);
  const sid = String(subjectId);
  let docs: Array<{ id: string; data: any }> = [];
  try {
    const q = query(collection(db, "quizzes"), where("classId", "==", cid), where("subjectId", "==", sid));
    const snap = await getDocs(q);
    docs = snap.docs.map((d) => ({ id: String(d.id), data: d.data() as any }));
  } catch (e: any) {
    const code = e?.code ? String(e.code) : "";
    if (code && code !== "failed-precondition") throw e;
    const q = query(collection(db, "quizzes"), where("classId", "==", cid));
    const snap = await getDocs(q);
    docs = snap.docs
      .map((d) => ({ id: String(d.id), data: d.data() as any }))
      .filter((x) => String(x.data?.subjectId || "") === sid);
  }

  return docs
    .map(({ id, data }) => {
      return {
        id,
        title: String(data?.title || "Тест"),
        source: data?.source != null ? String(data.source) : undefined,
        difficulty: data?.difficulty != null ? String(data.difficulty) : undefined,
        questions: decodeQuestionsFromFirestore(data?.questions),
      } satisfies Quiz;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function getQuiz(quizId: string): Promise<Quiz | null> {
  const snap = await getDoc(doc(db, "quizzes", String(quizId)));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return {
    id: String(snap.id),
    title: String(data?.title || "Тест"),
    source: data?.source != null ? String(data.source) : undefined,
    difficulty: data?.difficulty != null ? String(data.difficulty) : undefined,
    questions: decodeQuestionsFromFirestore(data?.questions),
  };
}

export async function upsertQuiz(input: {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  questions: QuizQuestion[];
  source?: string;
  difficulty?: string;
}): Promise<void> {
  const id = String(input.id || "").trim();
  if (!id) throw new Error("quiz id is required");
  const questions = encodeQuestionsForFirestore(input.questions);
  await setDoc(
    doc(db, "quizzes", id),
    {
      classId: String(input.classId || "").trim(),
      subjectId: String(input.subjectId || "").trim(),
      title: String(input.title || "Тест"),
      source: input.source != null ? String(input.source) : "manual",
      difficulty: input.difficulty != null ? String(input.difficulty) : "medium",
      questions,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createQuiz(input: { classId: string; subjectId: string }): Promise<Quiz> {
  const id = `quiz-${Date.now()}`;
  const quiz: Quiz = { id, title: "Новый тест", questions: [] };
  await upsertQuiz({ id, classId: input.classId, subjectId: input.subjectId, title: quiz.title, questions: [] });
  return quiz;
}

export async function deleteQuiz(quizId: string): Promise<void> {
  await deleteDoc(doc(db, "quizzes", String(quizId)));
}

