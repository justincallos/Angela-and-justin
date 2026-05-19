# Tracar — Deployment Guide

## Step 1: Set up Supabase database

1. Go to https://supabase.com and open your project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste everything from `SUPABASE_SETUP.sql` into the editor
5. Click **Run** (green button)
6. You should see "Success" — your tables are ready

---

## Step 2: Deploy to Vercel

### Option A — Easiest (drag and drop, no GitHub needed)

1. Go to https://vercel.com and sign up (use Google or GitHub)
2. From your Vercel dashboard, click **Add New → Project**
3. Click **"Import Third-Party Git Repository"** OR use the **Vercel CLI**

### Option B — Via GitHub (recommended for updates)

1. Create a free account at https://github.com
2. Create a new repository called `tracar`
3. Upload all the files in this folder to that repo
4. Go to https://vercel.com → **Add New → Project**
5. Connect your GitHub account and select the `tracar` repo
6. Click **Deploy** — Vercel auto-detects it's a React app
7. Done! You'll get a URL like `https://tracar.vercel.app`

---

## Step 3: Share with Angela

Once deployed, send Angela the Vercel URL (e.g. `https://tracar-yourname.vercel.app`).

- Both of you open it on your iPhones
- All data is shared in real time via Supabase
- Any car or expense added by one person instantly appears for the other

---

## Step 4: Add to iPhone home screen (makes it feel like an app)

1. Open the Vercel URL in **Safari** on your iPhone
2. Tap the **Share** button (box with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add**

It will appear on your home screen as "Tracar" and open full screen like a native app. Do this on both your phone and Angela's.

---

## File structure

```
tracar/
  public/
    index.html
  src/
    App.jsx        ← Main app code
    index.js       ← React entry point
    supabase.js    ← Database connection
  package.json
  SUPABASE_SETUP.sql
  DEPLOY.md
```
