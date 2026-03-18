import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listQuizAttempts } from "../../services/firestoreStats";

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

export function MePage() {
  const nav = useNavigate();
  const user = (window as any).__authUser as any;
  const isAdmin = (window as any).__isAdmin === true;

  const uid = user?.uid ? String(user.uid) : "";
  const label = useMemo(() => {
    if (!user) return "";
    return String(user.displayName || user.email || user.uid || "Пользователь");
  }, [user]);

  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; attempts: Attempt[] }
  >({ status: user ? "loading" : "idle" });

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setState({ status: "loading" });
    listQuizAttempts(uid, 50)
      .then((items) => {
        if (cancelled) return;
        setState({ status: "ready", attempts: items as any });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Не удалось загрузить статистику.";
        setState({ status: "error", error: msg });
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (typeof user === "undefined") {
    return (
      <div className="container container--loader">
        <div className="loader" />
        <p>Инициализация авторизации...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container">
        <h1>Профиль</h1>
        <p>Вы сейчас в гостевом режиме. Войдите, чтобы сохранялась статистика.</p>
        <button type="button" className="secondary" onClick={() => nav("/")}>
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Мой профиль</h1>
      <p>
        <strong>{label}</strong>
      </p>

      {isAdmin ? (
        <>
          <h2>Администратор</h2>
          <div className="stats-list">
            <div className="card stats-card">
              <div>
                <strong>Редактирование материала</strong>
              </div>
              <div>Открыть админ-панель и редактировать контент.</div>
              <div style={{ marginTop: 10 }}>
                <Link className="admin-link" to="/admin">
                  Перейти в админку
                </Link>
              </div>
            </div>
            <div className="card stats-card">
              <div>
                <strong>Статистика пользователей</strong>
              </div>
              <div>Список студентов и их результаты.</div>
              <div style={{ marginTop: 10 }}>
                <a className="admin-link" href="/admin.html#panel=students">
                  Открыть статистику
                </a>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <h2>Статистика</h2>

      {state.status === "loading" ? (
        <>
          <div className="loader" />
          <p>Загрузка статистики...</p>
        </>
      ) : null}

      {state.status === "error" ? <p>Не удалось загрузить статистику: {state.error}</p> : null}

      {state.status === "ready" ? (
        <>
          {state.attempts.length === 0 ? (
            <p>
              <em>Пока нет результатов. Пройдите любой тест — и он появится здесь.</em>
            </p>
          ) : (
            <>
              <p>
                <strong>Пройдено тестов:</strong> {state.attempts.length}
              </p>
              <div className="stats-list">
                {state.attempts.map((it) => {
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
            </>
          )}
        </>
      ) : null}

      <button type="button" className="secondary" onClick={() => nav("/")}>
        На главную
      </button>
    </div>
  );
}

