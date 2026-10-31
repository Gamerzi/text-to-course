import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthPage from "./components/AuthPage.jsx";
import Course from "./pages/Course.jsx";
import CourseDetails from "./pages/CourseDetails.jsx";
import LessonPage from "./pages/LessonPage.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import ErrorPage from "./components/ErrorPage.jsx";
import "./styles/App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          {/* Default Route: Register */}
          <Route path="/" element={<AuthPage initialMode="register" />} />
          <Route path="/register" element={<AuthPage initialMode="register" />} />

          {/* Login Route */}
          <Route path="/login" element={<AuthPage initialMode="login" />} />

          {/* Courses Dashboard */}
          <Route path="/courses" element={<Course />} />

          {/* Course Details */}
          <Route
            path="/course/:courseSlug"
            element={<CourseDetails />}
          />

          {/* Lesson Details */}
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

          {/* Explicit Bad Request route */}
          <Route
            path="/bad-request"
            element={
              <ErrorPage
                title="Bad Request"
                message="The request or URL parameters are invalid. Please check the address or return to your dashboard."
                badge="400 BAD REQUEST"
                backText="Back to My Courses"
                backUrl="/courses"
              />
            }
          />

          {/* Catch-all 404 for invalid routes */}
          <Route
            path="*"
            element={
              <ErrorPage
                title="Page Not Found"
                message="The route you entered does not exist or has been moved. Check the URL or return to your courses."
                badge="404 NOT FOUND"
                backText="Back to My Courses"
                backUrl="/courses"
              />
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
