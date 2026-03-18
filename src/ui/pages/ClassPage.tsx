import { Link, useParams } from "react-router-dom";
import { CONFIG } from "../../core/config";

export function ClassPage() {
  const { classId } = useParams();
  const cls = classId ? CONFIG.classes[classId] : undefined;

  if (!classId || !cls) {
    return (
      <div className="container">
        <p>Класс не найден</p>
        <Link to="/" className="secondary">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>{cls.name}</h1>
      <div style={{ display: "grid", gap: 12 }}>
        {Object.entries(cls.subjects).map(([subjectId, subj]) => (
          <Link
            key={subjectId}
            className="card"
            to={`/class/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`}
          >
            {subj.name}
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Link to="/" className="secondary">
          Назад
        </Link>
      </div>
    </div>
  );
}

