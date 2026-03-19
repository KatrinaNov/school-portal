import { collection, doc, getDocs, query, setDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

// We keep the existing Firestore schema used by migrate/sync:
// paragraphs/{classId}__{subjectId}__{legacyId}

export async function listParagraphsBySubject(classId: string, subjectId: string) {
  const q = query(
    collection(db, "paragraphs"),
    where("classId", "==", String(classId)),
    where("subjectId", "==", String(subjectId))
  );
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  items.sort((a: any, b: any) => {
    const na = Number(a.legacyId ?? a.id);
    const nb = Number(b.legacyId ?? b.id);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.legacyId ?? a.id).localeCompare(String(b.legacyId ?? b.id));
  });
  return items;
}

export async function createParagraph(classId: string, subjectId: string, payload: any) {
  const legacyId = String(payload?.legacyId || "");
  if (!legacyId) throw new Error("legacyId required");
  const id = `${String(classId)}__${String(subjectId)}__${legacyId}`;
  await setDoc(
    doc(db, "paragraphs", id),
    {
      classId: String(classId),
      subjectId: String(subjectId),
      legacyId,
      ...payload,
    },
    { merge: true }
  );
  return { id, legacyId };
}

export async function updateParagraph(classId: string, subjectId: string, legacyId: string, payload: any) {
  const id = `${String(classId)}__${String(subjectId)}__${String(legacyId)}`;
  await setDoc(
    doc(db, "paragraphs", id),
    {
      classId: String(classId),
      subjectId: String(subjectId),
      legacyId: String(legacyId),
      ...payload,
    },
    { merge: true }
  );
  return { id };
}

export async function deleteParagraph(classId: string, subjectId: string, legacyId: string) {
  const id = `${String(classId)}__${String(subjectId)}__${String(legacyId)}`;
  await deleteDoc(doc(db, "paragraphs", id));
}

