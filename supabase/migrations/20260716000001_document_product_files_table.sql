-- Documents the `product_files` table as it already exists in production.
--
-- This table was created directly against the live database (not through a
-- migration file), so it never showed up in `supabase/migrations/` and was
-- invisible to `supabase db diff` / drift checks. This migration captures its
-- current live shape verbatim (columns, constraints, indexes, trigger, RLS
-- policies) — no schema changes.
--
-- Intended to be registered via `supabase migration repair <version> --status
-- applied` against the already-provisioned linked project (never executed
-- there), so it only takes effect when replaying migrations into a fresh
-- environment (e.g. local dev, a new Supabase project).
--
-- Every statement is idempotent (CREATE ... IF NOT EXISTS / DROP ... IF
-- EXISTS then CREATE) so it is also safe to run as a genuine migration on a
-- database that doesn't have this table yet.

CREATE TABLE IF NOT EXISTS public.product_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type = ANY (ARRAY['video'::text, 'document'::text, 'audio'::text, 'image'::text, 'other'::text])),
  file_size_mb numeric,
  duration_minutes integer,
  page_count integer,
  sort_order integer DEFAULT 0,
  is_primary boolean DEFAULT false,
  mime_type text,
  description text,
  display_title text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_product_files_product_id ON public.product_files USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_product_files_sort_order ON public.product_files USING btree (product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_files_primary ON public.product_files USING btree (product_id, is_primary) WHERE (is_primary = true);
CREATE INDEX IF NOT EXISTS idx_product_files_is_primary ON public.product_files USING btree (product_id, is_primary) WHERE (is_primary = true);
CREATE UNIQUE INDEX IF NOT EXISTS unique_primary_file_per_product ON public.product_files USING btree (product_id) WHERE (is_primary = true);

DROP TRIGGER IF EXISTS update_product_files_updated_at ON public.product_files;
CREATE TRIGGER update_product_files_updated_at
  BEFORE UPDATE ON public.product_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view files of active products for preview" ON public.product_files;
CREATE POLICY "Anyone can view files of active products for preview" ON public.product_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_files.product_id AND p.is_active = true AND (p.price = 0::numeric OR true))
  );

DROP POLICY IF EXISTS "Anyone can view files of free active products" ON public.product_files;
CREATE POLICY "Anyone can view files of free active products" ON public.product_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_files.product_id AND p.price = 0::numeric AND p.is_active = true)
  );

DROP POLICY IF EXISTS "Experts can manage their product files" ON public.product_files;
CREATE POLICY "Experts can manage their product files" ON public.product_files
  FOR ALL USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_files.product_id AND p.expert_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_files.product_id AND p.expert_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role has full access to product files" ON public.product_files;
CREATE POLICY "Service role has full access to product files" ON public.product_files
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view files of purchased products" ON public.product_files;
CREATE POLICY "Users can view files of purchased products" ON public.product_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchases pu JOIN products p ON p.id = pu.product_id
      WHERE p.id = product_files.product_id AND pu.user_id = auth.uid() AND pu.status::text = 'completed'::text
    )
  );
