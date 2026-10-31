// routes/courseProgressRoutes.js
// Mount with: app.use("/api/progress", courseProgressRoutes);
import express from "express";
import protect from "../middlewear/auth.js";
import {
    getCourseProgress,
    updateLessonProgress,
    getMyCourseProgress,
} from "../controllers/courseProgressController.js";

const router = express.Router();

router.get("/my-progress", protect, getMyCourseProgress); // keep above /:courseSlug
router.get("/:courseSlug", protect, getCourseProgress);
router.patch("/:courseSlug/lessons/:lessonId", protect, updateLessonProgress);

export default router;