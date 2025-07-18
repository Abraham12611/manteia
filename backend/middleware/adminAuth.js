const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Admin credentials (hardcoded as requested)
const ADMIN_CREDENTIALS = {
    username: "Admin",
    password: "Abdaprince124#$"
};

// Generate JWT token for admin
const generateAdminToken = (username) => {
    return jwt.sign(
        { username, role: 'admin' },
        process.env.JWT_SECRET || 'manteia-admin-secret',
        { expiresIn: '24h' }
    );
};

// Admin login function
const adminLogin = (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'MISSING_CREDENTIALS',
                message: 'Username and password are required'
            }
        });
    }

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const token = generateAdminToken(username);

        logger.info('Admin login successful', { username, timestamp: new Date().toISOString() });

        return res.json({
            success: true,
            data: {
                token,
                username,
                role: 'admin',
                expiresIn: '24h'
            },
            timestamp: new Date().toISOString()
        });
    } else {
        logger.warn('Admin login failed', { username, timestamp: new Date().toISOString() });

        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid admin credentials'
            }
        });
    }
};

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'MISSING_TOKEN',
                message: 'Authorization token is required'
            }
        });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'manteia-admin-secret');

        if (decoded.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'Admin role required'
                }
            });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        logger.error('Admin token verification failed:', error);

        return res.status(401).json({
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid or expired token'
            }
        });
    }
};

// Verify admin credentials (for testing)
const verifyAdminCredentials = (username, password) => {
    return username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
};

module.exports = {
    adminLogin,
    authenticateAdmin,
    verifyAdminCredentials,
    generateAdminToken
};