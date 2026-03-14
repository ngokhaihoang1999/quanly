-- Migration: Add invite_link column to fruit_groups
-- Stores the Telegram invite link for the group,
-- so the Mini App can open the group directly

ALTER TABLE public.fruit_groups ADD COLUMN IF NOT EXISTS invite_link text;
