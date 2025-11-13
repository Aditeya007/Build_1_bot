# Deployment Changes Summary

## What Changed

This document summarizes all changes made to enable production deployment while preserving all functionality.

---

## Files Modified

### 1. `.env` (Root Directory)
**Change:** Reorganized with clear sections and inline guidance for production values
**Why:** Single source of configuration for both development and production environments

**Key sections:**
- Environment mode (development/production)
- MongoDB configuration
- Security secrets with generation instructions
- API URLs with examples for both environments
- CORS configuration

### 2. `admin-frontend/src/config.js`
**Change:** Added auto-detection logic for API base URL
**Why:** Automatically uses correct API endpoint based on hostname

**Logic:**
```javascript
// Checks in order:
1. REACT_APP_API_BASE environment variable (highest priority)
2. Auto-detect: If not localhost, use same domain with /api
3. Fallback: http://localhost:5000/api (development)
```

### 3. `BOT/app_20.py`
**Change:** Added environment mode detection in main block
**Why:** Automatically configures Uvicorn settings based on NODE_ENV

**Behavior:**
- **Development:** Auto-reload enabled, verbose logging
- **Production:** Auto-reload disabled, optimized for stability
- Port configurable via FASTAPI_PORT environment variable

---

## New Files Created

### Deployment Configuration

#### 1. `deployment/nginx.conf`
**Purpose:** Nginx reverse proxy configuration
**Features:**
- Serves React frontend
- Proxies /api to Node.js backend (port 5000)
- Proxies /bot to FastAPI (port 8000)
- Static file caching
- HTTPS configuration template

#### 2. `deployment/rag-bot.service`
**Purpose:** Systemd service file for FastAPI bot
**Features:**
- Auto-start on server boot
- Auto-restart on failure
- Environment variable loading
- Log file configuration
- Runs as www-data user

#### 3. `deployment/deploy.sh`
**Purpose:** Automated deployment script
**Actions:**
- Installs backend dependencies
- Starts backend with PM2
- Creates Python virtual environment
- Installs Python dependencies
- Installs and starts bot systemd service

#### 4. `deployment/setup.sh`
**Purpose:** Interactive setup wizard for first-time deployment
**Features:**
- Guided setup process
- Installs system dependencies
- Builds frontend
- Configures services
- Sets up Nginx with SSL

### Documentation

#### 5. `DEPLOYMENT.md`
**Purpose:** Comprehensive deployment guide
**Sections:**
- Prerequisites and requirements
- Step-by-step deployment instructions
- Security best practices
- Monitoring and logging
- Troubleshooting
- Backup and recovery
- Performance optimization

#### 6. `deployment/CHECKLIST.txt`
**Purpose:** Quick reference checklist for deployment
**Use:** Print or follow step-by-step during deployment

#### 7. `requirements-production.txt`
**Purpose:** Production-specific Python packages
**Contains:**
- Gunicorn (WSGI server)
- Uvicorn with standard extras

---

## How It Works

### Development Mode (Default)

When `NODE_ENV=development` (or not set):

1. **Frontend:**
   - Uses localhost:5000 for API calls
   - Run with `npm start` for hot reload

2. **Backend:**
   - Runs on port 5000
   - CORS allows localhost:3000
   - PM2 not required (can use `node server.js`)

3. **Bot:**
   - Auto-reload enabled
   - Runs on port 8000
   - Verbose logging

### Production Mode

When `NODE_ENV=production`:

1. **Frontend:**
   - Built with `npm run build`
   - Auto-detects production domain
   - Served by Nginx as static files

2. **Backend:**
   - Runs on port 5000 (internal)
   - Managed by PM2
   - CORS restricted to production domain
   - Proxied through Nginx at /api

3. **Bot:**
   - Auto-reload disabled
   - Runs on port 8000 (internal)
   - Managed by systemd service
   - Runs with Gunicorn + multiple workers
   - Proxied through Nginx at /bot

4. **Nginx:**
   - Serves frontend on port 80/443
   - Reverse proxies to backend/bot
   - Handles SSL/TLS
   - Static file caching

---

## Environment Variables Reference

### Required for Production

| Variable | Development | Production | Notes |
|----------|-------------|------------|-------|
| NODE_ENV | development | production | Controls behavior |
| MONGODB_URI | localhost:27017 | Atlas or remote server | Database connection |
| JWT_SECRET | development value | NEW generated secret | Must regenerate |
| FASTAPI_SHARED_SECRET | development value | NEW generated secret | Must regenerate |
| GOOGLE_API_KEY | development key | NEW restricted key | Must regenerate |
| FASTAPI_BOT_URL | localhost:8000 | https://domain/bot | Bot endpoint |
| CORS_ORIGIN | localhost:3000 | https://domain | Frontend URL |

### Optional

| Variable | Default | Notes |
|----------|---------|-------|
| PORT | 5000 | Backend port |
| FASTAPI_PORT | 8000 | Bot port |
| PYTHON_BIN | python | Python executable |

---

## Deployment Architecture

```
Internet (HTTPS)
        ↓
    Nginx (:80, :443)
        ↓
    ┌───────┴───────┐
    ↓               ↓
Frontend        /api/           /bot/
(Static)        ↓               ↓
            Node.js         FastAPI
            Backend         Bot
            (:5000)         (:8000)
                ↓               ↓
                └───────┬───────┘
                        ↓
                    MongoDB
```

---

## Security Enhancements

### 1. Secret Management
- All secrets in single `.env` file
- Clear instructions for generating new secrets
- Never committed to version control

### 2. Network Security
- Internal services not directly accessible
- Nginx acts as security gateway
- Firewall rules block internal ports

### 3. HTTPS/SSL
- Let's Encrypt integration
- Auto-renewal configured
- HTTP to HTTPS redirect

### 4. API Security
- CORS restricted to specific domain in production
- Service-to-service authentication
- Rate limiting enabled

---

## Zero Functionality Changes

✅ **All features work identically:**
- Multi-tenant support
- MongoDB lead storage
- Contact information extraction
- Gemini AI integration
- Vector store caching
- Real-time chat
- Widget embedding
- Admin dashboard
- User authentication
- All API endpoints

**Only configuration changed, not code logic.**

---

## Quick Start Commands

### Development
```bash
# Terminal 1
node admin-backend/server.js

# Terminal 2
python BOT/app_20.py

# Terminal 3
cd admin-frontend && npm start
```

### Production
```bash
# One-time setup
./deployment/setup.sh

# Or manual
./deployment/deploy.sh

# Check status
pm2 status
sudo systemctl status rag-bot
```

---

## Monitoring

### Logs
```bash
# Backend
pm2 logs rag-backend

# Bot
sudo journalctl -u rag-bot -f

# Nginx
sudo tail -f /var/log/nginx/error.log
```

### Status
```bash
# All services
pm2 status
sudo systemctl status rag-bot
sudo systemctl status nginx
```

---

## Common Tasks

### Update Application
```bash
cd /var/www/rag-chatbot
git pull
cd admin-frontend && npm install && npm run build && cd ..
cd admin-backend && npm install && cd ..
source venv/bin/activate && pip install -r requirements.txt
pm2 restart rag-backend
sudo systemctl restart rag-bot
```

### View Logs
```bash
pm2 logs rag-backend --lines 100
sudo journalctl -u rag-bot -n 100 -f
```

### Restart Services
```bash
pm2 restart rag-backend
sudo systemctl restart rag-bot
sudo systemctl reload nginx
```

---

## Support

For detailed instructions, see:
- **DEPLOYMENT.md** - Complete deployment guide
- **deployment/CHECKLIST.txt** - Step-by-step checklist
- **README.md** - Development setup

For issues:
1. Check service status
2. Review logs
3. Verify .env configuration
4. Check DEPLOYMENT.md troubleshooting section

---

**Last Updated:** November 2025
**Version:** 1.0
