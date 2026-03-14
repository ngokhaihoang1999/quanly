-- Find and delete orphaned check_hapja records where the profile no longer exists
-- Also find check_hapja records with NULL profile_id that were already "approved" (ghost hapja)

-- 1. Show orphaned check_hapja (profile deleted but check_hapja remains)
SELECT ch.id, ch.full_name, ch.status, ch.profile_id, ch.created_at
FROM check_hapja ch
LEFT JOIN profiles p ON p.id = ch.profile_id
WHERE ch.profile_id IS NOT NULL AND p.id IS NULL;

-- 2. Delete orphaned check_hapja (uncomment to run)
-- DELETE FROM check_hapja ch
-- USING check_hapja ch2
-- WHERE ch.id = ch2.id
--   AND ch2.profile_id IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ch2.profile_id);

-- Alternative: delete by listing specific IDs after running query 1
-- DELETE FROM check_hapja WHERE id IN ('...', '...', '...', '...');

-- 3. Add ON DELETE CASCADE for future cleanup
ALTER TABLE check_hapja DROP CONSTRAINT IF EXISTS check_hapja_profile_id_fkey;
ALTER TABLE check_hapja ADD CONSTRAINT check_hapja_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
