-- ============================================
-- KOMIKRU - COMPLETE DATABASE MIGRATION
-- From: Lovable Cloud
-- To: Your Own Supabase Instance
-- ============================================
-- Features included:
-- - Auto Catalog (10 pages fetch)
-- - Smart Chapter Cache 24 hours
-- - R2 Storage integration ready
-- - All new fields: type, rating, expires_at
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ============================================
-- TABLES
-- ============================================

-- Sources table (comic source websites)
CREATE TABLE public.sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Komik table (main comic metadata)
CREATE TABLE public.komik (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    cover_url TEXT,
    banner_url TEXT,
    status TEXT DEFAULT 'Ongoing',
    type TEXT DEFAULT 'manga', -- NEW: manga/manhwa/manhua
    rating NUMERIC, -- NEW: rating from source
    rating_admin NUMERIC DEFAULT 0,
    genres TEXT[] DEFAULT '{}',
    origin_country TEXT DEFAULT 'Unknown',
    country_flag_url TEXT,
    is_color BOOLEAN DEFAULT false,
    dominant_color TEXT,
    source_id UUID REFERENCES public.sources(id),
    source_slug TEXT,
    source_url TEXT,
    chapter_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    views_today INTEGER DEFAULT 0,
    views_week INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,
    popularity_score NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chapters table
CREATE TABLE public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    komik_id UUID NOT NULL REFERENCES public.komik(id) ON DELETE CASCADE,
    chapter_number NUMERIC NOT NULL,
    title TEXT,
    source_chapter_id TEXT,
    source_url TEXT,
    summary TEXT, -- NEW: chapter summary from CBZ
    total_pages INTEGER, -- NEW: total pages count
    r2_base_path TEXT, -- NEW: R2 storage base path
    html_info_url TEXT, -- NEW: URL to info.html in R2
    cover_page_url TEXT, -- NEW: cover page URL (page 1)
    metadata JSONB, -- NEW: parsed metadata from ComicInfo.xml
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(komik_id, chapter_number)
);

-- Chapter Images (original system - kept for backward compatibility)
CREATE TABLE public.chapter_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Chapter Pages (NEW: 24-hour cache system)
CREATE TABLE public.chapter_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    source_image_url TEXT NOT NULL,
    cached_image_url TEXT, -- R2 URL
    cached_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- NEW: 24-hour expiration
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- User Roles table (security definer pattern)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role public.app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Bookmarks table
CREATE TABLE public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    komik_id UUID NOT NULL REFERENCES public.komik(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, komik_id)
);

-- Reading History table
CREATE TABLE public.reading_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    komik_id UUID NOT NULL REFERENCES public.komik(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    last_page INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, komik_id)
);

-- Comments table
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    komik_id UUID NOT NULL REFERENCES public.komik(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    user_id UUID,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ads table
CREATE TABLE public.ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position TEXT NOT NULL,
    image_url TEXT NOT NULL,
    link_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Scrape Logs table
CREATE TABLE public.scrape_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.sources(id),
    action TEXT,
    target_url TEXT,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Rate Limits table
CREATE TABLE public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    action TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(identifier, action)
);

-- Admin OTP table
CREATE TABLE public.admin_otp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    attempt_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin 2FA Sessions table
CREATE TABLE public.admin_2fa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CBZ Upload Logs table (NEW: track CBZ uploads)
CREATE TABLE public.cbz_upload_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comic_id UUID REFERENCES public.komik(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    original_filename TEXT,
    total_pages INTEGER,
    status TEXT, -- 'SUCCESS' / 'FAILED'
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Komik indexes
CREATE INDEX idx_komik_source_id_source_slug ON public.komik(source_id, source_slug);
CREATE INDEX idx_komik_updated_at ON public.komik(updated_at DESC);
CREATE INDEX idx_komik_slug ON public.komik(slug);
CREATE INDEX idx_komik_popularity ON public.komik(popularity_score DESC);

-- Chapters indexes
CREATE INDEX idx_chapters_komik_id ON public.chapters(komik_id);
CREATE INDEX idx_chapters_source_url ON public.chapters(source_url);

-- Chapter Pages indexes (NEW)
CREATE INDEX idx_chapter_pages_chapter_id ON public.chapter_pages(chapter_id);
CREATE INDEX idx_chapter_pages_expires_at ON public.chapter_pages(expires_at);

-- Chapter Images indexes
CREATE INDEX idx_chapter_images_chapter_id ON public.chapter_images(chapter_id);

-- Bookmarks indexes
CREATE INDEX idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX idx_bookmarks_komik_id ON public.bookmarks(komik_id);

-- Reading History indexes
CREATE INDEX idx_reading_history_user_id ON public.reading_history(user_id);
CREATE INDEX idx_reading_history_komik_id ON public.reading_history(komik_id);

-- Comments indexes
CREATE INDEX idx_comments_komik_id ON public.comments(komik_id);
CREATE INDEX idx_comments_chapter_id ON public.comments(chapter_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Security Definer: Check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Increment komik view counter
CREATE OR REPLACE FUNCTION public.increment_komik_view(komik_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.komik
  SET 
    view_count = COALESCE(view_count, 0) + 1,
    views_today = COALESCE(views_today, 0) + 1,
    views_week = COALESCE(views_week, 0) + 1
  WHERE id = komik_id;
  
  -- Recalculate popularity score
  UPDATE public.komik
  SET popularity_score = (
    COALESCE(views_today, 0) * 3 + 
    COALESCE(views_week, 0) * 1.2 + 
    COALESCE(rating_admin, 0) * 5
  )
  WHERE id = komik_id;
END;
$$;

-- Calculate popularity scores (batch)
CREATE OR REPLACE FUNCTION public.calculate_popularity_scores()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.komik
  SET popularity_score = (
    COALESCE(views_today, 0) * 3 + 
    COALESCE(views_week, 0) * 1.2 + 
    COALESCE(rating_admin, 0) * 5
  );
END;
$$;

-- Reset daily views (run at midnight)
CREATE OR REPLACE FUNCTION public.reset_daily_views()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.komik
  SET views_week = COALESCE(views_week, 0) + COALESCE(views_today, 0),
      views_today = 0;
  
  -- Keep only last 7 days approximation
  UPDATE public.komik
  SET views_week = FLOOR(views_week * 0.85);
END;
$$;

-- Toggle bookmark
CREATE OR REPLACE FUNCTION public.toggle_bookmark(_user_id UUID, _komik_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bookmark_id UUID;
  _is_bookmarked BOOLEAN;
BEGIN
  -- Lock the komik row
  PERFORM id FROM public.komik WHERE id = _komik_id FOR UPDATE;
  
  -- Check if bookmark exists
  SELECT id INTO _bookmark_id
  FROM public.bookmarks
  WHERE user_id = _user_id AND komik_id = _komik_id;
  
  IF _bookmark_id IS NOT NULL THEN
    -- Remove bookmark
    DELETE FROM public.bookmarks WHERE id = _bookmark_id;
    
    UPDATE public.komik 
    SET bookmark_count = GREATEST(0, bookmark_count - 1)
    WHERE id = _komik_id;
    
    _is_bookmarked := FALSE;
  ELSE
    -- Add bookmark
    INSERT INTO public.bookmarks (user_id, komik_id)
    VALUES (_user_id, _komik_id)
    RETURNING id INTO _bookmark_id;
    
    UPDATE public.komik 
    SET bookmark_count = bookmark_count + 1
    WHERE id = _komik_id;
    
    _is_bookmarked := TRUE;
  END IF;
  
  RETURN jsonb_build_object(
    'is_bookmarked', _is_bookmarked,
    'bookmark_id', _bookmark_id
  );
END;
$$;

-- Check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier TEXT,
  _action TEXT,
  _max_requests INTEGER,
  _window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_count INTEGER;
  _window_start TIMESTAMPTZ;
BEGIN
  _window_start := now() - (_window_minutes || ' minutes')::INTERVAL;
  
  -- Clean up old records
  DELETE FROM public.rate_limits
  WHERE window_start < _window_start;
  
  -- Get current count
  SELECT COALESCE(SUM(count), 0) INTO _current_count
  FROM public.rate_limits
  WHERE identifier = _identifier
    AND action = _action
    AND window_start >= _window_start;
  
  -- Check if limit exceeded
  IF _current_count >= _max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Increment counter
  INSERT INTO public.rate_limits (identifier, action, count, window_start)
  VALUES (_identifier, _action, 1, now())
  ON CONFLICT (identifier, action)
  DO UPDATE SET 
    count = rate_limits.count + 1,
    window_start = CASE 
      WHEN rate_limits.window_start < _window_start THEN now()
      ELSE rate_limits.window_start
    END;
  
  RETURN TRUE;
END;
$$;

-- Generate admin OTP
CREATE OR REPLACE FUNCTION public.generate_admin_otp(admin_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  otp_code TEXT;
BEGIN
  otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  UPDATE public.admin_otp 
  SET used = true 
  WHERE email = admin_email AND used = false;
  
  INSERT INTO public.admin_otp (email, otp_code, expires_at)
  VALUES (admin_email, otp_code, now() + interval '5 minutes');
  
  RETURN otp_code;
END;
$$;

-- Verify admin OTP
CREATE OR REPLACE FUNCTION public.verify_admin_otp(admin_email TEXT, submitted_otp TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  otp_record RECORD;
  user_uuid UUID;
BEGIN
  SELECT * INTO otp_record
  FROM public.admin_otp
  WHERE email = admin_email
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF otp_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OTP tidak ditemukan atau sudah expired'
    );
  END IF;
  
  IF otp_record.attempt_count >= 3 THEN
    UPDATE public.admin_otp SET used = true WHERE id = otp_record.id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Terlalu banyak percobaan. Silakan request OTP baru.'
    );
  END IF;
  
  UPDATE public.admin_otp 
  SET attempt_count = attempt_count + 1 
  WHERE id = otp_record.id;
  
  IF otp_record.otp_code = submitted_otp THEN
    UPDATE public.admin_otp SET used = true WHERE id = otp_record.id;
    
    SELECT id INTO user_uuid FROM auth.users WHERE email = admin_email;
    
    IF user_uuid IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'User tidak ditemukan'
      );
    END IF;
    
    DELETE FROM public.admin_2fa_sessions WHERE user_id = user_uuid;
    
    INSERT INTO public.admin_2fa_sessions (user_id, expires_at)
    VALUES (user_uuid, now() + interval '24 hours');
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'OTP berhasil diverifikasi'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OTP salah. ' || (2 - otp_record.attempt_count)::TEXT || ' percobaan tersisa.',
      'attempts_remaining', 2 - otp_record.attempt_count
    );
  END IF;
END;
$$;

-- Check valid 2FA session
CREATE OR REPLACE FUNCTION public.has_valid_2fa_session(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_2fa_sessions
    WHERE user_id = check_user_id
      AND expires_at > now()
  );
$$;

-- Log audit event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _user_id UUID,
  _action TEXT,
  _resource_type TEXT,
  _resource_id TEXT DEFAULT NULL,
  _ip_address TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id, action, resource_type, resource_id, 
    ip_address, user_agent, metadata
  )
  VALUES (
    _user_id, _action, _resource_type, _resource_id,
    _ip_address, _user_agent, _metadata
  )
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp triggers
CREATE TRIGGER update_komik_updated_at
  BEFORE UPDATE ON public.komik
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reading_history_updated_at
  BEFORE UPDATE ON public.reading_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cbz_upload_logs_updated_at
  BEFORE UPDATE ON public.cbz_upload_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.komik ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_2fa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbz_upload_logs ENABLE ROW LEVEL SECURITY;

-- Sources policies
CREATE POLICY "Anyone can view active sources" ON public.sources
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage sources" ON public.sources
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Komik policies
CREATE POLICY "Anyone can view komik" ON public.komik
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert komik" ON public.komik
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update komik" ON public.komik
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete komik" ON public.komik
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Chapters policies
CREATE POLICY "Anyone can view chapters" ON public.chapters
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert chapters" ON public.chapters
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update chapters" ON public.chapters
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete chapters" ON public.chapters
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Chapter Images policies
CREATE POLICY "Anyone can view chapter images" ON public.chapter_images
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert chapter images" ON public.chapter_images
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete chapter images" ON public.chapter_images
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Chapter Pages policies (NEW)
CREATE POLICY "Anyone can view chapter pages" ON public.chapter_pages
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage chapter pages" ON public.chapter_pages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- User Roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Bookmarks policies
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Reading History policies
CREATE POLICY "Users can view own history" ON public.reading_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.reading_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own history" ON public.reading_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON public.reading_history
  FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone can view comments" ON public.comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comments" ON public.comments
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Ads policies
CREATE POLICY "Anyone can view active ads" ON public.ads
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert ads" ON public.ads
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ads" ON public.ads
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ads" ON public.ads
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Scrape Logs policies
CREATE POLICY "Admins can view scrape logs" ON public.scrape_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert scrape logs" ON public.scrape_logs
  FOR INSERT WITH CHECK (true);

-- Rate Limits policies
CREATE POLICY "Server can manage rate limits" ON public.rate_limits
  FOR ALL USING (true);

-- Admin OTP policies
CREATE POLICY "Only server can read OTP" ON public.admin_otp
  FOR SELECT USING (true);

CREATE POLICY "Only server can insert OTP" ON public.admin_otp
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Only server can update OTP" ON public.admin_otp
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Only server can delete OTP" ON public.admin_otp
  FOR DELETE USING (true);

-- Admin 2FA Sessions policies
CREATE POLICY "Users can view own 2FA sessions" ON public.admin_2fa_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own 2FA sessions" ON public.admin_2fa_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Audit Logs policies
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- CBZ Upload Logs policies
CREATE POLICY "Admins can view CBZ logs" ON public.cbz_upload_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert CBZ logs" ON public.cbz_upload_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update CBZ logs" ON public.cbz_upload_logs
  FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================
-- SEED DATA (OPTIONAL)
-- ============================================

-- Insert default sources
INSERT INTO public.sources (code, name, base_url, is_active) VALUES
  ('MANHWALIST', 'Manhwalist', 'https://manhwalist.com', true),
  ('SHINIGAMI', 'Shinigami', 'https://shinigami.sh', true),
  ('KOMIKCAST', 'Komikcast', 'https://komikcast.site', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- SCHEDULED JOBS (using pg_cron)
-- ============================================
-- NOTE: After setting up, run these commands in your Supabase SQL Editor
-- to schedule automated tasks:

-- Schedule daily view reset at midnight
-- SELECT cron.schedule(
--   'reset-daily-views',
--   '0 0 * * *',
--   $$SELECT public.reset_daily_views()$$
-- );

-- Schedule popularity score calculation every hour
-- SELECT cron.schedule(
--   'calculate-popularity',
--   '0 * * * *',
--   $$SELECT public.calculate_popularity_scores()$$
-- );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Set up Cloudflare R2 bucket
-- 3. Configure environment variables
-- 4. Deploy edge functions to your Supabase
-- 5. Update frontend to use new endpoints
-- ============================================
