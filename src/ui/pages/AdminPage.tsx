import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isAdminUid } from "../../services/roles";
import { AdminContentTab } from "./admin/AdminContentTab";
import { AdminStatsTab } from "./admin/AdminStatsTab";

type AdminState =
  | { status: "auth_loading" }
  | { status: "guest" }
  | { status: "forbidden" }
  | { status: "ready" }
  | { status: "error"; error: string };

type AdminTab = "content" | "stats";

function normalizeTab(v: string | null): AdminTab {
  return v === "stats" ? "stats" : "content";
}

export function AdminPage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = normalizeTab(params.get("tab"));

  const user = (window as any).__authUser as any;
  const uid = useMemo(() => (user?.uid ? String(user.uid) : ""), [user?.uid]);
  const [state, setState] = useState<AdminState>(() => {
    if (typeof user === "undefined") return { status: "auth_loading" };
    if (!user) return { status: "guest" };
    return { status: "auth_loading" };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = (window as any).__authUser;
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
  }, [uid]);

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
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Админка</h1>
        <button type="button" className="secondary" onClick={() => nav("/")}>
          На главную
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" className={tab === "content" ? "" : "secondary"} onClick={() => setTab("content")}>
          Контент
        </button>
        <button type="button" className={tab === "stats" ? "" : "secondary"} onClick={() => setTab("stats")}>
          Статистика
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {tab === "content" ? <AdminContentTab /> : null}
        {tab === "stats" ? <AdminStatsTab /> : null}
      </div>
    </div>
  );
}

