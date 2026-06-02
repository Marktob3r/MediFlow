-- ========================================================================================
-- SECURITY PATCH V2
-- Run this script in your Supabase SQL Editor to patch RLS vulnerabilities.
-- ========================================================================================

-- 1. Enable RLS on previously unprotected tables
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

-- 2. Services Policies
-- Anyone can view services
CREATE POLICY "anyone_can_read_services" ON public.services
  FOR SELECT USING (true);

-- Only admins can modify services
CREATE POLICY "admins_can_insert_services" ON public.services
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role = 'admin')
  );

CREATE POLICY "admins_can_update_services" ON public.services
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role = 'admin')
  );

CREATE POLICY "admins_can_delete_services" ON public.services
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role = 'admin')
  );

-- 3. Queue Settings Policies
-- Anyone can view queue settings (needed for landing page/frontend)
CREATE POLICY "anyone_can_read_settings" ON public.queue_settings
  FOR SELECT USING (true);

-- Only admins can modify queue settings
CREATE POLICY "admins_can_update_settings" ON public.queue_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role = 'admin')
  );

CREATE POLICY "admins_can_insert_settings" ON public.queue_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role = 'admin')
  );

-- 4. Queue Entries Policies (Securing the actual table you have)
-- Patients can join the queue (INSERT) for themselves
CREATE POLICY "patients_can_insert_own_queue" ON public.queue_entries
  FOR INSERT WITH CHECK ( patient_id = auth.uid()::uuid );

-- Patients can select their own entries; staff can see all
CREATE POLICY "users_can_select_queue" ON public.queue_entries
  FOR SELECT USING (
    patient_id = auth.uid()::uuid OR 
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role IN ('staff', 'admin'))
  );

-- Staff and admins can update queue entries
CREATE POLICY "staff_can_update_queues" ON public.queue_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role IN ('staff', 'admin'))
  );

-- Staff and admins can insert (for walk-ins)
CREATE POLICY "staff_can_insert_queues" ON public.queue_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role IN ('staff', 'admin'))
  );

-- Patients and staff can delete (cancel queue)
CREATE POLICY "users_can_delete_queues" ON public.queue_entries
  FOR DELETE USING (
    patient_id = auth.uid()::uuid OR
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role IN ('staff', 'admin'))
  );

-- 5. User Profiles Policies
-- Staff and Admins need to read all user profiles to see patient info
CREATE POLICY "staff_can_read_all_profiles" ON public.user_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role IN ('staff', 'admin'))
  );

-- 6. Medical History Policies
-- Staff and Admins can create and update medical history
CREATE POLICY "staff_can_insert_medical_history" ON public.medical_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role IN ('staff', 'admin'))
  );

CREATE POLICY "staff_can_update_medical_history" ON public.medical_history
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role IN ('staff', 'admin'))
  );

-- 7. User Roles Policies
-- Only admins can manage roles
CREATE POLICY "admins_can_insert_roles" ON public.user_roles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role = 'admin')
  );

CREATE POLICY "admins_can_update_roles" ON public.user_roles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role = 'admin')
  );

CREATE POLICY "admins_can_delete_roles" ON public.user_roles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()::uuid AND ur.role = 'admin')
  );

-- 8. Auto-generate queue token and position trigger
CREATE OR REPLACE FUNCTION public.generate_queue_token()
RETURNS TRIGGER AS $$
DECLARE
    next_num INT;
    ahead_count INT;
BEGIN
    -- Get the max queue number for today
    SELECT COALESCE(MAX(queue_number), 0) + 1 INTO next_num
    FROM public.queue_entries
    WHERE DATE(joined_at) = CURRENT_DATE;
    
    -- Count how many are waiting ahead
    SELECT COUNT(*) INTO ahead_count
    FROM public.queue_entries
    WHERE status = 'waiting';

    NEW.queue_number := next_num;
    NEW.token := 'Q-' || LPAD(next_num::TEXT, 3, '0');
    NEW.position := ahead_count + 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_queue_token ON public.queue_entries;
CREATE TRIGGER trg_generate_queue_token
BEFORE INSERT ON public.queue_entries
FOR EACH ROW
EXECUTE FUNCTION public.generate_queue_token();
