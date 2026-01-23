-- Create table to persist product categories and subcategories
CREATE TABLE public.categorias_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria_pai TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, nome, categoria_pai)
);

-- Enable RLS
ALTER TABLE public.categorias_produtos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their company categories"
  ON public.categorias_produtos FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their company categories"
  ON public.categorias_produtos FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their company categories"
  ON public.categorias_produtos FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their company categories"
  ON public.categorias_produtos FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_categorias_produtos_updated_at
  BEFORE UPDATE ON public.categorias_produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_categorias_produtos_company ON public.categorias_produtos(company_id);
CREATE INDEX idx_categorias_produtos_parent ON public.categorias_produtos(categoria_pai);