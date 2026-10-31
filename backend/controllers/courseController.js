
import outlineAgent from '../agents/outlineAgent.js';
import contentAgent from '../agents/contentAgent.js';
import lessonUpdateAgent from '../agents/lessonUpdate.js';

import Course from '../models/Course.js';
import User from '../models/User.js';
import Quiz from '../models/Quize.js';

import youtubeUtil from '../utils/youtube.js';

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const mongooseIsValidObjectId = (id) => {
    return /^[a-f\d]{24}$/i.test(String(id || ''));
};

const getCurrentUserId = (req) => {
    return req.user?._id || req.user?.id || req.user?.sub;
};

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
            await outlineAgent.generateCourseOutline(topic);

        if (!outline) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate course outline',
            });
        }

        const creatorId = getCurrentUserId(req);

        const course = await Course.addCourse({
            ...outline,
            creator: creatorId,
        });

        return res.status(201).json({
            success: true,
            message: 'Course generated successfully',
            course,
        });
    } catch (error) {
        console.error('[Generate Course] Error:', error.stack || error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate course',
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
        const { courseSlug, courseTitle, lesson } = req.body;

        if (!courseSlug || !lesson || !lesson.lessonId) {
            return res.status(400).json({
                success: false,
                message: 'courseSlug and lesson.lessonId are required',
            });
        }

        let existingCourse = await Course.findOne({ courseSlug });

        if (!existingCourse) {
            if (!courseTitle) {
                return res.status(404).json({
                    success: false,
                    message: 'Course not found',
                });
            }

            existingCourse = await Course.create({
                courseSlug,
                title: courseTitle,
                creator: getCurrentUserId(req),
                lessons: [lesson],
            });
        }

        const existingLesson = existingCourse.lessons.find(
            (item) => item.lessonId === lesson.lessonId
        );

        if (existingLesson?.isEnriched) {
            return res.status(200).json({
                success: true,
                message: 'Lesson content loaded from cache',
                lesson: existingLesson,
            });
        }

        const existingVideoIds = existingCourse.lessons
            .map((item) => item.video?.videoId)
            .filter(Boolean);

        const [content, video] = await Promise.all([
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

        const updatedCourse = await Course.enrichLesson(
            courseSlug,
            lesson.lessonId,
            {
                ...content,
                video,
                isEnriched: true,
            }
        );

        if (!updatedCourse) {
            return res.status(500).json({
                success: false,
                message: 'Failed to save lesson',
            });
        }

        const savedLesson = updatedCourse.lessons.find(
            (item) => item.lessonId === lesson.lessonId
        );

        return res.status(200).json({
            success: true,
            message: 'Lesson generated successfully',
            lesson: savedLesson,
        });
    } catch (error) {
        console.error('[Generate Lesson] Error:', error.stack || error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate lesson',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Get Course By Slug
|--------------------------------------------------------------------------
*/

const getCourseBySlug = async (req, res) => {
    try {
        const { courseSlug } = req.params;

        const course = await Course.findBySlug(courseSlug);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found',
            });
        }

        return res.status(200).json({
            success: true,
            course,
        });
    } catch (error) {
        console.error('[Get Course] Error:', error.stack || error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get course',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Get Lesson Content
|--------------------------------------------------------------------------
*/

const getLessonContent = async (req, res) => {
    try {
        const { courseSlug, lessonId } = req.params;

        const course = await Course.findOne({ courseSlug });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found',
            });
        }

        const lesson = course.lessons.find(
            (item) => item.lessonId === lessonId
        );

        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: 'Lesson not found',
            });
        }

        if (lesson.isEnriched) {
            return res.status(200).json({
                success: true,
                message: 'Lesson loaded from cache',
                lesson,
            });
        }

        const existingVideoIds = course.lessons
            .map((item) => item.video?.videoId)
            .filter(Boolean);

        const [content, video] = await Promise.all([
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

        const updatedCourse = await Course.enrichLesson(
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
                message: 'Failed to save lesson content',
            });
        }

        const savedLesson = updatedCourse.lessons.find(
            (item) => item.lessonId === lessonId
        );

        return res.status(200).json({
            success: true,
            message: 'Lesson content generated successfully',
            lesson: savedLesson,
        });
    } catch (error) {
        console.error('[Get Lesson] Error:', error.stack || error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get lesson content',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Update One Lesson Using AI
|--------------------------------------------------------------------------
*/

const updateLesson = async (req, res) => {
    const requestId =
        `lesson-update-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`;

    try {
        const { courseSlug, lessonId } = req.params;
        const prompt = req.body?.prompt;

        if (!courseSlug || !lessonId) {
            return res.status(400).json({
                success: false,
                message: 'courseSlug and lessonId are required',
                requestId,
            });
        }

        if (typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an update prompt',
                requestId,
            });
        }

        const course = await Course.findOne({ courseSlug });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found',
                requestId,
            });
        }

        const lesson = course.lessons.find(
            (item) => item.lessonId === lessonId
        );

        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: 'Lesson not found in this course',
                requestId,
            });
        }

        const otherVideoIds = course.lessons
            .filter((item) => item.lessonId !== lessonId)
            .map((item) => item.video?.videoId)
            .filter(Boolean);

        const result =
            await lessonUpdateAgent.updateLessonContent(
                course.title,
                lesson.toObject(),
                prompt.trim(),
                otherVideoIds
            );

        const updatedLesson =
            result?.updatedLesson || result?.lesson;

        const updateAnalysis = result?.updateAnalysis || {};

        if (!updatedLesson || typeof updatedLesson !== 'object') {
            return res.status(502).json({
                success: false,
                message: 'AI agent did not return a valid updated lesson',
                requestId,
            });
        }

        updatedLesson.lessonId = lesson.lessonId;
        updatedLesson.lessonNumber = lesson.lessonNumber;

        if (!updatedLesson.video && lesson.video) {
            updatedLesson.video = lesson.video;
        }

        const videoChangeRequested =
            updateAnalysis.videoChangeRequested === true;

        const videoChanged =
            updateAnalysis.videoChanged === true ||
            (
                Boolean(updatedLesson.video?.videoId) &&
                updatedLesson.video.videoId !== lesson.video?.videoId
            );

        const updatedCourse = await Course.updateLesson(
            courseSlug,
            lessonId,
            updatedLesson
        );

        if (!updatedCourse) {
            return res.status(500).json({
                success: false,
                message: 'Failed to save the updated lesson',
                requestId,
            });
        }

        const savedLesson = updatedCourse.lessons.find(
            (item) => item.lessonId === lessonId
        );

        if (!savedLesson) {
            return res.status(500).json({
                success: false,
                message: 'Lesson was not found after saving',
                requestId,
            });
        }

        const contentChanged =
            updateAnalysis.contentChanged === true;

        let quizInvalidated = false;

        if (contentChanged) {
            const deletedQuiz = await Quiz.findOneAndDelete({
                courseSlug,
                lessonId,
            });

            quizInvalidated = Boolean(deletedQuiz);
        }

        return res.status(200).json({
            success: true,
            message: 'Lesson updated successfully',
            requestId,
            update: {
                type: updateAnalysis.updateType || 'unknown',
                contentChanged,
                videoChangeRequested,
                videoChanged,
                quizInvalidated,
            },
            analysis: updateAnalysis,
            lesson: savedLesson,
        });
    } catch (error) {
        console.error(`[${requestId}] Update lesson error:`, error.stack || error);

        const statusCode =
            error.status || error.statusCode || error.response?.status;

        if (statusCode === 429) {
            return res.status(429).json({
                success: false,
                message: 'AI rate limit reached. Please wait before trying again.',
                requestId,
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while updating lesson',
            requestId,
        });
    }
};

/*
|--------------------------------------------------------------------------
| Get My Courses
|--------------------------------------------------------------------------
*/

const getMyCourses = async (req, res) => {
    try {
        const userId = getCurrentUserId(req);

        const courses = await Course.getMyCourses(userId);

        return res.status(200).json({
            success: true,
            courses,
        });
    } catch (error) {
        console.error('[Get My Courses] Error:', error.stack || error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get courses',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Get Share Courses
|--------------------------------------------------------------------------
*/

const getSharedCourses = async (req, res) => {
    try {
        const userId = getCurrentUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        const sharedCourses = await Course.getSharedCourses(userId);

        return res.status(200).json({
            success: true,
            sharedCourses,
        });

    } catch (error) {
        console.error('[Get Shared Courses] Error:', error.stack || error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get shared courses',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Share Course
|--------------------------------------------------------------------------
*/

const shareCourse = async (req, res) => {
    try {
        const { courseSlug, userId } = req.body;
        const currentUserId = getCurrentUserId(req);

        if (!courseSlug || !userId) {
            return res.status(400).json({
                success: false,
                message: 'courseSlug and userId are required',
            });
        }

        if (!mongooseIsValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
            });
        }

        if (!mongooseIsValidObjectId(currentUserId)) {
            return res.status(401).json({
                success: false,
                message: 'Authenticated user ID is invalid',
            });
        }

        const targetUser = await User.findById(userId);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'Target user not found',
            });
        }

        const course = await Course.findOne({ courseSlug });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found',
            });
        }

        if (String(course.creator) !== String(currentUserId)) {
            return res.status(403).json({
                success: false,
                message: 'Only the course owner can share this course',
            });
        }

        if (String(targetUser._id) === String(currentUserId)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot share a course with yourself',
            });
        }

        const alreadyShared = (course.sharedWith || []).some(
            (id) => String(id) === String(targetUser._id)
        );

        if (alreadyShared) {
            return res.status(200).json({
                success: true,
                message: 'Course is already shared with this user',
            });
        }

        const updatedCourse = await Course.shareCourseWithUser(
            courseSlug,
            userId
        );

        return res.status(200).json({
            success: true,
            message: 'Course shared successfully',
            course: updatedCourse,
        });
    } catch (error) {
        console.error('[Share Course] Error:', error.stack || error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to share course',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Search Registered Users
|--------------------------------------------------------------------------
| GET /api/courses/share/search-users?q=baqer
|--------------------------------------------------------------------------
*/

const searchUsers = async (req, res) => {
    try {
        const query = String(req.query.q || '').trim();

        if (query.length < 2) {
            return res.status(200).json({
                success: true,
                users: [],
            });
        }

        // This endpoint searches User directly; it does not look up a course.
        const escapedQuery = query.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

        const currentUserId = getCurrentUserId(req);

        const filter = {
            $or: [
                {
                    name: {
                        $regex: escapedQuery,
                        $options: 'i',
                    },
                },
                {
                    email: {
                        $regex: escapedQuery,
                        $options: 'i',
                    },
                },
            ],
        };

        // Exclude the current user when their ID is a MongoDB ObjectId.
        if (mongooseIsValidObjectId(currentUserId)) {
            filter._id = { $ne: currentUserId };
        }

        const users = await User.find(filter)
            .select('_id name email')
            .limit(10)
            .lean();

        return res.status(200).json({
            success: true,
            users,
        });
    } catch (error) {
        console.error('[Search Users] Error:', error.stack || error);

        return res.status(500).json({
            success: false,
            message: 'Failed to search registered users',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Delete Course
|--------------------------------------------------------------------------
*/

const deleteCourse = async (req, res) => {
    try {
        const { courseSlug } = req.params;
        const currentUserId = getCurrentUserId(req);

        const result = await Course.deleteCourseByOwner(
            courseSlug,
            currentUserId
        );

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('[Delete Course] Error:', error.stack || error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete course',
        });
    }
};

/*
|--------------------------------------------------------------------------
| Export Controller
|--------------------------------------------------------------------------
*/

export default {
    generateCourse,
    generateLesson,
    getCourseBySlug,
    getLessonContent,
    updateLesson,
    getMyCourses,
    getSharedCourses,
    shareCourse,
    searchUsers,
    deleteCourse,
};
