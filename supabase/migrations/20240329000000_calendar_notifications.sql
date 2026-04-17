-- Migration: Calendar Events, Notifications, Priority Tasks
-- 3 bảng mới cho hệ thống Lịch + Thông báo + Ưu tiên

-- ═══════════════════════════════════════════════════════
-- 1. CALENDAR EVENTS
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_code TEXT NOT NULL,  -- người sở hữu / liên quan
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'chot_tv', 'hoc_bb', 'deadline_bc_tv', 'deadline_bc_bb', 'custom'
  )),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  end_time TIME,
  color TEXT,
  reminder_minutes INT[] DEFAULT '{}',
  reminder_channels TEXT[] DEFAULT '{app}',
  reminder_sent BOOLEAN DEFAULT FALSE,
  source_record_id UUID,  -- link tới consultation_sessions hoặc records
  is_auto BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,  -- true = event chung hiện theo scope, false = cá nhân
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cal_select" ON public.calendar_events;
CREATE POLICY "cal_select" ON public.calendar_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "cal_insert" ON public.calendar_events;
CREATE POLICY "cal_insert" ON public.calendar_events FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "cal_update" ON public.calendar_events;
CREATE POLICY "cal_update" ON public.calendar_events FOR UPDATE USING (true);
DROP POLICY IF EXISTS "cal_delete" ON public.calendar_events;
CREATE POLICY "cal_delete" ON public.calendar_events FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_cal_staff ON public.calendar_events(staff_code);
CREATE INDEX IF NOT EXISTS idx_cal_date ON public.calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_cal_profile ON public.calendar_events(profile_id);

-- ═══════════════════════════════════════════════════════
-- 2. NOTIFICATIONS
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_staff_code TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- hapja_created, hapja_approved, chot_tv, bc_tv, chot_bb, bc_bb, mo_kt, drop_out, chot_center, reminder
  title TEXT NOT NULL,
  body TEXT,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_staff_code TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  channel TEXT DEFAULT 'app' CHECK (channel IN ('app', 'chat')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE USING (true);
DROP POLICY IF EXISTS "notif_delete" ON public.notifications;
CREATE POLICY "notif_delete" ON public.notifications FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_staff_code, is_read);

-- ═══════════════════════════════════════════════════════
-- 3. NOTIFICATION PREFERENCES
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_code TEXT UNIQUE NOT NULL,
  app_events TEXT[] DEFAULT '{hapja_created,hapja_approved,hapja_rejected,chot_tv,bc_tv,chot_bb,bc_bb,mo_kt,drop_out,chot_center,reminder}',
  chat_events TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "np_select" ON public.notification_preferences;
CREATE POLICY "np_select" ON public.notification_preferences FOR SELECT USING (true);
DROP POLICY IF EXISTS "np_insert" ON public.notification_preferences;
CREATE POLICY "np_insert" ON public.notification_preferences FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "np_update" ON public.notification_preferences;
CREATE POLICY "np_update" ON public.notification_preferences FOR UPDATE USING (true);

-- ═══════════════════════════════════════════════════════
-- 4. PRIORITY TASKS
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.priority_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_code TEXT NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN (
    'chot_tv_1', 'viet_bc_tv', 'hoc_bb', 'viet_bc_bb', 'duyet_hapja'
  )),
  title TEXT NOT NULL,
  deadline TIMESTAMPTZ,
  is_seen BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  source_id UUID,  -- ID nguồn (hapja, session, record)
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.priority_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pt_select" ON public.priority_tasks;
CREATE POLICY "pt_select" ON public.priority_tasks FOR SELECT USING (true);
DROP POLICY IF EXISTS "pt_insert" ON public.priority_tasks;
CREATE POLICY "pt_insert" ON public.priority_tasks FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "pt_update" ON public.priority_tasks;
CREATE POLICY "pt_update" ON public.priority_tasks FOR UPDATE USING (true);
DROP POLICY IF EXISTS "pt_delete" ON public.priority_tasks;
CREATE POLICY "pt_delete" ON public.priority_tasks FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_pt_staff ON public.priority_tasks(staff_code, is_completed);
