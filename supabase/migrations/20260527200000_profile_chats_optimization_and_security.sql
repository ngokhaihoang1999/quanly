-- Migration: Profile Chats Performance Indexes and Security Advisory Fixes
-- Creates missing indexes for profile_chats and profile_chat_reads to eliminate full table scans (Disk IO)
-- Fixes Security Linter warn: function_search_path_mutable and RLS Enabled No Policy (edit_history)

-- ============================================================
-- 1. Create Performance Indexes for Chat
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profile_chats_profile_id ON public.profile_chats (profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_chats_created_at ON public.profile_chats (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_chats_sender_code ON public.profile_chats (sender_code);

-- Composite index for fast unread counts lookup
CREATE INDEX IF NOT EXISTS idx_profile_chats_unread_lookup ON public.profile_chats (profile_id, sender_code, created_at DESC);

-- Composite index for chat read status checks
CREATE INDEX IF NOT EXISTS idx_profile_chat_reads_composite ON public.profile_chat_reads (profile_id, staff_code);

-- ============================================================
-- 2. Security Advisory: Fix Function Search Path Mutable
-- ============================================================
-- Fixes public.get_unread_chats search path vulnerability (SET search_path = public)
CREATE OR REPLACE FUNCTION public.get_unread_chats(user_code text)
RETURNS TABLE(profile_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT c.profile_id
  FROM public.profile_chats c
  LEFT JOIN public.profile_chat_reads r ON c.profile_id = r.profile_id AND r.staff_code = user_code
  WHERE c.sender_code != user_code
    AND (r.last_read_at IS NULL OR c.created_at > r.last_read_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 3. Security Advisory: RLS Enabled No Policy (edit_history)
-- ============================================================
-- Ensure edit_history has public access policy if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'edit_history'
  ) THEN
    ALTER TABLE public.edit_history ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'edit_history' AND policyname = 'Allow public manage edit_history'
    ) THEN
      CREATE POLICY "Allow public manage edit_history" ON public.edit_history FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END IF;
END;
$$;
