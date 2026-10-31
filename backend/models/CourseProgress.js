// models/CourseProgress.js
import mongoose from "mongoose";

const courseProgressSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },

        // CHANGED: stores lesson.lessonId values (strings), matching your frontend routes
        completedLessons: [{ type: String }],

        isCompleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

courseProgressSchema.index({ user: 1, course: 1 }, { unique: true });

export default mongoose.model("CourseProgress", courseProgressSchema);