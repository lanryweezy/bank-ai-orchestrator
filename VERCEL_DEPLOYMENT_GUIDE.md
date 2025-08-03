# 🚀 Vercel Deployment Fix Guide

## 🚨 **CURRENT ISSUE: Cannot Login on Vercel**

Your app is deployed to Vercel but login is failing because:
1. **Backend is missing** - Only frontend is deployed
2. **No database connection** - Backend needs PostgreSQL
3. **Missing environment variables** - Authentication secrets not configured

---

## 📋 **PREREQUISITES**

Before proceeding, you need:
- [ ] **PostgreSQL Database** (Railway, Supabase, or Neon recommended)
- [ ] **Vercel Account** with your project deployed
- [ ] **Database connection string** (starts with `postgresql://`)

---

## 🛠️ **STEP 1: Setup Database (Choose One)**

### Option A: Railway (Recommended)
1. Go to [Railway.app](https://railway.app)
2. Create new project → Add PostgreSQL
3. Copy the database connection string from "Connect" tab
4. Format: `postgresql://postgres:password@host:port/database`

### Option B: Supabase
1. Go to [Supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database → Connection string
4. Copy the URI format connection string

### Option C: Neon
1. Go to [Neon.tech](https://neon.tech)
2. Create new project
3. Copy the connection string from dashboard

---

## 🔐 **STEP 2: Configure Environment Variables in Vercel**

### Required Variables:
```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://username:password@host:port/database

# Authentication (REQUIRED) 
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
AUTH_SECRET=your-super-secret-auth-key-at-least-32-characters-long

# Application
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app

# Optional: Enable data seeding on first deploy
SEED_DATA=true
```

### How to Add in Vercel:
1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Your database connection string
   - **Environment**: Production
4. Repeat for all required variables above

---

## 🔧 **STEP 3: Update Your Local Code**

The following files have been created/updated for you:

### ✅ New Files Created:
- `vercel.json` - Vercel configuration for full-stack deployment
- `.env.production` - Environment variables template
- `api/index.ts` - Vercel serverless function entry point

### ✅ Updated Files:
- `backend/src/config/index.ts` - Production database configuration
- `backend/src/server.ts` - CORS and Vercel compatibility
- `package.json` - Build scripts (if needed)

---

## 🚀 **STEP 4: Deploy to Vercel**

### Option A: Automatic (Recommended)
1. **Commit all changes:**
   ```bash
   git add .
   git commit -m "Add Vercel deployment configuration"
   git push
   ```

2. **Vercel will auto-deploy** - Check your deployment logs

### Option B: Manual Deploy
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel --prod
   ```

---

## 🎯 **STEP 5: Initialize Database Schema**

After successful deployment:

### Option A: Auto-Initialize (Recommended)
Set `SEED_DATA=true` in Vercel environment variables and redeploy.

### Option B: Manual SQL Execution
1. Connect to your database
2. Execute the SQL from `backend/sql/core_banking_schema.sql`

---

## 🧪 **STEP 6: Test Your Deployment**

### Test Backend API:
Visit: `https://your-app.vercel.app/api/health`
Should return: `{"status": "Backend is healthy", "timestamp": "..."}`

### Test Authentication:
1. Go to your app: `https://your-app.vercel.app`
2. Try to register a new user
3. Try to login with the registered user

---

## 🔍 **TROUBLESHOOTING**

### ❌ Login Still Fails
**Check Vercel Function Logs:**
1. Go to Vercel Dashboard → Your Project → Functions tab
2. Click on `/api/index.ts` function
3. Check the logs for errors

**Common Issues:**
- ✅ Database connection string format incorrect
- ✅ Environment variables not set
- ✅ JWT_SECRET too short (needs 32+ characters)

### ❌ Database Connection Errors
**Check:**
1. Database is running and accessible
2. CONNECTION_STRING includes correct credentials
3. Database allows external connections
4. SSL is properly configured

### ❌ CORS Errors
The CORS configuration has been updated to handle Vercel domains. If you still get CORS errors:

1. Update `FRONTEND_URL` in Vercel environment variables
2. Ensure it matches your exact Vercel domain

---

## 📱 **DEFAULT TEST CREDENTIALS**

If seeding is enabled, you can login with:
```
Email: admin@bank.com
Password: admin123
```

---

## 🎉 **SUCCESS INDICATORS**

When working correctly, you should see:
- ✅ Health check endpoint returns success
- ✅ Registration creates new users
- ✅ Login returns JWT token
- ✅ Protected routes work with authentication
- ✅ Banking features accessible

---

## 🆘 **NEED HELP?**

If you're still having issues:

1. **Check Vercel function logs** for specific error messages
2. **Verify database connectivity** from your local machine
3. **Test environment variables** are properly set
4. **Ensure all files were committed** and deployed

### Quick Debug Checklist:
- [ ] Database URL is correct and database is accessible
- [ ] All environment variables are set in Vercel
- [ ] Latest code is pushed to Git
- [ ] Vercel deployment completed successfully
- [ ] Function logs show no errors

---

## 🔧 **Manual Environment Variable Generation**

If you need to generate secure secrets:

```bash
# Generate JWT_SECRET (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate AUTH_SECRET (32+ characters)  
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

Your banking application should now be fully functional on Vercel with authentication working correctly! 🎉