
import mongoose from 'mongoose';

const slugify = (text) => {
    return (text || '')
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
};

const lessonSchema = new mongoose.Schema({
    lessonId: {
        type: String,
        required: true,
    },

    lessonNumber: {
        type: Number,
        required: true,
    },

    title: {
        type: String,
        required: true,
    },

    learningObjective: {
        type: String,
        default: '',
    },

    subtopics: {
        type: [String],
        default: [],
    },

    video: {
        videoId: String,
        title: String,
        channelTitle: String,
        thumbnail: String,
        embedUrl: String,
        videoUrl: String,
    },

    isEnriched: {
        type: Boolean,
        default: false,
    },

    overview: {
        type: String,
        default: '',
    },

    sections: {
        type: [
            {
                subtopic: String,
                content: String,
            },
        ],
        default: [],
    },

    codeSnippet: {
        language: String,
        filename: String,
        code: String,
        explanation: String,
    },

    citations: {
        type: [
            {
                title: String,
                url: String,
                description: String,
            },
        ],
        default: [],
    },

    keyTakeaways: {
        type: [String],
        default: [],
    },
});

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
            required: [
                true,
                'Please provide a course title',
            ],
            trim: true,
        },

        description: {
            type: String,
            trim: true,
            default: '',
        },

        tags: {
            type: [String],
            default: [],
        },

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

        lessons: {
            type: [lessonSchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

/*
 * Automatically create course slug and lesson IDs.
 */
courseSchema.pre('validate', function () {
    if (!this.courseSlug && this.title) {
        this.courseSlug = slugify(this.title);
    }

    if (Array.isArray(this.lessons)) {
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

/*
 * Make slugify available through Course.slugify().
 */
courseSchema.statics.slugify = slugify;

/*
 * Add a new course.
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

    const existing = await this.findOne({
        courseSlug: finalSlug,
    });

    if (existing) {
        return existing;
    }

    return await this.create({
        courseSlug: finalSlug,
        title,
        description: description || '',
        tags: tags || [],
        totalLessons:
            totalLessons || lessons?.length || 5,
        creator,
        lessons: lessons || [],
    });
};

/*
 * Find course by slug.
 */
courseSchema.statics.findBySlug = async function (courseSlug) {
    return await this.findOne({
        courseSlug,
    })
        .populate('creator', 'name email')
        .populate('sharedWith', 'name email');
};

/*
 * Enrich a lesson for the first time.
 */
courseSchema.statics.enrichLesson = async function (
    courseSlug,
    lessonId,
    enrichedData
) {
    return await this.findOneAndUpdate(
        {
            courseSlug,
            'lessons.lessonId': lessonId,
        },
        {
            $set: {
                'lessons.$.isEnriched': true,
                'lessons.$.overview': enrichedData.overview,
                'lessons.$.sections': enrichedData.sections,
                'lessons.$.codeSnippet': enrichedData.codeSnippet,
                'lessons.$.citations': enrichedData.citations,
                'lessons.$.keyTakeaways': enrichedData.keyTakeaways,
                'lessons.$.video': enrichedData.video,
            },
        },
        {
            returnDocument: 'after',
            runValidators: true,
        }
    );
};

/*
 * Update ONLY one lesson.
 *
 * lessonId and lessonNumber are never changed.
 * The video field is saved along with the lesson content.
 */
courseSchema.statics.updateLesson = async function (
    courseSlug,
    lessonId,
    updatedLesson
) {
    if (!courseSlug || !lessonId || !updatedLesson) {
        throw new Error(
            'Course slug, lesson ID, and updated lesson are required'
        );
    }

    const updateFields = {
        'lessons.$.title': updatedLesson.title,
        'lessons.$.learningObjective':
            updatedLesson.learningObjective,
        'lessons.$.subtopics': updatedLesson.subtopics,
        'lessons.$.overview': updatedLesson.overview,
        'lessons.$.sections': updatedLesson.sections,
        'lessons.$.codeSnippet': updatedLesson.codeSnippet,
        'lessons.$.citations': updatedLesson.citations,
        'lessons.$.keyTakeaways': updatedLesson.keyTakeaways,
        'lessons.$.isEnriched': true,
    };

    /*
     * Only include video if the agent returned the field.
     * This prevents accidentally erasing a video if video
     * wasn't part of the update.
     */
    if (
        Object.prototype.hasOwnProperty.call(
            updatedLesson,
            'video'
        )
    ) {
        updateFields['lessons.$.video'] =
            updatedLesson.video;
    }

    const updatedCourse = await this.findOneAndUpdate(
        {
            courseSlug,
            'lessons.lessonId': lessonId,
        },
        {
            $set: updateFields,
        },
        {
            returnDocument: 'after',
            runValidators: true,
        }
    );

    if (!updatedCourse) {
        const error = new Error(
            'Course or lesson not found'
        );

        error.statusCode = 404;
        throw error;
    }

    return updatedCourse;
};

/*
 * Share course with another user.
 */
courseSchema.statics.shareCourseWithUser = async function (
    courseSlug,
    targetUserId
) {
    return await this.findOneAndUpdate(
        {
            courseSlug,
        },
        {
            $addToSet: {
                sharedWith: targetUserId,
            },
        },
        {
            returnDocument: 'after',
            runValidators: true,
        }
    ).populate('sharedWith', 'name email');
};

/*
 * Get courses created by user.
 */
courseSchema.statics.getMyCourses = async function (userId) {
    return await this.find({
        creator: userId,
    }).sort({
        createdAt: -1,
    });
};

/*
 * Get courses shared with user.
 */
courseSchema.statics.getSharedCourses = async function (userId) {
    return await this.find({
        sharedWith: userId,
    })
        .populate('creator', 'name email')
        .sort({
            createdAt: -1,
        });
};

/*
 * Delete course by owner.
 */
courseSchema.statics.deleteCourseByOwner = async function (
    courseSlug,
    userId
) {
    const course = await this.findOne({
        courseSlug,
    });

    if (!course) {
        const error = new Error('Course not found');
        error.statusCode = 404;
        throw error;
    }

    if (course.creator.toString() !== userId.toString()) {
        const error = new Error(
            'Forbidden: Only the owner can delete this course'
        );

        error.statusCode = 403;
        throw error;
    }

    await this.deleteOne({
        _id: course._id,
    });

    return {
        message: 'Course deleted successfully',
    };
};

const Course = mongoose.model('Course', courseSchema);

export default Course;
