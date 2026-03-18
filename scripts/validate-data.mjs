import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const dataRoot = path.join(repoRoot, "data");

function isObject(x) {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

async function listFilesRec(dir) {
  const out = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listFilesRec(p)));
    } else {
      out.push(p);
    }
  }
  return out;
}

function rel(p) {
  return path.relative(repoRoot, p).replaceAll("\\", "/");
}

function pushErr(errors, file, message) {
  errors.push(`${rel(file)}: ${message}`);
}

function ensureMediaExists(errors, file, baseDir, imageValue, hint) {
  if (imageValue == null) return;
  if (typeof imageValue !== "string" || !imageValue.trim()) {
    pushErr(errors, file, `${hint}: image must be string or null`);
    return;
  }
  const abs = path.join(baseDir, imageValue);
  if (!fs.existsSync(abs)) {
    pushErr(errors, file, `${hint}: missing file ${rel(abs)}`);
  }
}

function validateQuestion(errors, file, baseDir, q, idx, quizId) {
  const hint = `quiz "${quizId}" question #${idx + 1}`;
  if (!isObject(q)) {
    pushErr(errors, file, `${hint}: question must be an object`);
    return;
  }
  const type = q.type;
  if (typeof type !== "string" || !type.trim()) {
    pushErr(errors, file, `${hint}: missing "type"`);
    return;
  }

  // Common image checks
  if ("image" in q) ensureMediaExists(errors, file, baseDir, q.image, `${hint} (${type})`);

  if (type === "choice") {
    if (!Array.isArray(q.a) || q.a.length < 2) pushErr(errors, file, `${hint}: "a" must be array (>=2)`);
    if (typeof q.c !== "number") pushErr(errors, file, `${hint}: "c" must be number (index)`);
  } else if (type === "multiple_choice") {
    if (!Array.isArray(q.a) || q.a.length < 2) pushErr(errors, file, `${hint}: "a" must be array (>=2)`);
    if (!Array.isArray(q.c) || q.c.length < 1) pushErr(errors, file, `${hint}: "c" must be array (>=1)`);
  } else if (type === "match") {
    if (!Array.isArray(q.pairs) || q.pairs.length < 2) pushErr(errors, file, `${hint}: "pairs" must be array (>=2)`);
  } else if (type === "fill_words") {
    if (!Array.isArray(q.answers) || q.answers.length < 1) pushErr(errors, file, `${hint}: "answers" must be array (>=1)`);
  } else if (type === "input") {
    if (typeof q.answer !== "string" || !q.answer.trim()) pushErr(errors, file, `${hint}: "answer" must be non-empty string`);
  }
}

function validateContentJson(errors, file, json) {
  const baseDir = path.dirname(file);

  if (!isObject(json)) {
    pushErr(errors, file, "root must be an object");
    return;
  }
  if (!Array.isArray(json.paragraphs)) {
    pushErr(errors, file, '"paragraphs" must be an array');
    return;
  }
  if (!Array.isArray(json.quizzes)) {
    pushErr(errors, file, '"quizzes" must be an array');
    return;
  }

  const paragraphIds = new Set();
  for (let i = 0; i < json.paragraphs.length; i++) {
    const p = json.paragraphs[i];
    if (!isObject(p)) {
      pushErr(errors, file, `paragraph #${i + 1}: must be an object`);
      continue;
    }
    const id = p.id;
    if (typeof id !== "string" || !id.trim()) {
      pushErr(errors, file, `paragraph #${i + 1}: missing "id"`);
    } else if (paragraphIds.has(id)) {
      pushErr(errors, file, `paragraph #${i + 1}: duplicate id "${id}"`);
    } else {
      paragraphIds.add(id);
    }

    if ("image" in p) ensureMediaExists(errors, file, baseDir, p.image, `paragraph "${id || i + 1}"`);

    if (Array.isArray(p.quizzes)) {
      for (const q of p.quizzes) {
        if (!isObject(q) || typeof q.id !== "string") {
          pushErr(errors, file, `paragraph "${id || i + 1}": quiz ref must be object with string "id"`);
        }
      }
    }
  }

  const quizIds = new Set();
  for (let i = 0; i < json.quizzes.length; i++) {
    const quiz = json.quizzes[i];
    if (!isObject(quiz)) {
      pushErr(errors, file, `quiz #${i + 1}: must be an object`);
      continue;
    }
    const quizId = quiz.id;
    if (typeof quizId !== "string" || !quizId.trim()) {
      pushErr(errors, file, `quiz #${i + 1}: missing "id"`);
      continue;
    }
    if (quizIds.has(quizId)) {
      pushErr(errors, file, `quiz #${i + 1}: duplicate id "${quizId}"`);
      continue;
    }
    quizIds.add(quizId);

    if (!Array.isArray(quiz.questions) || quiz.questions.length < 1) {
      pushErr(errors, file, `quiz "${quizId}": "questions" must be array (>=1)`);
      continue;
    }
    for (let qi = 0; qi < quiz.questions.length; qi++) {
      validateQuestion(errors, file, baseDir, quiz.questions[qi], qi, quizId);
    }
  }
}

async function main() {
  const errors = [];

  if (!fs.existsSync(dataRoot)) {
    console.log(`No data dir found at ${rel(dataRoot)} — skipping.`);
    return;
  }

  const all = await listFilesRec(dataRoot);
  const contentFiles = all.filter((p) => p.endsWith(`${path.sep}content.json`));

  if (contentFiles.length === 0) {
    console.log("No content.json files found — nothing to validate.");
    return;
  }

  for (const file of contentFiles) {
    let raw;
    try {
      raw = await fs.promises.readFile(file, "utf8");
    } catch (e) {
      pushErr(errors, file, `cannot read file (${e?.message || e})`);
      continue;
    }
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      pushErr(errors, file, `invalid JSON (${e?.message || e})`);
      continue;
    }
    validateContentJson(errors, file, json);
  }

  if (errors.length > 0) {
    console.error(`Data validation failed (${errors.length} issue(s)):\n`);
    for (const e of errors) console.error(`- ${e}`);
    process.exitCode = 1;
    return;
  }

  console.log(`OK: validated ${contentFiles.length} content.json file(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

