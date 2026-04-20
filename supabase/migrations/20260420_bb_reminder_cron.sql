SELECT cron.schedule(
  'bb-reminder-check',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://smzoomekyvllsgppgvxw.supabase.co/functions/v1/bb-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
