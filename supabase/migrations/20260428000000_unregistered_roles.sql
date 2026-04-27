-- Migration: Allow unregistered staff in fruit_roles (for tg: prefix pattern)
-- Also add display_name column and relax fruit_groups constraints

-- 1. Drop FK constraints on fruit_roles.staff_code and assigned_by
ALTER TABLE public.fruit_roles DROP CONSTRAINT IF EXISTS fruit_roles_staff_code_fkey;
ALTER TABLE public.fruit_roles DROP CONSTRAINT IF EXISTS fruit_roles_assigned_by_fkey;

-- 2. Allow null staff_code (shouldn't be needed but safety)
ALTER TABLE public.fruit_roles ALTER COLUMN staff_code DROP NOT NULL;

-- 3. Add display_name column for unregistered staff names
ALTER TABLE public.fruit_roles ADD COLUMN IF NOT EXISTS display_name text;

-- 4. Relax fruit_groups.telegram_group_id constraints (allow null for virtual groups)
ALTER TABLE public.fruit_groups ALTER COLUMN telegram_group_id DROP NOT NULL;
ALTER TABLE public.fruit_groups DROP CONSTRAINT IF EXISTS fruit_groups_telegram_group_id_key;
