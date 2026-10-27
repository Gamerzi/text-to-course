import outlineAgent from '../agents/outlineAgent.js';
import contentAgent from '../agents/contentAgent.js';
import Course from '../models/Course.js';
import User from '../models/User.js';
import youtubeUtil from '../utils/youtube.js';

// @desc    Generate and save new course syllabus (Agent 1)
// @route   POST /api/courses/generate
const generateCourse = async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic || topic.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a topic to generate a course',
            });
        }

        // 1. Agent 1 generates the 5-lesson syllabus outline
        const outline = await outlineAgent.generateCourseOutline(topic);

        // 2. Save into MongoDB (Course model auto-generates courseSlug and lessonIds)
        const savedCourse = await Course.addCourse({
            courseSlug: outline.courseSlug,
            title: outline.title || topic,
            description: outline.description || '',
            tags: outline.tags || [],
            totalLessons: outline.totalLessons || outline.lessons?.length || 5,
            creator: req.user.id,
            lessons: outline.lessons || [],
        });

        console.log(`💾 [DB] New course "${savedCourse.title}" saved with slug: ${savedCourse.courseSlug}`);

        return res.status(200).json({
            success: true,
            message: 'Course outline generated and saved successfully',
            course: savedCourse,
        });
    } catch (error) {
        console.error('Course generation error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while generating course',
        });
    }
};

// @desc    Get or generate lesson content (Agent 2 + YouTube + MongoDB Cache)
// @route   POST /api/courses/generate-lesson
const generateLesson = async (req, res) => {
    try {
        const { courseSlug, courseTitle, lesson } = req.body;

        if (!courseSlug || !lesson || !lesson.lessonId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide courseSlug and lesson object with lessonId',
            });
        }

        // 1. Find course in MongoDB
        let existingCourse = await Course.findBySlug(courseSlug);

        // Safety net: if course not in DB, create it automatically
        if (!existingCourse) {
            console.log(`⚠️ Course "${courseSlug}" not in DB. Creating it now...`);
            existingCourse = await Course.addCourse({
                courseSlug,
                title: courseTitle || courseSlug.replace(/-/g, ' '),
                description: `Course for ${courseTitle || courseSlug}`,
                creator: req.user.id,
                lessons: [
                    {
                        lessonId: lesson.lessonId,
                        lessonNumber: lesson.lessonNumber || 1,
                        title: lesson.title,
                        learningObjective: lesson.learningObjective || '',
                        subtopics: lesson.subtopics || [],
                        isEnriched: false,
                    },
                ],
            });
        }

        // 2. Check if this lesson is already enriched in DB
        const existingLesson = existingCourse.lessons?.find(
            (l) => l.lessonId === lesson.lessonId
        );

        // ⚡ CACHE HIT: Return directly from DB (0 AI & YouTube calls, ~5ms)
        if (existingLesson && existingLesson.isEnriched) {
            console.log(`⚡ [Cache Hit] Serving "${existingLesson.title}" from MongoDB!`);
            return res.status(200).json({
                success: true,
                cached: true,
                lesson: existingLesson,
            });
        }

        // 3. 🎯 DEDUPLICATION: Extract all video IDs already assigned in this course
        const existingVideoIds = existingCourse.lessons
            ?.map((l) => l.video?.videoId)
            .filter(Boolean) || [];

        // 4. 🎯 SPECIFIC SEARCH: Use lesson title + subtopic instead of generic course title
        const specificQuery = `${lesson.title} ${lesson.subtopics?.[0] || ''}`.trim();

        console.log(`🔍 [YouTube] Searching for: "${specificQuery}" (excluding ${existingVideoIds.length} already assigned video IDs)`);

        // 5. Parallel execution: Agent 2 generates notes + YouTube searches non-duplicate video
        const [content, video] = await Promise.all([
            contentAgent.generateLessonContent(existingCourse.title, lesson),
            youtubeUtil.searchYouTube(specificQuery, existingVideoIds),
        ]);

        // 6. Enrich and cache in MongoDB
        const updatedCourse = await Course.enrichLesson(courseSlug, lesson.lessonId, {
            ...content,
            video,
            isEnriched: true,
        });

        const savedLesson = updatedCourse.lessons.find((l) => l.lessonId === lesson.lessonId);

        console.log(`✅ [Enriched & Cached] "${savedLesson.title}" saved with videoId: ${video?.videoId || 'N/A'}`);

        return res.status(200).json({
            success: true,
            cached: false,
            lesson: savedLesson,
        });
    } catch (error) {
        console.error('Lesson generation error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while generating lesson',
        });
    }
};

// @desc    Get complete course details by slug
// @route   GET /api/courses/:courseSlug
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
        console.error('Get course error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while fetching course',
        });
    }
};

// @desc    Get single lesson content (checks cache first, generates on demand if not enriched)
// @route   GET /api/courses/:courseSlug/:lessonId
const getLessonContent = async (req, res) => {
    try {
        const { courseSlug, lessonId } = req.params;

        const course = await Course.findBySlug(courseSlug);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found',
            });
        }

        const lesson = course.lessons.find((l) => l.lessonId === lessonId);
        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: 'Lesson not found in this course',
            });
        }

        // ⚡ Cache hit: Return immediately from DB
        if (lesson.isEnriched) {
            return res.status(200).json({
                success: true,
                cached: true,
                lesson,
            });
        }

        // 🎯 Deduplication & specific search on demand
        const existingVideoIds = course.lessons
            ?.map((l) => l.video?.videoId)
            .filter(Boolean) || [];

        const specificQuery = `${lesson.title} ${lesson.subtopics?.[0] || ''}`.trim();

        const [content, video] = await Promise.all([
            contentAgent.generateLessonContent(course.title, lesson),
            youtubeUtil.searchYouTube(specificQuery, existingVideoIds),
        ]);

        const updatedCourse = await Course.enrichLesson(courseSlug, lessonId, {
            ...content,
            video,
            isEnriched: true,
        });

        const enrichedLesson = updatedCourse.lessons.find((l) => l.lessonId === lessonId);

        return res.status(200).json({
            success: true,
            cached: false,
            lesson: enrichedLesson,
        });
    } catch (error) {
        console.error('Get lesson error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while fetching lesson',
        });
    }
};

// @desc    Get all courses created by the logged-in user
// @route   GET /api/courses/my-courses
const getMyCourses = async (req, res) => {
    try {
        const courses = await Course.getMyCourses(req.user.id);
        return res.status(200).json({
            success: true,
            count: courses.length,
            courses,
        });
    } catch (error) {
        console.error('Get my courses error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while fetching your courses',
        });
    }
};

// @desc    Share a course with another user by email
// @route   POST /api/courses/:courseSlug/share
const shareCourse = async (req, res) => {
    try {
        const { courseSlug } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide the recipient user email',
            });
        }

        const targetUser = await User.findOne({ email: email.toLowerCase() });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User with that email does not exist',
            });
        }

        const updatedCourse = await Course.shareCourseWithUser(
            courseSlug,
            req.user.id,
            targetUser._id
        );

        return res.status(200).json({
            success: true,
            message: `Course successfully shared with ${targetUser.name} (${targetUser.email})`,
            course: updatedCourse,
        });
    } catch (error) {
        console.error('Share course error:', error.message);
        const statusCode = error.message.includes('not authorized') ? 403 : 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || 'Server error while sharing course',
        });
    }
};

// @desc    Delete a course by owner (cascades all embedded lessons)
// @route   DELETE /api/courses/:courseSlug
const deleteCourse = async (req, res) => {
    try {
        const { courseSlug } = req.params;
        await Course.deleteCourseByOwner(courseSlug, req.user.id);

        return res.status(200).json({
            success: true,
            message: 'Course and all associated lessons deleted successfully',
        });
    } catch (error) {
        console.error('Delete course error:', error.message);
        const statusCode = error.message.includes('not authorized') ? 403 : 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || 'Server error while deleting course',
        });
    }
};

export default {
    generateCourse,
    generateLesson,
    getCourseBySlug,
    getLessonContent,
    getMyCourses,
    shareCourse,
    deleteCourse,
};