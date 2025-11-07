// admin-backend/routes/user.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');
const { validateProfileUpdate } = require('../middleware/validate');
const { userLimiter } = require('../middleware/rateLimiter');

/**
 * @route   GET /api/user/me
 * @desc    Get current user's profile
 * @access  Protected (requires JWT)
 */
router.get('/me', auth, userLimiter, userController.getMe);

/**
 * @route   PUT /api/user/me
 * @desc    Update current user's profile
 * @access  Protected (requires JWT)
 * @body    { name?, email?, username?, password? }
 */
router.put('/me', auth, userLimiter, validateProfileUpdate, userController.updateMe);

/**
 * @route   GET /api/user/api-token
 * @desc    Get or generate API token for widget authentication
 * @access  Protected (requires JWT)
 * @query   { regenerate?: boolean }
 */
router.get('/api-token', auth, userLimiter, userController.getApiToken);

module.exports = router;
