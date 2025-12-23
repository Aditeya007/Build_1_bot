const path = require('path');
const axios = require('axios'); // Requires axios
const { runPythonJob } = require('./pythonJob');

const repoRoot = path.resolve(__dirname, '..', '..');
const scraperScriptPath = path.resolve(repoRoot, 'Scraping2', 'run_tenant_spider.py');
const updaterScriptPath = path.resolve(repoRoot, 'UPDATER', 'run_tenant_updater.py');

// --- HELPER: Trigger Bot Restart ---
const triggerBotRestart = async (resourceId) => {
  try {
    const botUrl = process.env.FASTAPI_BOT_URL || 'http://localhost:8000';
    const secret = process.env.FASTAPI_SHARED_SECRET;
    
    // Skip if secret is not configured at all
    if (!secret) {
      console.log(`⚠️ [${resourceId}] Skipping bot restart - FASTAPI_SHARED_SECRET not set`);
      return;
    }

    console.log(`🔄 [${resourceId}] Triggering bot hard restart to force data reload...`);
    
    // Call the nuclear restart endpoint
    await axios.post(`${botUrl}/system/restart`, {}, {
      headers: { 'x-service-secret': secret },
      timeout: 5000 // Give it 5 seconds
    }).catch(err => {
      // Ignore "Network Error" or "Socket Hang Up" - that means it worked (server died)
      if (err.code === 'ECONNRESET' || 
          err.code === 'ECONNABORTED' || 
          err.message.includes('socket hang up') ||
          err.message.includes('Network Error')) {
        console.log(`✅ [${resourceId}] Bot restart confirmed (connection terminated as expected)`);
        return;
      }
      throw err;
    });
    
    console.log(`✅ [${resourceId}] Bot restart signal sent successfully`);
  } catch (err) {
    // Log but don't fail the scrape job
    console.warn(`⚠️ [${resourceId}] Failed to trigger bot restart: ${err.message}`);
  }
};

const buildArgs = (options = {}) => {
  const args = [];

  const push = (flag, value) => {
    if (typeof value === 'undefined' || value === null) return;
    if (typeof value === 'boolean') {
      if (value) args.push(flag);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => push(flag, entry));
      return;
    }
    args.push(flag, String(value));
  };

  push('--start-url', options.startUrl);
  push('--domain', options.domain);
  push('--resource-id', options.resourceId);
  push('--user-id', options.userId);
  push('--vector-store-path', options.vectorStorePath);
  push('--collection-name', options.collectionName);
  push('--embedding-model-name', options.embeddingModelName);
  push('--mongo-uri', options.mongoUri);
  push('--max-depth', options.maxDepth);
  push('--max-links-per-page', options.maxLinksPerPage);
  push('--sitemap-url', options.sitemapUrl);
  push('--job-id', options.jobId);
  push('--log-level', options.logLevel);

  if (options.respectRobots === true) push('--respect-robots', true);
  else if (options.respectRobots === false) push('--no-respect-robots', true);

  if (options.aggressiveDiscovery === true) push('--aggressive-discovery', true);
  else if (options.aggressiveDiscovery === false) push('--no-aggressive-discovery', true);

  if (options.statsOutput) push('--stats-output', options.statsOutput);

  return args;
};

const runTenantScrape = async (options) => {
  const args = buildArgs(options);
  const result = await runPythonJob({
    scriptPath: scraperScriptPath,
    args,
    cwd: repoRoot,
    logLabel: `scrape:${options.resourceId || 'unknown'}`
  });
  
  // TRIGGER RESTART AFTER SCRAPE (if we got here, scrape succeeded - errors throw)
  await triggerBotRestart(options.resourceId);
  
  return result;
};

const runTenantUpdater = async (options) => {
  const args = buildArgs(options);
  const result = await runPythonJob({
    scriptPath: updaterScriptPath,
    args,
    cwd: repoRoot,
    logLabel: `updater:${options.resourceId || 'unknown'}`
  });
  
  // TRIGGER RESTART AFTER UPDATE (if we got here, update succeeded - errors throw)
  await triggerBotRestart(options.resourceId);
  
  return result;
};

module.exports = {
  runTenantScrape,
  runTenantUpdater
};