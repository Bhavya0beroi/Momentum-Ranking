# Deploying to Railway

Railway is the **perfect platform** for this app! Unlike serverless platforms (Vercel, Netlify), Railway runs persistent Node.js servers, which means:

✅ **In-memory cache works perfectly** - single server instance  
✅ **No cold starts** - your server stays warm  
✅ **No execution time limits** - analyze as many topics as you want  
✅ **Simple deployment** - push to GitHub and done  
✅ **Free tier**: 500 hours/month ($5 credit)  

## Prerequisites

- [Railway account](https://railway.app) (sign up with GitHub)
- GitHub account
- YouTube Data API v3 key

---

## Option 1: Deploy from GitHub (Recommended)

### Step 1: Push to GitHub

If you haven't already, push your code to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect Node.js and configure everything!

### Step 3: Add Environment Variables

1. In your Railway project, go to the **Variables** tab
2. Click **"New Variable"**
3. Add:
   - **Variable**: `YOUTUBE_API_KEY`
   - **Value**: Your YouTube API key

4. Optional - Set PORT (Railway auto-assigns, but you can override):
   - **Variable**: `PORT`
   - **Value**: `3000`

### Step 4: Deploy

Railway will automatically deploy your app! You'll get:
- A public URL: `https://your-app.up.railway.app`
- Automatic deployments on every push to main

### Step 5: Test Your Deployment

1. Visit your Railway URL
2. Enter some topics and analyze
3. Check the logs in Railway dashboard if needed

---

## Option 2: Deploy via Railway CLI

### Step 1: Install Railway CLI

```bash
npm i -g @railway/cli
```

### Step 2: Login

```bash
railway login
```

### Step 3: Initialize Project

From your project directory:

```bash
railway init
```

Choose:
- **Project name**: (your choice)
- **Environment**: production

### Step 4: Add Environment Variables

```bash
railway variables set YOUTUBE_API_KEY=your_api_key_here
```

### Step 5: Deploy

```bash
railway up
```

Your app will be deployed and Railway will provide a URL!

### Step 6: Link a Domain (Optional)

```bash
railway domain
```

Or set up a custom domain in the Railway dashboard.

---

## Post-Deployment

### View Logs

**In Railway Dashboard:**
1. Go to your project
2. Click **"Deployments"**
3. Click on the active deployment
4. View real-time logs

**Via CLI:**
```bash
railway logs
```

### Monitor Your App

Railway provides:
- **CPU & Memory usage** graphs
- **Real-time logs**
- **Deployment history**
- **Request metrics**

### Redeploy After Changes

Just push to GitHub:
```bash
git add .
git commit -m "Update feature"
git push
```

Railway automatically redeploys!

Or via CLI:
```bash
railway up
```

### Custom Domain

1. In Railway dashboard, go to **Settings**
2. Click **"Domains"**
3. Click **"Custom Domain"**
4. Enter your domain
5. Update your DNS settings with provided CNAME

---

## Why Railway is Perfect for This App

### ✅ Cache Works Perfectly
Unlike Vercel/Netlify serverless:
- Railway runs a **persistent Node.js process**
- In-memory cache stays active between requests
- **Significantly reduces YouTube API quota usage**
- No cold starts = faster response times

### ✅ No Execution Limits
- Vercel free tier: 10-second limit per function
- Railway: No execution time limits
- Analyze 10 topics at once without timeouts

### ✅ Simple Architecture
Your existing code works without modifications:
- No serverless function wrappers needed
- No special routing configs
- Just `node index.js` - that's it!

### ✅ Cost Effective

**Railway Free Tier:**
- $5 credit per month (~500 hours)
- 8GB RAM, 8 vCPUs shared
- Perfect for personal projects

**For this app:**
- Server uses minimal resources (~50-100 MB RAM)
- One server running 24/7 = ~720 hours/month
- With sleep mode (no traffic), easily fits free tier

**YouTube API Free Tier:**
- 10,000 quota units/day
- ~20 full analyses per day (5 topics each)
- Cache dramatically reduces this

### ✅ Auto-Scaling (Paid Plans)
If your app gets popular:
- Upgrade to Pro ($5/month for compute)
- Horizontal scaling available
- Automatic SSL certificates

---

## Railway Configuration

### Procfile
Railway uses `Procfile` to know how to start your app:
```
web: node index.js
```
✅ Already created!

### railway.json
Optional configuration (already created):
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node index.js",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Environment Variables

**Required:**
- `YOUTUBE_API_KEY` - Your YouTube Data API v3 key

**Optional:**
- `PORT` - Railway auto-assigns, usually 3000+
- `NODE_ENV` - Set to `production` (Railway does this automatically)

---

## Advanced Features

### Sleep Mode (Save Free Tier Hours)

Railway can sleep your app when inactive:

1. Go to **Settings** in Railway dashboard
2. Enable **"Sleep on Idle"**
3. App sleeps after 15 minutes of no requests
4. Wakes up automatically on next request (~1-2 second startup)

This dramatically extends your free tier hours!

### Add Database (Future)

If you want to add persistent caching later:

1. In Railway, click **"New"** → **"Database"** → **"Redis"**
2. Railway provides Redis connection URL
3. Update `youtube.js` to use Redis instead of in-memory cache

### Custom Build Command

If you need a build step:

```json
{
  "deploy": {
    "buildCommand": "npm install",
    "startCommand": "node index.js"
  }
}
```

### Health Check

Railway automatically health checks:
- Checks if server is responding on assigned PORT
- Restarts on failure
- Monitors response times

---

## Troubleshooting

### Deployment Fails

**Error**: `Application failed to respond`
- **Solution**: Make sure app listens on `process.env.PORT` or Railway-assigned port
- **Fix**: Your `config.js` should use `process.env.PORT || 3000` ✅ Already configured!

**Error**: `Build failed`
- **Solution**: Check Railway logs for specific error
- **Common fix**: Ensure `package.json` has all dependencies (not devDependencies)

### App Not Loading

**Error**: Website shows "Application Error"
- **Solution**: Check deployment logs in Railway dashboard
- **Common causes**:
  - Missing `YOUTUBE_API_KEY` environment variable
  - Server not listening on correct PORT
  - Startup error (check logs)

### API Quota Exceeded

**Error**: YouTube API returns `quotaExceeded`
- **Solution**: Cache is working! Just hit daily limit
- **Monitor**: Check usage in Google Cloud Console
- **Fix**: Wait for midnight PT reset, or request quota increase

### Port Already in Use (Local Dev)

**Error**: `EADDRINUSE: address already in use :::3000`
- **Solution**: Kill existing process:
```bash
lsof -ti :3000 | xargs kill -9
```

---

## Cost Breakdown

### Free Tier Usage Estimate

**Railway Free Tier:**
- $5 credit/month
- ~500 hours execution time

**Your App (estimated):**
- Minimal resource usage: ~$0.01/hour
- With sleep mode: ~100-200 hours/month
- **Fits comfortably in free tier** ✅

**YouTube API:**
- 10,000 units/day free
- Each analysis (~5 topics): ~2,500 units
- **4 full analyses per day free**
- Cache reduces this significantly for repeated topics

### When to Upgrade

Consider Railway Pro ($5/month) when:
- App runs 24/7 without sleep
- Need guaranteed uptime
- Want priority support
- Need horizontal scaling

---

## Monitoring & Maintenance

### Check Deployment Status

**Railway Dashboard:**
- Green = Running
- Yellow = Deploying
- Red = Failed

**Via CLI:**
```bash
railway status
```

### View Metrics

Railway provides:
- CPU usage graph
- Memory usage graph
- Network I/O
- Response times
- Error rates

### Alerts (Paid Plans)

Set up alerts for:
- Deployment failures
- High memory usage
- Error rate spikes

---

## Security Best Practices

### Environment Variables
✅ Never commit `.env` to git (already in `.gitignore`)  
✅ Use Railway's environment variables feature  
✅ Rotate API keys periodically  

### API Key Safety
- Only enable YouTube Data API v3 in Google Cloud Console
- Set usage limits/alerts in Google Cloud Console
- Consider API key restrictions by domain

### HTTPS
✅ Railway provides automatic HTTPS  
✅ Custom domains get free SSL certificates  

---

## Comparison: Railway vs Others

| Feature | Railway | Vercel | Render | Heroku |
|---------|---------|--------|--------|--------|
| **Architecture** | Persistent server ✅ | Serverless ❌ | Persistent server ✅ | Persistent server ✅ |
| **In-memory cache** | Works ✅ | Doesn't work ❌ | Works ✅ | Works ✅ |
| **Execution limits** | None ✅ | 10s free tier ❌ | None ✅ | 30s free tier ⚠️ |
| **Cold starts** | None ✅ | Yes ❌ | Rare ⚠️ | Yes ❌ |
| **Free tier** | $5 credit (~500h) ✅ | Generous ✅ | 750h/month ✅ | None (paid) ❌ |
| **Deployment** | GitHub auto ✅ | GitHub auto ✅ | GitHub auto ✅ | GitHub auto ✅ |
| **Custom domain** | Free SSL ✅ | Free SSL ✅ | Free SSL ✅ | Paid SSL ❌ |
| **Best for** | This app! ✅ | Static/serverless | Full-stack apps | Enterprise |

**Winner for your app: Railway** 🏆

---

## Quick Reference

### Useful Commands

```bash
# Install CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set environment variable
railway variables set KEY=value

# Deploy
railway up

# View logs
railway logs

# Open in browser
railway open

# Check status
railway status
```

### Important Links

- **Railway Dashboard**: https://railway.app/dashboard
- **Railway Docs**: https://docs.railway.app
- **Your App URL**: Check Railway dashboard after deployment
- **YouTube API Console**: https://console.cloud.google.com/apis/api/youtube.googleapis.com

---

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Sign up for Railway
3. ✅ Connect GitHub repo
4. ✅ Add `YOUTUBE_API_KEY` variable
5. ✅ Deploy automatically
6. 🎉 Your app is live with working cache!

**Pro tip**: Enable "Sleep on Idle" to maximize your free tier hours!

---

Happy deploying! 🚀 Railway + Your momentum app = Perfect match! ⚡
