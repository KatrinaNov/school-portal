import { useEffect, useMemo, useState } from "react";
import { CONFIG } from "../../../core/config";
import {
  createParagraph,
  deleteParagraph,
  listParagraphsBySubject,
  updateParagraph,
} from "../../../services/adminContent";
import type { Paragraph } from "../../../services/content/types";
import { RichTextEditor } from "./RichTextEditor";
import { uploadImageToStorage } from "../../../services/storage";

type ClassOption = { id: string; name: string };
type SubjectOption = { id: string; name: string; path: string };

function safeString(v: any) {
  return v == null ? "" : String(v);
}

function buildOptionsFromConfig(): { classes: ClassOption[]; subjectsByClass: Record<string, SubjectOption[]> } {
  const classes: ClassOption[] = [];
  const subjectsByClass: Record<string, SubjectOption[]> = {};
  const cfg: any = CONFIG && (CONFIG as any).classes ? (CONFIG as any).classes : {};
  for (const classId of Object.keys(cfg)) {
    const c = cfg[classId];
    classes.push({ id: String(classId), name: safeString(c?.name || classId) });
    const subs = c?.subjects || {};
    subjectsByClass[String(classId)] = Object.keys(subs).map((sid) => {
      const s = subs[sid];
      return { id: String(sid), name: safeString(s?.name || sid), path: safeString(s?.path || "") };
    });
  }
  classes.sort((a, b) => a.id.localeCompare(b.id));
  return { classes, subjectsByClass };
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
  const { classes, subjectsByClass } = useMemo(buildOptionsFromConfig, []);
  const [classId, setClassId] = useState<string>(classes[0]?.id || "");
  const [subjectId, setSubjectId] = useState<string>(() => subjectsByClass[classes[0]?.id || ""]?.[0]?.id || "");

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

  useEffect(() => {
    if (!classId || !subjectId) {
      setListState({ status: "idle" });
      setDraft(null);
      return;
    }
    let cancelled = false;
    setListState({ status: "loading" });
    listParagraphsBySubject(classId, subjectId)
      .then((items) => {
        if (cancelled) return;
        const sel = items.length > 0 ? String(items[0].id) : null;
        setListState({ status: "ready", paragraphs: items, selectedId: sel });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Не удалось загрузить параграфы.";
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
    const items = await listParagraphsBySubject(classId, subjectId);
    setListState((prev) => ({
      status: "ready",
      paragraphs: items,
      selectedId: prev.status === "ready" && prev.selectedId ? prev.selectedId : (items[0]?.id ? String(items[0].id) : null),
    }));
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
      <h2 style={{ marginTop: 0 }}>Контент</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Класс</span>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ display: "block" }}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Предмет</span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ display: "block" }}>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ flex: "1 1 auto" }} />

        <button type="button" className="secondary" onClick={() => reload()}>
          Обновить
        </button>

        <button type="button" onClick={onCreate}>
          + Параграф
        </button>
      </div>

      {listState.status === "loading" ? (
        <div style={{ marginTop: 12 }}>
          <div className="loader" />
          <p>Загрузка…</p>
        </div>
      ) : null}

      {listState.status === "error" ? <p style={{ marginTop: 12 }}>Ошибка: {listState.error}</p> : null}

      {listState.status === "ready" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 2fr", gap: 12, marginTop: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <strong>Параграфы</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {listState.paragraphs.map((p: any) => {
                const id = String(p.id);
                const active = id === String(listState.selectedId);
                return (
                  <button
                    key={id}
                    type="button"
                    className="card"
                    style={{
                      textAlign: "left",
                      border: active ? "2px solid rgba(255, 102, 0, 0.6)" : undefined,
                    }}
                    onClick={() => setListState((prev) => (prev.status === "ready" ? { ...prev, selectedId: id } : prev))}
                  >
                    <strong>{safeString(p.title || `§${id}`)}</strong>
                    {p.summary ? <div style={{ marginTop: 6, opacity: 0.85 }}>{safeString(p.summary)}</div> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <strong>Редактор</strong>
            {!draft ? (
              <p style={{ marginTop: 10, opacity: 0.85 }}>Выберите параграф слева.</p>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={onSave}>
                    Сохранить
                  </button>
                  <button type="button" className="secondary" onClick={onDelete}>
                    Удалить
                  </button>
                  <div style={{ flex: "1 1 auto" }} />
                  <small style={{ opacity: 0.8 }}>
                    id генерируется автоматически (legacyId: {draft.legacyId})
                  </small>
                </div>

                <label>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Заголовок</span>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>

                <label>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Кратко</span>
                  <textarea
                    value={draft.summary}
                    onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                    rows={3}
                  />
                </label>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>Изображение параграфа</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                    <input
                      type="text"
                      placeholder="URL"
                      value={draft.image ?? ""}
                      onChange={(e) => setDraft({ ...draft, image: e.target.value || null })}
                      style={{ minWidth: 320 }}
                    />
                    <label className="secondary" style={{ display: "inline-block", padding: "10px 14px", cursor: "pointer" }}>
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
                    <div style={{ marginTop: 10 }}>
                      <img src={draft.image} alt="" style={{ maxWidth: 220, borderRadius: 10 }} />
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0 }}>Разделы</h3>
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

                  <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                    {draft.sections.map((s) => (
                      <div key={s.id} className="card" style={{ padding: 12 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
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

                        <label style={{ marginTop: 10, display: "block" }}>
                          <span style={{ fontSize: 12, opacity: 0.85 }}>Заголовок</span>
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

                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 12, opacity: 0.85 }}>Текст (визуальный редактор)</div>
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

                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 12, opacity: 0.85 }}>Изображение раздела</div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
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
                              style={{ minWidth: 320 }}
                            />
                            <label className="secondary" style={{ display: "inline-block", padding: "10px 14px", cursor: "pointer" }}>
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
                            <div style={{ marginTop: 10 }}>
                              <img src={s.image} alt="" style={{ maxWidth: 220, borderRadius: 10 }} />
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

