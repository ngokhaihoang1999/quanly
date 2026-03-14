-- Migration: Allow NULL telegram_group_id in fruit_groups
-- Reason: When Chốt BB/TV assigns GVBB/TVV roles BEFORE a real Telegram group exists,
-- a placeholder fruit_groups row is created with telegram_group_id = NULL.
-- The real Telegram group ID is set later when bot joins a group and user links the profile.

ALTER TABLE public.fruit_groups ALTER COLUMN telegram_group_id DROP NOT NULL;

-- Also drop the UNIQUE constraint on telegram_group_id so multiple NULLs are allowed
-- (PostgreSQL allows multiple NULLs with UNIQUE, but better to be explicit)
ALTER TABLE public.fruit_groups DROP CONSTRAINT IF EXISTS fruit_groups_telegram_group_id_key;

-- Re-create UNIQUE but only for non-null values (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS fruit_groups_telegram_group_id_unique
  ON public.fruit_groups (telegram_group_id) WHERE telegram_group_id IS NOT NULL;
