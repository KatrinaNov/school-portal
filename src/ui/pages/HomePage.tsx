import { CONFIG } from "../../core/config";
import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="container">
      <div className="home-hero">
        <h1>Привет! Здесь можно учиться и играть</h1>
        <p className="hero-tagline">Выбери класс, открой предмет — читай темы и проходи тесты. Удачи!</p>
      </div>

      <p className="home-classes-title">Выберите класс</p>
      <div style={{ display: "grid", gap: 12 }}>
        {Object.entries(CONFIG.classes).map(([classId, cls]) => (
          <Link key={classId} className="card" to={`/class/${encodeURIComponent(classId)}`}>
            {cls.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

