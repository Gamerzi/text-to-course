import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import connectDB from './config/DB.js';

import userRoute from './routes/userRoute.js';
import courseRoute from './routes/courseRoute.js';
import quizeRoute from './routes/quizeRoute.js';
import voiceRoutes from './routes/voiceRoute.js';
import courseProgressRoute from './routes/courseProgressRoutes.js';

dotenv.config();
connectDB();

const app = express();

// Middlewares
app.use(helmet({
    referrerPolicy: {
        policy: "strict-origin-when-cross-origin"
    }
}));

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoute);
app.use('/api/courses', courseRoute);
app.use('/api/voice', voiceRoutes);
app.use('/api/courses', quizeRoute);

// Course progress routes (supports /api/course-progress, /api/progress, and /api/courses/progress)
app.use('/api/course-progress', courseProgressRoute);
app.use('/api/progress', courseProgressRoute);
app.use('/api/courses/progress', courseProgressRoute);

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Text-to-Learn Backend API is running'
    });
});

// 404 / Bad Request handler for unmatched API routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Bad Request: Route ${req.originalUrl} not found`
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
