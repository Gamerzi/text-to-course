import Quiz from '../models/Quize.js';
import { getOrGenerateLessonQuiz } from '../agents/quizeAgent.js';

// GET /api/courses/:courseSlug/lessons/:lessonId/quiz
export async function getLessonQuiz(req, res) {
    try {
        const { courseSlug, lessonId } = req.params;
        const { includeAnswers, regenerate } = req.query;

        const quiz = await getOrGenerateLessonQuiz(
            courseSlug,
            lessonId,
            {
                forceRegenerate: regenerate === 'true'
            }
        );

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz could not be generated.'
            });
        }

        // Teacher/admin: return full quiz with answers
        if (includeAnswers === 'true') {
            return res.status(200).json({
                success: true,
                message: 'Full lesson quiz loaded with answers',
                quiz
            });
        }

        // Student: return public quiz without answers
        return res.status(200).json({
            success: true,
            message: 'Lesson quiz loaded successfully',
            quiz: quiz.toPublicQuiz()
        });

    } catch (error) {
        console.error('Lesson Quiz Error:', error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}


// POST /api/courses/:courseSlug/lessons/:lessonId/quiz/submit
export async function submitLessonQuizAnswers(req, res) {
    try {
        const { courseSlug, lessonId } = req.params;
        const { answers } = req.body;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid body: "answers" must be an array of { questionId, selectedIndex }'
            });
        }

        // Find quiz for this specific lesson
        const quiz = await Quiz.findOne({
            courseSlug,
            lessonId
        });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                error: 'Quiz not found for this lesson.'
            });
        }

        // Grade answers using Quiz schema method
        const result = quiz.gradeAnswers(answers);

        // Increment attempts
        quiz.attemptsCount = (quiz.attemptsCount || 0) + 1;

        await quiz.save();

        return res.status(200).json({
            success: true,
            message: 'Lesson quiz graded successfully',
            ...result
        });

    } catch (error) {
        console.error('Submit Lesson Quiz Error:', error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}


// GET /api/quizzes/:quizId
export async function getQuizById(req, res) {
    try {
        const { quizId } = req.params;

        const quiz = await Quiz.findById(quizId);

        if (!quiz) {
            return res.status(404).json({
                success: false,
                error: `Quiz not found with ID ${quizId}`
            });
        }

        const { includeAnswers } = req.query;

        // Teacher/admin: full quiz
        if (includeAnswers === 'true') {
            return res.status(200).json({
                success: true,
                quiz
            });
        }

        // Student: public quiz
        return res.status(200).json({
            success: true,
            quiz: quiz.toPublicQuiz()
        });

    } catch (error) {
        console.error('Get Quiz By ID Error:', error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}