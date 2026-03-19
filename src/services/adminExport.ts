import { fetchSubjectContentFirestore } from "./content/firestoreSource";
import { listClasses, listSubjectsByClass } from "./adminConfig";

function downloadTextFile(filename: string, content: string, mime = "application/json;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportSubjectContentJson(classId: string, subjectId: string) {
  const content = await fetchSubjectContentFirestore(String(classId), String(subjectId));
  downloadTextFile(
    `content-${String(classId)}-${String(subjectId)}.json`,
    JSON.stringify(content, null, 2)
  );
}

export async function exportClassToSingleJson(classId: string) {
  const subjects = await listSubjectsByClass(String(classId));
  const out: any = { classId: String(classId), exportedAt: new Date().toISOString(), subjects: {} };
  for (const s of subjects) {
    const content = await fetchSubjectContentFirestore(String(classId), String(s.id));
    out.subjects[String(s.id)] = content;
  }
  downloadTextFile(`export-class-${String(classId)}.json`, JSON.stringify(out, null, 2));
}

export async function exportAllToSingleJson() {
  const classes = await listClasses();
  const out: any = { exportedAt: new Date().toISOString(), classes: {} };
  for (const c of classes) {
    const subjects = await listSubjectsByClass(String(c.id));
    out.classes[String(c.id)] = { name: c.name || "", subjects: {} };
    for (const s of subjects) {
      const content = await fetchSubjectContentFirestore(String(c.id), String(s.id));
      out.classes[String(c.id)].subjects[String(s.id)] = content;
    }
  }
  downloadTextFile(`export-all-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2));
}

