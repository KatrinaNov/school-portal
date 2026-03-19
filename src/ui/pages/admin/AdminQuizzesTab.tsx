import { useEffect, useMemo, useState } from "react";
import { uploadImageToStorage } from "../../../services/storage";
import { listClasses, listSubjectsByClass } from "../../../services/adminConfig";
import { createQuiz, deleteQuiz, listQuizzesBySubject, upsertQuiz } from "../../../services/adminQuizzes";
import type { Quiz, QuizQuestion } from "../../../services/content/types";

function safeString(v: any) {
  return v == null ? "" : String(v);
}

type ClassOption = { id: string; name: string };
type SubjectOption = { id: string; name: string; path?: string };

function emptyQuestion(type: QuizQuestion["type"]): QuizQuestion {
  if (type === "choice") return { type: "choice", q: "Вопрос", a: ["Вариант 1", "Вариант 2"], c: 0 };
  if (type === "multiple_choice") return { type: "multiple_choice", q: "Вопрос", a: ["A", "B", "C"], c: [0] };
  if (type === "input") return { type: "input", q: "Вопрос", answer: "" };
  if (type === "match") return { type: "match", q: "Соотнесите", pairs: [["Лево", "Право"]] };
  if (type === "fill_words") return { type: "fill_words", q: "Заполните слова", answers: [""] };
  return { type: String(type), q: "Вопрос" } as any;
}

function normalizeChoiceAnswerIndex(q: any) {
  const n = Array.isArray(q?.a) ? q.a.length : 0;
  if (typeof q?.c !== "number" || !Number.isFinite(q.c)) q.c = 0;
  if (n <= 0) q.c = 0;
  if (q.c < 0) q.c = 0;
  if (q.c >= n) q.c = n - 1;
}

function normalizeMultiChoiceAnswers(q: any) {
  const n = Array.isArray(q?.a) ? q.a.length : 0;
  const arr = Array.isArray(q?.c) ? q.c : [];
  q.c = arr
    .map((x: any) => Number(x))
    .filter((x: any) => Number.isFinite(x) && x >= 0 && (n === 0 ? true : x < n));
  if (q.c.length === 0 && n > 0) q.c = [0];
}

export function AdminQuizzesTab() {
  const [cfgState, setCfgState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; classes: ClassOption[]; subjectsByClass: Record<string, SubjectOption[]> }
  >({ status: "loading" });

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const classes = await listClasses();
        const subjectsByClass: Record<string, SubjectOption[]> = {};
        for (const c of classes) {
          const subs = await listSubjectsByClass(c.id);
          subjectsByClass[c.id] = subs.map((s) => ({ id: s.id, name: s.name, path: s.path }));
        }
        if (cancelled) return;
        setCfgState({ status: "ready", classes, subjectsByClass });
        const firstClass = classes[0]?.id || "";
        const firstSub = firstClass ? subjectsByClass[firstClass]?.[0]?.id || "" : "";
        setClassId((prev) => prev || firstClass);
        setSubjectId((prev) => prev || firstSub);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Не удалось загрузить конфиг из Firestore.";
        setCfgState({ status: "error", error: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cfgState.status !== "ready") return;
    const subs = cfgState.subjectsByClass[classId] || [];
    if (subs.length === 0) {
      setSubjectId("");
      return;
    }
    if (!subs.some((s) => s.id === subjectId)) setSubjectId(subs[0].id);
  }, [cfgState, classId, subjectId]);

  const subs = useMemo(() => (cfgState.status === "ready" ? cfgState.subjectsByClass[classId] || [] : []), [cfgState, classId]);

  const [listState, setListState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; quizzes: Quiz[]; selectedId: string | null }
  >({ status: "idle" });

  const selectedQuiz = useMemo(() => {
    if (listState.status !== "ready") return null;
    return listState.quizzes.find((q) => q.id === listState.selectedId) || null;
  }, [listState]);

  const [draft, setDraft] = useState<Quiz | null>(null);

  const reload = async () => {
    if (!classId || !subjectId) return;
    setListState({ status: "loading" });
    try {
      const quizzes = await listQuizzesBySubject(classId, subjectId);
      setListState({ status: "ready", quizzes, selectedId: quizzes[0]?.id || null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось загрузить тесты.";
      setListState({ status: "error", error: msg });
    }
  };

  useEffect(() => {
    if (!classId || !subjectId) {
      setListState({ status: "idle" });
      setDraft(null);
      return;
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectId]);

  useEffect(() => {
    if (!selectedQuiz) {
      setDraft(null);
      return;
    }
    setDraft(JSON.parse(JSON.stringify(selectedQuiz)));
  }, [selectedQuiz?.id]);

  const onCreate = async () => {
    if (!classId || !subjectId) return;
    const q = await createQuiz({ classId, subjectId });
    await reload();
    setListState((prev) => (prev.status === "ready" ? { ...prev, selectedId: q.id } : prev));
  };

  const onSave = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return alert("Введите заголовок теста.");
    const questions = Array.isArray(draft.questions) ? draft.questions : [];
    questions.forEach((qq: any) => {
      if (qq?.type === "choice") normalizeChoiceAnswerIndex(qq);
      if (qq?.type === "multiple_choice") normalizeMultiChoiceAnswers(qq);
    });
    await upsertQuiz({
      id: draft.id,
      classId,
      subjectId,
      title: draft.title,
      questions: questions as any,
      source: draft.source,
      difficulty: draft.difficulty,
    });
    await reload();
    setListState((prev) => (prev.status === "ready" ? { ...prev, selectedId: draft.id } : prev));
  };

  const onDelete = async () => {
    if (!draft) return;
    if (!confirm("Удалить тест?")) return;
    await deleteQuiz(draft.id);
    await reload();
  };

  const uploadQuestionImage = async (qIndex: number, file: File) => {
    const url = await uploadImageToStorage({ classId, subjectId, file });
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, questions: prev.questions.slice() };
      const q = { ...(next.questions[qIndex] as any) };
      q.image = url;
      next.questions[qIndex] = q;
      return next;
    });
  };

  const addOption = (qIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, questions: prev.questions.slice() };
      const q: any = { ...(next.questions[qIndex] as any) };
      q.a = Array.isArray(q.a) ? q.a.slice() : [];
      q.a.push(`Вариант ${q.a.length + 1}`);
      next.questions[qIndex] = q;
      if (q.type === "choice") normalizeChoiceAnswerIndex(q);
      if (q.type === "multiple_choice") normalizeMultiChoiceAnswers(q);
      return next;
    });
  };

  const removeOption = (qIndex: number, optIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, questions: prev.questions.slice() };
      const q: any = { ...(next.questions[qIndex] as any) };
      q.a = Array.isArray(q.a) ? q.a.slice() : [];
      q.a.splice(optIndex, 1);
      next.questions[qIndex] = q;
      if (q.type === "choice") normalizeChoiceAnswerIndex(q);
      if (q.type === "multiple_choice") normalizeMultiChoiceAnswers(q);
      return next;
    });
  };

  const addQuestion = (type: QuizQuestion["type"]) => {
    setDraft((prev) => (prev ? { ...prev, questions: (prev.questions || []).concat([emptyQuestion(type)]) } : prev));
  };

  const removeQuestion = (idx: number) => {
    setDraft((prev) => (prev ? { ...prev, questions: (prev.questions || []).filter((_, i) => i !== idx) } : prev));
  };

  return (
    <div>
      <h2 className="u-mt-0">Тесты</h2>

      {cfgState.status === "loading" ? (
        <div className="u-mt-12">
          <div className="loader" />
          <p>Загрузка…</p>
        </div>
      ) : null}
      {cfgState.status === "error" ? <p className="u-mt-12">Ошибка: {cfgState.error}</p> : null}

      {cfgState.status === "ready" ? (
        <div>
          <div className="u-flex u-gap-10 u-flex-wrap u-items-center">
            <label>
              <span className="u-fz-12 u-opacity-85">Класс</span>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="u-block">
                {cfgState.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="u-fz-12 u-opacity-85">Предмет</span>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="u-block">
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.id}
                  </option>
                ))}
              </select>
            </label>

            <div className="u-flex-1" />

            <button type="button" className="secondary" onClick={reload}>
              Обновить
            </button>
            <button type="button" onClick={onCreate}>
              + Тест
            </button>
          </div>

          {listState.status === "loading" ? (
            <div className="u-mt-12">
              <div className="loader" />
              <p>Загрузка…</p>
            </div>
          ) : null}
          {listState.status === "error" ? <p className="u-mt-12">Ошибка: {listState.error}</p> : null}

          {listState.status === "ready" ? (
            <div className="u-grid u-grid-cols-minmax-220-2fr u-gap-12 u-mt-12">
              <div className="card u-p-12">
                <strong>Список</strong>
                <div className="u-grid u-gap-8 u-mt-10">
                  {listState.quizzes.length === 0 ? <p className="admin-empty">Нет тестов.</p> : null}
                  {listState.quizzes.map((q) => {
                    const active = q.id === listState.selectedId;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        className={`card u-text-left ${active ? "u-border-active" : ""}`}
                        onClick={() => setListState((prev) => (prev.status === "ready" ? { ...prev, selectedId: q.id } : prev))}
                      >
                        <strong>{safeString(q.title || q.id)}</strong>
                        <div className="u-mt-6 u-opacity-80">{q.id}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="card u-p-12">
                <strong>Редактор</strong>
                {!draft ? (
                  <p className="u-mt-10 u-opacity-85">Выберите тест слева.</p>
                ) : (
                  <div className="u-mt-10 u-grid u-gap-10">
                    <div className="u-flex u-gap-10 u-flex-wrap">
                      <button type="button" onClick={onSave}>
                        Сохранить
                      </button>
                      <button type="button" className="secondary" onClick={onDelete}>
                        Удалить
                      </button>
                      <div className="u-flex-1" />
                      <small className="u-opacity-80">id: {draft.id}</small>
                    </div>

                    <label>
                      <span className="u-fz-12 u-opacity-85">Заголовок</span>
                      <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                    </label>

                    <div className="card u-p-12">
                      <strong>Вопросы</strong>
                      <div className="u-flex u-gap-10 u-flex-wrap u-mt-10">
                        <button type="button" className="secondary" onClick={() => addQuestion("choice")}>
                          + Один ответ
                        </button>
                        <button type="button" className="secondary" onClick={() => addQuestion("multiple_choice")}>
                          + Несколько ответов
                        </button>
                        <button type="button" className="secondary" onClick={() => addQuestion("input")}>
                          + Ввод текста
                        </button>
                        <button type="button" className="secondary" onClick={() => addQuestion("match")}>
                          + Соответствия
                        </button>
                        <button type="button" className="secondary" onClick={() => addQuestion("fill_words")}>
                          + Заполнить слова
                        </button>
                      </div>

                      <div className="u-grid u-gap-12 u-mt-12">
                        {(draft.questions || []).map((q, idx) => {
                          const t = (q as any)?.type;
                          return (
                            <div key={idx} className="card u-p-12">
                              <div className="u-flex u-items-center u-justify-between u-gap-10">
                                <strong>
                                  #{idx + 1} — {safeString(t)}
                                </strong>
                                <button type="button" className="secondary" onClick={() => removeQuestion(idx)}>
                                  Удалить вопрос
                                </button>
                              </div>

                              {"q" in (q as any) ? (
                                <label className="u-block u-mt-10">
                                  <span className="u-fz-12 u-opacity-85">Текст вопроса</span>
                                  <textarea
                                    rows={3}
                                    value={safeString((q as any).q)}
                                    onChange={(e) =>
                                      setDraft((prev) => {
                                        if (!prev) return prev;
                                        const next = { ...prev, questions: prev.questions.slice() };
                                        next.questions[idx] = { ...(next.questions[idx] as any), q: e.target.value };
                                        return next;
                                      })
                                    }
                                  />
                                </label>
                              ) : null}

                              {(q as any).type === "choice" || (q as any).type === "multiple_choice" ? (
                                <div className="u-mt-10">
                                  <div className="u-fz-12 u-opacity-85">Варианты</div>
                                  <div className="u-grid u-gap-8 u-mt-8">
                                    {(((q as any).a as any[]) || []).map((opt, oi) => {
                                      const text = typeof opt === "string" ? opt : safeString((opt as any)?.text || "");
                                      const isChoice = (q as any).type === "choice";
                                      const isMulti = (q as any).type === "multiple_choice";
                                      const checked = isChoice
                                        ? Number((q as any).c) === oi
                                        : Array.isArray((q as any).c) && (q as any).c.includes(oi);
                                      return (
                                        <div key={oi} className="u-flex u-gap-10 u-items-center">
                                          <input
                                            type={isChoice ? "radio" : "checkbox"}
                                            name={isChoice ? `q-${idx}` : undefined}
                                            checked={!!checked}
                                            onChange={(e) =>
                                              setDraft((prev) => {
                                                if (!prev) return prev;
                                                const next = { ...prev, questions: prev.questions.slice() };
                                                const qq: any = { ...(next.questions[idx] as any) };
                                                if (isChoice) {
                                                  qq.c = oi;
                                                  normalizeChoiceAnswerIndex(qq);
                                                } else if (isMulti) {
                                                  const arr = Array.isArray(qq.c) ? qq.c.slice() : [];
                                                  const has = arr.includes(oi);
                                                  const nextArr = e.target.checked ? (has ? arr : arr.concat([oi])) : arr.filter((x: any) => x !== oi);
                                                  qq.c = nextArr;
                                                  normalizeMultiChoiceAnswers(qq);
                                                }
                                                next.questions[idx] = qq;
                                                return next;
                                              })
                                            }
                                          />
                                          <input
                                            type="text"
                                            value={text}
                                            onChange={(e) =>
                                              setDraft((prev) => {
                                                if (!prev) return prev;
                                                const next = { ...prev, questions: prev.questions.slice() };
                                                const qq: any = { ...(next.questions[idx] as any) };
                                                qq.a = Array.isArray(qq.a) ? qq.a.slice() : [];
                                                qq.a[oi] = e.target.value;
                                                next.questions[idx] = qq;
                                                return next;
                                              })
                                            }
                                            className="u-flex-1"
                                          />
                                          <button type="button" className="secondary" onClick={() => removeOption(idx, oi)}>
                                            −
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="u-mt-10">
                                    <button type="button" className="secondary" onClick={() => addOption(idx)}>
                                      + Вариант
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {(q as any).type === "input" ? (
                                <label className="u-block u-mt-10">
                                  <span className="u-fz-12 u-opacity-85">Правильный ответ</span>
                                  <input
                                    value={safeString((q as any).answer)}
                                    onChange={(e) =>
                                      setDraft((prev) => {
                                        if (!prev) return prev;
                                        const next = { ...prev, questions: prev.questions.slice() };
                                        next.questions[idx] = { ...(next.questions[idx] as any), answer: e.target.value };
                                        return next;
                                      })
                                    }
                                  />
                                </label>
                              ) : null}

                              {(q as any).type === "fill_words" ? (
                                <div className="u-mt-10">
                                  <div className="u-fz-12 u-opacity-85">Ответы (по порядку)</div>
                                  <div className="u-grid u-gap-8 u-mt-8">
                                    {(((q as any).answers as any[]) || []).map((ans, ai) => (
                                      <div key={ai} className="u-flex u-gap-10 u-items-center">
                                        <input
                                          value={safeString(ans)}
                                          onChange={(e) =>
                                            setDraft((prev) => {
                                              if (!prev) return prev;
                                              const next = { ...prev, questions: prev.questions.slice() };
                                              const qq: any = { ...(next.questions[idx] as any) };
                                              qq.answers = Array.isArray(qq.answers) ? qq.answers.slice() : [];
                                              qq.answers[ai] = e.target.value;
                                              next.questions[idx] = qq;
                                              return next;
                                            })
                                          }
                                          className="u-flex-1"
                                        />
                                        <button
                                          type="button"
                                          className="secondary"
                                          onClick={() =>
                                            setDraft((prev) => {
                                              if (!prev) return prev;
                                              const next = { ...prev, questions: prev.questions.slice() };
                                              const qq: any = { ...(next.questions[idx] as any) };
                                              qq.answers = Array.isArray(qq.answers) ? qq.answers.slice() : [];
                                              qq.answers.splice(ai, 1);
                                              next.questions[idx] = qq;
                                              return next;
                                            })
                                          }
                                        >
                                          −
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="u-mt-10">
                                    <button
                                      type="button"
                                      className="secondary"
                                      onClick={() =>
                                        setDraft((prev) => {
                                          if (!prev) return prev;
                                          const next = { ...prev, questions: prev.questions.slice() };
                                          const qq: any = { ...(next.questions[idx] as any) };
                                          qq.answers = Array.isArray(qq.answers) ? qq.answers.slice() : [];
                                          qq.answers.push("");
                                          next.questions[idx] = qq;
                                          return next;
                                        })
                                      }
                                    >
                                      + Ответ
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {(q as any).type === "match" ? (
                                <div className="u-mt-10">
                                  <div className="u-fz-12 u-opacity-85">Пары</div>
                                  <div className="u-grid u-gap-8 u-mt-8">
                                    {(((q as any).pairs as any[]) || []).map((pair, pi) => (
                                      <div key={pi} className="u-grid u-grid-cols-2-auto u-gap-10 u-items-center">
                                        <input
                                          value={safeString(pair?.[0])}
                                          onChange={(e) =>
                                            setDraft((prev) => {
                                              if (!prev) return prev;
                                              const next = { ...prev, questions: prev.questions.slice() };
                                              const qq: any = { ...(next.questions[idx] as any) };
                                              qq.pairs = Array.isArray(qq.pairs) ? qq.pairs.map((x: any) => (Array.isArray(x) ? [x[0], x[1]] : ["", ""])) : [];
                                              qq.pairs[pi] = [e.target.value, safeString(qq.pairs[pi]?.[1])];
                                              next.questions[idx] = qq;
                                              return next;
                                            })
                                          }
                                        />
                                        <input
                                          value={safeString(pair?.[1])}
                                          onChange={(e) =>
                                            setDraft((prev) => {
                                              if (!prev) return prev;
                                              const next = { ...prev, questions: prev.questions.slice() };
                                              const qq: any = { ...(next.questions[idx] as any) };
                                              qq.pairs = Array.isArray(qq.pairs) ? qq.pairs.map((x: any) => (Array.isArray(x) ? [x[0], x[1]] : ["", ""])) : [];
                                              qq.pairs[pi] = [safeString(qq.pairs[pi]?.[0]), e.target.value];
                                              next.questions[idx] = qq;
                                              return next;
                                            })
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="secondary"
                                          onClick={() =>
                                            setDraft((prev) => {
                                              if (!prev) return prev;
                                              const next = { ...prev, questions: prev.questions.slice() };
                                              const qq: any = { ...(next.questions[idx] as any) };
                                              qq.pairs = Array.isArray(qq.pairs) ? qq.pairs.slice() : [];
                                              qq.pairs.splice(pi, 1);
                                              next.questions[idx] = qq;
                                              return next;
                                            })
                                          }
                                        >
                                          −
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="u-mt-10">
                                    <button
                                      type="button"
                                      className="secondary"
                                      onClick={() =>
                                        setDraft((prev) => {
                                          if (!prev) return prev;
                                          const next = { ...prev, questions: prev.questions.slice() };
                                          const qq: any = { ...(next.questions[idx] as any) };
                                          qq.pairs = Array.isArray(qq.pairs) ? qq.pairs.slice() : [];
                                          qq.pairs.push(["", ""]);
                                          next.questions[idx] = qq;
                                          return next;
                                        })
                                      }
                                    >
                                      + Пара
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {"image" in (q as any) || (q as any).type === "choice" || (q as any).type === "multiple_choice" ? (
                                <div className="u-mt-10">
                                  <div className="u-fz-12 u-opacity-85">Изображение (опционально)</div>
                                  <div className="u-flex u-gap-10 u-flex-wrap u-items-center u-mt-6">
                                    <input
                                      type="text"
                                      placeholder="URL"
                                      value={safeString((q as any).image || "")}
                                      onChange={(e) =>
                                        setDraft((prev) => {
                                          if (!prev) return prev;
                                          const next = { ...prev, questions: prev.questions.slice() };
                                          next.questions[idx] = { ...(next.questions[idx] as any), image: e.target.value || undefined };
                                          return next;
                                        })
                                      }
                                      className="u-minw-320"
                                    />
                                    <label className="secondary u-secondary-upload">
                                      Загрузить…
                                      <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (f) uploadQuestionImage(idx, f);
                                          e.currentTarget.value = "";
                                        }}
                                      />
                                    </label>
                                  </div>
                                  {(q as any).image ? (
                                    <div className="u-mt-10">
                                      <img src={String((q as any).image)} alt="" className="u-maxw-220 u-radius-10" />
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

