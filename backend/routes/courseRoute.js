import express from 'express';
import protect from '../middlewear/auth.js';
import courseController from '../controllers/courseController.js';

const router = express.Router();

router.post(
    '/generate',
    protect,
    courseController.generateCourse
);

router.post(
    '/generate-lesson',
    protect,
    courseController.generateLesson
);

if (courseController.getMyCourses) {
    router.get(
        '/my-courses',
        protect,
        courseController.getMyCourses
    );
}

router.post(
    '/share',
    protect,
    courseController.shareCourse
);

router.delete(
    '/:courseSlug',
    protect,
    courseController.deleteCourse
);

router.get(
    '/:courseSlug',
    protect,
    courseController.getCourseBySlug
);

const lessonHandler =
    courseController.getLessonContent ||
    courseController.getLessonBySlug;

if (lessonHandler) {
    router.get(
        '/:courseSlug/:lessonId',
        protect,
        lessonHandler
    );
}

router.put(
    '/:courseSlug/:lessonId/update',
    protect,
    courseController.updateLesson
);

export default router;
