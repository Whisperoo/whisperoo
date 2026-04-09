-- Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alter profiles table to add tenant fields
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN acquisition_source TEXT;
ALTER TABLE public.profiles ADD COLUMN language_preference TEXT DEFAULT 'en';

-- Alter messages table for AI safety audit trail
ALTER TABLE public.messages ADD COLUMN is_flagged_for_review BOOLEAN DEFAULT false;

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Tenants Policies
-- Anyone can select active tenants (needed for branding before auth)
CREATE POLICY "Anyone can view active tenants"
  ON public.tenants FOR SELECT
  USING (is_active = true);

-- Profiles Policies (Modify existing or add new to ensure strictness. 
-- Since "Users can view own profile" already exists (Auth.uid() = id), the base RLS is covered.)
