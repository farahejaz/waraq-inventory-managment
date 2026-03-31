# 🚀 AK Copy House Multan Deployment Guide
## Stack: Vercel (Frontend) + Render (Backend) + Supabase (Database)
### 100% Free — Zero Cost — Persistent Data

---

## OVERVIEW

```
[Browser / Client]
       │
       ▼
[Vercel] — hosts frontend/index.html (static, free, global CDN)
       │  (API calls with credentials)
       ▼
[Render] — runs backend/server.js (Node.js, free tier)
       │  (SQL queries over SSL)
       ▼
[Supabase] — PostgreSQL database (free tier, 500MB, persistent forever)
```

---

## STEP 1 — Set Up Supabase (Database)

### 1.1 Create account & project
1. Go to **https://supabase.com** → Sign Up (free)
2. Click **New Project**
3. Choose a name: `ak-copy-house-db`
4. Set a strong **Database Password** (save it — you'll need it)
5. Choose a region close to your users
6. Click **Create new project** (takes ~2 min)

### 1.2 Run the database setup
1. In Supabase dashboard → click **SQL Editor** (left sidebar)
2. Click **New query**
3. Paste ALL the content from the file `backend/setup-db-supabase.sql`
4. Click **Run** (green button)
5. You should see: `Success. No rows returned`

### 1.3 Get your connection string
1. Go to **Project Settings** → **Database** (left sidebar)
2. Scroll down to **Connection string**
3. Select **URI** tab
4. Copy the string — it looks like:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```
5. **Save this** — you'll need it for Render

---

## STEP 2 — Deploy Backend to Render

### 2.1 Push code to GitHub
1. Create a new GitHub repo (public or private)
2. Push your project:
   ```bash
   cd AK Copy House Multan-Cloud
   git init
   git add .
   git commit -m "Initial deploy"
   git remote add origin https://github.com/YOUR_USERNAME/ak-copy-house-cloud.git
   git push -u origin main
   ```

### 2.2 Create Render Web Service
1. Go to **https://render.com** → Sign Up (free, use GitHub login)
2. Click **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name:** `ak-copy-house-backend`
   - **Region:** Oregon (or closest to you)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

### 2.3 Set Environment Variables in Render
Click **Environment** → Add these variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(paste your Supabase connection string from Step 1.3)* |
| `SESSION_SECRET` | *(click "Generate" button — Render creates a secure random value)* |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | *(leave blank for now — fill after Step 3)* |

5. Click **Create Web Service**
6. Wait for the build to complete (~3 min)
7. Your backend URL will be: `https://ak-copy-house-backend.onrender.com`
   (Render shows the exact URL in the dashboard)

### 2.4 Verify backend is working
Open in browser: `https://ak-copy-house-backend.onrender.com/health`

You should see:
```json
{"status":"ok","db":"connected","time":"2026-..."}
```

> ⚠️ **Render Free Tier Note:** The service sleeps after 15 minutes of inactivity.
> The first request after sleep takes ~30 seconds to wake up.
> This is normal on the free plan. See the "Zero Downtime Tips" section below.

---

## STEP 3 — Deploy Frontend to Vercel

### 3.1 Update your backend URL in the frontend
Before deploying, edit `frontend/index.html`:

Find this line near the top of the `<script>` section:
```javascript
const API_BASE = window.WARAQ_API_BASE || 'https://YOUR-RENDER-URL.onrender.com';
```

Replace with your actual Render URL:
```javascript
const API_BASE = window.WARAQ_API_BASE || 'https://ak-copy-house-backend.onrender.com';
```

Commit and push this change to GitHub.

### 3.2 Deploy to Vercel
1. Go to **https://vercel.com** → Sign Up (free, use GitHub login)
2. Click **Add New** → **Project**
3. Import your GitHub repo
4. Configure:
   - **Framework Preset:** Other
   - **Root Directory:** `.` (leave as root)
   - No build command needed (pure static HTML)
5. Click **Deploy**
6. Your frontend URL will be: `https://ak-copy-house-cloud.vercel.app`
   (Vercel shows the exact URL)

### 3.3 Update CORS on Render
Now that you have your Vercel URL, go back to Render:
1. **Dashboard** → **ak-copy-house-backend** → **Environment**
2. Add/update: `FRONTEND_URL` = `https://ak-copy-house-cloud.vercel.app`
   (use your actual Vercel URL)
3. Click **Save Changes** → Render will auto-redeploy

---

## STEP 4 — Test Everything

1. Open your Vercel URL in a browser
2. Login with:
   - Username: `admin` / Password: `admin123`
   - Username: `manager` / Password: `manager123`
   - Username: `accountant` / Password: `account123`
3. Add a supplier or customer, save it
4. Refresh the page — data should persist ✅
5. Open in a different browser or incognito — login should work ✅

### ⚠️ CRITICAL: Change default passwords immediately!
Log in as admin → go to User Management → change all passwords.

---

## GIVING THE CLIENT ACCESS

### Option A — Share the Vercel URL (Simplest)
Just send your client: `https://ak-copy-house-cloud.vercel.app`
- Works on any device (browser, phone, tablet)
- No installation needed
- They bookmark it like any website

### Option B — Create a custom domain (Professional)
1. Buy a domain (e.g. `ak-copy-house.yourbusiness.com`) from Namecheap (~$10/year)
2. In Vercel Dashboard → your project → **Domains** → add your domain
3. Follow Vercel's DNS instructions (takes <5 min)
4. Share: `https://ak-copy-house.yourbusiness.com`

### Option C — Desktop shortcut (Windows/Mac)
On Chrome/Edge:
1. Open the app URL
2. Click ⋮ (menu) → **More tools** → **Create shortcut**
3. Check "Open as window"
4. Now it appears like a native app on the desktop

### User Roles
| Role | Can Do |
|------|--------|
| `admin` | Everything + manage users |
| `manager` | All business data |
| `accountant` | Cash flow, purchases, sales only |

To give the client their own login:
1. Log in as admin
2. Go to **Users** section
3. Create a new user with role `manager` or `admin`
4. Share the credentials

---

## ZERO DOWNTIME & MAINTENANCE TIPS

### Problem: Render free tier sleeps after 15 min
**Fix — Keep-alive ping (free):**
1. Go to **https://cron-job.org** (free account)
2. Create a cron job:
   - URL: `https://ak-copy-house-backend.onrender.com/health`
   - Schedule: Every 14 minutes
3. This keeps the backend awake 24/7 at zero cost

### Problem: Supabase free tier pauses after 1 week of inactivity
**Fix:** Supabase pauses the PROJECT (not the data). To prevent:
1. Supabase Dashboard → **Settings** → **General**
2. Enable **"Pause protection"** (requires email verification)
OR simply visit the Supabase dashboard once a week to keep it active.
Data is NEVER deleted — only the compute pauses.

### Monitor your app health
Bookmark this URL and check it anytime:
`https://ak-copy-house-backend.onrender.com/health`

Response `"status": "ok"` = everything working ✅
Response `"status": "error"` = database issue (check Supabase) ❌

### Database backups (Supabase free tier)
Supabase keeps **7 days** of backups automatically.
For manual backup:
1. Supabase Dashboard → **Database** → **Backups**
2. Click **Download** to get a full PostgreSQL dump

---

## TROUBLESHOOTING

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Login fails | CORS issue | Check `FRONTEND_URL` env var on Render matches your Vercel URL exactly |
| Data doesn't save | Session cookie blocked | Make sure `sameSite: 'none'` and `secure: true` are set in production |
| 502 Bad Gateway | Render service sleeping | Wait 30s and refresh (or set up cron-job.org ping) |
| Database error on health check | Supabase paused | Visit Supabase dashboard and click "Restore project" |
| CORS error in browser console | `FRONTEND_URL` mismatch | In Render env vars, ensure URL has no trailing slash |

---

## FREE TIER LIMITS (all you need for a small business)

| Service | Free Limit |
|---------|-----------|
| Vercel | 100GB bandwidth/month, unlimited deploys |
| Render | 750 hours/month (enough for 1 service running 24/7) |
| Supabase | 500MB database, 2GB bandwidth/month |

All three limits are generous for a small business app. You'd only need to upgrade if you have thousands of daily users.
