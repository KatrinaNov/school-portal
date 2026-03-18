import { promises as fs } from "node:fs";
import path from "node:path";

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function ensureId(prefix, fallback, used) {
  const base = String(fallback ?? "").trim() || `${prefix}-${Math.random().toString(16).slice(2, 8)}`;
  let id = base;
  let i = 2;
  while (used.has(id)) {
    id = `${base}-${i++}`;
  }
  used.add(id);
  return id;
}

function normalizeContentJson(content, classId, subjectId) {
  const out = isObject(content) ? content : {};
  out.version = 1;
  if (!isObject(out.meta)) out.meta = {};
  out.meta.classId = String(out.meta.classId || classId);
  out.meta.subjectId = String(out.meta.subjectId || subjectId);
  out.meta.title = String(out.meta.title || subjectId);

  if (!Array.isArray(out.paragraphs)) out.paragraphs = [];
  if (!Array.isArray(out.quizzes)) out.quizzes = [];

  const paragraphIds = new Set();
  for (const p of out.paragraphs) {
    if (!isObject(p)) continue;
    p.id = String(p.id ?? "").trim();
    if (!p.id) p.id = ensureId("p", `${out.meta.subjectId}-p`, paragraphIds);
    if (paragraphIds.has(p.id)) p.id = ensureId("p", p.id, paragraphIds);
    else paragraphIds.add(p.id);

    p.title = String(p.title ?? "");
    if (p.summary != null) p.summary = String(p.summary);
    if (p.image === undefined) p.image = null;
    if (p.image !== null && p.image != null) p.image = String(p.image);

    if (!Array.isArray(p.sections)) p.sections = [];
    if (!Array.isArray(p.dates)) p.dates = [];
    if (!Array.isArray(p.terms)) p.terms = [];
    if (!Array.isArray(p.people)) p.people = [];
    if (!Array.isArray(p.quizzes)) p.quizzes = [];

    const termIds = new Set();
    p.terms = p.terms
      .filter((t) => isObject(t))
      .map((t, idx) => {
        const term = String(t.term ?? "");
        const definition = String(t.definition ?? "");
        const id = ensureId("t", t.id || `t-${p.id}-${idx + 1}`, termIds);
        const image = t.image === undefined ? null : t.image === null ? null : String(t.image);
        return { id, term, definition, image };
      });

    const peopleIds = new Set();
    p.people = p.people
      .filter((pp) => isObject(pp))
      .map((pp, idx) => {
        const name = String(pp.name ?? "");
        const description = pp.description != null ? String(pp.description) : pp.info != null ? String(pp.info) : "";
        const id = ensureId("person", pp.id || `p-${p.id}-${idx + 1}`, peopleIds);
        const image = pp.image === undefined ? null : pp.image === null ? null : String(pp.image);
        const outP = { id, name, description };
        if (image !== null) outP.image = image;
        return outP;
      });

    p.quizzes = p.quizzes
      .filter((q) => isObject(q))
      .map((q) => ({
        id: String(q.id ?? "").replace(/\.json$/i, ""),
        title: q.title != null ? String(q.title) : undefined,
        source: q.source != null ? String(q.source) : undefined,
      }))
      .filter((q) => q.id);
  }

  const quizIds = new Set();
  out.quizzes = out.quizzes
    .filter((q) => isObject(q))
    .map((q) => {
      const id = String(q.id ?? "").replace(/\.json$/i, "");
      if (!id) return null;
      if (quizIds.has(id)) return null;
      quizIds.add(id);

      const questionsRaw = Array.isArray(q.questions) ? q.questions : [];
      const questions = questionsRaw.map((qq) => {
        if (!isObject(qq)) return qq;
        if (qq.type !== "input") return qq;
        // Old data sometimes had `answers: []` or empty `answer`.
        const answer = qq.answer != null ? String(qq.answer).trim() : "";
        if (answer) return { ...qq, answer };
        const answersArr = Array.isArray(qq.answers) ? qq.answers.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
        if (answersArr.length > 0) return { ...qq, answer: answersArr[0] };
        return { ...qq, answer: "TODO" };
      });

      return {
        id,
        title: q.title != null ? String(q.title) : id,
        source: q.source != null ? String(q.source) : "manual",
        difficulty: q.difficulty != null ? String(q.difficulty) : undefined,
        questions,
      };
    })
    .filter(Boolean);

  return out;
}

async function buildFromLegacy(subjectDir, classId, subjectId) {
  const paragraphsPath = path.join(subjectDir, "paragraphs.json");
  const paragraphsRaw = JSON.parse(await fs.readFile(paragraphsPath, "utf8"));
  const paragraphs = Array.isArray(paragraphsRaw) ? paragraphsRaw : [];

  const quizIds = new Map(); // id -> {title}

  const out = {
    version: 1,
    meta: { classId: String(classId), subjectId: String(subjectId), title: String(subjectId) },
    paragraphs: [],
    quizzes: [],
  };

  for (const p of paragraphs) {
    if (!isObject(p)) continue;
    const pid = String(p.id ?? "").trim();
    const pQuizzes = Array.isArray(p.quizzes) ? p.quizzes : [];
    const quizRefs = pQuizzes
      .filter((q) => isObject(q))
      .map((q) => {
        const file = String(q.file ?? "").trim();
        const id = file.replace(/\.json$/i, "");
        const title = q.title != null ? String(q.title) : undefined;
        if (id) quizIds.set(id, { title });
        return { id, title, source: "manual" };
      })
      .filter((q) => q.id);

    const terms = Array.isArray(p.terms) ? p.terms : [];
    const dates = Array.isArray(p.dates) ? p.dates : [];
    const sections = Array.isArray(p.sections) ? p.sections : [];

    out.paragraphs.push({
      id: pid || String(out.paragraphs.length + 1),
      title: String(p.title ?? ""),
      summary: p.summary != null ? String(p.summary) : "",
      image: null,
      sections,
      dates,
      terms: terms.map((t, idx) => ({
        id: `t-${pid || out.paragraphs.length}-${idx + 1}`,
        term: String(t?.term ?? ""),
        definition: String(t?.definition ?? ""),
        image: null,
      })),
      people: [],
      quizzes: quizRefs,
    });
  }

  for (const [id, meta] of quizIds.entries()) {
    const quizPath = path.join(subjectDir, `${id}.json`);
    if (!(await fileExists(quizPath))) continue;
    const quizRaw = JSON.parse(await fs.readFile(quizPath, "utf8"));
    if (!isObject(quizRaw)) continue;
    out.quizzes.push({
      id,
      title: String(quizRaw.title ?? meta.title ?? id),
      source: "manual",
      difficulty: "medium",
      questions: Array.isArray(quizRaw.questions) ? quizRaw.questions : [],
    });
  }

  return normalizeContentJson(out, classId, subjectId);
}

async function main() {
  const dataRoot = path.resolve(process.cwd(), "data");
  const classDirs = (await fs.readdir(dataRoot, { withFileTypes: true })).filter((d) => d.isDirectory());

  const changed = [];

  for (const c of classDirs) {
    const classId = c.name;
    const classPath = path.join(dataRoot, classId);
    const subjectDirs = (await fs.readdir(classPath, { withFileTypes: true })).filter((d) => d.isDirectory());

    for (const s of subjectDirs) {
      const subjectId = s.name;
      const subjectPath = path.join(classPath, subjectId);

      const contentPath = path.join(subjectPath, "content.json");
      const hasContent = await fileExists(contentPath);
      const hasParagraphs = await fileExists(path.join(subjectPath, "paragraphs.json"));

      if (!hasContent && !hasParagraphs) continue;

      let content;
      if (hasContent) {
        const raw = JSON.parse(await fs.readFile(contentPath, "utf8"));
        content = normalizeContentJson(raw, classId, subjectId);
      } else {
        content = await buildFromLegacy(subjectPath, classId, subjectId);
      }

      await fs.writeFile(contentPath, JSON.stringify(content, null, 2) + "\n", "utf8");
      changed.push(path.relative(process.cwd(), contentPath));
    }
  }

  console.log(`Unified content.json files: ${changed.length}`);
  for (const p of changed) console.log(`- ${p}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

