import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

function decodeQuizQuestions(raw) {
  const questions = Array.isArray(raw) ? raw : [];
  return questions.map((q) => {
    if (!q || typeof q !== "object") return q;
    if (q.type === "match") {
      const pairs = Array.isArray(q.pairs) ? q.pairs : [];
      const decoded = pairs
        .map((p) => {
          if (Array.isArray(p)) return [String(p[0] ?? ""), String(p[1] ?? "")];
          if (p && typeof p === "object") return [String(p.left ?? ""), String(p.right ?? "")];
          return ["", ""];
        })
        .filter((p) => p[0] || p[1]);
      return { ...q, pairs: decoded };
    }
    return q;
  });
}

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
  const cid = String(classId);
  const sid = String(subjectId);
  try {
    const q = query(collection(db, "paragraphs"), where("classId", "==", cid), where("subjectId", "==", sid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // If composite index missing, fallback to classId-only query.
    const code = e && e.code ? String(e.code) : "";
    if (code && code !== "failed-precondition") throw e;
    const q = query(collection(db, "paragraphs"), where("classId", "==", cid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => String(p && p.subjectId ? p.subjectId : "") === sid);
  }
}

export async function getQuizById(quizId) {
  const snap = await getDoc(doc(db, "quizzes", String(quizId)));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return { id: snap.id, ...data, questions: decodeQuizQuestions(data.questions) };
}

