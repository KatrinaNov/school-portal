import { useEffect, useMemo, useState } from "react";
import {
  createParagraph,
  deleteParagraph,
  listParagraphsBySubject,
  updateParagraph,
} from "../../../services/adminContent";
import type { Paragraph } from "../../../services/content/types";
import { RichTextEditor } from "./RichTextEditor";
import { uploadImageToStorage } from "../../../services/storage";
import { listClasses, listSubjectsByClass } from "../../../services/adminConfig";
import { listQuizzesBySubject } from "../../../services/adminQuizzes";

type ClassOption = { id: string; name: string };
type SubjectOption = { id: string; name: string; path: string };

function safeString(v: any) {
  return v == null ? "" : String(v);
}

type ParagraphDraft = {
  id: string;
  legacyId: string;
  title: string;
  summary: string;
  image: string | null;
  sections: Array<{ id: string; title: string; content: string; contentRich?: any; image?: string | null }>;
  dates: any[];
  terms: any[];
  people: any[];
  quizzes: any[];
};

function toDraft(p: any): ParagraphDraft {
  return {
    id: safeString(p.id),
    legacyId: safeString(p.legacyId || p.id),
    title: safeString(p.title),
    summary: safeString(p.summary),
    image: p.image != null ? safeString(p.image) : null,
    sections: Array.isArray(p.sections)
      ? p.sections.map((s: any, idx: number) => ({
          id: safeString(s?.id || `sec-${idx + 1}`),
          title: safeString(s?.title || ""),
          content: safeString(s?.content || ""),
          contentRich: s?.contentRich,
          image: s?.image != null ? safeString(s.image) : null,
        }))
      : [],
    dates: Array.isArray(p.dates) ? p.dates : [],
    terms: Array.isArray(p.terms) ? p.terms : [],
    people: Array.isArray(p.people) ? p.people : [],
    quizzes: Array.isArray(p.quizzes) ? p.quizzes : [],
  };
}

function fromDraft(d: ParagraphDraft): Paragraph {
  return {
    id: d.legacyId,
    title: d.title,
    summary: d.summary,
    image: d.image,
    sections: d.sections.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      contentRich: s.contentRich,
      image: s.image ?? null,
    })),
    dates: d.dates,
    terms: d.terms,
    people: d.people,
    quizzes: d.quizzes,
  } as any;
}

function nextLegacyId(paragraphs: any[]): string {
  let maxN = 0;
  for (const p of paragraphs) {
    const v = p && (p.legacyId != null ? p.legacyId : p.id);
    const n = Number(String(v || "").trim());
    if (!Number.isNaN(n) && Number.isFinite(n)) maxN = Math.max(maxN, n);
  }
  return String(maxN + 1);
}

export function AdminContentTab() {
  const [cfgState, setCfgState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; classes: ClassOption[]; subjectsByClass: Record<string, SubjectOption[]> }
  >({ status: "loading" });

  const classes = useMemo(() => (cfgState.status === "ready" ? cfgState.classes : []), [cfgState]);
  const subjectsByClass = useMemo(
    () => (cfgState.status === "ready" ? cfgState.subjectsByClass : ({} as Record<string, SubjectOption[]>)),
    [cfgState]
  );

  const [classId, setClassId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cls = await listClasses();
        const subjects: Record<string, SubjectOption[]> = {};
        for (const c of cls) {
          const subs = await listSubjectsByClass(c.id);
          subjects[c.id] = subs.map((s) => ({ id: s.id, name: s.name, path: s.path }));
        }
        if (cancelled) return;
        setCfgState({ status: "ready", classes: cls, subjectsByClass: subjects });
        const firstClass = cls[0]?.id || "";
        const firstSub = firstClass ? subjects[firstClass]?.[0]?.id || "" : "";
        setClassId((prev) => prev || firstClass);
        setSubjectId((prev) => prev || firstSub);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Не удалось загрузить классы/предметы из Firestore.";
        setCfgState({ status: "error", error: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const subs = subjectsByClass[classId] || [];
    if (subs.length === 0) {
      setSubjectId("");
      return;
    }
    if (!subs.some((s) => s.id === subjectId)) setSubjectId(subs[0].id);
  }, [classId, subjectId, subjectsByClass]);

  const [listState, setListState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; paragraphs: any[]; selectedId: string | null }
  >({ status: "idle" });

  const selected = useMemo(() => {
    if (listState.status !== "ready") return null;
    const p = listState.paragraphs.find((x) => String(x.id) === String(listState.selectedId));
    return p || null;
  }, [listState]);

  const [draft, setDraft] = useState<ParagraphDraft | null>(null);
  const [availableQuizzes, setAvailableQuizzes] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    if (!classId || !subjectId) {
      setListState({ status: "idle" });
      setDraft(null);
      setAvailableQuizzes([]);
      return;
    }
    let cancelled = false;
    setListState({ status: "loading" });
    Promise.all([listParagraphsBySubject(classId, subjectId), listQuizzesBySubject(classId, subjectId)])
      .then(([items, quizzes]) => {
        if (cancelled) return;
        const sel = items.length > 0 ? String(items[0].id) : null;
        setListState({ status: "ready", paragraphs: items, selectedId: sel });
        setAvailableQuizzes(quizzes.map((q) => ({ id: q.id, title: q.title || q.id })));
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Не удалось загрузить данные.";
        setListState({ status: "error", error: msg });
      });
    return () => {
      cancelled = true;
    };
  }, [classId, subjectId]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft(toDraft(selected));
  }, [selected?.id]);

  const reload = async () => {
    if (!classId || !subjectId) return;
    setListState({ status: "loading" });
    const [items, quizzes] = await Promise.all([
      listParagraphsBySubject(classId, subjectId),
      listQuizzesBySubject(classId, subjectId),
    ]);
    setListState((prev) => ({
      status: "ready",
      paragraphs: items,
      selectedId: prev.status === "ready" && prev.selectedId ? prev.selectedId : (items[0]?.id ? String(items[0].id) : null),
    }));
    setAvailableQuizzes(quizzes.map((q) => ({ id: q.id, title: q.title || q.id })));
  };

  const onCreate = async () => {
    if (listState.status !== "ready") return;
    const legacyId = nextLegacyId(listState.paragraphs);
    const created = await createParagraph(classId, subjectId, {
      legacyId,
      title: `§${legacyId}. Новый параграф`,
      summary: "",
      image: null,
      sections: [],
      dates: [],
      terms: [],
      people: [],
      quizzes: [],
    } as any);
    await reload();
    setListState((prev) =>
      prev.status === "ready" ? { ...prev, selectedId: String(created.id) } : prev
    );
  };

  const onSave = async () => {
    if (!draft) return;
    await updateParagraph(classId, subjectId, draft.legacyId, fromDraft(draft) as any);
    await reload();
  };

  const onDelete = async () => {
    if (!draft) return;
    if (!confirm("Удалить параграф?")) return;
    await deleteParagraph(classId, subjectId, draft.legacyId);
    await reload();
  };

  const uploadParagraphImage = async (file: File) => {
    const url = await uploadImageToStorage({ classId, subjectId, file });
    setDraft((prev) => (prev ? { ...prev, image: url } : prev));
  };

  const uploadSectionImage = async (sectionId: string, file: File) => {
    const url = await uploadImageToStorage({ classId, subjectId, file });
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, image: url } : s)),
          }
        : prev
    );
  };

  const subs = subjectsByClass[classId] || [];

  return (
    <div>
      <h2 className="u-mt-0">Контент</h2>

      {cfgState.status === "loading" ? (
        <div className="u-mt-12">
          <div className="loader" />
          <p>Загрузка…</p>
        </div>
      ) : null}
      {cfgState.status === "error" ? <p className="u-mt-12">Ошибка: {cfgState.error}</p> : null}

      <div className="u-flex u-gap-10 u-flex-wrap u-items-center">
        <label>
          <span className="u-fz-12 u-opacity-85">Класс</span>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="u-block">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="u-fz-12 u-opacity-85">Предмет</span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="u-block">
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="u-flex-1" />

        <button type="button" className="secondary" onClick={() => reload()}>
          Обновить
        </button>

        <button type="button" onClick={onCreate}>
          + Параграф
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
            <strong>Параграфы</strong>
            <div className="u-grid u-gap-8 u-mt-10">
              {listState.paragraphs.map((p: any) => {
                const id = String(p.id);
                const active = id === String(listState.selectedId);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`card u-text-left ${active ? "u-border-active" : ""}`}
                    onClick={() => setListState((prev) => (prev.status === "ready" ? { ...prev, selectedId: id } : prev))}
                  >
                    <strong>{safeString(p.title || `§${id}`)}</strong>
                    {p.summary ? <div className="u-mt-6 u-opacity-85">{safeString(p.summary)}</div> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card u-p-12">
            <strong>Редактор</strong>
            {!draft ? (
              <p className="u-mt-10 u-opacity-85">Выберите параграф слева.</p>
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
                  <small className="u-opacity-80">
                    id генерируется автоматически (legacyId: {draft.legacyId})
                  </small>
                </div>

                <label>
                  <span className="u-fz-12 u-opacity-85">Заголовок</span>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>

                <label>
                  <span className="u-fz-12 u-opacity-85">Кратко</span>
                  <textarea
                    value={draft.summary}
                    onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                    rows={3}
                  />
                </label>

                <div className="card u-p-12">
                  <strong>Тесты этого параграфа</strong>
                  {availableQuizzes.length === 0 ? (
                    <p className="admin-empty">В этом предмете пока нет тестов. Создайте их во вкладке «Тесты».</p>
                  ) : (
                    <div className="u-grid u-gap-8 u-mt-10">
                      {availableQuizzes.map((q) => {
                        const selected = Array.isArray(draft.quizzes) && draft.quizzes.some((r: any) => String(r?.id) === q.id);
                        return (
                          <label key={q.id} className="u-flex u-gap-10 u-items-center">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setDraft((prev) => {
                                  if (!prev) return prev;
                                  const prevRefs = Array.isArray(prev.quizzes) ? prev.quizzes.slice() : [];
                                  const nextRefs = checked
                                    ? prevRefs.concat([{ id: q.id, title: q.title }]).filter((r: any, i: number, a: any[]) => a.findIndex((x) => String(x?.id) === String(r?.id)) === i)
                                    : prevRefs.filter((r: any) => String(r?.id) !== q.id);
                                  return { ...prev, quizzes: nextRefs };
                                });
                              }}
                            />
                            <span>
                              <strong>{q.title}</strong> <span className="u-opacity-75">({q.id})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="u-fz-12 u-opacity-85">Изображение параграфа</div>
                  <div className="u-flex u-gap-10 u-items-center u-flex-wrap u-mt-6">
                    <input
                      type="text"
                      placeholder="URL"
                      value={draft.image ?? ""}
                      onChange={(e) => setDraft({ ...draft, image: e.target.value || null })}
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
                          if (f) uploadParagraphImage(f);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {draft.image ? (
                    <div className="u-mt-10">
                      <img src={draft.image} alt="" className="u-maxw-220 u-radius-10" />
                    </div>
                  ) : null}
                </div>

                <div className="u-mt-6">
                  <div className="u-flex u-gap-10 u-items-center u-justify-between">
                    <h3 className="u-m-0">Разделы</h3>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          sections: draft.sections.concat([
                            { id: `sec-${Date.now()}`, title: "Новый раздел", content: "", contentRich: null, image: null },
                          ]),
                        })
                      }
                    >
                      + Раздел
                    </button>
                  </div>

                  <div className="u-grid u-gap-12 u-mt-10">
                    {draft.sections.map((s) => (
                      <div key={s.id} className="card u-p-12">
                        <div className="u-flex u-gap-10 u-items-center u-justify-between">
                          <strong>{s.title || "Раздел"}</strong>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                sections: draft.sections.filter((x) => x.id !== s.id),
                              })
                            }
                          >
                            Удалить
                          </button>
                        </div>

                        <label className="u-mt-10 u-block">
                          <span className="u-fz-12 u-opacity-85">Заголовок</span>
                          <input
                            type="text"
                            value={s.title}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                sections: draft.sections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)),
                              })
                            }
                          />
                        </label>

                        <div className="u-mt-10">
                          <div className="u-fz-12 u-opacity-85">Текст (визуальный редактор)</div>
                          <RichTextEditor
                            value={s.contentRich ?? null}
                            onChange={(doc, plain) =>
                              setDraft({
                                ...draft,
                                sections: draft.sections.map((x) =>
                                  x.id === s.id ? { ...x, contentRich: doc, content: plain } : x
                                ),
                              })
                            }
                          />
                        </div>

                        <div className="u-mt-10">
                          <div className="u-fz-12 u-opacity-85">Изображение раздела</div>
                          <div className="u-flex u-gap-10 u-items-center u-flex-wrap u-mt-6">
                            <input
                              type="text"
                              placeholder="URL"
                              value={s.image ?? ""}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  sections: draft.sections.map((x) => (x.id === s.id ? { ...x, image: e.target.value || null } : x)),
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
                                  if (f) uploadSectionImage(s.id, f);
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>
                          </div>
                          {s.image ? (
                            <div className="u-mt-10">
                              <img src={s.image} alt="" className="u-maxw-220 u-radius-10" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

