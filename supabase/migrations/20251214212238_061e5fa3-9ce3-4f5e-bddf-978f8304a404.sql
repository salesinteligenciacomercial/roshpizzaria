-- Adicionar campo profile_picture_url na tabela leads para armazenar fotos de perfil
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Adicionar índice para busca por telefone (otimização)
CREATE INDEX IF NOT EXISTS idx_leads_telefone_phone ON public.leads (telefone, phone);

COMMENT ON COLUMN public.leads.profile_picture_url IS 'URL da foto de perfil do contato, capturada via webhook Meta API ou Evolution API';