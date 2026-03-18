import { listClasses, listSubjectsByClass, listParagraphs, getQuizById } from "./firestoreContent";

/**
 * Firestore-first provider with graceful fallback.
 * - If Firestore has no data (empty collections) or errors, fallback to legacy window.CONFIG/Api.
 * - Guests: always fallback (no need to log in).
 */
export function installFirebaseDataProvider() {
  if (typeof window === "undefined") return;
  if (!window.Api || typeof window.Api.getParagraphs !== "function" || typeof window.Api.getQuiz !== "function") return;
  if (!window.CONFIG || !window.CONFIG.classes) return;

  const legacyGetParagraphs = window.Api.getParagraphs;
  const legacyGetQuiz = window.Api.getQuiz;

  // Expose a helper to refresh CONFIG from Firestore (optional).
  window.FirebaseContent = window.FirebaseContent || {};
  window.FirebaseContent.refreshConfigFromFirestore = async function refreshConfigFromFirestore() {
    const classes = await listClasses();
    if (!classes || classes.length === 0) return false;

    const next = { classes: {} };
    for (const c of classes) {
      const classId = String(c.id);
      const subjects = await listSubjectsByClass(classId);
      const subjObj = {};
      (subjects || []).forEach((s) => {
        subjObj[String(s.id)] = {
          name: s.name || "",
          path: s.path || (window.CONFIG.classes[classId] && window.CONFIG.classes[classId].subjects[String(s.id)] ? window.CONFIG.classes[classId].subjects[String(s.id)].path : ""),
          showOnlyQuizzes: s.showOnlyQuizzes === true,
        };
      });
      next.classes[classId] = { name: c.name || "", subjects: subjObj };
    }
    window.CONFIG = next;
    return true;
  };

  // Override Api methods to prefer Firestore when signed-in and Firestore has content.
  window.Api.getParagraphs = async function getParagraphs(path) {
    // Guests: keep old behavior
    if (!window.__authUser) return legacyGetParagraphs(path);

    // Infer classId/subjectId from CONFIG by path.
    try {
      const p = String(path || "").replace(/\/$/, "");
      let classId = null;
      let subjectId = null;
      const classes = window.CONFIG && window.CONFIG.classes ? window.CONFIG.classes : {};
      for (const cid in classes) {
        const subs = classes[cid] && classes[cid].subjects ? classes[cid].subjects : {};
        for (const sid in subs) {
          const sp = String(subs[sid].path || "").replace(/\/$/, "");
          if (sp && sp === p) {
            classId = cid;
            subjectId = sid;
            break;
          }
        }
        if (classId) break;
      }
      if (!classId || !subjectId) return legacyGetParagraphs(path);

      const paragraphs = await listParagraphs(classId, subjectId);
      if (!paragraphs || paragraphs.length === 0) return legacyGetParagraphs(path);

      // Normalize to legacy paragraph shape expected by UI.
      return paragraphs.map((p) => ({
        id: p.legacyId || p.id,
        title: p.title || "",
        summary: p.summary || "",
        image: p.image != null ? p.image : null,
        sections: Array.isArray(p.sections) ? p.sections : [],
        dates: Array.isArray(p.dates) ? p.dates : [],
        terms: Array.isArray(p.terms) ? p.terms : [],
        people: Array.isArray(p.people) ? p.people : [],
        quizzes: Array.isArray(p.quizzes) ? p.quizzes.map((q) => ({ title: q.title || "", file: (q.id || q.quizId || "").toString() + ".json" })) : [],
      }));
    } catch (e) {
      return legacyGetParagraphs(path);
    }
  };

  window.Api.getQuiz = async function getQuiz(fullPath) {
    if (!window.__authUser) return legacyGetQuiz(fullPath);
    try {
      // legacy key is path + id + ".json"
      const name = String(fullPath || "").split("/").pop() || "";
      const quizId = name.replace(/\.json$/i, "");
      if (!quizId) return legacyGetQuiz(fullPath);
      const q = await getQuizById(quizId);
      if (!q) return legacyGetQuiz(fullPath);
      return { title: q.title || "Тест", questions: Array.isArray(q.questions) ? q.questions : [] };
    } catch (e) {
      return legacyGetQuiz(fullPath);
    }
  };
}

