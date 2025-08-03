# 🚂 Railway Database Setup for Vercel Deployment

## 🎯 **Your Railway Connection Details**

**✅ Database Connection String:**
```
postgresql://postgres:HvmmvZdLujtugwaorlGGAqoJMPjOawsr@postgres.railway.internal:5432/railway
```

**⚠️ Important:** The connection string you provided uses `postgres.railway.internal` which only works inside Railway's network. For Vercel to connect, we need the **public hostname**.

---

## 🔧 **STEP 1: Get Public Railway Hostname**

### Option A: Railway Dashboard (Recommended)
1. Go to your [Railway Dashboard](https://railway.app/dashboard)
2. Click on your PostgreSQL service
3. Go to **"Connect"** tab
4. Look for **"Public Networking"** section
5. Copy the **TCP Proxy** connection string
   - Should look like: `roundhouse.proxy.rlwy.net:XXXX`

### Option B: Railway CLI
```bash
railway login
railway connect
railway variables
```
Look for `DATABASE_PUBLIC_URL` or similar.

---

## 🎯 **STEP 2: Set Vercel Environment Variables**

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these **exact variables**:

```bash
# Database (REQUIRED) - Use the public hostname
DATABASE_URL=postgresql://postgres:HvmmvZdLujtugwaorlGGAqoJMPjOawsr@roundhouse.proxy.rlwy.net:5432/railway

# Authentication (REQUIRED)
JWT_SECRET=banking-app-super-secret-jwt-key-for-production-at-least-32-chars
AUTH_SECRET=banking-app-super-secret-auth-key-for-production-at-least-32-chars

# Application Configuration
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
SEED_DATA=true
```

**🔑 Important Notes:**
- Replace `roundhouse.proxy.rlwy.net` with your actual Railway public hostname
- The `5432` port might be different - use the port from your Railway dashboard
- Keep the username (`postgres`) and password (`HvmmvZdLujtugwaorlGGAqoJMPjOawsr`) exactly as provided

---

## 🧪 **STEP 3: Test Your Configuration**

### Local Test (Optional)
```bash
# Test the connection locally first
export DATABASE_URL="postgresql://postgres:HvmmvZdLujtugwaorlGGAqoJMPjOawsr@your-public-hostname:port/railway"
npm run dev:backend
```

### Vercel Test
After setting environment variables and deploying:

1. **Health Check**: Visit `https://your-app.vercel.app/api/health`
   
   **Expected Success Response:**
   ```json
   {
     "status": "Backend is healthy",
     "database": "Railway PostgreSQL connected",
     "timestamp": "2024-01-XX...",
     "environment": "production"
   }
   ```

   **If Failed Response:**
   ```json
   {
     "status": "Backend unhealthy",
     "database": "Railway PostgreSQL connection failed",
     "error": "connection timeout / auth failed / etc."
   }
   ```

---

## 🚀 **STEP 4: Deploy and Initialize**

### Deploy Updated Code:
```bash
git add .
git commit -m "Configure Railway database for Vercel"
git push
```

### What Happens Automatically:
1. ✅ **Connection Test** - Vercel will test Railway connection
2. ✅ **Schema Creation** - Database tables will be created automatically
3. ✅ **Default User** - Admin user will be created for testing
4. ✅ **Banking Features** - All banking tables and workflows initialized

---

## 🔍 **TROUBLESHOOTING**

### ❌ "Connection Timeout" Error
**Cause:** Railway database not publicly accessible or wrong hostname
**Fix:** 
1. Check Railway dashboard for public networking settings
2. Ensure database allows external connections
3. Verify the public hostname is correct

### ❌ "Authentication Failed" Error  
**Cause:** Wrong username/password
**Fix:** 
1. Double-check the connection string from Railway
2. Ensure password matches exactly (case-sensitive)

### ❌ "Database Not Found" Error
**Cause:** Wrong database name
**Fix:**
1. Verify database name is `railway` (default)
2. Check Railway dashboard for actual database name

### ❌ "SSL Connection Error"
**Cause:** SSL configuration issues
**Fix:** Our code automatically handles SSL for production

---

## 🎉 **SUCCESS INDICATORS**

When everything is working correctly:

1. **✅ Health Check Passes**
   - `/api/health` returns success status
   - Shows "Railway PostgreSQL connected"

2. **✅ Authentication Works**
   - Can register new users
   - Can login successfully 
   - JWT tokens are generated

3. **✅ Banking Features Active**
   - Customer management works
   - Account operations functional
   - Workflow engine operational

---

## 🔑 **Default Login Credentials**

Once deployed successfully, you can login with:
```
Email: admin@bank.com  
Password: admin123
```

---

## 🆘 **Still Having Issues?**

### Check Vercel Function Logs:
1. Vercel Dashboard → Your Project → Functions
2. Click on `/api/index.ts` 
3. View the logs for specific error messages

### Common Error Messages & Solutions:

| Error | Solution |
|-------|----------|
| `ENOTFOUND postgres.railway.internal` | Replace with public hostname |
| `Connection timeout` | Check Railway public networking |
| `Authentication failed` | Verify username/password |
| `SSL SYSCALL error` | SSL configuration (handled automatically) |
| `Too many connections` | Database connection limit (usually resolves itself) |

---

## 📝 **Final Checklist**

- [ ] Got public Railway hostname from dashboard
- [ ] Updated DATABASE_URL in Vercel environment variables
- [ ] Set JWT_SECRET and AUTH_SECRET (32+ characters each)
- [ ] Set NODE_ENV=production
- [ ] Set SEED_DATA=true for initial setup
- [ ] Committed and pushed code changes
- [ ] Verified `/api/health` endpoint works
- [ ] Successfully logged in with admin credentials

**🎉 Your Railway database is now properly connected to Vercel!**