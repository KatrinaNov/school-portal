import fs from "node:fs/promises";
import path from "node:path";

import admin from "firebase-admin";

function log(msg) {
  process.stdout.write(msg + "\n");
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function initFirebaseAdmin() {
  const serviceAccountPath = requireEnv("FIREBASE_SERVICE_ACCOUNT");
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, "utf8"));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }
  return admin.firestore();
}

function decodeMatchPairs(q) {
  if (!q || typeof q !== "object") return q;
  if (q.type !== "match") return q;
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

function decodeQuiz(quizDoc) {
  const data = quizDoc || {};
  const questions = Array.isArray(data.questions) ? data.questions : [];
  return {
    id: String(data.id || ""),
    title: String(data.title || "Тест"),
    source: data.source != null ? String(data.source) : "manual",
    difficulty: data.difficulty != null ? String(data.difficulty) : "medium",
    questions: questions.map(decodeMatchPairs),
  };
}

function paragraphLegacyId(docId, docData) {
  if (docData && docData.legacyId != null) return String(docData.legacyId);
  // paragraphs/{classId}__{subjectId}__{legacyId}
  const parts = String(docId || "").split("__");
  return parts.length >= 3 ? String(parts.slice(2).join("__")) : String(docId || "");
}

function decodeParagraph(docId, docData) {
  const data = docData || {};
  return {
    id: paragraphLegacyId(docId, data),
    title: data.title != null ? String(data.title) : "",
    summary: data.summary != null ? String(data.summary) : "",
    image: data.image != null ? data.image : null,
    sections: Array.isArray(data.sections) ? data.sections : [],
    dates: Array.isArray(data.dates) ? data.dates : [],
    terms: Array.isArray(data.terms) ? data.terms : [],
    people: Array.isArray(data.people) ? data.people : [],
    quizzes: Array.isArray(data.quizzes) ? data.quizzes : [],
  };
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function exportAll(repoRoot) {
  const db = await initFirebaseAdmin();

  const classesSnap = await db.collection("classes").get();
  const classes = classesSnap.docs.map((d) => ({ id: String(d.id), ...(d.data() || {}) }));

  for (const c of classes) {
    const classId = String(c.id);
    log(`\nClass ${classId}...`);

    const subjectsSnap = await db.collection("subjects").where("classId", "==", classId).get();
    const subjects = subjectsSnap.docs.map((d) => ({ id: String(d.data()?.subjectId || ""), key: String(d.id), ...(d.data() || {}) }));

    for (const s of subjects) {
      const subjectId = String(s.subjectId || s.id || "");
      if (!subjectId) continue;
      const outPath = String(s.path || `data/${classId}/${subjectId}/`);
      if (!outPath.startsWith("data/")) {
        log(`  - Skip ${classId}/${subjectId}: path not under data/: ${outPath}`);
        continue;
      }

      log(`  Subject ${classId}/${subjectId} -> ${outPath}content.json`);

      const paragraphsSnap = await db
        .collection("paragraphs")
        .where("classId", "==", classId)
        .where("subjectId", "==", subjectId)
        .get();
      const paragraphs = paragraphsSnap.docs.map((d) => decodeParagraph(d.id, d.data()));

      const quizzesSnap = await db
        .collection("quizzes")
        .where("classId", "==", classId)
        .where("subjectId", "==", subjectId)
        .get();
      const quizzes = quizzesSnap.docs.map((d) => decodeQuiz({ id: d.id, ...(d.data() || {}) }));
      quizzes.forEach((q) => {
        if (!q.id) q.id = String(q.id || "");
        if (!q.id) q.id = String(q.title || "quiz");
      });

      const content = {
        version: 1,
        meta: { classId, subjectId, title: String(s.name || `${classId}/${subjectId}`), updated: new Date().toISOString() },
        paragraphs,
        quizzes,
      };

      const filePath = path.join(repoRoot, outPath, "content.json");
      await writeJson(filePath, content);
    }
  }

  log("\nDone.");
}

const repoRoot = process.cwd();
exportAll(repoRoot).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

