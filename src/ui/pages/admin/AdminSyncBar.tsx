import { useMemo, useState } from "react";
import { CONFIG } from "../../../core/config";
import { seedAllFromContentJson, seedClassFromContentJson, seedFromLocalConfig } from "../../../services/adminSync";
import { exportAllToSingleJson, exportClassToSingleJson, exportSubjectContentJson } from "../../../services/adminExport";
import { listSubjectsByClass } from "../../../services/adminConfig";

type Scope = "all" | "config" | "content";

function safeString(v: any) {
  return v == null ? "" : String(v);
}

function classOptionsFromConfig() {
  const classes = (CONFIG as any)?.classes || {};
  return Object.keys(classes)
    .map((id) => ({ id: String(id), name: safeString(classes[id]?.name || id) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function AdminSyncBar() {
  const classes = useMemo(classOptionsFromConfig, []);
  const [targetClassId, setTargetClassId] = useState<string>("__all__");
  const [subjectsState, setSubjectsState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; subjects: Array<{ id: string; name: string }> }
    | { status: "error"; error: string }
  >({ status: "idle" });
  const [targetSubjectId, setTargetSubjectId] = useState<string>("");
  const [status, setStatus] = useState<
    | { status: "idle" }
    | { status: "running"; message: string }
    | { status: "done"; message: string }
    | { status: "error"; error: string }
  >({ status: "idle" });

  const loadSubjects = async (classId: string) => {
    if (!classId || classId === "__all__") {
      setSubjectsState({ status: "idle" });
      setTargetSubjectId("");
      return;
    }
    setSubjectsState({ status: "loading" });
    try {
      const subs = await listSubjectsByClass(classId);
      const subjects = subs.map((s) => ({ id: s.id, name: s.name || s.id }));
      setSubjectsState({ status: "ready", subjects });
      setTargetSubjectId((prev) => (prev && subjects.some((x) => x.id === prev) ? prev : subjects[0]?.id || ""));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось загрузить предметы.";
      setSubjectsState({ status: "error", error: msg });
      setTargetSubjectId("");
    }
  };

  const run = async (scope: Scope) => {
    setStatus({ status: "running", message: "Синхронизация…" });
    try {
      if (scope === "config") {
        await seedFromLocalConfig(CONFIG, (p) => setStatus({ status: "running", message: p.message }));
        await loadSubjects(targetClassId);
      } else if (scope === "content") {
        // assumes config already present (but safe to upsert anyway)
        await seedFromLocalConfig(CONFIG, (p) => setStatus({ status: "running", message: p.message }));
        if (targetClassId === "__all__") {
          await seedAllFromContentJson(CONFIG, (p) => setStatus({ status: "running", message: p.message }));
        } else {
          await seedClassFromContentJson({
            cfg: CONFIG,
            classId: targetClassId,
            onProgress: (p) => setStatus({ status: "running", message: p.message }),
          });
        }
        await loadSubjects(targetClassId);
      } else {
        // all
        await seedFromLocalConfig(CONFIG, (p) => setStatus({ status: "running", message: p.message }));
        if (targetClassId === "__all__") {
          await seedAllFromContentJson(CONFIG, (p) => setStatus({ status: "running", message: p.message }));
        } else {
          await seedClassFromContentJson({
            cfg: CONFIG,
            classId: targetClassId,
            onProgress: (p) => setStatus({ status: "running", message: p.message }),
          });
        }
        await loadSubjects(targetClassId);
      }
      setStatus({ status: "done", message: "Готово." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось синхронизировать.";
      setStatus({ status: "error", error: msg });
    }
  };

  return (
    <div className="card u-p-12 u-mt-12">
      <strong>Синхронизация с Firestore</strong>
      <div className="u-flex u-gap-10 u-flex-wrap u-items-end u-mt-10">
        <label>
          <span className="u-fz-12 u-opacity-85">Класс</span>
          <select
            value={targetClassId}
            onChange={(e) => {
              const next = e.target.value;
              setTargetClassId(next);
              void loadSubjects(next);
            }}
            className="u-block"
          >
            <option value="__all__">Все классы</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {targetClassId !== "__all__" ? (
          <label>
            <span className="u-fz-12 u-opacity-85">Предмет</span>
            <select
              value={targetSubjectId}
              onChange={(e) => setTargetSubjectId(e.target.value)}
              disabled={subjectsState.status !== "ready"}
              className="u-block u-minw-220"
            >
              {subjectsState.status === "loading" ? <option>Загрузка…</option> : null}
              {subjectsState.status === "error" ? <option>Ошибка загрузки</option> : null}
              {subjectsState.status === "ready"
                ? subjectsState.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                : null}
            </select>
          </label>
        ) : null}

        <button type="button" className="secondary" onClick={() => run("config")} disabled={status.status === "running"}>
          Классы/предметы
        </button>
        <button type="button" onClick={() => run("content")} disabled={status.status === "running"}>
          Параграфы + тесты
        </button>
        <button type="button" className="secondary" onClick={() => run("all")} disabled={status.status === "running"}>
          Всё
        </button>

        <div className="u-flex-1" />

        <button
          type="button"
          className="secondary"
          disabled={
            status.status === "running" ||
            targetClassId === "__all__" ||
            subjectsState.status !== "ready" ||
            !targetSubjectId
          }
          onClick={async () => {
            setStatus({ status: "running", message: "Экспорт content.json…" });
            try {
              await exportSubjectContentJson(targetClassId, targetSubjectId);
              setStatus({ status: "done", message: "content.json скачан." });
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Не удалось экспортировать content.json.";
              setStatus({ status: "error", error: msg });
            }
          }}
        >
          Скачать content.json
        </button>

        <button
          type="button"
          className="secondary"
          disabled={status.status === "running"}
          onClick={async () => {
            setStatus({ status: "running", message: "Экспорт…" });
            try {
              if (targetClassId === "__all__") await exportAllToSingleJson();
              else await exportClassToSingleJson(targetClassId);
              setStatus({ status: "done", message: "Экспорт завершён (файл скачан)." });
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Не удалось экспортировать.";
              setStatus({ status: "error", error: msg });
            }
          }}
        >
          Скачать JSON
        </button>
      </div>

      {status.status === "running" ? <p className="u-mt-10">{status.message}</p> : null}
      {status.status === "done" ? <p className="u-mt-10">Готово: {status.message}</p> : null}
      {status.status === "error" ? <p className="u-mt-10">Ошибка: {status.error}</p> : null}
    </div>
  );
}

