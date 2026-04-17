-- Allow DELETE on records and consultation_sessions (needed for undo/revert features)
-- records
DROP POLICY IF EXISTS "Allow public delete records" ON records;
CREATE POLICY "Allow public delete records"
  ON records FOR DELETE USING (true);

-- consultation_sessions
DROP POLICY IF EXISTS "Allow public delete consultation_sessions" ON consultation_sessions;
CREATE POLICY "Allow public delete consultation_sessions"
  ON consultation_sessions FOR DELETE USING (true);
