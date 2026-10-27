import express from 'express';
import {
    getLessonQuiz,
    submitLessonQuizAnswers,
    getQuizById
} from '../controllers/quizeController.js';
import protect from '../middlewear/auth.js';

const router = express.Router();

// Protect all quiz routes with JWT auth middleware
router.use(protect);

// GET /api/courses/:courseSlug/lessons/:lessonId/quiz
router.get(
    '/:courseSlug/lessons/:lessonId/quiz',
    getLessonQuiz
);

// POST /api/courses/:courseSlug/lessons/:lessonId/quiz/submit
router.post(
    '/:courseSlug/lessons/:lessonId/quiz/submit',
    submitLessonQuizAnswers
);

// GET /api/quizzes/:quizId
router.get(
    '/quizzes/:quizId',
    getQuizById
);

export default router;