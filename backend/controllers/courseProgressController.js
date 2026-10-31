// controllers/courseProgressController.js
import Course from "../models/Course.js";
import CourseProgress from "../models/CourseProgress.js";

// Same id the frontend uses in /course/:courseSlug/lesson/:lessonId
const lessonKey = (lesson) => String(lesson.lessonId ?? lesson._id);

/** Counts only lessons that still exist, so progress can never pass 100%. */
const buildSummary = (course, completedLessons = []) => {
    const valid = new Set((course.lessons || []).map(lessonKey));
    const completed = [...new Set(completedLessons.map(String))].filter((id) =>
        valid.has(id)
    );

    const totalLessons = valid.size;
    const completedCount = completed.length;

    return {
        totalLessons,
        completedLessons: completed,
        completedCount,
        percentage:
            totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100),
        isCompleted: totalLessons > 0 && completedCount === totalLessons,
    };
};

const findCourseBySlug = async (slug) => {
    const clean = String(slug || "").trim();
    if (!clean) return null;

    const safeEscaped = clean.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    return await Course.findOne({
        $or: [
            { courseSlug: clean },
            { courseSlug: clean.toLowerCase() },
            { courseSlug: new RegExp(`^${safeEscaped}$`, "i") }
        ]
    }).lean();
};

// GET /api/progress/:courseSlug or /api/course-progress/:courseSlug
export const getCourseProgress = async (req, res) => {
    try {
        const { courseSlug } = req.params;
        const userId = req.user?.id || req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const course = await findCourseBySlug(courseSlug);
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        const progress = await CourseProgress.findOne({
            user: userId,
            course: course._id,
        }).lean();

        return res.status(200).json({
            courseSlug: course.courseSlug,
            ...buildSummary(course, progress?.completedLessons),
        });
    } catch (error) {
        console.error("getCourseProgress error:", error);
        return res.status(500).json({ message: "Failed to fetch course progress" });
    }
};

// PATCH /api/progress/:courseSlug/lessons/:lessonId   body: { completed: true|false }
export const updateLessonProgress = async (req, res) => {
    try {
        const { courseSlug, lessonId } = req.params;
        const { completed } = req.body;
        const userId = req.user?.id || req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        if (typeof completed !== "boolean") {
            return res.status(400).json({ message: "completed must be true or false" });
        }

        const course = await findCourseBySlug(courseSlug);
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        const cleanLessonId = String(lessonId || "").trim();
        const matchedLesson = (course.lessons || []).find((lesson) => {
            const key = String(lesson.lessonId ?? lesson._id);
            return (
                key === cleanLessonId ||
                key.toLowerCase() === cleanLessonId.toLowerCase() ||
                (lesson.title && Course.slugify && Course.slugify(lesson.title) === cleanLessonId)
            );
        });

        // Resolve to lesson.lessonId or provided lessonId
        const resolvedId = matchedLesson ? lessonKey(matchedLesson) : cleanLessonId;

        const update = completed
            ? { $addToSet: { completedLessons: resolvedId } }
            : { $pull: { completedLessons: resolvedId } };

        const progress = await CourseProgress.findOneAndUpdate(
            { user: userId, course: course._id },
            update,
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

        const summary = buildSummary(course, progress.completedLessons);

        if (progress.isCompleted !== summary.isCompleted) {
            await CourseProgress.updateOne(
                { _id: progress._id },
                { $set: { isCompleted: summary.isCompleted } }
            );
        }

        return res.status(200).json({
            message: completed ? "Lesson marked as completed" : "Lesson marked as incomplete",
            courseSlug: course.courseSlug,
            ...summary,
        });
    } catch (error) {
        console.error("updateLessonProgress error:", error);
        return res.status(500).json({ message: "Failed to update lesson progress" });
    }
};

// GET /api/progress/my-progress or /api/course-progress/my-progress
export const getMyCourseProgress = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const list = await CourseProgress.find({ user: userId })
            .populate("course", "title courseSlug lessons")
            .lean();

        const result = list
            .filter((item) => item.course)
            .map((item) => {
                const s = buildSummary(item.course, item.completedLessons);
                return {
                    courseId: item.course._id,
                    courseSlug: item.course.courseSlug,
                    title: item.course.title,
                    totalLessons: s.totalLessons,
                    completedCount: s.completedCount,
                    percentage: s.percentage,
                    isCompleted: s.isCompleted,
                };
            });

        return res.status(200).json(result);
    } catch (error) {
        console.error("getMyCourseProgress error:", error);
        return res.status(500).json({ message: "Failed to fetch course progress" });
    }
};
