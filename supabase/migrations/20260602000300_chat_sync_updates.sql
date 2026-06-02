-- Migration: Chat Sync Updates - /menu, edited_at, media sync, edit/delete sync, tag mapping
-- Created: 2026-06-02

-- 1. Add columns to staff and profile_chats
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS telegram_username text DEFAULT NULL;

ALTER TABLE public.profile_chats
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Backfill updated_at for existing rows
UPDATE public.profile_chats SET updated_at = created_at WHERE updated_at IS NULL;

-- 2. Trigger to set updated_at on profile_chats only on content change
CREATE OR REPLACE FUNCTION public.set_profile_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_chats_set_updated_at ON public.profile_chats;
CREATE TRIGGER trg_profile_chats_set_updated_at
  BEFORE UPDATE ON public.profile_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_chats_updated_at();

-- 3. Upgrade trigger function to handle Insert, Update, and Delete webhooks
CREATE OR REPLACE FUNCTION public.handle_profile_chat_event()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_role_key text;
  payload jsonb;
BEGIN
  -- Safely retrieve the service_role_key from setting
  BEGIN
    service_role_key := coalesce(current_setting('app.settings.service_role_key', true), '');
  EXCEPTION WHEN OTHERS THEN
    service_role_key := '';
  END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source = 'app' THEN
      payload := jsonb_build_object(
        'type', 'app_message_inserted',
        'record', row_to_json(NEW)::jsonb
      );
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only sync edits made from the app (source = 'app')
    -- and only when message text changed
    IF NEW.source = 'app' AND NEW.message IS DISTINCT FROM OLD.message THEN
      payload := jsonb_build_object(
        'type', 'app_message_updated',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      );
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Sync deletion if it was from app and has tg_message_id
    IF OLD.source = 'app' AND OLD.tg_message_id IS NOT NULL THEN
      payload := jsonb_build_object(
        'type', 'app_message_deleted',
        'record', row_to_json(OLD)::jsonb
      );
    ELSE
      RETURN OLD;
    END IF;
  END IF;

  -- Asynchronously post the message payload to the telegram-bot Edge Function
  PERFORM net.http_post(
    url := 'https://smzoomekyvllsgppgvxw.supabase.co/functions/v1/telegram-bot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Clean up old trigger
DROP TRIGGER IF EXISTS trg_profile_chat_inserted ON public.profile_chats;

-- Attach the new trigger for all operations
DROP TRIGGER IF EXISTS trg_profile_chat_event ON public.profile_chats;
CREATE TRIGGER trg_profile_chat_event
  AFTER INSERT OR UPDATE OR DELETE ON public.profile_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_chat_event();
