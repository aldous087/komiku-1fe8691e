-- Add chapter_id to comments table for per-chapter comments
ALTER TABLE public.comments 
ADD COLUMN chapter_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_comments_chapter_id ON public.comments(chapter_id);

-- Update RLS policies to support chapter comments
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.comments;

CREATE POLICY "Authenticated users can insert comments" 
ON public.comments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
