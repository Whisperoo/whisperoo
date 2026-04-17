-- 20260417000001_care_checklist_tables.sql
-- SOW 4.1: Care checklist templates + user progress tracking

-- Templates: Admin-defined checklist items per developmental stage
CREATE TABLE public.care_checklist_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage           text NOT NULL,
  stage_label     text NOT NULL,
  title           text NOT NULL,
  description     text,
  category        text DEFAULT 'general',
  sort_order      int DEFAULT 0,
  is_universal    boolean DEFAULT true,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  hospital_phone  text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_checklist_templates_stage ON public.care_checklist_templates(stage);
CREATE INDEX idx_checklist_templates_tenant ON public.care_checklist_templates(tenant_id);

COMMENT ON TABLE public.care_checklist_templates IS 'Admin-defined care checklist items per developmental stage (SOW 4.1)';
COMMENT ON COLUMN public.care_checklist_templates.stage IS 'Stage key: expecting_t1, expecting_t2, expecting_t3, newborn_0_3m, infant_3_6m, infant_6_12m, toddler_12_24m';
COMMENT ON COLUMN public.care_checklist_templates.category IS 'Category: medical, milestone, safety, nutrition, general';
COMMENT ON COLUMN public.care_checklist_templates.is_universal IS 'true = shown to all users; false = shown only to users matching tenant_id';

-- Progress: User completion state per checklist item per child
CREATE TABLE public.care_checklist_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kid_id          uuid NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  template_id     uuid NOT NULL REFERENCES public.care_checklist_templates(id) ON DELETE CASCADE,
  completed       boolean DEFAULT false,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, kid_id, template_id)
);

CREATE INDEX idx_checklist_progress_user_kid ON public.care_checklist_progress(user_id, kid_id);

COMMENT ON TABLE public.care_checklist_progress IS 'User completion tracking per checklist item per child (SOW 4.1)';

-- RLS: Templates are read-only for everyone
ALTER TABLE public.care_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_reads_templates" ON public.care_checklist_templates
  FOR SELECT USING (true);

-- RLS: Progress is per-user
ALTER TABLE public.care_checklist_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_progress" ON public.care_checklist_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
