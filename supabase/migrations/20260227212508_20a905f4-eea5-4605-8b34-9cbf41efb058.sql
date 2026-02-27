
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS capture_page_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.companies.capture_page_config IS 'Configuração da página de captura de leads: título, descrição, cores, logo, serviços, perguntas do formulário IA, etc.';
