-- Adicionar campos de endereço ao lead
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS endereco_cep TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS endereco_numero TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS endereco_complemento TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS endereco_bairro TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS endereco_cidade TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS endereco_estado TEXT;

-- Adicionar campos do Gov.br
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS govbr_login TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS govbr_senha TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.leads.endereco_cep IS 'CEP do endereço do lead';
COMMENT ON COLUMN public.leads.endereco_logradouro IS 'Rua/Avenida do endereço';
COMMENT ON COLUMN public.leads.endereco_numero IS 'Número do endereço';
COMMENT ON COLUMN public.leads.endereco_complemento IS 'Complemento do endereço (apto, sala, etc)';
COMMENT ON COLUMN public.leads.endereco_bairro IS 'Bairro do endereço';
COMMENT ON COLUMN public.leads.endereco_cidade IS 'Cidade do endereço';
COMMENT ON COLUMN public.leads.endereco_estado IS 'Estado (UF) do endereço';
COMMENT ON COLUMN public.leads.govbr_login IS 'Login de acesso ao Gov.br';
COMMENT ON COLUMN public.leads.govbr_senha IS 'Senha de acesso ao Gov.br';