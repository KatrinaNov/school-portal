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
      <div className="u-flex u-gap-12 u-items-center u-justify-between">
        <h1 className="u-m-0">{subject.name}</h1>
        <Link to={`/class/${encodeURIComponent(classId)}`} className="secondary">
          Назад
        </Link>
      </div>

      {state.status === "loading" && (
        <div className="container container--loader u-mt-12">
          <div className="loader" />
          <p>Загрузка тем...</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="u-mt-12">
          <p>Ошибка загрузки: {state.error}</p>
        </div>
      )}

      {state.status === "ready" && (
        <div className="u-mt-12">
          {subject.showOnlyQuizzes !== true && (
            <>
              <h2>Темы</h2>
              <div className="u-grid u-gap-12">
                {state.content.paragraphs.map((p) => (
                  <Link
                    key={p.id}
                    className="card"
                    to={`/class/${encodeURIComponent(classId)}/${encodeURIComponent(
                      subjectId
                    )}/paragraph/${encodeURIComponent(p.id)}`}
                  >
                    <strong>{p.title}</strong>
                    {p.summary ? <div className="u-mt-6 u-opacity-90">{p.summary}</div> : null}
                  </Link>
                ))}
              </div>
            </>
          )}

          <h2 className="u-mt-18">Тесты</h2>
          <div className="u-grid u-gap-12">
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

