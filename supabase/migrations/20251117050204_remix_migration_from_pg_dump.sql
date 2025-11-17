--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: calculate_popularity_scores(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_popularity_scores() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update popularity score for all comics
  UPDATE komik
  SET popularity_score = (
    COALESCE(views_today, 0) * 3 + 
    COALESCE(views_week, 0) * 1.2 + 
    COALESCE(rating_admin, 0) * 5
  );
END;
$$;


--
-- Name: check_rate_limit(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(_identifier text, _action text, _max_requests integer, _window_minutes integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _current_count INTEGER;
  _window_start TIMESTAMP WITH TIME ZONE;
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


--
-- Name: generate_admin_otp(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_admin_otp(admin_email text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  otp_code TEXT;
BEGIN
  -- Generate 6-digit OTP
  otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  -- Invalidate all previous unused OTPs for this email
  UPDATE admin_otp 
  SET used = true 
  WHERE email = admin_email AND used = false;
  
  -- Insert new OTP
  INSERT INTO admin_otp (email, otp_code, expires_at)
  VALUES (admin_email, otp_code, now() + interval '5 minutes');
  
  RETURN otp_code;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: has_valid_2fa_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_valid_2fa_session(check_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_2fa_sessions
    WHERE user_id = check_user_id
      AND expires_at > now()
  );
$$;


--
-- Name: increment_komik_view(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_komik_view(komik_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE komik
  SET 
    view_count = COALESCE(view_count, 0) + 1,
    views_today = COALESCE(views_today, 0) + 1,
    views_week = COALESCE(views_week, 0) + 1
  WHERE id = komik_id;
  
  -- Recalculate popularity score
  UPDATE komik
  SET popularity_score = (
    COALESCE(views_today, 0) * 3 + 
    COALESCE(views_week, 0) * 1.2 + 
    COALESCE(rating_admin, 0) * 5
  )
  WHERE id = komik_id;
END;
$$;


--
-- Name: log_audit_event(uuid, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event(_user_id uuid, _action text, _resource_type text, _resource_id text DEFAULT NULL::text, _ip_address text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text, _metadata jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: reset_daily_views(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_daily_views() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Move today's views to weekly counter
  UPDATE komik
  SET views_week = COALESCE(views_week, 0) + COALESCE(views_today, 0),
      views_today = 0;
  
  -- Keep only last 7 days in views_week (approximate)
  UPDATE komik
  SET views_week = FLOOR(views_week * 0.85);
END;
$$;


--
-- Name: toggle_bookmark(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_bookmark(_user_id uuid, _komik_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _bookmark_id UUID;
  _is_bookmarked BOOLEAN;
BEGIN
  -- Lock the komik row to prevent race conditions
  PERFORM id FROM komik WHERE id = _komik_id FOR UPDATE;
  
  -- Check if bookmark exists
  SELECT id INTO _bookmark_id
  FROM bookmarks
  WHERE user_id = _user_id AND komik_id = _komik_id;
  
  IF _bookmark_id IS NOT NULL THEN
    -- Remove bookmark
    DELETE FROM bookmarks WHERE id = _bookmark_id;
    
    -- Decrement count atomically
    UPDATE komik 
    SET bookmark_count = GREATEST(0, bookmark_count - 1)
    WHERE id = _komik_id;
    
    _is_bookmarked := FALSE;
  ELSE
    -- Add bookmark
    INSERT INTO bookmarks (user_id, komik_id)
    VALUES (_user_id, _komik_id)
    RETURNING id INTO _bookmark_id;
    
    -- Increment count atomically
    UPDATE komik 
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


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: verify_admin_otp(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_admin_otp(admin_email text, submitted_otp text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  otp_record RECORD;
  user_uuid UUID;
BEGIN
  -- Get the latest unused OTP for this email
  SELECT * INTO otp_record
  FROM admin_otp
  WHERE email = admin_email
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check if OTP exists
  IF otp_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OTP tidak ditemukan atau sudah expired'
    );
  END IF;
  
  -- Check rate limit (3 attempts)
  IF otp_record.attempt_count >= 3 THEN
    UPDATE admin_otp SET used = true WHERE id = otp_record.id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Terlalu banyak percobaan. Silakan request OTP baru.'
    );
  END IF;
  
  -- Increment attempt count
  UPDATE admin_otp 
  SET attempt_count = attempt_count + 1 
  WHERE id = otp_record.id;
  
  -- Check if OTP matches
  IF otp_record.otp_code = submitted_otp THEN
    UPDATE admin_otp SET used = true WHERE id = otp_record.id;
    
    -- Get user_id from auth.users
    SELECT id INTO user_uuid FROM auth.users WHERE email = admin_email;
    
    IF user_uuid IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'User tidak ditemukan'
      );
    END IF;
    
    -- Delete old 2FA sessions for this user
    DELETE FROM admin_2fa_sessions WHERE user_id = user_uuid;
    
    -- Create new 2FA session (valid for 24 hours)
    INSERT INTO admin_2fa_sessions (user_id, expires_at)
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


SET default_table_access_method = heap;

--
-- Name: admin_2fa_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_2fa_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_otp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_otp (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    otp_code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "position" text NOT NULL,
    image_url text NOT NULL,
    link_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ads_position_check CHECK (("position" = ANY (ARRAY['header'::text, 'mid'::text, 'reader'::text, 'sidebar'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    ip_address text,
    user_agent text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    komik_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chapter_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chapter_id uuid NOT NULL,
    image_url text NOT NULL,
    order_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    komik_id uuid NOT NULL,
    chapter_number numeric NOT NULL,
    title text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    komik_id uuid NOT NULL,
    user_id uuid,
    username text NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: komik; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.komik (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    cover_url text,
    genres text[] DEFAULT '{}'::text[],
    status text DEFAULT 'Ongoing'::text,
    view_count integer DEFAULT 0,
    bookmark_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    rating_admin numeric(2,1) DEFAULT 0,
    origin_country text DEFAULT 'Unknown'::text,
    country_flag_url text,
    chapter_count integer DEFAULT 0,
    is_color boolean DEFAULT false,
    popularity_score numeric DEFAULT 0,
    views_today integer DEFAULT 0,
    views_week integer DEFAULT 0,
    dominant_color text,
    banner_url text,
    CONSTRAINT komik_rating_admin_check CHECK (((rating_admin IS NULL) OR ((rating_admin >= (0)::numeric) AND (rating_admin <= (10)::numeric)))),
    CONSTRAINT komik_status_check CHECK ((status = ANY (ARRAY['Ongoing'::text, 'Complete'::text, 'Hiatus'::text])))
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    action text NOT NULL,
    count integer DEFAULT 1,
    window_start timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: reading_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    komik_id uuid NOT NULL,
    chapter_id uuid NOT NULL,
    last_page integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_2fa_sessions admin_2fa_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_2fa_sessions
    ADD CONSTRAINT admin_2fa_sessions_pkey PRIMARY KEY (id);


--
-- Name: admin_otp admin_otp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_otp
    ADD CONSTRAINT admin_otp_pkey PRIMARY KEY (id);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);


--
-- Name: bookmarks bookmarks_user_id_komik_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_user_id_komik_id_key UNIQUE (user_id, komik_id);


--
-- Name: chapter_images chapter_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_images
    ADD CONSTRAINT chapter_images_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: komik komik_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.komik
    ADD CONSTRAINT komik_pkey PRIMARY KEY (id);


--
-- Name: komik komik_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.komik
    ADD CONSTRAINT komik_slug_key UNIQUE (slug);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: reading_history reading_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_pkey PRIMARY KEY (id);


--
-- Name: reading_history reading_history_user_id_komik_id_chapter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_user_id_komik_id_chapter_id_key UNIQUE (user_id, komik_id, chapter_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_bookmarks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookmarks_user_id ON public.bookmarks USING btree (user_id);


--
-- Name: idx_chapter_images_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_images_chapter_id ON public.chapter_images USING btree (chapter_id);


--
-- Name: idx_chapters_komik_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapters_komik_id ON public.chapters USING btree (komik_id);


--
-- Name: idx_comments_komik_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_komik_id ON public.comments USING btree (komik_id);


--
-- Name: idx_komik_popularity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_komik_popularity ON public.komik USING btree (popularity_score DESC);


--
-- Name: idx_komik_rating_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_komik_rating_admin ON public.komik USING btree (rating_admin DESC);


--
-- Name: idx_komik_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_komik_slug ON public.komik USING btree (slug);


--
-- Name: idx_komik_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_komik_status ON public.komik USING btree (status);


--
-- Name: idx_komik_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_komik_updated_at ON public.komik USING btree (updated_at DESC);


--
-- Name: idx_komik_view_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_komik_view_count ON public.komik USING btree (view_count DESC);


--
-- Name: idx_komik_views_today; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_komik_views_today ON public.komik USING btree (views_today DESC);


--
-- Name: idx_rate_limits_identifier_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_identifier_action ON public.rate_limits USING btree (identifier, action);


--
-- Name: idx_rate_limits_window_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_window_start ON public.rate_limits USING btree (window_start);


--
-- Name: idx_reading_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_history_user_id ON public.reading_history USING btree (user_id);


--
-- Name: komik update_komik_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_komik_updated_at BEFORE UPDATE ON public.komik FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reading_history update_reading_history_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_reading_history_updated_at BEFORE UPDATE ON public.reading_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bookmarks bookmarks_komik_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_komik_id_fkey FOREIGN KEY (komik_id) REFERENCES public.komik(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chapter_images chapter_images_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_images
    ADD CONSTRAINT chapter_images_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: chapters chapters_komik_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_komik_id_fkey FOREIGN KEY (komik_id) REFERENCES public.komik(id) ON DELETE CASCADE;


--
-- Name: comments comments_komik_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_komik_id_fkey FOREIGN KEY (komik_id) REFERENCES public.komik(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reading_history reading_history_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: reading_history reading_history_komik_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_komik_id_fkey FOREIGN KEY (komik_id) REFERENCES public.komik(id) ON DELETE CASCADE;


--
-- Name: reading_history reading_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ads Admins can delete ads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete ads" ON public.ads FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: comments Admins can delete any comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any comments" ON public.comments FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chapter_images Admins can delete chapter images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete chapter images" ON public.chapter_images FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chapters Admins can delete chapters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete chapters" ON public.chapters FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: komik Admins can delete komik; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete komik" ON public.komik FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ads Admins can insert ads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert ads" ON public.ads FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chapter_images Admins can insert chapter images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert chapter images" ON public.chapter_images FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chapters Admins can insert chapters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert chapters" ON public.chapters FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: komik Admins can insert komik; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert komik" ON public.komik FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ads Admins can update ads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update ads" ON public.ads FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chapters Admins can update chapters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update chapters" ON public.chapters FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: komik Admins can update komik; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update komik" ON public.komik FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs Admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ads Anyone can view active ads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active ads" ON public.ads FOR SELECT USING (((is_active = true) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: chapter_images Anyone can view chapter images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view chapter images" ON public.chapter_images FOR SELECT USING (true);


--
-- Name: chapters Anyone can view chapters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view chapters" ON public.chapters FOR SELECT USING (true);


--
-- Name: comments Anyone can view comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);


--
-- Name: komik Anyone can view komik; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view komik" ON public.komik FOR SELECT USING (true);


--
-- Name: comments Authenticated users can insert comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert comments" ON public.comments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: admin_otp Only server can delete OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only server can delete OTP" ON public.admin_otp FOR DELETE TO service_role USING (true);


--
-- Name: admin_otp Only server can insert OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only server can insert OTP" ON public.admin_otp FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: admin_otp Only server can read OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only server can read OTP" ON public.admin_otp FOR SELECT TO service_role USING (true);


--
-- Name: admin_otp Only server can update OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only server can update OTP" ON public.admin_otp FOR UPDATE TO service_role USING (true) WITH CHECK (true);


--
-- Name: rate_limits Server can manage rate limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Server can manage rate limits" ON public.rate_limits USING (true);


--
-- Name: bookmarks Users can delete own bookmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: comments Users can delete own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: reading_history Users can delete own history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own history" ON public.reading_history FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: bookmarks Users can insert own bookmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: reading_history Users can insert own history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own history" ON public.reading_history FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: admin_2fa_sessions Users can manage own 2FA sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own 2FA sessions" ON public.admin_2fa_sessions USING ((auth.uid() = user_id));


--
-- Name: reading_history Users can update own history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own history" ON public.reading_history FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: admin_2fa_sessions Users can view own 2FA sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own 2FA sessions" ON public.admin_2fa_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: bookmarks Users can view own bookmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: reading_history Users can view own history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own history" ON public.reading_history FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_2fa_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_2fa_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_otp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_otp ENABLE ROW LEVEL SECURITY;

--
-- Name: ads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bookmarks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

--
-- Name: chapter_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chapter_images ENABLE ROW LEVEL SECURITY;

--
-- Name: chapters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: komik; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.komik ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: reading_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


