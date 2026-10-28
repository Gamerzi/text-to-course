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
            await outlineAgent.generateCourseOutline(topic);

        if (!outline) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate course outline',
            });
        }

        const course = await Course.addCourse({
            ...outline,
            creator: req.user._id,
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

        if (!courseSlug || !lesson) {
            return res.status(400).json({
                success: false,
                message: 'courseSlug and lesson are required',
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
                creator: req.user._id,
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

        console.log('[Generate Lesson] Generating content and finding video');

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

        console.log('[Get Lesson] Generating lesson content');

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
| PUT /api/courses/:courseSlug/:lessonId/update
| Body: { "prompt": "Replace the video with a better tutorial" }
|--------------------------------------------------------------------------
*/

const updateLesson = async (req, res) => {
    const requestId =
        `lesson-update-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    console.log(`\n[${requestId}] ===== UPDATE STARTED =====`);
    console.log(`[${requestId}] Params:`, req.params);
    console.log(`[${requestId}] Prompt:`, req.body?.prompt);

    try {
        const { courseSlug, lessonId } = req.params;
        const prompt = req.body?.prompt;

        // 1. Validate request
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

        // 2. Find course
        console.log(`[${requestId}] Step 1: Finding course`);

        const course = await Course.findOne({ courseSlug });

        if (!course) {
            console.error(`[${requestId}] Course not found`);

            return res.status(404).json({
                success: false,
                message: 'Course not found',
                requestId,
            });
        }

        // 3. Find requested lesson
        const lesson = course.lessons.find(
            (item) => item.lessonId === lessonId
        );

        if (!lesson) {
            console.error(`[${requestId}] Lesson not found:`, lessonId);

            return res.status(404).json({
                success: false,
                message: 'Lesson not found in this course',
                requestId,
            });
        }

        console.log(`[${requestId}] Step 2: Lesson found`);
        console.log(`[${requestId}] Lesson title:`, lesson.title);
        console.log(
            `[${requestId}] Existing video ID:`,
            lesson.video?.videoId || 'None'
        );

        // Video IDs already used by OTHER lessons in this course,
        // so a replacement video is not a duplicate of another lesson's video.
        const otherVideoIds = course.lessons
            .filter((item) => item.lessonId !== lessonId)
            .map((item) => item.video?.videoId)
            .filter(Boolean);

        // 4. Ask the AI agent to update the lesson
        console.log(`[${requestId}] Step 3: Calling lesson update agent`);

        const result = await lessonUpdateAgent.updateLessonContent(
            course.title,
            lesson.toObject(),
            prompt.trim(),
            otherVideoIds
        );

        console.log(`[${requestId}] Step 4: AI agent returned`);
        console.log(
            `[${requestId}] Agent result keys:`,
            result && typeof result === 'object'
                ? Object.keys(result)
                : result
        );

        /*
         * Support either result.lesson or result.updatedLesson.
         * The agent must return one of these shapes.
         */
        const updatedLesson = result?.updatedLesson || result?.lesson;
        const updateAnalysis = result?.updateAnalysis || {};

        if (!updatedLesson || typeof updatedLesson !== 'object') {
            console.error(
                `[${requestId}] Invalid agent result:`,
                JSON.stringify(result, null, 2)
            );

            return res.status(502).json({
                success: false,
                message:
                    'AI agent did not return a valid updated lesson. Check the lessonUpdate.js return value.',
                requestId,
            });
        }

        // 5. Preserve lesson identity and order
        updatedLesson.lessonId = lesson.lessonId;
        updatedLesson.lessonNumber = lesson.lessonNumber;

        /*
         * Preserve the existing video unless the agent has
         * deliberately supplied a replacement video.
         */
        if (!updatedLesson.video && lesson.video) {
            updatedLesson.video = lesson.video;
        }

        const videoChangeRequested =
            updateAnalysis.videoChangeRequested === true;

        const videoChanged =
            updateAnalysis.videoChanged === true ||
            (
                Boolean(updatedLesson.video?.videoId) &&
                updatedLesson.video?.videoId !== lesson.video?.videoId
            );

        console.log(`[${requestId}] Video change requested:`, videoChangeRequested);
        console.log(`[${requestId}] Video changed:`, videoChanged);
        console.log(
            `[${requestId}] New video ID:`,
            updatedLesson.video?.videoId || 'None'
        );

        // 6. Save the updated lesson
        console.log(`[${requestId}] Step 5: Saving lesson to MongoDB`);

        const updatedCourse = await Course.updateLesson(
            courseSlug,
            lessonId,
            updatedLesson
        );

        if (!updatedCourse) {
            console.error(
                `[${requestId}] Course.updateLesson returned no course`
            );

            return res.status(500).json({
                success: false,
                message:
                    'MongoDB did not return the updated course. Check Course.updateLesson in models/Course.js.',
                requestId,
            });
        }

        console.log(`[${requestId}] Step 6: MongoDB save completed`);

        // 7. Retrieve the actual saved lesson
        const savedLesson = updatedCourse.lessons.find(
            (item) => item.lessonId === lessonId
        );

        if (!savedLesson) {
            console.error(
                `[${requestId}] Saved course does not contain the lesson`
            );

            return res.status(500).json({
                success: false,
                message: 'Lesson was not found after saving',
                requestId,
            });
        }

        console.log(
            `[${requestId}] Saved video ID:`,
            savedLesson.video?.videoId || 'None'
        );

        // 8. Invalidate the quiz only if lesson content changed
        const contentChanged =
            updateAnalysis.contentChanged === true;

        let quizInvalidated = false;

        if (contentChanged) {
            console.log(`[${requestId}] Step 7: Invalidating old quiz`);

            const deletedQuiz = await Quiz.findOneAndDelete({
                courseSlug,
                lessonId,
            });

            quizInvalidated = Boolean(deletedQuiz);

            console.log(
                `[${requestId}] Quiz invalidated:`,
                quizInvalidated
            );
        }

        // 9. Send response
        console.log(`[${requestId}] ===== UPDATE SUCCEEDED =====\n`);

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
        console.error(`\n[${requestId}] ===== UPDATE FAILED =====`);
        console.error(`[${requestId}] Error name:`, error.name);
        console.error(`[${requestId}] Error message:`, error.message);
        console.error(`[${requestId}] Stack trace:\n`, error.stack);
        console.error(`[${requestId}] ===== END ERROR =====\n`);

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
        const courses = await Course.getMyCourses(req.user._id);

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
| Share Course
|--------------------------------------------------------------------------
*/

const shareCourse = async (req, res) => {
    try {
        const { courseSlug, userId } = req.body;

        if (!courseSlug || !userId) {
            return res.status(400).json({
                success: false,
                message: 'courseSlug and userId are required',
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

        if (
            course.creator.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: 'Only the course owner can share this course',
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

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to share course',
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

        const result = await Course.deleteCourseByOwner(
            courseSlug,
            req.user._id
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
    shareCourse,
    deleteCourse,
};