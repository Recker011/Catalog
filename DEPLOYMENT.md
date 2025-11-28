# 🚀 Deployment Guide for CAT-alog

## Easiest Option: Vercel (Recommended)

### Step 1: Prepare Your Repository
1. Make sure your code is pushed to GitHub
2. The `vercel.json` config is already added to your project

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click "New Project"
3. Import your CAT-alog repository
4. Vercel will automatically detect it's a Node.js app
5. Click "Deploy"

### Step 3: Add Environment Variables
1. In your Vercel dashboard, go to your project
2. Navigate to Settings → Environment Variables
3. Add these variables:
   - `TMDB_API_KEY`: Your TMDB API key
   - `TMDB_READ_TOKEN`: Your TMDB read token
4. Redeploy the project

### Step 4: Your App is Live! 🎉
- Your app will be available at: `https://your-project-name.vercel.app`
- Vercel provides automatic HTTPS and CDN

## Alternative: Railway

### Step 1: Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your CAT-alog repository

### Step 2: Add Environment Variables
1. In Railway dashboard, go to your project
2. Click on your service → Variables tab
3. Add:
   - `TMDB_API_KEY`
   - `TMDB_READ_TOKEN`
4. Redeploy

## Why These Are The Easiest:

✅ **No server configuration needed**  
✅ **Automatic deployments** from GitHub  
✅ **Built-in environment variable management**  
✅ **Free SSL certificates**  
✅ **Global CDN** for fast loading  
✅ **Automatic scaling**  

## Security Note:
⚠️ **Important**: Move your API keys to environment variables instead of hardcoding them. I've provided the config files, but make sure your `.env` file is in `.gitignore` (which it already is).

Your app will work perfectly on either platform - Vercel is just slightly easier for beginners!