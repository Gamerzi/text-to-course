
import express from 'express';
import protect from '../middlewear/auth.js'
import generateLessonVoice from '../controllers/voiceController.js';

const router = express.Router();

// Generate or retrieve voice for a specific lesson
router.post('/:courseSlug/:lessonId', protect, generateLessonVoice);

export default router;
