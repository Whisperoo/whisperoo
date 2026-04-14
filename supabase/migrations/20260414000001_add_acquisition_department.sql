-- 20260414000001_add_acquisition_department.sql
-- Add acquisition_department column to profiles for QR/URL hospital onboarding (SOW 2.1)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS acquisition_department TEXT;
