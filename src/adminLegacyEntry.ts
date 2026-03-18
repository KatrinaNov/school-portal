import "./auth.js";
import { isAdminUid } from "./services/roles";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  where,
} from "firebase/firestore";

function loadLegacyScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function fetchJsonOrNull(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function bootstrapLegacyAdminUi() {
  const scripts = [
    // Provide window.CONFIG for legacy panels + seeding.
    "/assets/js/data.js",
    "/assets/js/utils/safeHtml.js",
    "/assets/js/admin/schema.js",
    "/assets/js/admin/sanitize.js",
    "/assets/js/admin/store.js",
    "/assets/js/admin/ui.js",
    "/assets/js/admin/admin.js",
    "/assets/js/admin/panels/classes.js",
    "/assets/js/admin/panels/subjects.js",
    "/assets/js/admin/panels/paragraphs.js",
    "/assets/js/admin/panels/quizzes.js",
    "/assets/js/admin/panels/students.js",
  ];
  for (const src of scripts) {
    await loadLegacyScript(src);
  }

  // admin.js may auto-render a panel before panels are registered (DOMContentLoaded already fired),
  // which shows "Панель не загружена". After all panels are loaded, force a re-render.
  const Admin = (window as any).Admin;
  if (Admin && typeof Admin.renderPanel === "function") {
    const current = typeof Admin.getCurrentPanel === "function" ? Admin.getCurrentPanel() : "classes";
    Admin.renderPanel(current || "classes");
  }
}

async function seedLocalAdminDataIfEmpty() {
  const Store = (window as any).AdminStore;
  const UI = (window as any).AdminUI;
  const Schema = (window as any).AdminSchema;

  if (!Store || !Schema) return;
  // If storage has meaningful data, keep it. But if it only contains a blank skeleton, re-seed.
  if (typeof Store.loadFromStorage === "function") {
    const existing = Store.loadFromStorage();
    const hasClasses = !!existing?.config?.classes && Object.keys(existing.config.classes).length > 0;
    const hasParagraphs = !!existing?.paragraphs && Object.keys(existing.paragraphs).length > 0;
    const hasQuizzes = !!existing?.quizzes && Object.keys(existing.quizzes).length > 0;
    if (existing && (hasClasses || hasParagraphs || hasQuizzes)) return;
  }

  const cfg = (window as any).CONFIG;
  if (!cfg || !cfg.classes) return;

  const seed = Schema.createEmpty();
  seed.config = cfg;

  const classes = cfg.classes || {};

  function normalizeChoiceOptions(a: any): string[] {
    if (!Array.isArray(a)) return [];
    return a
      .map((opt: any) => {
        if (typeof opt === "string") return opt;
        if (opt && typeof opt === "object") {
          if (typeof opt.text === "string") return opt.text;
          if (typeof opt.value === "string") return opt.value;
        }
        if (opt == null) return "";
        return String(opt);
      })
      .filter((s: string) => s != null);
  }

  function normalizeLegacyQuestion(qq: any) {
    if (!qq || typeof qq !== "object") return null;
    if (qq.type === "choice") {
      const a = normalizeChoiceOptions(qq.a);
      const len = a.length;
      let c: any = qq.c;
      // Some old/merged sources may store c as array or non-number.
      if (Array.isArray(c) && c.length > 0) c = c[0];
      if (typeof c !== "number" || !Number.isFinite(c)) c = 0;
      // Clamp c into valid range for legacy validator.
      if (len === 0) c = 0;
      else if (c < 0) c = 0;
      else if (c >= len) c = len - 1;
      return {
        type: "choice",
        q: qq.q != null ? String(qq.q) : "",
        a,
        c,
      };
    }
    if (qq.type === "input") {
      const answer = qq.answer != null ? String(qq.answer) : "";
      return {
        type: "input",
        q: qq.q != null ? String(qq.q) : "",
        answer: answer || "TODO",
      };
    }
    return null;
  }

  for (const classId of Object.keys(classes)) {
    const subs = classes[classId]?.subjects || {};
    for (const subId of Object.keys(subs)) {
      const subjectPathRaw = String(subs[subId]?.path || "");
      if (!subjectPathRaw) continue;
      const subjectPath = subjectPathRaw.endsWith("/") ? subjectPathRaw : `${subjectPathRaw}/`;
      const content = await fetchJsonOrNull(`/${subjectPath}content.json`);
      if (!content || typeof content !== "object") continue;

      const paragraphs = Array.isArray((content as any).paragraphs) ? (content as any).paragraphs : [];
      const quizzes = Array.isArray((content as any).quizzes) ? (content as any).quizzes : [];

      // Map SubjectContent -> legacy AdminStore format.
      const idPrefix = String(subjectPath)
        .replace(/[\/]+/g, "_")
        .replace(/^_+|_+$/g, "");
      seed.paragraphs[subjectPath] = paragraphs
        .filter((p: any) => p && typeof p === "object")
        .map((p: any, idx: number) => {
          const rawId = p.id != null ? String(p.id).trim() : "";
          const legacyId = rawId ? `${idPrefix}__${rawId}` : `${idPrefix}__${subjectPath}__${idx + 1}`;
          return {
          id: legacyId,
          title: p.title != null ? String(p.title) : "",
          summary: p.summary != null ? String(p.summary) : "",
          image: p.image != null ? p.image : null,
          sections: Array.isArray(p.sections) ? p.sections : [],
          dates: Array.isArray(p.dates) ? p.dates : [],
          terms: Array.isArray(p.terms) ? p.terms : [],
          // legacy expects people[].info; keep compatible with new {description}
          people: Array.isArray(p.people)
            ? p.people.map((pp: any) => ({
                ...pp,
                info: pp && pp.info != null ? pp.info : pp && pp.description != null ? pp.description : "",
              }))
            : [],
          quizzes: Array.isArray(p.quizzes)
            ? p.quizzes
                .map((q: any) => ({
                  title: q && q.title != null ? String(q.title) : "",
                  file: q && q.id != null ? `${String(q.id)}.json` : "",
                }))
                .filter((q: any) => q.file)
            : [],
          };
        });

      for (const q of quizzes) {
        if (!q || typeof q !== "object" || q.id == null) continue;
        const id = String((q as any).id).replace(/\.json$/i, "");
        if (!id) continue;
        const fullKey = `${subjectPath}${id}.json`;

        // Legacy admin editor supports only choice/input. Keep other types view-only by filtering.
        const questionsRaw = Array.isArray((q as any).questions) ? (q as any).questions : [];
        const questions = questionsRaw
          .map((qq: any) => normalizeLegacyQuestion(qq))
          .filter((x: any) => x && (x.type === "choice" || x.type === "input"));

        seed.quizzes[fullKey] = {
          title: (q as any).title != null ? String((q as any).title) : "Тест",
          questions,
        };
      }
    }
  }

  const validation =
    Schema && typeof Schema.validateFullData === "function" ? Schema.validateFullData(seed) : { valid: true };

  if (!validation.valid) {
    if (UI && typeof UI.showError === "function") {
      UI.showError(`Не удалось инициализировать данные: ${String(validation.error || "ошибка схемы")}`);
    }
    return;
  }

  if (typeof Store.setData === "function" && Store.setData(seed)) {
    if (typeof Store.save === "function") Store.save();
    if (UI && typeof UI.showSuccess === "function") {
      UI.showSuccess("Данные инициализированы из content.json");
    }
  } else {
    if (UI && typeof UI.showError === "function") {
      UI.showError("Не удалось инициализировать данные (проверь content.json и CONFIG)");
    }
  }
}

async function ensureAdminOrLock(): Promise<boolean> {
  const user = (window as any).__authUser;
  const panel = document.getElementById("admin-panel");
  if (!panel) return false;

  if (typeof user === "undefined") {
    panel.innerHTML =
      '<div class="container"><h1>Админ-панель</h1><div class="loader"></div><p>Инициализация авторизации...</p></div>';
    return false;
  }

  if (!user) {
    panel.innerHTML = '<div class="container"><h1>Админ-панель</h1><p>Войдите, чтобы продолжить.</p></div>';
    return false;
  }
  const ok = await isAdminUid(user.uid);
  if (!ok) {
    panel.innerHTML =
      '<div class="container"><h1>Доступ запрещён</h1><p>Этот аккаунт не является администратором.</p></div>';
    return false;
  }
  return true;
}

async function exportFirestoreToAdminBlob() {
  const cfg: any = { classes: {} };
  const classesSnap = await getDocs(collection(db, "classes"));
  for (const c of classesSnap.docs) {
    cfg.classes[c.id] = { name: (c.data() as any).name || "", subjects: {} };
  }

  const subjectsSnap = await getDocs(collection(db, "subjects"));
  const subjectPathByKey = new Map<string, string>(); // `${classId}/${subjectId}` -> path
  for (const s of subjectsSnap.docs) {
    const d: any = s.data();
    const classId = String(d.classId || "");
    if (!cfg.classes[classId]) cfg.classes[classId] = { name: classId, subjects: {} };
    cfg.classes[classId].subjects[s.id] = {
      name: d.name || "",
      path: d.path || "",
      showOnlyQuizzes: d.showOnlyQuizzes === true,
    };
    subjectPathByKey.set(`${classId}/${s.id}`, String(d.path || ""));
  }

  const paragraphs: Record<string, any[]> = {};
  const quizzes: Record<string, any> = {};

  const paragraphsSnap = await getDocs(collection(db, "paragraphs"));
  for (const pDoc of paragraphsSnap.docs) {
    const p: any = pDoc.data() || {};
    const classId = String(p.classId || "");
    const subjectId = String(p.subjectId || "");
    const subjectPath = subjectPathByKey.get(`${classId}/${subjectId}`) || "";
    if (!subjectPath) continue;

    const legacyId = p.legacyId != null ? String(p.legacyId) : pDoc.id;
    const quizRefs = Array.isArray(p.quizzes) ? p.quizzes : [];
    const legacyQuizRefs = quizRefs
      .map((q: any) => ({
        title: q && q.title != null ? String(q.title) : "",
        file: q && q.id != null ? `${String(q.id)}.json` : "",
      }))
      .filter((q: any) => q.file);

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

  for (const sp of Object.keys(paragraphs)) {
    paragraphs[sp].sort((a, b) => {
      const na = Number(a.id);
      const nb = Number(b.id);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  const quizzesSnap = await getDocs(collection(db, "quizzes"));
  for (const qDoc of quizzesSnap.docs) {
    const qz: any = qDoc.data() || {};
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

async function syncAdminBlobToFirestore(adminData: any) {
  const batchLimit = 450;
  const batches: Promise<void>[] = [];
  let batch = writeBatch(db);
  let ops = 0;
  const commitBatch = async () => {
    if (ops === 0) return;
    batches.push(batch.commit() as any);
    batch = writeBatch(db);
    ops = 0;
  };

  const classes = adminData?.config?.classes ? adminData.config.classes : {};
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

  const paragraphsByPath = adminData?.paragraphs ? adminData.paragraphs : {};
  for (const pPath of Object.keys(paragraphsByPath)) {
    const arr = Array.isArray(paragraphsByPath[pPath]) ? paragraphsByPath[pPath] : [];
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
            ? p.quizzes
                .map((q: any) => ({
                  id: q.file ? String(q.file).replace(/\.json$/i, "") : "",
                  title: q.title || "",
                }))
                .filter((q: any) => q.id)
            : [],
        },
        { merge: true }
      );
      ops++;
      if (ops >= batchLimit) await commitBatch();
    }
  }

  const quizzesByPath = adminData?.quizzes ? adminData.quizzes : {};
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
        title: qz?.title ? String(qz.title) : "Тест",
        source: qz?.source ? String(qz.source) : "manual",
        difficulty: qz?.difficulty ? String(qz.difficulty) : "medium",
        questions: qz && Array.isArray(qz.questions) ? qz.questions : [],
      },
      { merge: true }
    );
    ops++;
    if (ops >= batchLimit) await commitBatch();
  }

  batch.set(
    doc(db, "adminData", "latest"),
    { data: adminData, updatedAt: serverTimestamp() },
    { merge: true }
  );
  ops++;
  await commitBatch();
  await Promise.all(batches);
}

async function tryLoadAdminSnapshot() {
  try {
    const snap = await getDoc(doc(db, "adminData", "latest"));
    if (!snap.exists()) return null;
    const d: any = snap.data();
    return d && d.data ? d.data : null;
  } catch {
    return null;
  }
}

async function listStudents(limitN = 200) {
  const q = query(collection(db, "users"), where("role", "==", "student"), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }));
}

async function listAttemptsForUser(uid: string, max = 50) {
  const col = collection(doc(db, "users", String(uid)), "quizAttempts");
  const q = query(col, orderBy("finishedAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

function wireButtons() {
  const btnLoad = document.getElementById("adminLoadFirebase");
  const btnSync = document.getElementById("adminSyncFirebase");

  if (btnLoad)
    btnLoad.addEventListener("click", async () => {
      const ok = await ensureAdminOrLock();
      if (!ok) return;
      const snap = (await tryLoadAdminSnapshot()) || (await exportFirestoreToAdminBlob());
      const Store = (window as any).AdminStore;
      const UI = (window as any).AdminUI;
      if (Store && Store.setData) {
        Store.setData(snap);
        Store.save();
        if (UI && typeof UI.showSuccess === "function") UI.showSuccess("Загружено из Firebase (в localStorage)");
        location.reload();
      }
    });

  if (btnSync)
    btnSync.addEventListener("click", async () => {
      const ok = await ensureAdminOrLock();
      if (!ok) return;
      const Store = (window as any).AdminStore;
      const UI = (window as any).AdminUI;
      const data = Store && Store.getData ? Store.getData() : null;
      if (!data) return;
      if (UI && typeof UI.showWarning === "function") UI.showWarning("Синхронизация в Firebase...");
      await syncAdminBlobToFirestore(data);
      if (UI && typeof UI.showSuccess === "function") UI.showSuccess("Синхронизировано в Firebase");
    });
}

function applyPanelFromHash() {
  try {
    const hash = String(location.hash || "");
    const m = hash.match(/panel=([a-z]+)/i);
    const panel = m ? m[1] : "";
    const Admin = (window as any).Admin;
    if (panel && Admin && typeof Admin.renderPanel === "function") {
      Admin.renderPanel(panel);
    }
  } catch {}
}

async function bootstrapAdmin() {
  await bootstrapLegacyAdminUi();
  await seedLocalAdminDataIfEmpty();

  // Expose Firestore bridge for legacy panels (students, sync).
  (window as any).AdminFirebaseBridge = {
    ensureAdminOrLock,
    exportFirestoreToAdminBlob,
    syncAdminBlobToFirestore,
    tryLoadAdminSnapshot,
    listStudents,
    listAttemptsForUser,
  };

  wireButtons();

  const start = Date.now();
  while (typeof (window as any).__authUser === "undefined" && Date.now() - start < 8000) {
    await new Promise((r) => setTimeout(r, 150));
  }

  const ok = await ensureAdminOrLock();
  if (ok) applyPanelFromHash();
}

bootstrapAdmin().catch((e) => console.error(e));

