import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';              // <-- add this
import connectDB from './config/DB.js';

import userRoute from './routes/userRoute.js';
import courseRoute from './routes/courseRoute.js';
import quizeRoute from './routes/quizeRoute.js';
import voiceRoutes from './routes/voiceRoute.js';

dotenv.config();
connectDB();

const app = express();

// Middlewares (helmet BEFORE routes)
app.use(helmet({ referrerPolicy: { policy: "strict-origin-when-cross-origin" } }));
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoute);
app.use('/api/courses', courseRoute);
app.use('/api/voice', voiceRoutes);
app.use('/api/courses', quizeRoute);

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Text-to-Learn Backend API is running'
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});