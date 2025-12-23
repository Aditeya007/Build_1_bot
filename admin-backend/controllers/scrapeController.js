const crypto = require('crypto');
const axios = require('axios');
const { runTenantScrape, runTenantUpdater } = require('../jobs/scrapeJob');
const { getUserTenantContext } = require('../services/userContextService');

const buildJobId = (prefix, resourceId) => {
  const random = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
  return `${prefix}_${resourceId || 'tenant'}_${random}`;
};

/**
 * Wait for bot to come back online after restart
 * 
 * @param {Object} tenantContext - Tenant context with botEndpoint
 * @param {number} maxWaitMs - Maximum time to wait (default 30 seconds)
 * @returns {Promise<Object>} Result with success status
 */
const waitForBotRestart = async (tenantContext, maxWaitMs = 30000) => {
  // Use base bot URL, not the tenant-specific endpoint
  const botBaseUrl = process.env.FASTAPI_BOT_URL || 'http://localhost:8000';
  const startTime = Date.now();
  const pollInterval = 2000; // Check every 2 seconds
  
  console.log(`⏳ Waiting for bot to restart and come back online...`);
  
  // Wait a moment for the restart to actually begin
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await axios.get(`${botBaseUrl}/health`, { timeout: 2000 });
      if (response.status === 200) {
        console.log(`✅ Bot is back online! Ready to serve new data.`);
        return { success: true, message: 'Bot restarted successfully' };
      }
    } catch (err) {
      // Bot still restarting, continue waiting
      console.log(`   Bot not ready yet, waiting...`);
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  console.warn(`⚠️  Bot did not come back online within ${maxWaitMs/1000} seconds`);
  return { success: false, error: 'Bot restart timeout' };
};

const truncateLog = (value) => {
  if (!value) {
    return value;
  }
  const maxLength = 8_192;
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n... [truncated ${value.length - maxLength} chars]`;
};

const ensureTenantResources = (tenantContext) => {
  if (!tenantContext.vectorStorePath || !tenantContext.resourceId) {
    const error = new Error('Tenant resources are incomplete. Re-provision before running scrape.');
    error.statusCode = 503;
    throw error;
  }
};

const toBooleanOrUndefined = (value) => {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const parseIntegerOrUndefined = (value) => {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

exports.startScrape = async (req, res) => {
  req.setTimeout(0);
  if (typeof res.setTimeout === 'function') {
    res.setTimeout(0);
  }

  const startUrl = typeof req.body.startUrl === 'string' ? req.body.startUrl.trim() : '';
  const sitemapUrl = typeof req.body.sitemapUrl === 'string' ? req.body.sitemapUrl.trim() : undefined;
  const embeddingModelName = typeof req.body.embeddingModelName === 'string' ? req.body.embeddingModelName.trim() : undefined;
  const collectionName = typeof req.body.collectionName === 'string' ? req.body.collectionName.trim() : undefined;
  const domain = typeof req.body.domain === 'string' ? req.body.domain.trim() : undefined;
  const respectRobots = toBooleanOrUndefined(req.body.respectRobots);
  const aggressiveDiscovery = toBooleanOrUndefined(req.body.aggressiveDiscovery);
  const maxDepth = parseIntegerOrUndefined(req.body.maxDepth);
  const maxLinksPerPage = parseIntegerOrUndefined(req.body.maxLinksPerPage);

  try {
    const userId = req.tenantUserId || req.user.userId;
    const userRole = req.user.role;

    // Regular users can only scrape their own data
    if (userRole === 'user' && req.tenantUserId && req.tenantUserId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You can only scrape your own data'
      });
    }
    const tenantContext = await getUserTenantContext(userId);
    ensureTenantResources(tenantContext);

    console.log('🧭 Starting tenant scrape', {
      tenantUserId: tenantContext.userId,
      resourceId: tenantContext.resourceId,
      databaseUri: tenantContext.databaseUri,
      vectorStorePath: tenantContext.vectorStorePath
    });

    const jobId = buildJobId('scrape', tenantContext.resourceId);
    const scrapeOptions = {
      startUrl,
      sitemapUrl,
      resourceId: tenantContext.resourceId,
      userId: tenantContext.userId,
      vectorStorePath: tenantContext.vectorStorePath,
      collectionName,
      embeddingModelName,
      domain,
      maxDepth,
      maxLinksPerPage,
      respectRobots,
      aggressiveDiscovery,
      jobId,
      logLevel: process.env.SCRAPER_LOG_LEVEL || 'INFO'
    };

    const result = await runTenantScrape(scrapeOptions);

    // Bot restarts automatically after scrape (triggered in scrapeJob.js)
    // Wait for it to come back online
    const restartResult = await waitForBotRestart(tenantContext);

    res.json({
      success: true,
      jobId,
      resourceId: tenantContext.resourceId,
      summary: result.summary,
      stdout: truncateLog(result.stdout),
      stderr: truncateLog(result.stderr),
      botRestarted: restartResult.success
    });
  } catch (err) {
    console.error('❌ Scrape job failed:', {
      userId: req.tenantUserId || req.user.userId,
      error: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message,
      code: err.code,
      summary: err.summary || null
    });
  }
};

exports.runUpdater = async (req, res) => {
  req.setTimeout(0);
  if (typeof res.setTimeout === 'function') {
    res.setTimeout(0);
  }

  const startUrl = typeof req.body.startUrl === 'string' ? req.body.startUrl.trim() : '';
  const sitemapUrl = typeof req.body.sitemapUrl === 'string' ? req.body.sitemapUrl.trim() : undefined;
  const embeddingModelName = typeof req.body.embeddingModelName === 'string' ? req.body.embeddingModelName.trim() : undefined;
  const collectionName = typeof req.body.collectionName === 'string' ? req.body.collectionName.trim() : undefined;
  const domain = typeof req.body.domain === 'string' ? req.body.domain.trim() : undefined;
  const mongoUriOverride = typeof req.body.mongoUri === 'string' ? req.body.mongoUri.trim() : undefined;
  const respectRobots = toBooleanOrUndefined(req.body.respectRobots);
  const aggressiveDiscovery = toBooleanOrUndefined(req.body.aggressiveDiscovery);
  const maxDepth = parseIntegerOrUndefined(req.body.maxDepth);
  const maxLinksPerPage = parseIntegerOrUndefined(req.body.maxLinksPerPage);

  try {
    const userId = req.tenantUserId || req.user.userId;
    const userRole = req.user.role;

    // Regular users can only update their own data
    if (userRole === 'user' && req.tenantUserId && req.tenantUserId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You can only update your own data'
      });
    }
    const tenantContext = await getUserTenantContext(userId);
    ensureTenantResources(tenantContext);

    const effectiveMongoUri = mongoUriOverride || tenantContext.databaseUri;

    console.log('🧭 Starting tenant updater', {
      tenantUserId: tenantContext.userId,
      resourceId: tenantContext.resourceId,
      databaseUri: effectiveMongoUri,
      vectorStorePath: tenantContext.vectorStorePath
    });

    const jobId = buildJobId('update', tenantContext.resourceId);
    const updaterOptions = {
      startUrl,
      sitemapUrl,
      resourceId: tenantContext.resourceId,
      userId: tenantContext.userId,
      vectorStorePath: tenantContext.vectorStorePath,
      collectionName,
      embeddingModelName,
      domain,
      maxDepth,
      maxLinksPerPage,
      respectRobots,
      aggressiveDiscovery,
      mongoUri: effectiveMongoUri,
      jobId,
      logLevel: process.env.UPDATER_LOG_LEVEL || 'INFO'
    };

    const result = await runTenantUpdater(updaterOptions);

    // Bot restarts automatically after update (triggered in scrapeJob.js)
    // Wait for it to come back online
    const restartResult = await waitForBotRestart(tenantContext);

    res.json({
      success: true,
      jobId,
      resourceId: tenantContext.resourceId,
      summary: result.summary,
      stdout: truncateLog(result.stdout),
      stderr: truncateLog(result.stderr),
      botRestarted: restartResult.success
    });
  } catch (err) {
    console.error('❌ Updater job failed:', {
      userId: req.tenantUserId || req.user.userId,
      error: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message,
      code: err.code,
      summary: err.summary || null
    });
  }
};
