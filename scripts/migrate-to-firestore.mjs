import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

import admin from "firebase-admin";

function log(msg) {
  process.stdout.write(msg + "\n");
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function loadConfigFromDataJs(repoRoot) {
  const p = path.join(repoRoot, "assets", "js", "data.js");
  const raw = await fs.readFile(p, "utf8");
  const sandbox = { window: {}, CONFIG: undefined };
  vm.createContext(sandbox);
  vm.runInContext(raw, sandbox, { filename: "data.js" });
  const cfg = sandbox.window.CONFIG || sandbox.CONFIG;
  if (!cfg || !cfg.classes) throw new Error("Failed to load CONFIG from assets/js/data.js");
  return cfg;
}

function normalizeQuiz(quiz, fallbackId) {
  return {
    id: quiz.id ? String(quiz.id) : String(fallbackId),
    classId: quiz.classId != null ? String(quiz.classId) : undefined,
    subjectId: quiz.subjectId != null ? String(quiz.subjectId) : undefined,
    title: quiz.title ? String(quiz.title) : "Тест",
    source: quiz.source != null ? String(quiz.source) : "manual",
    difficulty: quiz.difficulty != null ? String(quiz.difficulty) : "medium",
    questions: Array.isArray(quiz.questions) ? quiz.questions : [],
  };
}

function paragraphDocId(classId, subjectId, legacyParagraphId) {
  return `${classId}__${subjectId}__${legacyParagraphId}`;
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

async function upsertDoc(db, col, id, data) {
  await db.collection(col).doc(String(id)).set(data, { merge: true });
}

async function migrate(repoRoot) {
  const db = await initFirebaseAdmin();
  const cfg = await loadConfigFromDataJs(repoRoot);

  log("Migrating classes/subjects from CONFIG...");
  for (const classId of Object.keys(cfg.classes)) {
    const c = cfg.classes[classId];
    await upsertDoc(db, "classes", classId, { name: c.name || "" });
    const subjects = c.subjects || {};
    for (const subjectId of Object.keys(subjects)) {
      const s = subjects[subjectId];
      await upsertDoc(db, "subjects", subjectId, {
        classId: String(classId),
        name: s.name || "",
        path: s.path || "",
        showOnlyQuizzes: s.showOnlyQuizzes === true,
      });
    }
  }

  const dataRoot = path.join(repoRoot, "data");
  const classDirs = await fs.readdir(dataRoot, { withFileTypes: true });

  for (const classDir of classDirs) {
    if (!classDir.isDirectory()) continue;
    const classId = classDir.name;
    const classPath = path.join(dataRoot, classId);
    const subjectDirs = await fs.readdir(classPath, { withFileTypes: true });

    for (const subjDir of subjectDirs) {
      if (!subjDir.isDirectory()) continue;
      const subjectId = subjDir.name;
      const subjectPath = path.join(classPath, subjectId);

      const contentPath = path.join(subjectPath, "content.json");
      const paragraphsPath = path.join(subjectPath, "paragraphs.json");

      log(`\nSubject ${classId}/${subjectId}...`);

      if (await fileExists(contentPath)) {
        const content = await readJson(contentPath);
        const paragraphs = Array.isArray(content.paragraphs) ? content.paragraphs : [];
        const quizzes = Array.isArray(content.quizzes) ? content.quizzes : [];

        // Quizzes
        for (const q of quizzes) {
          const nq = normalizeQuiz(q, q.id);
          await upsertDoc(db, "quizzes", nq.id, {
            classId: String(classId),
            subjectId: String(subjectId),
            title: nq.title,
            source: nq.source,
            difficulty: nq.difficulty,
            questions: nq.questions,
          });
        }

        // Paragraphs
        for (const p of paragraphs) {
          const legacyId = p.id != null ? String(p.id) : "";
          if (!legacyId) continue;
          const docId = paragraphDocId(classId, subjectId, legacyId);
          const quizRefs = Array.isArray(p.quizzes)
            ? p.quizzes
                .map((r) => ({
                  id: r && r.id != null ? String(r.id) : "",
                  title: r && r.title != null ? String(r.title) : "",
                }))
                .filter((r) => r.id)
            : [];

          await upsertDoc(db, "paragraphs", docId, {
            classId: String(classId),
            subjectId: String(subjectId),
            legacyId,
            title: p.title != null ? String(p.title) : "",
            summary: p.summary != null ? String(p.summary) : "",
            image: p.image != null ? p.image : null,
            sections: Array.isArray(p.sections) ? p.sections : [],
            dates: Array.isArray(p.dates) ? p.dates : [],
            terms: Array.isArray(p.terms) ? p.terms : [],
            people: Array.isArray(p.people) ? p.people : [],
            quizzes: quizRefs,
          });
        }

        continue;
      }

      // Legacy: paragraphs.json + quiz-*.json
      if (await fileExists(paragraphsPath)) {
        const paragraphs = await readJson(paragraphsPath);
        if (Array.isArray(paragraphs)) {
          for (const p of paragraphs) {
            const legacyId = p.id != null ? String(p.id) : "";
            if (!legacyId) continue;
            const docId = paragraphDocId(classId, subjectId, legacyId);

            const quizRefs = Array.isArray(p.quizzes)
              ? p.quizzes
                  .map((r) => {
                    const file = r && r.file ? String(r.file) : "";
                    const id = file ? file.replace(/\.json$/i, "") : "";
                    return { id, title: r && r.title != null ? String(r.title) : "" };
                  })
                  .filter((r) => r.id)
              : [];

            await upsertDoc(db, "paragraphs", docId, {
              classId: String(classId),
              subjectId: String(subjectId),
              legacyId,
              title: p.title != null ? String(p.title) : "",
              summary: p.summary != null ? String(p.summary) : "",
              image: p.image != null ? p.image : null,
              sections: Array.isArray(p.sections) ? p.sections : [],
              dates: Array.isArray(p.dates) ? p.dates : [],
              terms: Array.isArray(p.terms) ? p.terms : [],
              people: Array.isArray(p.people) ? p.people : [],
              quizzes: quizRefs,
            });
          }
        }

        // Upload quiz files in the folder
        const files = await fs.readdir(subjectPath, { withFileTypes: true });
        for (const f of files) {
          if (!f.isFile()) continue;
          if (!/\.json$/i.test(f.name)) continue;
          if (f.name === "paragraphs.json") continue;
          if (f.name === "content.json") continue;
          if (!/^quiz-/i.test(f.name) && !/quiz/i.test(f.name)) continue;

          const full = path.join(subjectPath, f.name);
          const q = await readJson(full);
          const id = f.name.replace(/\.json$/i, "");
          const nq = normalizeQuiz(q, id);
          await upsertDoc(db, "quizzes", nq.id, {
            classId: String(classId),
            subjectId: String(subjectId),
            title: nq.title,
            source: nq.source,
            difficulty: nq.difficulty,
            questions: nq.questions,
          });
        }
      } else {
        log("  No content.json or paragraphs.json found, skipping.");
      }
    }
  }

  log("\nDone.");
}

const repoRoot = process.cwd();
migrate(repoRoot).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

