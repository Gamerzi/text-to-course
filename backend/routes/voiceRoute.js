
import express from 'express';
import generateLessonVoice from '../controllers/voiceController.js';

const router = express.Router();

// Generate or retrieve voice for a specific lesson
router.post('/:courseSlug/:lessonId', generateLessonVoice);

export default router;
