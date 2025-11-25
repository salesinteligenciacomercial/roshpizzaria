-- Criar tabela para gerenciar grupos bloqueados por usuário
CREATE TABLE IF NOT EXISTS public.blocked_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  group_number TEXT NOT NULL,
  group_name TEXT,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_group UNIQUE (user_id, company_id, group_number)
);

-- Habilitar RLS
ALTER TABLE public.blocked_groups ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver seus próprios grupos bloqueados
CREATE POLICY "Users can view their own blocked groups"
ON public.blocked_groups
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Usuários podem bloquear grupos
CREATE POLICY "Users can block groups"
ON public.blocked_groups
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Usuários podem desbloquear seus grupos
CREATE POLICY "Users can unblock their groups"
ON public.blocked_groups
FOR DELETE
USING (auth.uid() = user_id);

-- Policy: Usuários podem atualizar informações de grupos bloqueados
CREATE POLICY "Users can update their blocked groups"
ON public.blocked_groups
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_blocked_groups_updated_at
BEFORE UPDATE ON public.blocked_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_blocked_groups_user_company ON public.blocked_groups(user_id, company_id);
CREATE INDEX idx_blocked_groups_group_number ON public.blocked_groups(group_number);