// src/config.js

// Determine base URL based on environment
const getApiBaseUrl = () => {
  // Check for explicit environment variable first
  if (process.env.REACT_APP_API_BASE) {
    return process.env.REACT_APP_API_BASE;
  }
  
  // Auto-detect based on hostname for production deployment
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Production: use same domain with /api path
    return `${window.location.protocol}//${window.location.hostname}/api`;
  }
  
  // Development fallback
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getApiBaseUrl();

// If you want to centralize endpoints, add them here:
export const ENDPOINTS = {
  login: '/auth/login',
  register: '/auth/register',
  userMe: '/user/me',
  health: '/health',
  runBot: '/bot/run',
  // Add more as you go
};
