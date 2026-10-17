import express from 'express';
import { register, login } from '../controllers/userController.js';
import { protect } from '../middlewear/auth.js';
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', protect, (req, res) => {
    res.status(200).json({
        success: true,
        message: `Hello ${req.user.name}!`,
        user: req.user,
    });
});

export default router;