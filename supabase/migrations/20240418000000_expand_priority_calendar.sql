-- Migration: expand priority_tasks task_type constraint + add created_by to calendar_events
-- Run this in Supabase SQL Editor

-- 1. Drop old task_type constraint and add expanded one
ALTER TABLE priority_tasks DROP CONSTRAINT IF EXISTS priority_tasks_task_type_check;
ALTER TABLE priority_tasks ADD CONSTRAINT priority_tasks_task_type_check
  CHECK (task_type IN (
    'chot_tv_1', 'chot_tv_hinh', 'viet_bc_tv', 'lap_group',
    'hoc_bb', 'viet_bc_bb', 'duyet_hapja'
  ));

-- 2. Add created_by to calendar_events for distributed event tracking
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS created_by TEXT;
