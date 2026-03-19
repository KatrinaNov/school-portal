import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";

function safeName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120);
}

export async function uploadImageToStorage(args: { classId: string; subjectId: string; file: File }) {
  const { classId, subjectId, file } = args;
  const ext = file.name && file.name.includes(".") ? file.name.split(".").pop() : "";
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const fileName = safeName(`${id}${ext ? "." + ext : ""}`);
  const path = `admin/uploads/${safeName(String(classId))}/${safeName(String(subjectId))}/${fileName}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type || "application/octet-stream" });
  return getDownloadURL(r);
}

