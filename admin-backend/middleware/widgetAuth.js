// admin-backend/middleware/widgetAuth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Widget authentication middleware
 * Accepts either JWT tokens (Bearer <jwt>) or API tokens (Bearer <apiToken>)
 * For widget requests, API tokens are preferred for security
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const widgetAuth = async (req, res, next) => {
  try {
    // Extract token from 'Authorization: Bearer <token>' header
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'No authorization header provided',
        message: 'Please provide a valid authentication token',
        widgetError: true
      });
    }
    
    // Check if header follows 'Bearer <token>' format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ 
        error: 'Invalid authorization header format',
        message: 'Authorization header must be in format: Bearer <token>',
        widgetError: true
      });
    }
    
    const token = parts[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No token provided',
        message: 'Authentication token is missing',
        widgetError: true
      });
    }

    // Try to verify as JWT first
    let isJWT = false;
    let decoded = null;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256']
      });
      isJWT = true;
    } catch (jwtErr) {
      // Not a valid JWT, will try API token next
      isJWT = false;
    }

    if (isJWT && decoded) {
      // Valid JWT - use it
      req.user = decoded;
      req.authType = 'jwt';
      return next();
    }

    // Try to find user by API token
    const user = await User.findByApiToken(token);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Authentication token is invalid or expired',
        widgetError: true
      });
    }

    // Valid API token - attach user info to request
    req.user = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role
    };
    req.authType = 'apiToken';
    
    next();
  } catch (err) {
    console.error('❌ Widget authentication error:', {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Unable to authenticate request',
      widgetError: true
    });
  }
};

module.exports = widgetAuth;
