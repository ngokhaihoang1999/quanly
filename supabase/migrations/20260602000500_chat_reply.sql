-- Migration: Add reply_to_id column for message reply system
ALTER TABLE public.profile_chats 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.profile_chats(id) ON DELETE SET NULL;
