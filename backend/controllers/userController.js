import User from '../models/User.js';

// Register user
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email, and password',
            });
        }

        const token = await User.registerUser({ name, email, password });

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message,
        });
    }
};

// Login user
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password',
            });
        }

        const token = await User.loginUser({ email, password });

        return res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            token
        });
    } catch (error) {
        return res.status(error.statusCode || 401).json({
            success: false,
            message: error.message,
        });
    }
};

// Named exports at the bottom
export { register, login };