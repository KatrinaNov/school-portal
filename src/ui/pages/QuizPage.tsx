import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSubjectContent } from "../../services/content/useSubjectContent";
import type { Quiz, QuizQuestion } from "../../services/content/types";
import { saveQuizAttempt } from "../../services/firestoreStats";

function normalizeAnswer(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function validateAnswer(question: QuizQuestion, userAnswer: unknown): boolean {
  if (!question) return false;
  const type = (question as any).type;

  if (type === "choice") {
    const correctIdx = Number((question as any).c);
    const userIdx = Number(userAnswer);
    return Number.isFinite(correctIdx) && Number.isFinite(userIdx) && userIdx === correctIdx;
  }

  if (type === "input") {
    const answers = (question as any).answers ?? ((question as any).answer != null ? [(question as any).answer] : []);
    const normalized = normalizeAnswer(userAnswer);
    return Array.isArray(answers) && answers.some((a) => normalizeAnswer(a) === normalized);
  }

  if (type === "multiple_choice") {
    const correctSet: number[] = Array.isArray((question as any).c) ? (question as any).c : [];
    const userSet: number[] = Array.isArray(userAnswer) ? (userAnswer as number[]) : [];
    const c = [...correctSet].sort((a, b) => a - b).join(",");
    const u = [...userSet].sort((a, b) => a - b).join(",");
    return c === u;
  }

  if (type === "match") {
    const pairs = (question as any).pairs;
    const ua = userAnswer as any;
    if (!Array.isArray(pairs) || pairs.length === 0) return false;
    if (!ua || !Array.isArray(ua.rightOrder) || !Array.isArray(ua.selected)) return false;
    if (ua.selected.length !== ua.rightOrder.length) return false;
    for (let i = 0; i < pairs.length; i++) {
      if (ua.rightOrder.indexOf(i) !== ua.selected[i]) return false;
    }
    return true;
  }

  if (type === "fill_words") {
    const expected: string[] = Array.isArray((question as any).answers) ? (question as any).answers : [];
    const given: unknown[] = Array.isArray(userAnswer) ? (userAnswer as unknown[]) : [];
    if (expected.length === 0 || given.length !== expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (normalizeAnswer(given[i]) !== normalizeAnswer(expected[i])) return false;
    }
    return true;
  }

  return false;
}

function optionText(opt: unknown): string {
  if (opt == null) return "";
  if (typeof opt === "object" && (opt as any).text != null) return String((opt as any).text);
  return String(opt);
}

function imgUrl(base: string, imageValue?: string) {
  if (!imageValue) return "";
  const v = String(imageValue).trim();
  if (!v || /javascript:/i.test(v) || v.includes("..")) return "";
  if (/^https?:/i.test(v) || v.startsWith("/")) return v;
  return `${base}${v.replace(/^\.\//, "")}`;
}

type Answer =
  | { type: "choice"; index: number }
  | { type: "multiple_choice"; indices: number[] }
  | { type: "input"; value: string }
  | { type: "fill_words"; values: string[] }
  | { type: "match"; rightOrder: number[]; selected: number[] }
  | null;

export function QuizPage() {
  const nav = useNavigate();
  const { classId, subjectId, quizId } = useParams();
  const state = useSubjectContent(classId, subjectId);

  const baseMedia = useMemo(() => {
    if (!classId || !subjectId) return "";
    return `/data/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/`;
  }, [classId, subjectId]);

  const quiz: Quiz | undefined =
    state.status === "ready" && quizId ? state.content.quizzes.find((q) => q.id === quizId) : undefined;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [mode, setMode] = useState<"take" | "result">("take");
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);

  const total = quiz?.questions?.length ?? 0;
  const q = quiz && total > 0 ? (quiz.questions[step] as QuizQuestion) : null;

  const backToSubject = () => {
    if (!classId || !subjectId) return nav("/");
    nav(`/class/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`);
  };

  if (!classId || !subjectId || !quizId) {
    return (
      <div className="container">
        <p>Тест не найден</p>
        <Link to="/" className="secondary">
          На главную
        </Link>
      </div>
    );
  }

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="container container--loader">
        <div className="loader" />
        <p>Загрузка теста...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="container">
        <p>Ошибка загрузки: {state.error}</p>
        <button type="button" className="secondary" onClick={backToSubject}>
          Назад
        </button>
      </div>
    );
  }

  if (!quiz || total === 0) {
    return (
      <div className="container">
        <h1>В этом тесте нет вопросов</h1>
        <button type="button" className="secondary" onClick={backToSubject}>
          Назад
        </button>
      </div>
    );
  }

  async function finish() {
    const correct = quiz.questions.reduce((acc, question, idx) => {
      const a = answers[idx];
      let ua: unknown = null;
      if (a?.type === "choice") ua = a.index;
      if (a?.type === "multiple_choice") ua = a.indices;
      if (a?.type === "input") ua = a.value;
      if (a?.type === "fill_words") ua = a.values;
      if (a?.type === "match") ua = { rightOrder: a.rightOrder, selected: a.selected };
      return acc + (validateAnswer(question as any, ua) ? 1 : 0);
    }, 0);

    const totalQ = quiz.questions.length;
    setResult({ correct, total: totalQ });
    setMode("result");

    try {
      const user = (window as any).__authUser;
      if (user && user.uid) {
        const score = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
        await saveQuizAttempt(String(user.uid), {
          quizId: quiz.id,
          quizTitle: quiz.title,
          score,
          total: totalQ,
          correct,
          wrong: totalQ - correct,
          finishedAt: new Date().toISOString(),
        });
      }
    } catch {
      // non-critical
    }
  }

  const currentAnswer = answers[step] ?? null;

  const progress = `${step + 1} из ${total}`;

  return (
    <div className="container">
      <div className="quiz-header">
        <h1>{quiz.title}</h1>
        <button type="button" className="secondary quiz-exit" onClick={backToSubject}>
          Выйти
        </button>
      </div>

      {mode === "result" && result ? (
        <div style={{ marginTop: 12 }}>
          <h2>
            Результат: {result.correct}/{result.total} ({Math.round((result.correct / result.total) * 100)}%)
          </h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" onClick={() => nav(0)}>
              Пройти ещё раз
            </button>
            <button type="button" className="secondary" onClick={backToSubject}>
              Назад к предмету
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="quiz-welcome">
            Ты справишься! Выбери ответ или введи его — результат увидишь после проверки.
          </p>
          <div className="progress">{progress}</div>

          <h2>{(q as any)?.q ?? ""}</h2>
          {(q as any)?.image ? (
            <div className="quiz-q-image">
              <img src={imgUrl(baseMedia, (q as any).image)} alt="" className="quiz-image" loading="lazy" />
            </div>
          ) : null}

          <div style={{ marginTop: 8 }}>
            {q && (q as any).type === "choice" && Array.isArray((q as any).a) ? (
              <div style={{ display: "grid", gap: 12 }}>
                {(q as any).a.map((opt: unknown, idx: number) => {
                  const selected = currentAnswer?.type === "choice" && currentAnswer.index === idx;
                  return (
                    <div
                      key={idx}
                      className={`card answer-card${selected ? " answer-card--selected" : ""}`}
                      onClick={() => setAnswers((prev) => ({ ...prev, [step]: { type: "choice", index: idx } }))}
                      role="button"
                      tabIndex={0}
                    >
                      {optionText(opt)}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {q && (q as any).type === "multiple_choice" && Array.isArray((q as any).a) ? (
              <div style={{ display: "grid", gap: 12 }}>
                {(q as any).a.map((opt: unknown, idx: number) => {
                  const checked =
                    currentAnswer?.type === "multiple_choice" && currentAnswer.indices.includes(idx);
                  return (
                    <label key={idx} className="card answer-card answer-card--multi">
                      <input
                        type="checkbox"
                        className="multi-choice-cb"
                        checked={checked}
                        onChange={(e) => {
                          setAnswers((prev) => {
                            const cur =
                              prev[step]?.type === "multiple_choice" ? (prev[step] as any).indices : [];
                            const next = new Set<number>(cur);
                            if (e.target.checked) next.add(idx);
                            else next.delete(idx);
                            return { ...prev, [step]: { type: "multiple_choice", indices: Array.from(next) } };
                          });
                        }}
                      />
                      <span className="multi-choice-label">{optionText(opt)}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}

            {q && (q as any).type === "input" ? (
              <input
                type="text"
                className="input-answer"
                placeholder="Введите ответ"
                value={currentAnswer?.type === "input" ? currentAnswer.value : ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [step]: { type: "input", value: e.target.value } }))}
              />
            ) : null}

            {q && (q as any).type === "fill_words" && Array.isArray((q as any).answers) ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {((q as any).answers as unknown[]).map((_: unknown, i: number) => {
                  const values =
                    currentAnswer?.type === "fill_words" ? currentAnswer.values : Array(((q as any).answers as any[]).length).fill("");
                  return (
                    <span key={i} className="fill-word-wrap">
                      <input
                        type="text"
                        className="input-answer fill-word-input"
                        placeholder="…"
                        value={values[i] ?? ""}
                        onChange={(e) => {
                          setAnswers((prev) => {
                            const cur =
                              prev[step]?.type === "fill_words"
                                ? (prev[step] as any).values
                                : Array(((q as any).answers as any[]).length).fill("");
                            const next = [...cur];
                            next[i] = e.target.value;
                            return { ...prev, [step]: { type: "fill_words", values: next } };
                          });
                        }}
                      />
                    </span>
                  );
                })}
              </div>
            ) : null}

            {q && (q as any).type === "match" && Array.isArray((q as any).pairs) ? (
              <MatchQuestion
                question={q as any}
                answer={currentAnswer?.type === "match" ? currentAnswer : null}
                onChange={(a) => setAnswers((prev) => ({ ...prev, [step]: a }))}
              />
            ) : null}
          </div>

          <div className="quiz-nav" style={{ marginTop: 16 }}>
            {step > 0 ? (
              <button type="button" className="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Назад
              </button>
            ) : null}

            {step === total - 1 ? (
              <button type="button" onClick={finish}>
                Проверить
              </button>
            ) : (
              <button type="button" onClick={() => setStep((s) => Math.min(total - 1, s + 1))}>
                Дальше
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MatchQuestion({
  question,
  answer,
  onChange,
}: {
  question: { pairs: Array<[string, string]> };
  answer: { type: "match"; rightOrder: number[]; selected: number[] } | null;
  onChange: (a: { type: "match"; rightOrder: number[]; selected: number[] }) => void;
}) {
  const rightOrder = useMemo(() => {
    if (answer?.rightOrder?.length === question.pairs.length) return answer.rightOrder;
    const idx = question.pairs.map((_, i) => i);
    // stable shuffle
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [answer?.rightOrder, question.pairs]);

  const rightItems = rightOrder.map((i) => question.pairs[i][1]);
  const selected =
    answer?.selected?.length === question.pairs.length ? answer.selected : Array(question.pairs.length).fill(-1);

  return (
    <div className="match-container">
      <div className="match-column match-left">
        <ul>
          {question.pairs.map(([left], leftIdx) => (
            <li key={leftIdx} className="match-row" data-left-index={leftIdx}>
              <span className="match-left-text">{left}</span>
              <select
                className="match-select"
                value={selected[leftIdx] ?? -1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = [...selected];
                  next[leftIdx] = Number.isFinite(v) ? v : -1;
                  onChange({ type: "match", rightOrder, selected: next });
                }}
              >
                <option value={-1}>—</option>
                {rightItems.map((txt, i) => (
                  <option key={i} value={i}>
                    {txt}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

