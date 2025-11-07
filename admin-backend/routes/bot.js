const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const widgetAuth = require('../middleware/widgetAuth');
const resolveTenant = require('../middleware/resolveTenant');
const botController = require('../controllers/botController');
const { validateBotRun } = require('../middleware/validate');
const { botLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /api/bot/run
 * @desc    Run the RAG bot with user's query
 * @access  Protected (requires JWT or API token for widgets)
 * @body    { input: string }
 * @returns { answer: string } - The bot's response
 * @security Rate limited to prevent API abuse
 */
router.post('/run', widgetAuth, resolveTenant, botLimiter, validateBotRun, botController.runBot);

module.exports = router;
