import { Link, useParams } from "react-router-dom";
import { CONFIG } from "../../core/config";
import { useSubjectContent } from "../../services/content/useSubjectContent";

export function SubjectPage() {
  const { classId, subjectId } = useParams();
  const subject =
    classId && subjectId ? CONFIG.classes[classId]?.subjects?.[subjectId] : undefined;

  const state = useSubjectContent(classId, subjectId);

  if (!classId || !subjectId || !subject) {
    return (
      <div className="container">
        <p>Предмет не найден</p>
        <Link to="/" className="secondary">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>{subject.name}</h1>
        <Link to={`/class/${encodeURIComponent(classId)}`} className="secondary">
          Назад
        </Link>
      </div>

      {state.status === "loading" && (
        <div className="container container--loader" style={{ marginTop: 12 }}>
          <div className="loader" />
          <p>Загрузка тем...</p>
        </div>
      )}

      {state.status === "error" && (
        <div style={{ marginTop: 12 }}>
          <p>Ошибка загрузки: {state.error}</p>
        </div>
      )}

      {state.status === "ready" && (
        <div style={{ marginTop: 12 }}>
          {subject.showOnlyQuizzes !== true && (
            <>
              <h2>Темы</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {state.content.paragraphs.map((p) => (
                  <Link
                    key={p.id}
                    className="card"
                    to={`/class/${encodeURIComponent(classId)}/${encodeURIComponent(
                      subjectId
                    )}/paragraph/${encodeURIComponent(p.id)}`}
                  >
                    <strong>{p.title}</strong>
                    {p.summary ? <div style={{ marginTop: 6, opacity: 0.9 }}>{p.summary}</div> : null}
                  </Link>
                ))}
              </div>
            </>
          )}

          <h2 style={{ marginTop: 18 }}>Тесты</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {state.content.quizzes.map((q) => (
              <Link
                key={q.id}
                className="card"
                to={`/class/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/quiz/${encodeURIComponent(
                  q.id
                )}`}
              >
                {q.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

