-- Add missing tenant and acquisition tracking columns to profiles table
-- This fixes the 400 Bad Request error during hospital-affiliated signup.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS acquisition_department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';
