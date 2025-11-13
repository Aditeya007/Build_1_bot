#!/usr/bin/env node

/**
 * Environment Validation Script
 * Validates .env configuration before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('\n==============================================');
console.log('RAG Chatbot - Environment Validation');
console.log('==============================================\n');

// Load .env file
const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
    console.error('❌ ERROR: .env file not found!');
    console.error('   Expected location:', envPath);
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

// Parse .env file
envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
        }
    }
});

console.log('✅ Found .env file\n');

// Required variables
const required = [
    'NODE_ENV',
    'MONGODB_URI',
    'MONGODB_DATABASE',
    'JWT_SECRET',
    'FASTAPI_SHARED_SECRET',
    'GOOGLE_API_KEY',
    'FASTAPI_BOT_URL',
    'CORS_ORIGIN'
];

let hasErrors = false;
let hasWarnings = false;

console.log('Checking required variables:\n');

required.forEach(key => {
    if (!envVars[key] || envVars[key].trim() === '') {
        console.error(`❌ ERROR: ${key} is missing or empty`);
        hasErrors = true;
    } else {
        console.log(`✅ ${key}: Set`);
    }
});

console.log('\n==============================================');
console.log('Production Readiness Checks:');
console.log('==============================================\n');

// Check NODE_ENV
const nodeEnv = envVars['NODE_ENV'];
if (nodeEnv === 'production') {
    console.log('✅ NODE_ENV: production');
} else if (nodeEnv === 'development') {
    console.log('⚠️  NODE_ENV: development (Change to "production" for deployment)');
    hasWarnings = true;
} else {
    console.log(`❌ NODE_ENV: Invalid value "${nodeEnv}"`);
    hasErrors = true;
}

// Check MongoDB URI
const mongoUri = envVars['MONGODB_URI'];
if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
    if (nodeEnv === 'production') {
        console.log('⚠️  WARNING: MongoDB URI points to localhost in production mode');
        hasWarnings = true;
    } else {
        console.log('✅ MongoDB URI: localhost (OK for development)');
    }
} else {
    console.log('✅ MongoDB URI: Remote server configured');
}

// Check secrets
const defaultSecrets = [
    '23a622a0c4e1a9cff7128491814c701ced7b196ea21374c2d5524ad6851f7115',
    '4aad0a02cede5ce53c442ce666fb60acd5d58d4f8392c536bde1d3310ce573fe'
];

const jwtSecret = envVars['JWT_SECRET'];
const fastapiSecret = envVars['FASTAPI_SHARED_SECRET'];

if (defaultSecrets.includes(jwtSecret)) {
    console.log('❌ ERROR: JWT_SECRET is using default development value!');
    console.log('   Generate new: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    hasErrors = true;
} else {
    console.log('✅ JWT_SECRET: Custom value set');
}

if (defaultSecrets.includes(fastapiSecret)) {
    console.log('❌ ERROR: FASTAPI_SHARED_SECRET is using default development value!');
    console.log('   Generate new: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    hasErrors = true;
} else {
    console.log('✅ FASTAPI_SHARED_SECRET: Custom value set');
}

// Check Google API Key
const googleApiKey = envVars['GOOGLE_API_KEY'];
const exposedKey = 'AIzaSyCcA5Rnd5WaeAiwxcQCgFZ80lWKeOYq1Eo';
if (googleApiKey === exposedKey) {
    console.log('❌ ERROR: GOOGLE_API_KEY is using exposed development key!');
    console.log('   Get new key: https://console.cloud.google.com/apis/credentials');
    hasErrors = true;
} else {
    console.log('✅ GOOGLE_API_KEY: Custom value set');
}

// Check URLs
const botUrl = envVars['FASTAPI_BOT_URL'];
const corsOrigin = envVars['CORS_ORIGIN'];

if (nodeEnv === 'production') {
    if (botUrl.includes('localhost')) {
        console.log('⚠️  WARNING: FASTAPI_BOT_URL points to localhost in production');
        hasWarnings = true;
    }
    
    if (corsOrigin.includes('localhost')) {
        console.log('⚠️  WARNING: CORS_ORIGIN points to localhost in production');
        hasWarnings = true;
    }
    
    if (corsOrigin === '*') {
        console.log('⚠️  WARNING: CORS_ORIGIN is set to wildcard (*) - Security risk!');
        hasWarnings = true;
    }
    
    if (!botUrl.startsWith('https://') && !botUrl.includes('localhost')) {
        console.log('⚠️  WARNING: FASTAPI_BOT_URL should use HTTPS in production');
        hasWarnings = true;
    }
}

console.log('\n==============================================');
console.log('Summary:');
console.log('==============================================\n');

if (hasErrors) {
    console.error('❌ VALIDATION FAILED - Please fix errors above before deploying');
    process.exit(1);
} else if (hasWarnings) {
    console.warn('⚠️  VALIDATION PASSED WITH WARNINGS');
    console.warn('   Review warnings above before production deployment\n');
    process.exit(0);
} else {
    console.log('✅ ALL CHECKS PASSED - Ready for deployment!\n');
    process.exit(0);
}
