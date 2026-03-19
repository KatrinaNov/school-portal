import { Link, useNavigate, useParams } from "react-router-dom";
import { CONFIG } from "../../core/config";
import { useSubjectContent } from "../../services/content/useSubjectContent";
import { RichTextViewer } from "./admin/RichTextViewer";

function imgUrl(base: string, imageValue?: string | null) {
  if (!imageValue) return "";
  const v = String(imageValue).trim();
  if (!v || /javascript:/i.test(v) || v.includes("..")) return "";
  if (/^https?:/i.test(v) || v.startsWith("/")) return v;
  return `${base}${v.replace(/^\.\//, "")}`;
}

export function ParagraphPage() {
  const nav = useNavigate();
  const { classId, subjectId, paragraphId } = useParams();
  const subject = classId && subjectId ? CONFIG.classes[classId]?.subjects?.[subjectId] : undefined;
  const state = useSubjectContent(classId, subjectId);

  const backToSubject = () => {
    if (!classId || !subjectId) return nav("/");
    nav(`/class/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`);
  };

  if (!classId || !subjectId || !paragraphId || !subject) {
    return (
      <div className="container">
        <p>Тема не найдена</p>
        <Link to="/" className="secondary">
          На главную
        </Link>
      </div>
    );
  }

  const baseMedia = `/data/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/`;

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="container container--loader">
        <div className="loader" />
        <p>Загрузка темы...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="container">
        <p>Ошибка загрузки: {state.error}</p>
        <button type="button" className="secondary" onClick={backToSubject}>
          Назад
        </button>
      </div>
    );
  }

  const p = state.content.paragraphs.find((x) => x.id === paragraphId);
  if (!p) {
    return (
      <div className="container">
        <p>Тема не найдена</p>
        <button type="button" className="secondary" onClick={backToSubject}>
          Назад
        </button>
      </div>
    );
  }

  const hasQuizzes = Array.isArray(p.quizzes) && p.quizzes.length > 0;
  const quizzes = hasQuizzes
    ? p.quizzes
        .map((qref) => state.content.quizzes.find((q) => q.id === qref.id))
        .filter(Boolean)
    : [];

  return (
    <div className="container">
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>{p.title}</h1>
        <button type="button" className="secondary" onClick={backToSubject}>
          Назад
        </button>
      </div>

      {p.image ? (
        <div style={{ marginTop: 12 }}>
          <img
            src={imgUrl(baseMedia, p.image)}
            alt=""
            className="content-image"
            loading="lazy"
            style={{ maxWidth: 180 }}
          />
        </div>
      ) : null}

      {p.summary ? <p style={{ marginTop: 10 }}>{p.summary}</p> : null}

      {Array.isArray(p.sections) && p.sections.length > 0 ? (
        <>
          <h2>Текст</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {p.sections.map((s: any, idx: number) => (
              <div key={s?.id ?? idx} className="card" style={{ cursor: "default" }}>
                {s?.title ? <strong>{String(s.title)}</strong> : null}
                {s?.image ? (
                  <div style={{ marginTop: 10 }}>
                    <img
                      src={imgUrl(baseMedia, String(s.image))}
                      alt=""
                      className="content-image"
                      loading="lazy"
                      style={{ maxWidth: 260 }}
                    />
                  </div>
                ) : null}
                {s?.contentRich ? (
                  <div style={{ marginTop: 10 }}>
                    <RichTextViewer doc={s.contentRich} />
                  </div>
                ) : s?.content ? (
                  <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{String(s.content)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {Array.isArray(p.terms) && p.terms.length > 0 ? (
        <>
          <h2>Термины</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {p.terms.map((t) => (
              <div key={t.id} className="card">
                <strong>{t.term}</strong>
                <div style={{ marginTop: 6, opacity: 0.9 }}>{t.definition}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {Array.isArray(p.people) && p.people.length > 0 ? (
        <>
          <h2>Персоны</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {p.people.map((person: any) => (
              <div key={person.id ?? person.name} className="card">
                <strong>{String(person.name ?? "")}</strong>
                {person.description ? (
                  <div style={{ marginTop: 6, opacity: 0.9 }}>{String(person.description)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {quizzes.length > 0 ? (
        <>
          <h2>Тесты</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {quizzes.map((q: any) => (
              <Link
                key={q.id}
                className="card"
                to={`/class/${encodeURIComponent(classId)}/${encodeURIComponent(
                  subjectId
                )}/quiz/${encodeURIComponent(q.id)}`}
              >
                {q.title}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

