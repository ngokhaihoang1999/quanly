-- Migration: add visible_at to priority_tasks
-- visible_at: task only shows in Priority tab AFTER this timestamp
-- NULL = show immediately

ALTER TABLE priority_tasks
ADD COLUMN IF NOT EXISTS visible_at TIMESTAMPTZ;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_priority_tasks_visible_at
  ON priority_tasks(visible_at)
  WHERE is_completed = false AND visible_at IS NOT NULL;
