import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function listClasses() {
  const snap = await getDocs(collection(db, "classes"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listSubjectsByClass(classId) {
  const q = query(collection(db, "subjects"), where("classId", "==", String(classId)));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listParagraphs(classId, subjectId) {
  const q = query(
    collection(db, "paragraphs"),
    where("classId", "==", String(classId)),
    where("subjectId", "==", String(subjectId))
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getQuizById(quizId) {
  const snap = await getDoc(doc(db, "quizzes", String(quizId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

