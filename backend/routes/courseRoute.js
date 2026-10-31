
import express from 'express';
import protect from '../middlewear/auth.js';
import courseController from '../controllers/courseController.js';

const router = express.Router();

// Generate a course
router.post('/generate', protect, courseController.generateCourse);

// Generate lesson content
router.post(
    '/generate-lesson',
    protect,
    courseController.generateLesson
);

// Get courses belonging to the logged-in user
if (courseController.getMyCourses) {
    router.get('/my-courses', protect, courseController.getMyCourses);
}

// Get share courses belonging to the logged-in user
router.get('/shared-with-me', protect, courseController.getSharedCourses);
console.log("protect:", typeof protect);
console.log("getSharedCourses:", typeof courseController.getSharedCourses);
console.log("getMyCourses:", typeof courseController.getMyCourses);
console.log("shareCourse:", typeof courseController.shareCourse);

// Search registered users — must not look up a course
router.get(
    '/share/search-users',
    protect,
    courseController.searchUsers
);

// Share a course
router.post('/share', protect, courseController.shareCourse);

// Lesson content and updates
const lessonHandler =
    courseController.getLessonContent ||
    courseController.getLessonBySlug;

if (lessonHandler) {
    router.get('/:courseSlug/:lessonId', protect, lessonHandler);
}

router.put(
    '/:courseSlug/:lessonId/update',
    protect,
    courseController.updateLesson
);

// Delete a course
router.delete('/:courseSlug', protect, courseController.deleteCourse);

// Get a course by slug — keep this after the specific routes
router.get('/:courseSlug', protect, courseController.getCourseBySlug);

export default router;
