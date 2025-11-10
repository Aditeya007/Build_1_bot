# 🚀 Simple Deployment Guide - Make Your Chatbot Live

This guide will help you deploy your chatbot to a live server (like DigitalOcean) so it works on any website.

---

## 📋 What You Need

- **A server** (DigitalOcean droplet, AWS EC2, or any Ubuntu server)
- **A domain name** (like `yourcompany.com`)
- **30-60 minutes** of time

---

## 🎯 What We're Doing

**Right now:** Your chatbot only works on `localhost` (your computer)

**After this:** Your chatbot will work on ANY website in the world! 🌍

---

## Part 1: Prepare Your Code (On Your Computer)

### Step 1: Update Environment File

Open the `.env` file in your project root folder and change these lines:

```env
# FROM localhost TO your real domain
NODE_ENV=production
FASTAPI_BOT_URL=https://yourcompany.com/bot
CORS_ORIGIN=https://yourcompany.com
DEFAULT_BOT_BASE_URL=https://yourcompany.com/bot

# Generate NEW secrets for security
# Run this command in terminal TWICE to get 2 different secrets:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

JWT_SECRET=paste_first_secret_here
FASTAPI_SHARED_SECRET=paste_second_secret_here

# Your Google API Key
GOOGLE_API_KEY=your_actual_google_api_key

# Database (can keep localhost if MongoDB is on same server)
MONGODB_URI=mongodb://localhost:27017
MONGO_URI=mongodb://localhost:27017/rag_chatbot_prod
```

### Step 2: Build Your Frontend

Open terminal and run:

```bash
cd admin-frontend

# Create production config file
echo "REACT_APP_API_BASE=https://yourcompany.com/api" > .env.production

# Install and build
npm install
npm run build

# Go back to project root
cd ..
```

This creates an optimized version of your frontend in `admin-frontend/build/` folder.

---

## Part 2: Setup Your Server (DigitalOcean or Similar)

### Step 1: Create a Server

1. Go to **DigitalOcean** (or your hosting provider)
2. Create a new **Droplet** (server):
   - **OS:** Ubuntu 20.04 or 22.04
   - **Plan:** At least 4GB RAM ($24/month recommended)
   - **Region:** Choose closest to your users

3. Point your domain to the server:
   - Go to your domain registrar
   - Add an **A Record**: `yourcompany.com` → Your server's IP address

### Step 2: Connect to Your Server

```bash
# From your terminal
ssh root@your-server-ip
```

### Step 3: Install Required Software

Copy and paste these commands one by one:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python
sudo apt install -y python3 python3-pip python3-venv

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Nginx (web server)
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install SSL certificate tool
sudo apt install -y certbot python3-certbot-nginx
```

---

## Part 3: Upload Your Code

### Option A: Using Git (Recommended)

```bash
# On your server
cd /home
git clone https://github.com/excellis-it/excellis_chatbot.git
cd excellis_chatbot
```

### Option B: Manual Upload

1. On your computer, zip your project folder (exclude `node_modules` and `FENV` folders)
2. Upload using SFTP or SCP:
   ```bash
   scp -r RAG_FINAL-main root@your-server-ip:/home/
   ```
3. On server:
   ```bash
   cd /home/RAG_FINAL-main
   ```

---

## Part 4: Install Dependencies on Server

```bash
# Make sure you're in project folder
cd /home/RAG_FINAL-main  # or wherever you uploaded

# Backend dependencies
cd admin-backend
npm install --production
cd ..

# Python dependencies
python3 -m venv FENV
source FENV/bin/activate
pip install -r requirements.txt
playwright install chromium
deactivate
```

---

## Part 5: Start Your Services

### Create PM2 Configuration

Create a file called `ecosystem.config.js` in your project root:

```bash
nano ecosystem.config.js
```

Paste this content (update the path if your project is in a different location):

```javascript
module.exports = {
  apps: [
    {
      name: 'rag-backend',
      script: 'admin-backend/server.js',
      cwd: '/home/RAG_FINAL-main',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'rag-bot',
      script: 'FENV/bin/python',
      args: 'BOT/app_20.py',
      cwd: '/home/RAG_FINAL-main',
      interpreter: 'none',
      instances: 1,
      autorestart: true
    }
  ]
};
```

Save and exit (press `Ctrl+X`, then `Y`, then `Enter`)

### Start Services with PM2

```bash
# Start both services
pm2 start ecosystem.config.js

# Save configuration
pm2 save

# Make PM2 start on server reboot
pm2 startup
# Copy and run the command it shows
```

### Check if services are running

```bash
pm2 status

# Should show:
# rag-backend  | online
# rag-bot      | online
```

---

## Part 6: Configure Web Server (Nginx)

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/rag-chatbot
```

Paste this (replace `yourcompany.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name yourcompany.com www.yourcompany.com;

    # Increase timeouts for AI processing
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;

    # Serve Frontend
    location / {
        root /home/RAG_FINAL-main/admin-frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # IMPORTANT: Serve Widget with CORS headers
    location /ragChatWidget.js {
        alias /home/RAG_FINAL-main/admin-frontend/public/ragChatWidget.js;
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        default_type application/javascript;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # CORS for widget
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, x-service-secret" always;
    }

    # Bot Service
    location /bot/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_read_timeout 300s;
        
        add_header Access-Control-Allow-Origin * always;
    }
}
```

Save and exit.

### Enable the Configuration

```bash
# Create link to enable site
sudo ln -s /etc/nginx/sites-available/rag-chatbot /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

## Part 7: Get Free SSL Certificate (HTTPS)

```bash
# Run Certbot
sudo certbot --nginx -d yourcompany.com -d www.yourcompany.com

# Follow the prompts:
# 1. Enter your email
# 2. Agree to terms
# 3. Choose option 2 (redirect HTTP to HTTPS)
```

Certbot will automatically configure HTTPS and set up auto-renewal!

---

## Part 8: Test Your Deployment

### Test Health Endpoints

```bash
# Test backend
curl https://yourcompany.com/api/health

# Should return: {"status":"OK",...}

# Test bot
curl https://yourcompany.com/bot/health

# Should return: {"status":"healthy",...}
```

### Test in Browser

1. Visit `https://yourcompany.com`
2. You should see the login page
3. Register a new user account
4. Login and copy your **User ID** and **API Token** from the dashboard

---

## Part 9: Use Your Widget on Any Website

Now you can embed your chatbot on ANY website!

### Widget Code:

```html
<!-- Add this to ANY website -->
<script src="https://yourcompany.com/ragChatWidget.js"></script>
<script>
  window.RAGWidget.init({
    apiBase: "https://yourcompany.com/api",
    userId: "YOUR_USER_ID_FROM_DASHBOARD",
    authToken: "YOUR_API_TOKEN_FROM_DASHBOARD"
  });
</script>
```

### Test It:

1. Create a file called `test-widget.html` on your desktop:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Chatbot Test</title>
</head>
<body>
    <h1>My Website</h1>
    <p>The chatbot should appear in the bottom-right corner.</p>

    <!-- Your chatbot widget -->
    <script src="https://yourcompany.com/ragChatWidget.js"></script>
    <script>
      window.RAGWidget.init({
        apiBase: "https://yourcompany.com/api",
        userId: "paste_your_user_id",
        authToken: "paste_your_token"
      });
    </script>
</body>
</html>
```

2. Open it in your browser
3. The chatbot should appear! 🎉

---

## 🎉 You're Live!

Your chatbot is now:
- ✅ Accessible from anywhere in the world
- ✅ Secured with HTTPS
- ✅ Can be embedded on unlimited websites
- ✅ Automatically restarts if it crashes
- ✅ Professional and production-ready

---

## 📊 Useful Commands

### Check Service Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs
pm2 logs rag-backend  # Backend only
pm2 logs rag-bot      # Bot only
```

### Restart Services
```bash
pm2 restart all
```

### Stop Services
```bash
pm2 stop all
```

### Update Your Code
```bash
cd /home/RAG_FINAL-main
git pull  # If using git
cd admin-frontend && npm run build && cd ..
pm2 restart all
```

---

## 🆘 Troubleshooting

### Widget Not Loading?

**Check browser console** (F12) for errors:
- If you see CORS errors → Check Nginx configuration
- If widget.js not found → Verify path in Nginx config

**Test widget file directly:**
```bash
curl -I https://yourcompany.com/ragChatWidget.js
```
Should show: `Access-Control-Allow-Origin: *`

### Services Not Starting?

```bash
# Check PM2 logs for errors
pm2 logs

# Check if MongoDB is running
sudo systemctl status mongod

# Restart MongoDB if needed
sudo systemctl restart mongod
```

### Can't Access Website?

```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues?

```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

---

## 💰 Cost Summary

**Minimum Setup:**
- DigitalOcean Droplet (4GB RAM): **$24/month**
- Domain name: **$10-15/year**
- SSL Certificate: **FREE** (Let's Encrypt)

**Total: About $25-30/month**

---

## 🎓 What You Learned

1. ✅ How to prepare code for production
2. ✅ How to set up a cloud server
3. ✅ How to configure a web server (Nginx)
4. ✅ How to manage services with PM2
5. ✅ How to get free SSL certificates
6. ✅ How to make a widget work globally

---

## 📞 Need Help?

- **Services not starting?** Check `pm2 logs`
- **Website not loading?** Check `sudo nginx -t`
- **MongoDB issues?** Check `sudo systemctl status mongod`
- **SSL problems?** Run `sudo certbot renew`

---

## 🚀 Next Steps

1. **Configure scraping** for your target websites
2. **Add more users** through the dashboard
3. **Embed widget** on client websites
4. **Monitor** with `pm2 monit`
5. **Set up backups** for MongoDB

---

**Congratulations! Your chatbot is now live and ready to be embedded on websites worldwide! 🌍✨**
