-- Migration: Telegram Chat Sync schema changes, webhooks, and retention policy
-- Created: 2026-06-02

-- 1. Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Add columns to profile_chats table
ALTER TABLE public.profile_chats
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'app' CHECK (source IN ('app', 'telegram')),
  ADD COLUMN IF NOT EXISTS tg_message_id bigint DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tg_sender_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_metadata jsonb DEFAULT NULL;

-- 3. Create unique index to prevent duplicate inserts from Telegram Webhook
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_chats_tg_msg_id 
  ON public.profile_chats (tg_message_id) 
  WHERE tg_message_id IS NOT NULL;

-- 4. Create trigger function to sync app-created chat messages to Telegram
CREATE OR REPLACE FUNCTION public.handle_profile_chat_inserted()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_role_key text;
BEGIN
  -- Only trigger for messages created from the App
  IF NEW.source = 'app' THEN
    -- Safely retrieve the service_role_key from setting
    BEGIN
      service_role_key := coalesce(current_setting('app.settings.service_role_key', true), '');
    EXCEPTION WHEN OTHERS THEN
      service_role_key := '';
    END;

    -- Asynchronously post the message payload to the telegram-bot Edge Function
    PERFORM net.http_post(
      url := 'https://smzoomekyvllsgppgvxw.supabase.co/functions/v1/telegram-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'type', 'app_message',
        'record', row_to_json(NEW)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach the trigger
DROP TRIGGER IF EXISTS trg_profile_chat_inserted ON public.profile_chats;
CREATE TRIGGER trg_profile_chat_inserted
  AFTER INSERT ON public.profile_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_chat_inserted();

-- 6. Schedule 30-day Retention Policy via pg_cron
-- Safely unschedule existing job first if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-old-profile-chats');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if unschedule fails
END;
$$;

-- Schedule the cleanup cron job
SELECT cron.schedule(
  'purge-old-profile-chats',
  '0 0 * * *', -- Daily at midnight
  $$DELETE FROM public.profile_chats WHERE created_at < now() - interval '30 days'$$
);
