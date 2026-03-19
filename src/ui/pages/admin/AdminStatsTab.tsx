import { useEffect, useMemo, useState } from "react";
import { listStudents, listAttemptsForUser } from "../../../services/adminStats";

type Student = { uid: string; displayName?: string | null; email?: string | null };
type Attempt = {
  id: string;
  quizId?: string;
  quizTitle?: string;
  score?: number;
  total?: number;
  correct?: number;
  wrong?: number;
  finishedAt?: any;
};

function formatFinishedAt(v: any): string {
  try {
    if (!v) return "";
    if (typeof v === "string") return new Date(v).toLocaleString();
    if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
    return String(v);
  } catch {
    return "";
  }
}

export function AdminStatsTab() {
  const [studentsState, setStudentsState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; students: Student[]; selectedUid: string | null }
  >({ status: "loading" });

  const selectedUid =
    studentsState.status === "ready" ? studentsState.selectedUid : null;

  const [attemptsState, setAttemptsState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; attempts: Attempt[] }
  >({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setStudentsState({ status: "loading" });
    listStudents(200)
      .then((items) => {
        if (cancelled) return;
        setStudentsState({
          status: "ready",
          students: items,
          selectedUid: items.length > 0 ? items[0].uid : null,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Не удалось загрузить студентов.";
        setStudentsState({ status: "error", error: msg });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedUid) {
      setAttemptsState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setAttemptsState({ status: "loading" });
    listAttemptsForUser(selectedUid, 50)
      .then((items) => {
        if (cancelled) return;
        setAttemptsState({ status: "ready", attempts: items as any });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Не удалось загрузить результаты.";
        setAttemptsState({ status: "error", error: msg });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUid]);

  const selectedLabel = useMemo(() => {
    if (studentsState.status !== "ready") return "";
    const s = studentsState.students.find((x) => x.uid === studentsState.selectedUid);
    if (!s) return "";
    return String(s.displayName || s.email || s.uid);
  }, [studentsState]);

  return (
    <div>
      <h2 className="u-mt-0">Студенты</h2>

      {studentsState.status === "loading" ? (
        <>
          <div className="loader" />
          <p>Загрузка…</p>
        </>
      ) : null}

      {studentsState.status === "error" ? (
        <p>Ошибка: {studentsState.error}</p>
      ) : null}

      {studentsState.status === "ready" ? (
        <>
          {studentsState.students.length === 0 ? (
            <p className="admin-empty">Пока нет зарегистрированных студентов.</p>
          ) : (
            <>
              <p className="admin-empty">Выберите студента, чтобы увидеть последние результаты.</p>
              <div className="admin-students-grid">
                {studentsState.students.map((s) => {
                  const label = String(s.displayName || s.email || s.uid);
                  const active = s.uid === studentsState.selectedUid;
                  return (
                    <button
                      key={s.uid}
                      type="button"
                      className={`card u-text-left ${active ? "u-border-active" : ""}`}
                      onClick={() =>
                        setStudentsState((prev) =>
                          prev.status === "ready" ? { ...prev, selectedUid: s.uid } : prev
                        )
                      }
                    >
                      <strong>{label}</strong>
                      <div className="u-fz-12 u-opacity-80">{s.uid}</div>
                    </button>
                  );
                })}
              </div>

              <div className="u-mt-14">
                <h3 className="u-m-0">Результаты</h3>
                {selectedUid ? <p className="u-m-0 u-opacity-85">{selectedLabel}</p> : null}

                {attemptsState.status === "loading" ? (
                  <>
                    <div className="loader" />
                    <p>Загрузка…</p>
                  </>
                ) : null}

                {attemptsState.status === "error" ? <p>Ошибка: {attemptsState.error}</p> : null}

                {attemptsState.status === "ready" ? (
                  attemptsState.attempts.length === 0 ? (
                    <p className="admin-empty">У этого студента пока нет результатов.</p>
                  ) : (
                    <div className="stats-list">
                      {attemptsState.attempts.map((it) => {
                        const title = it.quizTitle || it.quizId || "Тест";
                        const score = it.score != null ? String(it.score) : "0";
                        const total = it.total != null ? String(it.total) : "";
                        const correct = it.correct != null ? String(it.correct) : "";
                        const finishedAt = formatFinishedAt(it.finishedAt);
                        return (
                          <div key={it.id} className="card stats-card">
                            <div>
                              <strong>{title}</strong>
                            </div>
                            <div>
                              Результат: <strong>{score}%</strong> ({correct}/{total})
                            </div>
                            {finishedAt ? <div className="stats-date">{finishedAt}</div> : null}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : null}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

