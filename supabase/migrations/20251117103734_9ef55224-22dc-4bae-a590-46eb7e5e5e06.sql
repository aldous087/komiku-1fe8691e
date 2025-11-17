-- Remove the check constraint that limits position values
ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_position_check;

-- This allows any string value for position field
-- including 'home-top', 'detail-sidebar', 'header', 'mid', 'reader', 'sidebar', etc.