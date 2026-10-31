import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./components/AuthPage.jsx";
import Course from "./pages/Course.jsx";
import CourseDetails from "./pages/CourseDetails.jsx";
import LessonPage from "./pages/LessonPage.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import "./styles/App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<AuthPage />} />

          <Route path="/courses" element={<Course />} />

          <Route
            path="/course/:courseSlug"
            element={<CourseDetails />}
          />

          <Route
            path="/course/:courseSlug/lesson/:lessonId"
            element={<LessonPage />}
          />

          {/* Lesson-specific Quiz */}
          <Route
            path="/course/:courseSlug/lesson/:lessonId/quiz"
            element={<QuizPage />}
          />

          {/* Course-level Quiz */}
          <Route
            path="/course/:courseSlug/quiz"
            element={<QuizPage />}
          />

          {/* Fallback to Auth/Home */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}