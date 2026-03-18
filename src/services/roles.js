import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const adminCache = new Map();

export async function isAdminUid(uid) {
  if (!uid) return false;
  if (adminCache.has(uid)) return adminCache.get(uid);
  const snap = await getDoc(doc(db, "admins", uid));
  const ok = snap.exists();
  adminCache.set(uid, ok);
  return ok;
}

