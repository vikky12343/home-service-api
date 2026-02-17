# Deploy to Render - Step by Step Guide

## Prerequisites
- GitHub account (free)
- Render account (free with $7/month credit)
- Your code pushed to GitHub

---

## Step 1: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit - production ready"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/home-service-api.git
git push -u origin main
```

**Note:** If you don't have Git installed, download from [git-scm.com](https://git-scm.com)

---

## Step 2: Create Render Account & Connect GitHub

1. Go to [render.com](https://render.com)
2. Click **"Sign Up"** → Choose **GitHub** sign-up
3. Authorize Render to access your GitHub repositories
4. Click **"Create New"** → Select **"Web Service"**

---

## Step 3: Configure Web Service on Render

### **Basic Settings**
| Field | Value |
|-------|-------|
| **Repository** | home-service-api |
| **Branch** | main |
| **Name** | home-service-api |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

### **Advanced Settings**
- **Instance Type:** Free
- **Auto-deploy:** Yes

---

## Step 4: Add Environment Variables

In Render dashboard:
1. Go to your service → **"Environment"**
2. Add these variables:

```
PORT=5000
NODE_ENV=production
DATABASE_URL=mongodb+srv://kumarvikky0811999_db_user:iFVSBMrRIl2lAWSM@cluster0.0rqpfb4.mongodb.net/?appName=Cluster0
JWT_SECRET=your_jwt_secret_key_change_this_in_production_minimum_32_chars_long_key_12345abcdef
REFRESH_TOKEN_SECRET=your_refresh_token_secret_key_minimum_32_chars_long_key_12345abcdef
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
SMTP_SERVICE=gmail
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

**⚠️ IMPORTANT:** Replace with your actual secrets!

---

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will automatically start deploying
3. Watch the logs in the **"Logs"** tab
4. Wait for ✅ "Your service is live"

---

## Step 6: Verify Deployment

Once deployed, you'll get a URL like:
```
https://home-service-api-xxxxx.onrender.com
```

Test your API:
```bash
# Health check
curl https://home-service-api-xxxxx.onrender.com/api/health

# Or in PowerShell:
Invoke-WebRequest -Uri "https://home-service-api-xxxxx.onrender.com/api/health"
```

---

## Step 7: Configure Webhooks (For Payment Processing)

In Razorpay Dashboard:
1. Go to **Settings** → **Webhooks**
2. Add webhook URL:
   ```
   https://your-render-url.onrender.com/api/webhooks/razorpay
   ```
3. Select events: `payment.authorized`, `payment.captured`, `payment.failed`, `refund.created`, `refund.failed`
4. Copy the **Webhook Secret** and update in Render environment variables

---

## Troubleshooting

### **Deployment Fails**
- Check logs in Render dashboard
- Ensure `package.json` has `"start"` script
- Verify all environment variables are set

### **MongoDB Connection Error**
- Verify `DATABASE_URL` is correct
- Check MongoDB Atlas whitelist: Add `0.0.0.0/0` (allow all IPs)
  - Go to MongoDB Atlas → Network Access → Add IP Address

### **JWT Secret Error**
- Ensure `JWT_SECRET` is at least 32 characters
- Same for `REFRESH_TOKEN_SECRET`

### **API Returns 502 Bad Gateway**
- Check server logs (Render dashboard)
- Ensure PORT is set correctly (default 5000)
- Check for syntax errors in code

---

## Performance Optimization

### **For Free Tier:**
- ⚠️ Goes to sleep after 15 minutes of inactivity
- ⚠️ Limited to 0.5 GB RAM
- ✅ Suitable for development/testing
- ✅ Wakes up on first request

### **Upgrade to Starter Plan ($7/month):**
1. In Render → Service Settings
2. Change Plan to **"Starter"**
3. Benefits:
   - No sleep cycles
   - 2 GB RAM
   - Better performance
   - Recommended for production

---

## Auto-Deploy Setup

Render automatically deploys when you push to GitHub!

To test:
```bash
# Make a change locally
echo "# Updated" >> README.md

# Push to GitHub
git add .
git commit -m "Update README"
git push origin main

# Render will automatically redeploy in 1-2 minutes
```

---

## Custom Domain (Optional)

1. In Render → Service Settings → **"Custom Domain"**
2. Add your domain (e.g., `api.yoursite.com`)
3. Update DNS records with Render's nameservers
4. SSL certificate auto-configured by Render ✅

---

## Monitoring & Logs

In Render Dashboard:
- **Logs:** Real-time server output
- **Metrics:** CPU, Memory, Network usage
- **Alerts:** Set up alerts for downtime

---

## Production Checklist

- [x] Code pushed to GitHub
- [x] Environment variables configured
- [x] Database connection verified
- [x] JWT secrets are 32+ characters
- [x] Razorpay webhooks configured
- [x] API endpoints tested
- [x] HTTPS enabled (automatic)
- [x] Error logging enabled
- [ ] Monitor logs for errors

---

## Next Steps

1. ✅ Deploy on Render
2. 📱 Update frontend API URL to Render URL
3. 🧪 Test all endpoints
4. 🔐 Monitor security & logs
5. 💰 Monitor costs (free tier may be enough)

---

## Support Links

- Render Docs: https://render.com/docs
- Node.js on Render: https://render.com/docs/deploy-node
- Environment Variables: https://render.com/docs/environment-variables

