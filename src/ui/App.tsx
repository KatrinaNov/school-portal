import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../ui/pages/HomePage";
import { ClassPage } from "./pages/ClassPage";
import { AdminPage } from "./pages/AdminPage";
import { SubjectPage } from "./pages/SubjectPage";
import { QuizPage } from "./pages/QuizPage";
import { ParagraphPage } from "./pages/ParagraphPage";
import { MePage } from "./pages/MePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/me" element={<MePage />} />
      <Route path="/class/:classId" element={<ClassPage />} />
      <Route path="/class/:classId/:subjectId" element={<SubjectPage />} />
      <Route path="/class/:classId/:subjectId/paragraph/:paragraphId" element={<ParagraphPage />} />
      <Route path="/class/:classId/:subjectId/quiz/:quizId" element={<QuizPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

