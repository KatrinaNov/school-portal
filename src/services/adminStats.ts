import { collection, doc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";

export async function listStudents(max = 200) {
  const q = query(collection(db, "users"), where("role", "==", "student"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }));
}

export async function listAttemptsForUser(uid: string, max = 50) {
  const col = collection(doc(db, "users", String(uid)), "quizAttempts");
  const q = query(col, orderBy("finishedAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

