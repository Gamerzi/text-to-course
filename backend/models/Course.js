import mongoose from 'mongoose';

// Helper to create clean URL slugs 
const slugify = (text) => {
    return (text || '')
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove special characters
        .trim()
        .replace(/\s+/g, '-');    // replace spaces with hyphens
};

// Sub-schema for individual lessons
const lessonSchema = new mongoose.Schema({
    lessonId: { type: String, required: true }, // e.g. "foundations-of-containerization"
    lessonNumber: { type: Number, required: true },
    title: { type: String, required: true },
    learningObjective: String,
    subtopics: [String],

    // 🎥 YouTube Video recommendation
    video: {
        videoId: String,
        title: String,
        channelTitle: String,
        thumbnail: String,
        embedUrl: String,
        videoUrl: String,
    },

    // AI-Enriched fields
    isEnriched: { type: Boolean, default: false },
    overview: String,
    sections: [
        {
            subtopic: String,
            content: String,
        },
    ],
    codeSnippet: {
        language: String,
        filename: String,
        code: String,
        explanation: String,
    },
    citations: [
        {
            title: String,
            url: String,
            description: String,
        },
    ],
    keyTakeaways: [String],
});

// Main Course Schema
const courseSchema = new mongoose.Schema(
    {
        courseSlug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        title: {
            type: String,
            required: [true, 'Please provide a course title'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        tags: [String],
        totalLessons: {
            type: Number,
            default: 5,
        },
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        sharedWith: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        lessons: [lessonSchema],
    },
    {
        timestamps: true,
    }
);

// ⚡ AUTOMATIC SLUG GENERATION IN MODEL:
courseSchema.pre('validate', function () {
    // 1. Auto-generate courseSlug from title
    if (!this.courseSlug && this.title) {
        this.courseSlug = slugify(this.title);
    }

    // 2. Auto-generate each lesson's lessonId from its title
    if (this.lessons && Array.isArray(this.lessons)) {
        this.lessons.forEach((lesson, index) => {
            if (!lesson.lessonId && lesson.title) {
                lesson.lessonId = slugify(lesson.title);
            }
            if (!lesson.lessonNumber) {
                lesson.lessonNumber = index + 1;
            }
        });
    }
});

// Expose slugify static helper on Course model so any controller can use Course.slugify()
courseSchema.statics.slugify = slugify;

// ---------------------------------------------------------------------
// DATABASE OPERATIONS
// ---------------------------------------------------------------------

/**
 * 1. Add / Save course (Model auto-generates courseSlug and lessonIds!)
 */
courseSchema.statics.addCourse = async function ({
    courseSlug,
    title,
    description,
    tags,
    totalLessons,
    creator,
    lessons,
}) {
    const finalSlug = courseSlug || slugify(title);

    // If already exists, return existing course
    const existing = await this.findOne({ courseSlug: finalSlug });
    if (existing) {
        return existing;
    }

    // Create new course document (triggers pre('validate') hook!)
    return await this.create({
        courseSlug: finalSlug,
        title,
        description: description || '',
        tags: tags || [],
        totalLessons: totalLessons || lessons?.length || 5,
        creator,
        lessons: lessons || [],
    });
};

/**
 * 2. Find course by slug
 */
courseSchema.statics.findBySlug = async function (courseSlug) {
    return await this.findOne({ courseSlug })
        .populate('creator', 'name email')
        .populate('sharedWith', 'name email');
};

/**
 * 3. Enrich a lesson (saves AI notes, code, citations, AND YouTube video!)
 */
courseSchema.statics.enrichLesson = async function (courseSlug, lessonId, enrichedData) {
    return await this.findOneAndUpdate(
        { courseSlug, 'lessons.lessonId': lessonId },
        {
            $set: {
                'lessons.$.isEnriched': true,
                'lessons.$.overview': enrichedData.overview,
                'lessons.$.sections': enrichedData.sections,
                'lessons.$.codeSnippet': enrichedData.codeSnippet,
                'lessons.$.citations': enrichedData.citations,
                'lessons.$.keyTakeaways': enrichedData.keyTakeaways,
                'lessons.$.video': enrichedData.video, // 👈 Saves YouTube video in MongoDB!
            },
        },
        { new: true }
    );
};

/**
 * 4. Share course
 */
courseSchema.statics.shareCourseWithUser = async function (courseSlug, targetUserId) {
    return await this.findOneAndUpdate(
        { courseSlug },
        { $addToSet: { sharedWith: targetUserId } },
        { new: true }
    ).populate('sharedWith', 'name email');
};

/**
 * 5. Get user courses
 */
courseSchema.statics.getMyCourses = async function (userId) {
    return await this.find({ creator: userId }).sort({ createdAt: -1 });
};

/**
 * 6. Get shared courses
 */
courseSchema.statics.getSharedCourses = async function (userId) {
    return await this.find({ sharedWith: userId })
        .populate('creator', 'name email')
        .sort({ createdAt: -1 });
};

/**
 * 7. Delete course (Owner only)
 */
courseSchema.statics.deleteCourseByOwner = async function (courseSlug, userId) {
    const course = await this.findOne({ courseSlug });

    if (!course) {
        const error = new Error('Course not found');
        error.statusCode = 404;
        throw error;
    }

    if (course.creator.toString() !== userId.toString()) {
        const error = new Error('Forbidden: Only the owner can delete this course');
        error.statusCode = 403;
        throw error;
    }

    await this.deleteOne({ _id: course._id });
    return { message: 'Course deleted successfully' };
};

const Course = mongoose.model('Course', courseSchema);

export default Course;