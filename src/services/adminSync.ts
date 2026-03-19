import type { SubjectContent } from "./content/types";
import { upsertClass, upsertSubject, subjectDocId } from "./adminConfig";
import { upsertQuiz } from "./adminQuizzes";
import { updateParagraph } from "./adminContent";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export type SeedProgress =
  | { step: "start"; message: string }
  | { step: "config"; message: string }
  | { step: "subject"; message: string; classId: string; subjectId: string }
  | { step: "class"; message: string; classId: string }
  | { step: "done"; message: string };

export async function seedFromLocalConfig(cfg: any, onProgress?: (p: SeedProgress) => void) {
  onProgress?.({ step: "start", message: "Синхронизация CONFIG → Firestore…" });
  const classes = cfg && cfg.classes ? cfg.classes : {};

  for (const classId of Object.keys(classes)) {
    const c = classes[classId];
    await upsertClass({ id: String(classId), name: String(c?.name || "") });
    const subjects = c?.subjects || {};
    for (const subjectId of Object.keys(subjects)) {
      const s = subjects[subjectId];
      await upsertSubject({
        classId: String(classId),
        subjectId: String(subjectId),
        name: String(s?.name || ""),
        path: String(s?.path || ""),
        showOnlyQuizzes: s?.showOnlyQuizzes === true,
      });

      // Cleanup legacy schema: subjects/{subjectId} (without class prefix) could remain and cause duplicates.
      const legacyKey = String(subjectId);
      const newKey = subjectDocId(String(classId), String(subjectId));
      if (legacyKey !== newKey) {
        try {
          await deleteDoc(doc(db, "subjects", legacyKey));
        } catch {
          // ignore
        }
      }
    }
  }

  onProgress?.({ step: "config", message: "CONFIG синхронизирован." });
}

export async function seedSubjectFromContentJson(input: {
  classId: string;
  subjectId: string;
  onProgress?: (p: SeedProgress) => void;
}) {
  const classId = String(input.classId);
  const subjectId = String(input.subjectId);
  input.onProgress?.({ step: "subject", message: "Загрузка content.json…", classId, subjectId });

  const url = `/data/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/content.json`;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Не удалось загрузить content.json (${res.status})`);
  const data = (await res.json()) as SubjectContent;

  // Quizzes
  for (const q of Array.isArray(data.quizzes) ? data.quizzes : []) {
    await upsertQuiz({
      id: String(q.id),
      classId,
      subjectId,
      title: String(q.title || "Тест"),
      questions: Array.isArray(q.questions) ? (q.questions as any) : [],
      source: q.source,
      difficulty: q.difficulty,
    });
  }

  // Paragraphs
  for (const p of Array.isArray(data.paragraphs) ? data.paragraphs : []) {
    const legacyId = p?.id != null ? String(p.id) : "";
    if (!legacyId) continue;
    await updateParagraph(classId, subjectId, legacyId, {
      legacyId,
      title: String(p?.title || ""),
      summary: p?.summary != null ? String(p.summary) : "",
      image: p?.image != null ? p.image : null,
      sections: Array.isArray(p?.sections) ? p.sections : [],
      dates: Array.isArray(p?.dates) ? p.dates : [],
      terms: Array.isArray(p?.terms) ? p.terms : [],
      people: Array.isArray(p?.people) ? p.people : [],
      quizzes: Array.isArray(p?.quizzes) ? p.quizzes : [],
    } as any);
  }

  input.onProgress?.({ step: "subject", message: "Готово.", classId, subjectId });
}

export async function seedAllFromContentJson(cfg: any, onProgress?: (p: SeedProgress) => void) {
  const classes = cfg && cfg.classes ? cfg.classes : {};
  for (const classId of Object.keys(classes)) {
    const c = classes[classId];
    const subjects = c?.subjects || {};
    for (const subjectId of Object.keys(subjects)) {
      onProgress?.({ step: "subject", message: "Синхронизация предмета…", classId: String(classId), subjectId: String(subjectId) });
      await seedSubjectFromContentJson({ classId: String(classId), subjectId: String(subjectId), onProgress });
    }
  }
  onProgress?.({ step: "done", message: "Синхронизация завершена." });
}

export async function seedClassFromContentJson(input: {
  cfg: any;
  classId: string;
  onProgress?: (p: SeedProgress) => void;
}) {
  const classes = input.cfg && input.cfg.classes ? input.cfg.classes : {};
  const classId = String(input.classId);
  const c = classes[classId];
  if (!c) throw new Error(`Class not found in CONFIG: ${classId}`);
  input.onProgress?.({ step: "class", message: `Синхронизация класса ${classId}…`, classId });
  const subjects = c?.subjects || {};
  for (const subjectId of Object.keys(subjects)) {
    await seedSubjectFromContentJson({ classId, subjectId: String(subjectId), onProgress: input.onProgress });
  }
}

export async function seedQuizzesOnlyFromContentJson(input: {
  classId: string;
  subjectId: string;
  onProgress?: (p: SeedProgress) => void;
}) {
  const classId = String(input.classId);
  const subjectId = String(input.subjectId);
  input.onProgress?.({ step: "subject", message: "Загрузка content.json (только тесты)…", classId, subjectId });

  const url = `/data/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/content.json`;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Не удалось загрузить content.json (${res.status})`);
  const data = (await res.json()) as SubjectContent;

  for (const q of Array.isArray(data.quizzes) ? data.quizzes : []) {
    await upsertQuiz({
      id: String(q.id),
      classId,
      subjectId,
      title: String(q.title || "Тест"),
      questions: Array.isArray(q.questions) ? (q.questions as any) : [],
      source: q.source,
      difficulty: q.difficulty,
    });
  }
}

export async function seedParagraphsOnlyFromContentJson(input: {
  classId: string;
  subjectId: string;
  onProgress?: (p: SeedProgress) => void;
}) {
  const classId = String(input.classId);
  const subjectId = String(input.subjectId);
  input.onProgress?.({ step: "subject", message: "Загрузка content.json (только параграфы)…", classId, subjectId });

  const url = `/data/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/content.json`;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Не удалось загрузить content.json (${res.status})`);
  const data = (await res.json()) as SubjectContent;

  for (const p of Array.isArray(data.paragraphs) ? data.paragraphs : []) {
    const legacyId = p?.id != null ? String(p.id) : "";
    if (!legacyId) continue;
    await updateParagraph(classId, subjectId, legacyId, {
      legacyId,
      title: String(p?.title || ""),
      summary: p?.summary != null ? String(p.summary) : "",
      image: p?.image != null ? p.image : null,
      sections: Array.isArray(p?.sections) ? p.sections : [],
      dates: Array.isArray(p?.dates) ? p.dates : [],
      terms: Array.isArray(p?.terms) ? p.terms : [],
      people: Array.isArray(p?.people) ? p.people : [],
      quizzes: Array.isArray(p?.quizzes) ? p.quizzes : [],
    } as any);
  }
}

