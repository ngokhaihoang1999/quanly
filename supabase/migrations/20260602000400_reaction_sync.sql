-- Migration: Bidirectional reaction synchronization trigger update
-- Created: 2026-06-02

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
    -- 1. Check for reaction changes on already synced messages
    IF NEW.reactions IS DISTINCT FROM OLD.reactions AND NEW.tg_message_id IS NOT NULL THEN
      payload := jsonb_build_object(
        'type', 'app_message_reaction',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      );
    -- 2. Check for late sync (tg_message_id populated and message already had reactions)
    ELSIF OLD.tg_message_id IS NULL AND NEW.tg_message_id IS NOT NULL AND NEW.reactions IS NOT NULL AND NEW.reactions != '{}'::jsonb THEN
      payload := jsonb_build_object(
        'type', 'app_message_reaction',
        'record', row_to_json(NEW)::jsonb,
        'old_record', row_to_json(OLD)::jsonb
      );
    -- 3. Check for message edits (only from app)
    ELSIF NEW.source = 'app' AND NEW.message IS DISTINCT FROM OLD.message THEN
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
