import express from 'express';
import protect from '../middlewear/auth.js';
import courseController from '../controllers/courseController.js';

const router = express.Router();

// 1. Generate new course outline (Agent 1)
router.post('/generate', protect, courseController.generateCourse);

// 2. Generate or fetch lesson content (Agent 2 + YouTube + Cache)
router.post('/generate-lesson', protect, courseController.generateLesson);

// 3. Get user's created courses
if (courseController.getMyCourses) {
    router.get('/my-courses', protect, courseController.getMyCourses);
}

// 4. Delete course by slug
router.delete('/:courseSlug', protect, courseController.deleteCourse);

// 5. Get full course by slug
router.get('/:courseSlug', protect, courseController.getCourseBySlug);

// 6. Get single lesson content (supports getLessonContent or getLessonBySlug)
const lessonHandler = courseController.getLessonContent || courseController.getLessonBySlug;
if (lessonHandler) {
    router.get('/:courseSlug/:lessonId', protect, lessonHandler);
}

export default router;