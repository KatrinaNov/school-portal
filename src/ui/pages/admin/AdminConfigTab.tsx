import { useEffect, useMemo, useState } from "react";
import {
  createSubjectAuto,
  deleteClassCascade,
  deleteSubjectCascade,
  listClasses,
  listSubjectsByClass,
  upsertClass,
  upsertSubject,
} from "../../../services/adminConfig";

function safeString(v: any) {
  return v == null ? "" : String(v);
}

export function AdminConfigTab() {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; classes: Array<{ id: string; name: string }> }
  >({ status: "idle" });

  const [draftId, setDraftId] = useState("");
  const [draftName, setDraftName] = useState("");

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [subjectsState, setSubjectsState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; subjects: Array<{ id: string; name: string; path: string; showOnlyQuizzes?: boolean }> }
  >({ status: "idle" });

  const [subjectName, setSubjectName] = useState("");
  const [subjectPath, setSubjectPath] = useState("");
  const [subjectOnlyQuizzes, setSubjectOnlyQuizzes] = useState(false);

  const reload = async () => {
    setState({ status: "loading" });
    try {
      const classes = await listClasses();
      setState({ status: "ready", classes });
      const first = classes[0]?.id || "";
      setSelectedClassId((prev) => prev || first);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось загрузить классы.";
      setState({ status: "error", error: msg });
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const existingIds = useMemo(() => {
    if (state.status !== "ready") return new Set<string>();
    return new Set(state.classes.map((c) => String(c.id)));
  }, [state]);

  const reloadSubjects = async (classId: string) => {
    if (!classId) {
      setSubjectsState({ status: "idle" });
      return;
    }
    setSubjectsState({ status: "loading" });
    try {
      const subjects = await listSubjectsByClass(classId);
      setSubjectsState({ status: "ready", subjects });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось загрузить предметы.";
      setSubjectsState({ status: "error", error: msg });
    }
  };

  useEffect(() => {
    reloadSubjects(selectedClassId);
  }, [selectedClassId]);

  const onAdd = async () => {
    const id = safeString(draftId).trim();
    const name = safeString(draftName).trim();
    if (!id) return alert("Введите id класса (например: 7).");
    if (existingIds.has(id)) return alert("Класс с таким id уже существует.");
    await upsertClass({ id, name: name || `${id} класс` });
    setDraftId("");
    setDraftName("");
    await reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm(`Удалить класс ${id}? Будут удалены предметы/параграфы/тесты этого класса в Firestore.`)) return;
    await deleteClassCascade(id);
    await reload();
  };

  const onAddSubject = async () => {
    if (!selectedClassId) return alert("Сначала выберите класс.");
    const name = safeString(subjectName).trim();
    const path = safeString(subjectPath).trim();
    if (!name) return alert("Введите название предмета.");
    if (!path) return alert("Введите path (например: data/6/history/).");
    await createSubjectAuto({ classId: selectedClassId, name, path, showOnlyQuizzes: subjectOnlyQuizzes });
    setSubjectName("");
    setSubjectPath("");
    setSubjectOnlyQuizzes(false);
    await reloadSubjects(selectedClassId);
  };

  const onDeleteSubject = async (subjectId: string) => {
    if (!selectedClassId) return;
    if (!confirm(`Удалить предмет ${subjectId}? Будут удалены параграфы/тесты этого предмета в Firestore.`)) return;
    await deleteSubjectCascade(selectedClassId, subjectId);
    await reloadSubjects(selectedClassId);
  };

  const onToggleShowOnlyQuizzes = async (subjectId: string, next: boolean) => {
    if (!selectedClassId) return;
    if (subjectsState.status !== "ready") return;
    const s = subjectsState.subjects.find((x) => x.id === subjectId);
    if (!s) return;
    await upsertSubject({
      classId: selectedClassId,
      subjectId,
      name: s.name,
      path: s.path,
      showOnlyQuizzes: next,
    });
    await reloadSubjects(selectedClassId);
  };

  return (
    <div>
      <h2 className="u-mt-0">Классы</h2>

      <div className="card u-p-12">
        <strong>Добавить класс</strong>
        <div className="u-flex u-gap-10 u-flex-wrap u-items-end u-mt-10">
          <label>
            <span className="u-fz-12 u-opacity-85">ID</span>
            <input value={draftId} onChange={(e) => setDraftId(e.target.value)} placeholder="например: 7" />
          </label>
          <label className="u-flex-1-260">
            <span className="u-fz-12 u-opacity-85">Название</span>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="7 класс" />
          </label>
          <button type="button" onClick={onAdd}>
            Добавить
          </button>
          <button type="button" className="secondary" onClick={reload}>
            Обновить
          </button>
        </div>
      </div>

      {state.status === "loading" ? (
        <div className="u-mt-12">
          <div className="loader" />
          <p>Загрузка…</p>
        </div>
      ) : null}

      {state.status === "error" ? <p className="u-mt-12">Ошибка: {state.error}</p> : null}

      {state.status === "ready" ? (
        <div className="u-grid u-grid-cols-2 u-gap-12 u-mt-12">
          <div className="card u-p-12">
            <strong>Список классов</strong>
            {state.classes.length === 0 ? (
              <p className="admin-empty">Нет классов в Firestore.</p>
            ) : (
              <div className="u-grid u-gap-8 u-mt-10">
                {state.classes.map((c) => (
                  <div key={c.id} className="card u-p-12 u-flex u-gap-10 u-items-center">
                    <div className="u-flex-1">
                      <strong>{safeString(c.id)}</strong> — {safeString(c.name || "")}
                    </div>
                    <button type="button" className="secondary" onClick={() => onDelete(String(c.id))}>
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card u-p-12">
            <strong>Предметы</strong>

            <div className="u-flex u-gap-10 u-flex-wrap u-items-end u-mt-10">
              <label className="u-flex-1-240">
                <span className="u-fz-12 u-opacity-85">Класс</span>
                <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="u-block">
                  {state.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.id}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="secondary" onClick={() => reloadSubjects(selectedClassId)}>
                Обновить
              </button>
            </div>

            <div className="card u-p-12 u-mt-12">
              <strong>Добавить предмет</strong>
              <div className="u-grid u-gap-10 u-mt-10">
                <label>
                  <span className="u-fz-12 u-opacity-85">Название</span>
                  <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="История" />
                </label>
                <label>
                  <span className="u-fz-12 u-opacity-85">Path</span>
                  <input value={subjectPath} onChange={(e) => setSubjectPath(e.target.value)} placeholder="data/6/history/" />
                </label>
                <label className="u-flex u-gap-10 u-items-center">
                  <input
                    type="checkbox"
                    checked={subjectOnlyQuizzes}
                    onChange={(e) => setSubjectOnlyQuizzes(e.target.checked)}
                  />
                  <span>Показывать только тесты (без параграфов)</span>
                </label>
                <div className="u-flex u-gap-10 u-flex-wrap">
                  <button type="button" onClick={onAddSubject}>
                    Добавить
                  </button>
                  <small className="u-opacity-80">
                    id генерируется автоматически
                  </small>
                </div>
              </div>
            </div>

            {subjectsState.status === "loading" ? (
              <div className="u-mt-12">
                <div className="loader" />
                <p>Загрузка…</p>
              </div>
            ) : null}
            {subjectsState.status === "error" ? <p className="u-mt-12">Ошибка: {subjectsState.error}</p> : null}
            {subjectsState.status === "ready" ? (
              <div className="u-grid u-gap-8 u-mt-12">
                {subjectsState.subjects.length === 0 ? <p className="admin-empty">Нет предметов у этого класса.</p> : null}
                {subjectsState.subjects.map((s) => (
                  <div key={s.id} className="card u-p-12 u-grid u-gap-8">
                    <div className="u-flex u-gap-10 u-items-center u-justify-between">
                      <div>
                        <strong>{safeString(s.name || s.id)}</strong>{" "}
                        <span className="u-opacity-75">({s.id})</span>
                      </div>
                      <button type="button" className="secondary" onClick={() => onDeleteSubject(String(s.id))}>
                        Удалить
                      </button>
                    </div>
                    <div className="u-opacity-85">
                      path: <code>{safeString(s.path)}</code>
                    </div>
                    <label className="u-flex u-gap-10 u-items-center">
                      <input
                        type="checkbox"
                        checked={s.showOnlyQuizzes === true}
                        onChange={(e) => onToggleShowOnlyQuizzes(String(s.id), e.target.checked)}
                      />
                      <span>Показывать только тесты</span>
                    </label>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

