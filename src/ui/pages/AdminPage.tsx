export function AdminPage() {
  // Admin uses legacy full-page layout + Firebase popups.
  // Rendering it inside the main app (iframe) causes nested headers/footers
  // and can break auth popups. Redirect to the standalone page instead.
  if (typeof window !== "undefined") {
    window.location.href = "/admin.html";
  }
  return (
    <div className="container">
      <h1>Админка</h1>
      <p>Открываем админ-панель…</p>
      <p>
        Если не открылось, перейдите вручную: <a href="/admin.html">admin.html</a>
      </p>
    </div>
  );
}

