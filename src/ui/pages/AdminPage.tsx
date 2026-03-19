import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isAdminUid } from "../../services/roles";
import { AdminContentTab } from "./admin/AdminContentTab";
import { AdminQuizzesTab } from "./admin/AdminQuizzesTab";
import { AdminConfigTab } from "./admin/AdminConfigTab";
import { AdminStatsTab } from "./admin/AdminStatsTab";
import { AdminSyncBar } from "./admin/AdminSyncBar";

type AdminState =
  | { status: "auth_loading" }
  | { status: "guest" }
  | { status: "forbidden" }
  | { status: "ready" }
  | { status: "error"; error: string };

type AdminTab = "content" | "quizzes" | "classes" | "stats";

function normalizeTab(v: string | null): AdminTab {
  if (v === "stats") return "stats";
  if (v === "quizzes") return "quizzes";
  if (v === "classes") return "classes";
  return "content";
}

export function AdminPage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = normalizeTab(params.get("tab"));

  const [authUser, setAuthUser] = useState<any>(() => (window as any).__authUser);
  const uid = useMemo(() => (authUser?.uid ? String(authUser.uid) : ""), [authUser?.uid]);
  const [state, setState] = useState<AdminState>(() => {
    const u = (window as any).__authUser;
    if (typeof u === "undefined") return { status: "auth_loading" };
    if (!u) return { status: "guest" };
    return { status: "auth_loading" };
  });

  useEffect(() => {
    // `auth.js` sets window.__authUser asynchronously. We need to react to it.
    // We keep a tiny poll here to avoid wiring a full auth context.
    let cancelled = false;
    const tick = () => {
      const u = (window as any).__authUser;
      if (!cancelled) setAuthUser(u);
    };
    tick();
    const t = window.setInterval(tick, 200);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = authUser;
      if (typeof u === "undefined") {
        setState({ status: "auth_loading" });
        return;
      }
      if (!u) {
        setState({ status: "guest" });
        return;
      }
      try {
        const ok = await isAdminUid(String(u.uid || ""));
        if (cancelled) return;
        setState(ok ? { status: "ready" } : { status: "forbidden" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Не удалось проверить роль администратора.";
        if (!cancelled) setState({ status: "error", error: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, authUser]);

  const setTab = (next: AdminTab) => setParams({ tab: next });

  if (state.status === "auth_loading") {
    return (
      <div className="container container--loader">
        <div className="loader" />
        <p>Инициализация авторизации…</p>
      </div>
    );
  }

  if (state.status === "guest") {
    return (
      <div className="container">
        <h1>Админка</h1>
        <p>Войдите, чтобы открыть админ-панель.</p>
        <button type="button" className="secondary" onClick={() => nav("/")}>
          На главную
        </button>
      </div>
    );
  }

  if (state.status === "forbidden") {
    return (
      <div className="container">
        <h1>Доступ запрещён</h1>
        <p>Этот аккаунт не является администратором.</p>
        <button type="button" className="secondary" onClick={() => nav("/")}>
          На главную
        </button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="container">
        <h1>Админка</h1>
        <p>Ошибка: {state.error}</p>
        <button type="button" className="secondary" onClick={() => nav("/")}>
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="u-flex u-gap-12 u-items-center u-justify-between">
        <h1 className="u-m-0">Админка</h1>
        <button type="button" className="secondary" onClick={() => nav("/")}>
          На главную
        </button>
      </div>

      <AdminSyncBar />

      <div className="u-flex u-gap-10 u-flex-wrap u-mt-12">
        <button type="button" className={tab === "content" ? "" : "secondary"} onClick={() => setTab("content")}>
          Контент
        </button>
        <button type="button" className={tab === "quizzes" ? "" : "secondary"} onClick={() => setTab("quizzes")}>
          Тесты
        </button>
        <button type="button" className={tab === "classes" ? "" : "secondary"} onClick={() => setTab("classes")}>
          Классы
        </button>
        <button type="button" className={tab === "stats" ? "" : "secondary"} onClick={() => setTab("stats")}>
          Статистика
        </button>
      </div>

      <div className="u-mt-12">
        {tab === "content" ? <AdminContentTab /> : null}
        {tab === "quizzes" ? <AdminQuizzesTab /> : null}
        {tab === "classes" ? <AdminConfigTab /> : null}
        {tab === "stats" ? <AdminStatsTab /> : null}
      </div>
    </div>
  );
}

