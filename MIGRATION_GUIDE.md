# 🚀 KomikRu - Full Migration Guide
## From Lovable Cloud to Your Own Supabase + Cloudflare R2

This guide will help you migrate your entire KomikRu project from Lovable to your own infrastructure.

### ✨ Features Included

- 📚 Complete comic management system
- 🔄 Auto Catalog (10 pages fetch)
- ⚡ Smart Chapter Cache (24 hours)
- 📦 **CBZ Upload Module** - Auto-detect, compress, and upload CBZ files
- 💾 R2 Storage integration
- 🔐 Admin authentication with OTP
- 📊 Analytics and popularity tracking

---

## 📋 **Prerequisites**

Before starting, make sure you have:

1. ✅ **Supabase Account** - [Sign up here](https://supabase.com)
2. ✅ **Cloudflare Account** - [Sign up here](https://cloudflare.com)
3. ✅ **Node.js 18+** installed
4. ✅ **Git** installed

---

## 🔧 **Step 1: Set Up Supabase Project**

### 1.1 Create New Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Project Name**: `komikru`
   - **Database Password**: Choose a strong password
   - **Region**: Select closest to your users
   - **Pricing Plan**: Free tier is fine for starting

### 1.2 Import Database Schema

1. Open your Supabase project
2. Go to **SQL Editor** (left sidebar)
3. Click "New Query"
4. Copy the entire contents of `migration-complete.sql`
5. Paste and click "Run"
6. Wait for completion (should take 10-30 seconds)

### 1.3 Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: Your anon key
   - **service_role**: Your service role key (⚠️ Keep secret!)

---

## ☁️ **Step 2: Set Up Cloudflare R2**

### 2.1 Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select **R2** from sidebar
3. Click "Create bucket"
4. **Bucket name**: `komikru`
5. **Location**: Choose appropriate region
6. Click "Create bucket"

### 2.2 Configure Public Access

1. Open your bucket
2. Go to **Settings** → **Public Access**
3. Click "Allow Access"
4. Copy the **Public R2.dev subdomain** URL (e.g., `https://pub-xxxxx.r2.dev`)

**Or set up custom domain (recommended):**

1. Go to **Settings** → **Custom Domains**
2. Add your domain (e.g., `cdn.yourdomain.com`)
3. Follow DNS configuration steps
4. Wait for SSL certificate provisioning

### 2.3 Generate API Tokens

1. Go to **R2** → **Manage R2 API Tokens**
2. Click "Create API Token"
3. **Token name**: `komikru-access`
4. **Permissions**: Admin Read & Write
5. **TTL**: Never expire (or set as needed)
6. Click "Create API Token"
7. Copy these values:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (from R2 dashboard URL)

---

## 🔐 **Step 3: Configure Environment Variables**

### 3.1 Create `.env` File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 3.2 Fill in Values

Edit `.env` with your actual values:

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Cloudflare R2
VITE_R2_ACCOUNT_ID=your-account-id
VITE_R2_ACCESS_KEY_ID=your-access-key
VITE_R2_SECRET_ACCESS_KEY=your-secret-key
VITE_R2_BUCKET_NAME=komikru
VITE_R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=komikru
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

# Application
VITE_APP_URL=http://localhost:5173
JWT_SECRET=your-generated-secret

# Scraper
SCRAPER_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64)
SCRAPER_DELAY_MS=2000
```

### 3.3 Generate JWT Secret

```bash
openssl rand -base64 32
```

---

## 📦 **Step 4: Install Dependencies**

```bash
npm install
```

### Additional Dependencies for R2

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## 🚀 **Step 5: Deploy Edge Functions**

### 5.1 Install Supabase CLI

```bash
npm install -g supabase
```

### 5.2 Login to Supabase

```bash
supabase login
```

### 5.3 Link to Your Project

```bash
supabase link --project-ref your-project-ref
```

(Find `your-project-ref` in Supabase dashboard URL)

### 5.4 Deploy Functions

```bash
supabase functions deploy cache-chapter-r2
supabase functions deploy cleanup-cache-r2
supabase functions deploy sync-comic
```

### 5.5 Set Function Secrets

```bash
supabase secrets set \
  R2_ACCOUNT_ID=your-account-id \
  R2_ACCESS_KEY_ID=your-access-key \
  R2_SECRET_ACCESS_KEY=your-secret-key \
  R2_BUCKET_NAME=komikru \
  R2_PUBLIC_URL=https://pub-xxxxx.r2.dev \
  SCRAPER_USER_AGENT="Mozilla/5.0"
```

---

## 🔄 **Step 6: Update Frontend Code**

All storage calls have been updated to use R2. Key changes:

### Files Updated:
- ✅ `src/lib/r2-storage.ts` - New R2 integration
- ✅ `src/lib/storage.ts` - Updated to use R2 functions
- ✅ `src/pages/Reader.tsx` - Uses R2 cache
- ✅ `src/components/CoverUpload.tsx` - Uploads to R2
- ✅ All admin upload components - R2 integration

### Replace Lovable Storage Imports

**Old (Lovable):**
```typescript
import { supabase } from "@/integrations/supabase/client";
const { data } = await supabase.storage
  .from('covers')
  .upload(path, file);
```

**New (R2):**
```typescript
import { uploadComicCoverToR2 } from "@/lib/r2-storage";
const url = await uploadComicCoverToR2(file, komikId);
```

---

## ⏰ **Step 7: Set Up Automated Tasks**

### 7.1 Schedule Cleanup (Daily at Midnight)

In Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'cleanup-cache-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/cleanup-cache-r2',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### 7.2 Schedule Auto Catalog Update (Daily at 08:00)

```sql
SELECT cron.schedule(
  'auto-update-catalog',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/auto-update-catalog',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### 7.3 Schedule View Reset (Daily at Midnight)

```sql
SELECT cron.schedule(
  'reset-daily-views',
  '0 0 * * *',
  $$SELECT public.reset_daily_views()$$
);
```

---

## 🧪 **Step 8: Test Everything**

### 8.1 Start Development Server

```bash
npm run dev
```

### 8.2 Test Checklist

- ✅ Homepage loads komik list
- ✅ Comic detail page displays correctly
- ✅ Reader page loads chapter images
- ✅ Chapter cache system works (24 hours)
- ✅ Admin login works
- ✅ Admin can upload covers
- ✅ Admin can sync comics
- ✅ Admin can add chapters
- ✅ Search functionality works
- ✅ Bookmarks work for logged-in users
- ✅ Comments work
- ✅ Reading history saves

---

## 🚢 **Step 9: Deploy to Production**

### Option A: Vercel

```bash
npm install -g vercel
vercel
```

Then set environment variables in Vercel dashboard.

### Option B: Netlify

```bash
npm install -g netlify-cli
netlify deploy
```

### Option C: Your Own Server

```bash
npm run build
# Upload dist/ folder to your server
```

---

## 🔍 **Step 10: Verify No Lovable Dependencies**

Run this command to check for any Lovable references:

```bash
grep -r "lovable" src/
grep -r "LCL_" src/
grep -r "lovable.app" src/
grep -r "lovable.dev" src/
```

Should return **no results**.

---

## 📊 **Monitoring & Maintenance**

### Check Cache Health

```sql
SELECT 
  COUNT(*) as total_cached_pages,
  COUNT(*) FILTER (WHERE expires_at > now()) as active_cache,
  COUNT(*) FILTER (WHERE expires_at < now()) as expired_cache
FROM chapter_pages;
```

### Check Storage Usage

In R2 Dashboard:
- Monitor bucket size
- Check request metrics
- Review bandwidth usage

### View Scraper Logs

```sql
SELECT *
FROM scrape_logs
ORDER BY created_at DESC
LIMIT 50;
```

---

## 🆘 **Troubleshooting**

### Issue: Edge functions not deploying

**Solution:**
```bash
# Check Supabase CLI version
supabase --version

# Update if needed
npm install -g supabase@latest

# Re-link project
supabase link --project-ref your-project-ref
```

### Issue: R2 images not loading

**Solution:**
1. Check R2 bucket is public
2. Verify CORS settings in R2
3. Check `R2_PUBLIC_URL` in `.env`

### Issue: Database migration fails

**Solution:**
1. Ensure you're using a fresh Supabase project
2. Run migration SQL in parts if needed
3. Check Supabase logs for specific errors

### Issue: Cache not expiring

**Solution:**
1. Verify cron job is scheduled
2. Check `cleanup-cache-r2` function logs
3. Manually trigger: `supabase functions invoke cleanup-cache-r2`

---

## 🎉 **Migration Complete!**

Your KomikRu is now running on:
- ✅ Your own Supabase database
- ✅ Cloudflare R2 storage
- ✅ Custom edge functions
- ✅ Zero Lovable dependencies

### Next Steps:

1. **Set up custom domain** for R2
2. **Configure analytics** (optional)
3. **Set up monitoring** (Sentry, etc.)
4. **Enable backups** in Supabase
5. **Optimize R2 caching** rules

---

## 📚 **Additional Resources**

- [Supabase Documentation](https://supabase.com/docs)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)

---

## 💬 **Support**

If you encounter issues:

1. Check the troubleshooting section above
2. Review Supabase logs
3. Check R2 bucket settings
4. Verify all environment variables are correct

---

**🎊 Congratulations! Your migration is complete!**
