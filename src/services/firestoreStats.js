import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function saveQuizAttempt(uid, payload) {
  if (!uid) throw new Error("uid required");
  const col = collection(doc(db, "users", uid), "quizAttempts");
  return addDoc(col, {
    ...payload,
    createdAt: serverTimestamp(),
    finishedAt: payload && payload.finishedAt ? payload.finishedAt : serverTimestamp(),
  });
}

export async function listQuizAttempts(uid, max = 50) {
  if (!uid) return [];
  const col = collection(doc(db, "users", uid), "quizAttempts");
  const q = query(col, orderBy("finishedAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

