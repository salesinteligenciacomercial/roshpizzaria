
CREATE TABLE public.company_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(company_id, tag_name)
);

ALTER TABLE public.company_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tags of their company"
  ON public.company_tags FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tags for their company"
  ON public.company_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tags of their company"
  ON public.company_tags FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );
