import jwt from 'jsonwebtoken';

const protect = async (req, res, next) => {
    let token;

    // 1. Check if token exists in Authorization header (Format: Bearer <token>)
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Extract token string after "Bearer "
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify token using JWT_SECRET
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Extract user name and email from token and log to console
            console.log(`👋 Hello ${decoded.name} (${decoded.email})`);

            // 4. Attach user data to request object for future routes to use
            req.user = decoded;

            // 5. Proceed to the next middleware or controller
            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            return res.status(401).json({
                success: false,
                message: 'Not authorized, token invalid or expired',
            });
        }
    }

    // If no token was found in the header
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token provided',
        });
    }
};

export default protect;