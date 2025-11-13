# RAG Chatbot - Production Deployment Guide

## Overview

This guide covers deploying your RAG Chatbot from localhost development environment to a live production server. All code changes have been made to support both environments automatically.

---

## What Changed

### Code Modifications (Actual Changes Made)

1. **`.env` File** - Single unified configuration file with clear sections for all environments
2. **`admin-frontend/src/config.js`** - Auto-detects production vs development based on hostname
3. **`BOT/app_20.py`** - Automatically switches between development/production mode based on NODE_ENV

### New Files Created

1. **`deployment/nginx.conf`** - Nginx reverse proxy configuration
2. **`deployment/rag-bot.service`** - Systemd service for FastAPI bot
3. **`deployment/deploy.sh`** - Automated deployment script

---

## Prerequisites

### Server Requirements
- Ubuntu 20.04+ or Debian-based Linux
- 4GB+ RAM (8GB recommended)
- 20GB+ disk space
- Root or sudo access

### Software Requirements
- Node.js 16+ and npm
- Python 3.8+
- MongoDB 4.4+ (local or MongoDB Atlas)
- Nginx
- PM2 (for Node.js process management)
- Certbot (for SSL/HTTPS)

### Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python and pip
sudo apt install -y python3 python3-pip python3-venv

# Install MongoDB (if hosting locally)
# Follow: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

---

## Deployment Steps

### Step 1: Prepare Your Code

Upload your project to the server at `/var/www/rag-chatbot`

```bash
# On your local machine, from project root
rsync -avz --exclude 'node_modules' --exclude '__pycache__' --exclude 'FENV' \
  ./ user@your-server:/var/www/rag-chatbot/
```

Or use Git:

```bash
# On server
sudo mkdir -p /var/www/rag-chatbot
sudo chown $USER:$USER /var/www/rag-chatbot
cd /var/www/rag-chatbot
git clone https://github.com/yourusername/yourrepo.git .
```

### Step 2: Configure Environment Variables

Edit the single `.env` file in the project root:

```bash
cd /var/www/rag-chatbot
nano .env
```

**Update these critical values:**

```bash
# Set environment to production
NODE_ENV=production

# MongoDB - Update to your production database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
# OR for self-hosted MongoDB:
MONGODB_URI=mongodb://localhost:27017

# Generate NEW secrets (IMPORTANT!)
# Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=YOUR_NEW_GENERATED_SECRET_HERE
FASTAPI_SHARED_SECRET=YOUR_NEW_GENERATED_SECRET_HERE

# Get new Google API key with restrictions
# https://console.cloud.google.com/apis/credentials
GOOGLE_API_KEY=YOUR_NEW_GOOGLE_API_KEY

# Update URLs to your domain
FASTAPI_BOT_URL=https://yourdomain.com/bot
DEFAULT_BOT_BASE_URL=https://yourdomain.com/bot
CORS_ORIGIN=https://yourdomain.com

# Update MongoDB URIs
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/rag_chatbot
UPDATER_MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DEFAULT_DATABASE_URI_BASE=mongodb+srv://username:password@cluster.mongodb.net/
```

**Save and exit** (Ctrl+X, then Y, then Enter)

### Step 3: Build Frontend

```bash
cd /var/www/rag-chatbot/admin-frontend
npm install
npm run build
```

The build creates optimized production files in `admin-frontend/build/`

### Step 4: Deploy Backend Services

Make deployment script executable and run it:

```bash
cd /var/www/rag-chatbot
chmod +x deployment/deploy.sh
sudo ./deployment/deploy.sh
```

This script will:
- Install Node.js backend dependencies
- Start backend with PM2
- Create Python virtual environment
- Install Python dependencies
- Start FastAPI bot as a systemd service

### Step 5: Configure Nginx

Edit the Nginx configuration to replace `yourdomain.com` with your actual domain:

```bash
sudo nano /var/www/rag-chatbot/deployment/nginx.conf
```

Replace all instances of `yourdomain.com` with your domain, then:

```bash
# Copy to Nginx sites-available
sudo cp /var/www/rag-chatbot/deployment/nginx.conf /etc/nginx/sites-available/rag-chatbot

# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/rag-chatbot /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 6: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH

# Block direct access to backend services
sudo ufw deny 5000/tcp
sudo ufw deny 8000/tcp
sudo ufw deny 27017/tcp

# Enable firewall
sudo ufw enable
```

### Step 7: Setup SSL/HTTPS (Required for Production)

```bash
# Obtain SSL certificate from Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured automatically by certbot
# Test renewal:
sudo certbot renew --dry-run
```

After SSL is configured, edit the Nginx config to enable HTTPS:

```bash
sudo nano /etc/nginx/sites-available/rag-chatbot
# Uncomment the HTTPS server block and update paths
sudo nginx -t
sudo systemctl reload nginx
```

---

## Verify Deployment

### Check Services Status

```bash
# Check Node.js backend
pm2 status
pm2 logs rag-backend

# Check FastAPI bot
sudo systemctl status rag-bot
sudo journalctl -u rag-bot -n 50

# Check Nginx
sudo systemctl status nginx
```

### Test Endpoints

```bash
# Test frontend
curl https://yourdomain.com

# Test backend health
curl https://yourdomain.com/api/health

# Test bot health
curl https://yourdomain.com/bot/health
```

### Access in Browser

- **Frontend**: https://yourdomain.com
- **Admin Dashboard**: https://yourdomain.com (login with your credentials)

---

## Widget Embedding

After deployment, embed the widget on any website:

```html
<!-- Add before closing </body> tag -->
<script src="https://yourdomain.com/ragChatWidget.js"></script>
<script>
  window.RAGWidget.init({
    apiBase: "https://yourdomain.com/api",
    userId: "unique-user-id",
    authToken: "your-api-token"
  });
</script>
```

---

## Managing Services

### Backend (Node.js with PM2)

```bash
# View logs
pm2 logs rag-backend

# Restart
pm2 restart rag-backend

# Stop
pm2 stop rag-backend

# Auto-start on server reboot
pm2 startup
pm2 save
```

### Bot (FastAPI with Systemd)

```bash
# View logs
sudo journalctl -u rag-bot -f

# Restart
sudo systemctl restart rag-bot

# Stop
sudo systemctl stop rag-bot

# Start
sudo systemctl start rag-bot

# Disable auto-start
sudo systemctl disable rag-bot
```

### Nginx

```bash
# Test configuration
sudo nginx -t

# Reload (graceful restart)
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# View error logs
sudo tail -f /var/log/nginx/error.log
```

---

## Updating Your Application

### Update Code

```bash
cd /var/www/rag-chatbot

# Pull latest changes
git pull

# Update backend dependencies
cd admin-backend
npm install

# Rebuild frontend
cd ../admin-frontend
npm install
npm run build

# Update Python dependencies
cd ..
source venv/bin/activate
pip install -r requirements.txt

# Restart services
pm2 restart rag-backend
sudo systemctl restart rag-bot
```

---

## MongoDB Configuration

### Using MongoDB Atlas (Recommended)

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Create database user
4. Whitelist your server IP
5. Get connection string and update `.env`

### Using Self-Hosted MongoDB

```bash
# Install MongoDB
sudo apt install -y mongodb-server

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Secure MongoDB
sudo mongo
> use admin
> db.createUser({
    user: "admin",
    pwd: "your-secure-password",
    roles: ["root"]
  })
> exit

# Enable authentication
sudo nano /etc/mongodb.conf
# Add: security.authorization: enabled

# Restart MongoDB
sudo systemctl restart mongodb
```

Update `.env`:
```bash
MONGODB_URI=mongodb://admin:your-secure-password@localhost:27017/admin
```

---

## Security Best Practices

### 1. Environment Variables
- ✅ Generate new `JWT_SECRET` for production
- ✅ Generate new `FASTAPI_SHARED_SECRET` for production  
- ✅ Get new `GOOGLE_API_KEY` with domain restrictions
- ✅ Never commit `.env` to version control

### 2. MongoDB Security
- ✅ Enable authentication
- ✅ Use strong passwords
- ✅ Configure IP whitelist
- ✅ Use SSL/TLS connections

### 3. API Security
- ✅ Update `CORS_ORIGIN` to your specific domain (remove `*`)
- ✅ Rate limiting is already configured
- ✅ Service-to-service authentication enabled

### 4. Server Security
- ✅ Configure firewall (ufw)
- ✅ Regular security updates: `sudo apt update && sudo apt upgrade`
- ✅ Use SSH keys instead of passwords
- ✅ Configure fail2ban for SSH protection

### 5. HTTPS/SSL
- ✅ Always use HTTPS in production
- ✅ Auto-renewal configured with certbot
- ✅ Redirect HTTP to HTTPS

---

## Monitoring and Logs

### Application Logs

```bash
# Backend logs
pm2 logs rag-backend --lines 100

# Bot logs
sudo journalctl -u rag-bot -n 100 -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### System Monitoring

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Check running processes
ps aux | grep -E 'node|python|nginx'
```

### Setup Log Rotation

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/rag-chatbot
```

Add:
```
/var/log/rag-bot/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

---

## Troubleshooting

### Frontend Shows "Cannot connect to server"

**Check:**
1. Backend is running: `pm2 status`
2. Nginx configuration is correct: `sudo nginx -t`
3. Firewall allows traffic: `sudo ufw status`
4. Browser console for errors

**Solution:**
```bash
pm2 restart rag-backend
sudo systemctl reload nginx
```

### Bot Returns "Service Unavailable"

**Check:**
1. Bot service is running: `sudo systemctl status rag-bot`
2. MongoDB connection: Check `.env` values
3. Logs: `sudo journalctl -u rag-bot -n 50`

**Solution:**
```bash
# Check MongoDB connectivity
cd /var/www/rag-chatbot/BOT
source ../venv/bin/activate
python -c "from pymongo import MongoClient; client = MongoClient('YOUR_MONGODB_URI'); print(client.server_info())"

# Restart bot
sudo systemctl restart rag-bot
```

### MongoDB Connection Failed

**Check:**
1. MongoDB is running: `sudo systemctl status mongodb` (if self-hosted)
2. Connection string format is correct
3. IP is whitelisted (if using Atlas)
4. Credentials are correct

### SSL Certificate Issues

**Renew certificate:**
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### High CPU/Memory Usage

**Check:**
1. Number of workers (reduce if needed)
2. Memory leaks in logs
3. Database queries optimization

**Solution:**
```bash
# Reduce Gunicorn workers
sudo nano /etc/systemd/system/rag-bot.service
# Change -w 4 to -w 2
sudo systemctl daemon-reload
sudo systemctl restart rag-bot
```

---

## Backup and Recovery

### Database Backup (MongoDB)

```bash
# Create backup script
sudo nano /usr/local/bin/backup-rag-mongodb.sh
```

Add:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/rag-chatbot"
mkdir -p $BACKUP_DIR

mongodump --uri="YOUR_MONGODB_URI" --out="$BACKUP_DIR/backup_$DATE"

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
```

```bash
chmod +x /usr/local/bin/backup-rag-mongodb.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-rag-mongodb.sh
```

### Restore from Backup

```bash
mongorestore --uri="YOUR_MONGODB_URI" /var/backups/rag-chatbot/backup_YYYYMMDD_HHMMSS
```

---

## Performance Optimization

### 1. Nginx Caching

Add to Nginx config:
```nginx
# In http block
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m;

# In location block
proxy_cache api_cache;
proxy_cache_valid 200 5m;
```

### 2. Gunicorn Workers

Adjust workers based on CPU cores:
```bash
# Rule: (2 x CPU cores) + 1
# For 4 cores: -w 9
sudo nano /etc/systemd/system/rag-bot.service
sudo systemctl daemon-reload
sudo systemctl restart rag-bot
```

### 3. Database Indexing

Ensure MongoDB indexes are created (already done in code):
- `session_id` (unique)
- `created_at`

---

## Scaling Considerations

### Horizontal Scaling

For high traffic:
1. Use load balancer (Nginx, HAProxy)
2. Multiple backend instances
3. MongoDB replica set
4. Redis for session management

### Vertical Scaling

Upgrade server resources:
- More RAM for vector store caching
- More CPU for faster embeddings
- SSD storage for better I/O

---

## Cost Optimization

### Free Tier Options
- **MongoDB Atlas**: 512MB free tier
- **Let's Encrypt**: Free SSL certificates
- **Nginx**: Free and open-source

### Cloud Providers
- **DigitalOcean**: $6/month droplet
- **Linode**: $5/month VPS
- **AWS**: Free tier eligible
- **Google Cloud**: $300 free credits

---

## Support and Resources

### Documentation
- FastAPI: https://fastapi.tiangolo.com
- React: https://reactjs.org/docs
- Nginx: https://nginx.org/en/docs
- MongoDB: https://docs.mongodb.com

### Community
- GitHub Issues: Report bugs and feature requests
- Stack Overflow: Technical questions

---

## Summary Checklist

Before going live:

- [ ] Update `.env` with production values
- [ ] Set `NODE_ENV=production`
- [ ] Generate new JWT_SECRET
- [ ] Generate new FASTAPI_SHARED_SECRET
- [ ] Get new Google API key with restrictions
- [ ] Update MongoDB URI to production database
- [ ] Update CORS_ORIGIN to your domain
- [ ] Build frontend with `npm run build`
- [ ] Run deployment script
- [ ] Configure Nginx with your domain
- [ ] Setup SSL with certbot
- [ ] Configure firewall
- [ ] Test all endpoints
- [ ] Setup monitoring and logs
- [ ] Configure database backups
- [ ] Test widget embedding

---

## Conclusion

Your RAG Chatbot is now deployed to production! The application automatically detects the environment and adjusts behavior accordingly. All functionality remains the same as in development.

For issues or questions, check the logs first:
- Backend: `pm2 logs rag-backend`
- Bot: `sudo journalctl -u rag-bot -f`
- Nginx: `sudo tail -f /var/log/nginx/error.log`

Good luck with your deployment! 🚀
