// Admin bundle: load legacy admin UI in global scope + add Firebase sync and students stats.

import "script-loader!../assets/js/utils/safeHtml.js";
import "script-loader!../assets/js/admin/schema.js";
import "script-loader!../assets/js/admin/sanitize.js";
import "script-loader!../assets/js/admin/store.js";
import "script-loader!../assets/js/admin/ui.js";
import "script-loader!../assets/js/admin/admin.js";
import "script-loader!../assets/js/admin/panels/classes.js";
import "script-loader!../assets/js/admin/panels/subjects.js";
import "script-loader!../assets/js/admin/panels/paragraphs.js";
import "script-loader!../assets/js/admin/panels/quizzes.js";
import "script-loader!../assets/js/admin/panels/students.js";

import "./auth.js";
import { isAdminUid } from "./services/roles";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
  getDoc,
} from "firebase/firestore";

async function ensureAdminOrLock() {
  // auth.js sets window.__authUser asynchronously via onAuthStateChanged.
  // undefined = not initialized yet, null = guest, object = signed-in user.
  const user = window.__authUser;
  const panel = document.getElementById("admin-panel");
  if (!panel) return false;

  if (typeof user === "undefined") {
    panel.innerHTML = '<div class="container"><h1>Админ-панель</h1><div class="loader"></div><p>Инициализация авторизации...</p></div>';
    return false;
  }

  if (!user) {
    panel.innerHTML = '<div class="container"><h1>Админ-панель</h1><p>Войдите, чтобы продолжить.</p></div>';
    return false;
  }
  const ok = await isAdminUid(user.uid);
  if (!ok) {
    panel.innerHTML = '<div class="container"><h1>Доступ запрещён</h1><p>Этот аккаунт не является администратором.</p></div>';
    return false;
  }
  return true;
}

async function exportFirestoreToAdminBlob() {
  const cfg = { classes: {} };
  const classesSnap = await getDocs(collection(db, "classes"));
  for (const c of classesSnap.docs) {
    cfg.classes[c.id] = { name: c.data().name || "", subjects: {} };
  }
  const subjectsSnap = await getDocs(collection(db, "subjects"));
  const subjectPathByKey = new Map(); // `${classId}/${subjectId}` -> path
  for (const s of subjectsSnap.docs) {
    const d = s.data();
    const classId = String(d.classId || "");
    if (!cfg.classes[classId]) cfg.classes[classId] = { name: classId, subjects: {} };
    cfg.classes[classId].subjects[s.id] = {
      name: d.name || "",
      path: d.path || "",
      showOnlyQuizzes: d.showOnlyQuizzes === true,
    };
    subjectPathByKey.set(`${classId}/${s.id}`, String(d.path || ""));
  }

  // Admin UI expects:
  // - paragraphs: { [subjectPath]: Paragraph[] }
  // - quizzes: { [fullPathToQuizJson]: Quiz }
  const paragraphs = {};
  const quizzes = {};

  // Paragraphs
  const paragraphsSnap = await getDocs(collection(db, "paragraphs"));
  for (const pDoc of paragraphsSnap.docs) {
    const p = pDoc.data() || {};
    const classId = String(p.classId || "");
    const subjectId = String(p.subjectId || "");
    const subjectPath = subjectPathByKey.get(`${classId}/${subjectId}`) || "";
    if (!subjectPath) continue;

    const legacyId = p.legacyId != null ? String(p.legacyId) : pDoc.id;
    const quizRefs = Array.isArray(p.quizzes) ? p.quizzes : [];
    const legacyQuizRefs = quizRefs
      .map((q) => ({
        title: q && q.title != null ? String(q.title) : "",
        file: q && q.id != null ? String(q.id) + ".json" : "",
      }))
      .filter((q) => q.file);

    if (!paragraphs[subjectPath]) paragraphs[subjectPath] = [];
    paragraphs[subjectPath].push({
      id: legacyId,
      title: p.title != null ? String(p.title) : "",
      summary: p.summary != null ? String(p.summary) : "",
      image: p.image != null ? p.image : null,
      sections: Array.isArray(p.sections) ? p.sections : [],
      dates: Array.isArray(p.dates) ? p.dates : [],
      terms: Array.isArray(p.terms) ? p.terms : [],
      people: Array.isArray(p.people) ? p.people : [],
      quizzes: legacyQuizRefs,
    });
  }

  // Keep paragraph order stable (by numeric id when possible)
  for (const sp of Object.keys(paragraphs)) {
    paragraphs[sp].sort((a, b) => {
      const na = Number(a.id);
      const nb = Number(b.id);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  // Quizzes
  const quizzesSnap = await getDocs(collection(db, "quizzes"));
  for (const qDoc of quizzesSnap.docs) {
    const qz = qDoc.data() || {};
    const classId = String(qz.classId || "");
    const subjectId = String(qz.subjectId || "");
    const subjectPath = subjectPathByKey.get(`${classId}/${subjectId}`) || "";
    if (!subjectPath) continue;

    const id = qDoc.id;
    const fullPath = `${subjectPath}${id}.json`;
    quizzes[fullPath] = {
      title: qz.title != null ? String(qz.title) : "Тест",
      source: qz.source != null ? String(qz.source) : "manual",
      difficulty: qz.difficulty != null ? String(qz.difficulty) : "medium",
      questions: Array.isArray(qz.questions) ? qz.questions : [],
    };
  }

  return { config: cfg, paragraphs, quizzes };
}

async function syncAdminBlobToFirestore(adminData) {
  const batchLimit = 450; // keep margin below 500
  const batches = [];
  let batch = writeBatch(db);
  let ops = 0;
  const commitBatch = async () => {
    if (ops === 0) return;
    batches.push(batch.commit());
    batch = writeBatch(db);
    ops = 0;
  };

  // classes/subjects from config
  const classes = (adminData && adminData.config && adminData.config.classes) ? adminData.config.classes : {};
  for (const classId of Object.keys(classes)) {
    const c = classes[classId];
    batch.set(doc(db, "classes", String(classId)), { name: c.name || "" }, { merge: true });
    ops++;
    if (ops >= batchLimit) await commitBatch();

    const subjects = c.subjects || {};
    for (const subjectId of Object.keys(subjects)) {
      const s = subjects[subjectId];
      batch.set(
        doc(db, "subjects", String(subjectId)),
        {
          classId: String(classId),
          name: s.name || "",
          path: s.path || "",
          showOnlyQuizzes: s.showOnlyQuizzes === true,
        },
        { merge: true }
      );
      ops++;
      if (ops >= batchLimit) await commitBatch();
    }
  }

  // paragraph/quizzes maps (legacy admin store). We store them into paragraphs/quizzes collections best-effort.
  const paragraphsByPath = (adminData && adminData.paragraphs) ? adminData.paragraphs : {};
  for (const pPath of Object.keys(paragraphsByPath)) {
    const arr = Array.isArray(paragraphsByPath[pPath]) ? paragraphsByPath[pPath] : [];
    // infer classId/subjectId from path like data/6/history/
    const m = String(pPath).match(/^data\/([^/]+)\/([^/]+)\/?$/);
    const classId = m ? m[1] : null;
    const subjectId = m ? m[2] : null;
    for (const p of arr) {
      if (!p || p.id == null) continue;
      const legacyId = String(p.id);
      const id = classId && subjectId ? `${classId}__${subjectId}__${legacyId}` : `legacy__${legacyId}`;
      batch.set(
        doc(db, "paragraphs", id),
        {
          classId: classId || "",
          subjectId: subjectId || "",
          legacyId,
          title: p.title || "",
          summary: p.summary || "",
          image: p.image != null ? p.image : null,
          sections: Array.isArray(p.sections) ? p.sections : [],
          dates: Array.isArray(p.dates) ? p.dates : [],
          terms: Array.isArray(p.terms) ? p.terms : [],
          people: Array.isArray(p.people) ? p.people : [],
          quizzes: Array.isArray(p.quizzes)
            ? p.quizzes.map((q) => ({ id: (q.file ? String(q.file).replace(/\.json$/i, "") : ""), title: q.title || "" })).filter((q) => q.id)
            : [],
        },
        { merge: true }
      );
      ops++;
      if (ops >= batchLimit) await commitBatch();
    }
  }

  const quizzesByPath = (adminData && adminData.quizzes) ? adminData.quizzes : {};
  for (const fullPath of Object.keys(quizzesByPath)) {
    const qz = quizzesByPath[fullPath];
    const name = String(fullPath).split("/").pop() || "";
    const id = name.replace(/\.json$/i, "");
    if (!id) continue;
    const m = String(fullPath).match(/^data\/([^/]+)\/([^/]+)\/.+$/);
    const classId = m ? m[1] : "";
    const subjectId = m ? m[2] : "";
    batch.set(
      doc(db, "quizzes", id),
      {
        classId,
        subjectId,
        title: (qz && qz.title) ? String(qz.title) : "Тест",
        source: (qz && qz.source) ? String(qz.source) : "manual",
        difficulty: (qz && qz.difficulty) ? String(qz.difficulty) : "medium",
        questions: (qz && Array.isArray(qz.questions)) ? qz.questions : [],
      },
      { merge: true }
    );
    ops++;
    if (ops >= batchLimit) await commitBatch();
  }

  // Snapshot for admin to reload quickly
  batch.set(doc(db, "adminData", "latest"), { data: adminData, updatedAt: serverTimestamp() }, { merge: true });
  ops++;
  await commitBatch();
  await Promise.all(batches);
}

async function tryLoadAdminSnapshot() {
  try {
    const snap = await getDoc(doc(db, "adminData", "latest"));
    if (!snap.exists()) return null;
    const d = snap.data();
    return d && d.data ? d.data : null;
  } catch {
    return null;
  }
}

async function listStudents(limitN = 200) {
  const q = query(collection(db, "users"), where("role", "==", "student"), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

async function listAttemptsForUser(uid, max = 50) {
  const col = collection(doc(db, "users", String(uid)), "quizAttempts");
  const q = query(col, orderBy("finishedAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

window.AdminFirebaseBridge = {
  ensureAdminOrLock,
  exportFirestoreToAdminBlob,
  syncAdminBlobToFirestore,
  tryLoadAdminSnapshot,
  listStudents,
  listAttemptsForUser,
};

function wireButtons() {
  const btnLoad = document.getElementById("adminLoadFirebase");
  const btnSync = document.getElementById("adminSyncFirebase");
  if (btnLoad)
    btnLoad.addEventListener("click", async () => {
      const ok = await ensureAdminOrLock();
      if (!ok) return;
      const snap = (await tryLoadAdminSnapshot()) || (await exportFirestoreToAdminBlob());
      if (window.AdminStore && window.AdminStore.setData) {
        window.AdminStore.setData(snap);
        window.AdminStore.save();
        window.AdminUI && window.AdminUI.showSuccess && window.AdminUI.showSuccess("Загружено из Firebase (в localStorage)");
        location.reload();
      }
    });
  if (btnSync)
    btnSync.addEventListener("click", async () => {
      const ok = await ensureAdminOrLock();
      if (!ok) return;
      const data = window.AdminStore && window.AdminStore.getData ? window.AdminStore.getData() : null;
      if (!data) return;
      window.AdminUI && window.AdminUI.showWarning && window.AdminUI.showWarning("Синхронизация в Firebase...");
      await syncAdminBlobToFirestore(data);
      window.AdminUI && window.AdminUI.showSuccess && window.AdminUI.showSuccess("Синхронизировано в Firebase");
    });
}

wireButtons();

function applyPanelFromHash() {
  try {
    const hash = String(location.hash || "");
    const m = hash.match(/panel=([a-z]+)/i);
    const panel = m ? m[1] : "";
    if (panel && window.Admin && typeof window.Admin.renderPanel === "function") {
      window.Admin.renderPanel(panel);
    }
  } catch {}
}

async function bootstrapAdmin() {
  // Wait until auth is initialized.
  const start = Date.now();
  while (typeof window.__authUser === "undefined" && Date.now() - start < 8000) {
    await new Promise((r) => setTimeout(r, 150));
  }
  const ok = await ensureAdminOrLock();
  if (ok) applyPanelFromHash();
}

bootstrapAdmin();

