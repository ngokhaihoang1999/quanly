-- Create sinka-exports storage bucket for Word file downloads
-- This bucket is public so Telegram WebApp can open download links

INSERT INTO storage.buckets (id, name, public)
VALUES ('sinka-exports', 'sinka-exports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users (with anon key) to upload
DROP POLICY IF EXISTS "Allow upload sinka exports" ON storage.objects;
CREATE POLICY "Allow upload sinka exports" ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'sinka-exports');

-- Allow public read for downloads
DROP POLICY IF EXISTS "Allow public read sinka exports" ON storage.objects;
CREATE POLICY "Allow public read sinka exports" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'sinka-exports');

-- Allow delete for cleanup
DROP POLICY IF EXISTS "Allow delete sinka exports" ON storage.objects;
CREATE POLICY "Allow delete sinka exports" ON storage.objects
FOR DELETE TO anon
USING (bucket_id = 'sinka-exports');
