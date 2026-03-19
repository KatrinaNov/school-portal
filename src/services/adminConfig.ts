import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

export type AdminClass = { id: string; name: string };
export type AdminSubject = {
  key: string; // Firestore doc id
  id: string; // subjectId used by content/quizzes
  classId: string;
  name: string;
  path: string;
  showOnlyQuizzes?: boolean;
};

function slugify(input: string) {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return s || "subject";
}

export function subjectDocId(classId: string, subjectId: string) {
  return `${String(classId)}__${String(subjectId)}`;
}

export async function listClasses(): Promise<AdminClass[]> {
  const snap = await getDocs(collection(db, "classes"));
  return snap.docs
    .map((d) => ({ id: String(d.id), name: String((d.data() as any)?.name || "") }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function upsertClass(input: { id: string; name: string }): Promise<void> {
  const id = String(input.id || "").trim();
  if (!id) throw new Error("Class id is required");
  await setDoc(doc(db, "classes", id), { name: String(input.name || "").trim() }, { merge: true });
}

export async function listSubjectsByClass(classId: string): Promise<AdminSubject[]> {
  const cid = String(classId);
  const q = query(collection(db, "subjects"), where("classId", "==", cid));
  const snap = await getDocs(q);
  const raw = snap.docs.map((d) => {
    const data = d.data() as any;
    const key = String(d.id);
    const inferredFromKey =
      key.includes("__") && key.split("__")[0] === cid ? String(key.split("__")[1] || "") : key;
    const id = String(data?.subjectId || data?.id || inferredFromKey || "");
    return {
      key,
      id,
      classId: String(data?.classId || cid),
      name: String(data?.name || ""),
      path: String(data?.path || ""),
      showOnlyQuizzes: data?.showOnlyQuizzes === true,
    } satisfies AdminSubject;
  });

  // De-duplicate by subjectId:
  // - Prefer new schema docId = `${classId}__${subjectId}`
  // - Ignore broken legacy docs without subjectId/name/path
  const byId = new Map<string, AdminSubject>();
  for (const s of raw) {
    if (!s.id) continue;
    const preferredKey = subjectDocId(cid, s.id);
    const prev = byId.get(s.id);
    const score = (x: AdminSubject) => (x.key === preferredKey ? 2 : 1);
    if (!prev || score(s) > score(prev)) byId.set(s.id, s);
  }

  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export async function upsertSubject(input: {
  classId: string;
  subjectId: string;
  name: string;
  path: string;
  showOnlyQuizzes?: boolean;
}): Promise<void> {
  const classId = String(input.classId || "").trim();
  const subjectId = String(input.subjectId || "").trim();
  if (!classId) throw new Error("classId is required");
  if (!subjectId) throw new Error("subjectId is required");
  const key = subjectDocId(classId, subjectId);
  await setDoc(
    doc(db, "subjects", key),
    {
      classId,
      subjectId,
      name: String(input.name || "").trim(),
      path: String(input.path || "").trim(),
      showOnlyQuizzes: input.showOnlyQuizzes === true,
    },
    { merge: true }
  );
}

async function listDocRefsByClass(colName: string, classId: string) {
  const q = query(collection(db, colName), where("classId", "==", String(classId)));
  const snap = await getDocs(q);
  return snap.docs.map((d) => doc(db, colName, String(d.id)));
}

async function listDocRefsByClassSubject(colName: string, classId: string, subjectId: string) {
  const q = query(
    collection(db, colName),
    where("classId", "==", String(classId)),
    where("subjectId", "==", String(subjectId))
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => doc(db, colName, String(d.id)));
}

export async function deleteClassCascade(classId: string): Promise<{ deleted: number }> {
  const classRef = doc(db, "classes", String(classId));
  const subjectRefs = await listDocRefsByClass("subjects", classId);
  const paragraphRefs = await listDocRefsByClass("paragraphs", classId);
  const quizRefs = await listDocRefsByClass("quizzes", classId);

  const all = [classRef, ...subjectRefs, ...paragraphRefs, ...quizRefs];
  let deleted = 0;

  // Firestore batch limit is 500 ops.
  for (let i = 0; i < all.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = all.slice(i, i + 450);
    chunk.forEach((r) => batch.delete(r));
    await batch.commit();
    deleted += chunk.length;
  }

  // Best-effort: delete subject doc(s) that might not have classId indexed correctly.
  // (Historically, subjects had docId = subjectId, which can collide across classes.)
  // We keep this as minimal cleanup: if a subject doc remains, it will be overwritten when re-adding.
  try {
    await deleteDoc(classRef);
  } catch {
    // ignore
  }

  return { deleted };
}

export async function createSubjectAuto(input: {
  classId: string;
  name: string;
  path: string;
  showOnlyQuizzes?: boolean;
}): Promise<{ id: string }> {
  const classId = String(input.classId || "").trim();
  if (!classId) throw new Error("classId is required");
  const name = String(input.name || "").trim();
  if (!name) throw new Error("name is required");

  const existing = await listSubjectsByClass(classId);
  const base = slugify(name);
  let id = base;
  let n = 2;
  const ids = new Set(existing.map((s) => s.id));
  while (ids.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }

  await upsertSubject({
    classId,
    subjectId: id,
    name,
    path: String(input.path || "").trim(),
    showOnlyQuizzes: input.showOnlyQuizzes === true,
  });
  return { id };
}

export async function deleteSubjectCascade(classId: string, subjectId: string): Promise<{ deleted: number }> {
  const subjectRef = doc(db, "subjects", subjectDocId(classId, subjectId));
  const paragraphRefs = await listDocRefsByClassSubject("paragraphs", classId, subjectId);
  const quizRefs = await listDocRefsByClassSubject("quizzes", classId, subjectId);

  const all = [subjectRef, ...paragraphRefs, ...quizRefs];
  let deleted = 0;
  for (let i = 0; i < all.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = all.slice(i, i + 450);
    chunk.forEach((r) => batch.delete(r));
    await batch.commit();
    deleted += chunk.length;
  }
  return { deleted };
}

