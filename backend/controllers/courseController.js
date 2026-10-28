import outlineAgent from '../agents/outlineAgent.js';
import contentAgent from '../agents/contentAgent.js';
import lessonUpdateAgent from '../agents/lessonUpdate.js';

import Course from '../models/Course.js';
import User from '../models/User.js';
import Quiz from '../models/Quize.js';

import youtubeUtil from '../utils/youtube.js';

/*
|--------------------------------------------------------------------------
| Generate Course
|--------------------------------------------------------------------------
*/

const generateCourse = async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic || !topic.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Topic is required',
            });
        }

        const outline =
            await outlineAgent.generateCourseOutline(
                topic
            );

        if (!outline) {
            return res.status(500).json({
                success: false,
                message:
                    'Failed to generate course outline',
            });
        }

        const course =
            await Course.addCourse({
                ...outline,
                creator: req.user._id,
            });

        return res.status(201).json({
            success: true,
            message:
                'Course generated successfully',
            course,
        });
    } catch (error) {
        console.error(
            'Generate Course Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                'Failed to generate course',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Generate Lesson Content
|--------------------------------------------------------------------------
*/

const generateLesson = async (req, res) => {
    try {
        const {
            courseSlug,
            courseTitle,
            lesson,
        } = req.body;

        if (
            !courseSlug ||
            !lesson
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'courseSlug and lesson are required',
            });
        }

        let existingCourse =
            await Course.findOne({
                courseSlug,
            });

        /*
         * Safety fallback.
         */
        if (!existingCourse) {
            if (!courseTitle) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Course not found',
                });
            }

            existingCourse =
                await Course.create({
                    courseSlug,
                    title: courseTitle,
                    creator: req.user._id,
                    lessons: [lesson],
                });
        }

        /*
         * Check whether lesson already has content.
         */
        const existingLesson =
            existingCourse.lessons.find(
                (item) =>
                    item.lessonId ===
                    lesson.lessonId
            );

        if (
            existingLesson &&
            existingLesson.isEnriched
        ) {
            return res.status(200).json({
                success: true,
                message:
                    'Lesson content loaded from cache',
                lesson: existingLesson,
            });
        }

        /*
         * Collect existing video IDs.
         */
        const existingVideoIds =
            existingCourse.lessons
                .map(
                    (item) =>
                        item.video?.videoId
                )
                .filter(Boolean);

        /*
         * Generate lesson content and video
         * in parallel.
         */
        const [content, video] =
            await Promise.all([
                contentAgent.generateLessonContent(
                    existingCourse.title,
                    lesson,
                    existingVideoIds
                ),

                youtubeUtil.searchYouTube(
                    `${existingCourse.title} ${lesson.title}`,
                    existingVideoIds
                ),
            ]);

        /*
         * Save enriched lesson.
         */
        const updatedCourse =
            await Course.enrichLesson(
                courseSlug,
                lesson.lessonId,
                {
                    ...content,
                    video,
                    isEnriched: true,
                }
            );

        if (!updatedCourse) {
            return res.status(404).json({
                success: false,
                message:
                    'Failed to save lesson',
            });
        }

        const savedLesson =
            updatedCourse.lessons.find(
                (item) =>
                    item.lessonId ===
                    lesson.lessonId
            );

        return res.status(200).json({
            success: true,
            message:
                'Lesson generated successfully',
            lesson: savedLesson,
        });
    } catch (error) {
        console.error(
            'Generate Lesson Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                'Failed to generate lesson',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Get Course By Slug
|--------------------------------------------------------------------------
*/

const getCourseBySlug = async (
    req,
    res
) => {
    try {
        const { courseSlug } =
            req.params;

        const course =
            await Course.findBySlug(
                courseSlug
            );

        if (!course) {
            return res.status(404).json({
                success: false,
                message:
                    'Course not found',
            });
        }

        return res.status(200).json({
            success: true,
            course,
        });
    } catch (error) {
        console.error(
            'Get Course Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                'Failed to get course',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Get Lesson Content
|--------------------------------------------------------------------------
*/

const getLessonContent = async (
    req,
    res
) => {
    try {
        const {
            courseSlug,
            lessonId,
        } = req.params;

        const course =
            await Course.findOne({
                courseSlug,
            });

        if (!course) {
            return res.status(404).json({
                success: false,
                message:
                    'Course not found',
            });
        }

        const lesson =
            course.lessons.find(
                (item) =>
                    item.lessonId ===
                    lessonId
            );

        if (!lesson) {
            return res.status(404).json({
                success: false,
                message:
                    'Lesson not found',
            });
        }

        /*
         * Return cached content.
         */
        if (lesson.isEnriched) {
            return res.status(200).json({
                success: true,
                message:
                    'Lesson loaded from cache',
                lesson,
            });
        }

        /*
         * Generate content if it doesn't exist.
         */
        const existingVideoIds =
            course.lessons
                .map(
                    (item) =>
                        item.video?.videoId
                )
                .filter(Boolean);

        const [
            content,
            video,
        ] = await Promise.all([
            contentAgent.generateLessonContent(
                course.title,
                lesson.toObject(),
                existingVideoIds
            ),

            youtubeUtil.searchYouTube(
                `${course.title} ${lesson.title}`,
                existingVideoIds
            ),
        ]);

        const updatedCourse =
            await Course.enrichLesson(
                courseSlug,
                lessonId,
                {
                    ...content,
                    video,
                    isEnriched: true,
                }
            );

        if (!updatedCourse) {
            return res.status(500).json({
                success: false,
                message:
                    'Failed to save lesson content',
            });
        }

        const savedLesson =
            updatedCourse.lessons.find(
                (item) =>
                    item.lessonId ===
                    lessonId
            );

        return res.status(200).json({
            success: true,
            message:
                'Lesson content generated successfully',
            lesson: savedLesson,
        });
    } catch (error) {
        console.error(
            'Get Lesson Content Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                'Failed to get lesson content',
        });
    }
};

/*
|--------------------------------------------------------------------------
| UPDATE ONE LESSON USING AI
|--------------------------------------------------------------------------
|
| PUT
| /api/courses/:courseSlug/:lessonId/update
|
| Body:
| {
|   "prompt": "Make this lesson easier for beginners"
| }
|
|--------------------------------------------------------------------------
*/

const updateLesson = async (
    req,
    res
) => {
    try {
        const {
            courseSlug,
            lessonId,
        } = req.params;

        const { prompt } =
            req.body;

        /*
         * Validate params.
         */
        if (
            !courseSlug ||
            !lessonId
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'courseSlug and lessonId are required',
            });
        }

        /*
         * Validate prompt.
         */
        if (
            !prompt ||
            !prompt.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Please provide an update prompt',
            });
        }

        /*
         * Find course.
         */
        const course =
            await Course.findOne({
                courseSlug,
            });

        if (!course) {
            return res.status(404).json({
                success: false,
                message:
                    'Course not found',
            });
        }

        /*
         * Find ONLY the requested lesson.
         */
        const lesson =
            course.lessons.find(
                (item) =>
                    item.lessonId ===
                    lessonId
            );

        if (!lesson) {
            return res.status(404).json({
                success: false,
                message:
                    'Lesson not found in this course',
            });
        }

        /*
         * Send existing lesson + user prompt
         * to the AI update agent.
         */
        const result =
            await lessonUpdateAgent.updateLessonContent(
                course.title,
                lesson.toObject(),
                prompt
            );

        if (
            !result ||
            !result.lesson
        ) {
            return res.status(500).json({
                success: false,
                message:
                    'AI failed to update the lesson',
            });
        }

        const updatedLesson =
            result.lesson;

        const updateAnalysis =
            result.updateAnalysis || {};

        /*
         * NEVER allow AI to change
         * lesson identity/order.
         */
        updatedLesson.lessonId =
            lesson.lessonId;

        updatedLesson.lessonNumber =
            lesson.lessonNumber;

        /*
         * Determine what changed.
         */
        const contentChanged =
            updateAnalysis.contentChanged ===
            true;

        const videoChangeRequested =
            updateAnalysis.videoChangeRequested ===
            true;

        const videoChanged =
            updateAnalysis.videoChanged ===
            true;

        /*
         * Save ONLY this lesson.
         *
         * Other lessons remain untouched.
         */
        const updatedCourse =
            await Course.updateLesson(
                courseSlug,
                lessonId,
                updatedLesson
            );

        if (!updatedCourse) {
            return res.status(500).json({
                success: false,
                message:
                    'Failed to save updated lesson',
            });
        }

        /*
         * If educational content changed,
         * delete the old quiz.
         *
         * The next quiz request will
         * automatically generate a new quiz
         * using the updated lesson.
         */
        let quizInvalidated =
            false;

        if (contentChanged) {
            const deletedQuiz =
                await Quiz.findOneAndDelete({
                    courseSlug,
                    lessonId,
                });

            if (deletedQuiz) {
                quizInvalidated = true;
            }
        }

        /*
         * Get the actual saved lesson.
         */
        const savedLesson =
            updatedCourse.lessons.find(
                (item) =>
                    item.lessonId ===
                    lessonId
            );

        return res.status(200).json({
            success: true,

            message:
                'Lesson updated successfully',

            update: {
                type:
                    updateAnalysis.updateType ||
                    'unknown',

                contentChanged,

                videoChangeRequested,

                videoChanged,

                quizInvalidated,
            },

            analysis:
                updateAnalysis,

            lesson:
                savedLesson,
        });
    } catch (error) {
        console.error(
            'Lesson Update Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                'Server error while updating lesson',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Get My Courses
|--------------------------------------------------------------------------
*/

const getMyCourses = async (
    req,
    res
) => {
    try {
        const courses =
            await Course.getMyCourses(
                req.user._id
            );

        return res.status(200).json({
            success: true,
            courses,
        });
    } catch (error) {
        console.error(
            'Get My Courses Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                'Failed to get courses',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Share Course
|--------------------------------------------------------------------------
*/

const shareCourse = async (
    req,
    res
) => {
    try {
        const {
            courseSlug,
            userId,
        } = req.body;

        if (
            !courseSlug ||
            !userId
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'courseSlug and userId are required',
            });
        }

        const targetUser =
            await User.findById(
                userId
            );

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message:
                    'Target user not found',
            });
        }

        const course =
            await Course.findOne({
                courseSlug,
            });

        if (!course) {
            return res.status(404).json({
                success: false,
                message:
                    'Course not found',
            });
        }

        if (
            course.creator.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'Only the course owner can share this course',
            });
        }

        const updatedCourse =
            await Course.shareCourseWithUser(
                courseSlug,
                userId
            );

        return res.status(200).json({
            success: true,
            message:
                'Course shared successfully',
            course: updatedCourse,
        });
    } catch (error) {
        console.error(
            'Share Course Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                'Failed to share course',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Delete Course
|--------------------------------------------------------------------------
*/

const deleteCourse = async (
    req,
    res
) => {
    try {
        const {
            courseSlug,
        } = req.params;

        const result =
            await Course.deleteCourseByOwner(
                courseSlug,
                req.user._id
            );

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error(
            'Delete Course Error:',
            error
        );

        return res.status(
            error.statusCode || 500
        ).json({
            success: false,
            message:
                error.message ||
                'Failed to delete course',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

export default {
    generateCourse,
    generateLesson,
    getCourseBySlug,
    getLessonContent,
    updateLesson,
    getMyCourses,
    shareCourse,
    deleteCourse,
};