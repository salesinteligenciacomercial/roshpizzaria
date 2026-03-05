-- REBUILD TABELA CONVERSAS - ELIMINAR 19GB TOAST BLOAT

-- 1. Remover FK que referencia conversas
ALTER TABLE IF EXISTS public.whatsapp_message_logs DROP CONSTRAINT IF EXISTS whatsapp_message_logs_conversation_id_fkey;

-- 2. Remover triggers
DROP TRIGGER IF EXISTS trigger_atualizar_nome_contato ON public.conversas;
DROP TRIGGER IF EXISTS trigger_update_lead_from_ad_conversation ON public.conversas;
DROP TRIGGER IF EXISTS trigger_vincular_conversa_lead ON public.conversas;
DROP TRIGGER IF EXISTS update_conversas_updated_at ON public.conversas;

-- 3. Remover da publicação realtime (sem IF EXISTS)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.conversas;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Desabilitar RLS para cópia
ALTER TABLE public.conversas DISABLE ROW LEVEL SECURITY;

-- 5. Criar tabela clone
CREATE TABLE public.conversas_clean (LIKE public.conversas INCLUDING DEFAULTS);

-- 6. Copiar dados reais (~26MB)
INSERT INTO public.conversas_clean SELECT * FROM public.conversas;

-- 7. Dropar tabela antiga (libera 19GB de bloat)
DROP TABLE public.conversas CASCADE;

-- 8. Renomear
ALTER TABLE public.conversas_clean RENAME TO conversas;

-- 9. PK
ALTER TABLE public.conversas ADD PRIMARY KEY (id);

-- 10. FKs
ALTER TABLE public.conversas ADD CONSTRAINT conversas_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);
ALTER TABLE public.conversas ADD CONSTRAINT conversas_fila_id_fkey FOREIGN KEY (fila_id) REFERENCES public.filas_atendimento(id);
ALTER TABLE public.conversas ADD CONSTRAINT conversas_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);
ALTER TABLE public.whatsapp_message_logs ADD CONSTRAINT whatsapp_message_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversas(id) ON DELETE SET NULL;

-- 11. Índices
CREATE INDEX idx_conversas_assigned_user ON public.conversas (assigned_user_id);
CREATE INDEX idx_conversas_campanha_id ON public.conversas (campanha_id);
CREATE INDEX idx_conversas_campanha_nome ON public.conversas (campanha_nome);
CREATE INDEX idx_conversas_company_created ON public.conversas (company_id, created_at DESC);
CREATE INDEX idx_conversas_company_id ON public.conversas (company_id);
CREATE INDEX idx_conversas_company_numero_created ON public.conversas (company_id, numero, created_at DESC);
CREATE INDEX idx_conversas_company_telefone ON public.conversas (company_id, telefone_formatado);
CREATE INDEX idx_conversas_created_at ON public.conversas (created_at DESC);
CREATE INDEX idx_conversas_fila ON public.conversas (fila_id);
CREATE INDEX idx_conversas_lead ON public.conversas (lead_id);
CREATE INDEX idx_conversas_numero ON public.conversas (numero);
CREATE INDEX idx_conversas_origem_api ON public.conversas (origem_api);
CREATE INDEX idx_conversas_owner ON public.conversas (owner_id);
CREATE INDEX idx_conversas_replied_to_id ON public.conversas (replied_to_id);
CREATE INDEX idx_conversas_telefone ON public.conversas (telefone_formatado) WHERE (telefone_formatado IS NOT NULL);
CREATE INDEX idx_conversas_telefone_formatado ON public.conversas (telefone_formatado);
CREATE INDEX idx_conversas_whatsapp_message_id ON public.conversas (whatsapp_message_id) WHERE (whatsapp_message_id IS NOT NULL);

-- 12. RLS
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users view conversations" ON public.conversas FOR SELECT USING (user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "Company users insert conversations" ON public.conversas FOR INSERT WITH CHECK (user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "Company users update conversations" ON public.conversas FOR UPDATE USING (user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "Company users delete conversations" ON public.conversas FOR DELETE USING (user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "Service role insert conversations" ON public.conversas FOR INSERT WITH CHECK (true);

-- 13. Triggers
CREATE TRIGGER trigger_atualizar_nome_contato BEFORE INSERT OR UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION atualizar_nome_contato_conversa();
CREATE TRIGGER trigger_update_lead_from_ad_conversation BEFORE INSERT ON public.conversas FOR EACH ROW EXECUTE FUNCTION update_lead_from_ad_conversation();
CREATE TRIGGER trigger_vincular_conversa_lead BEFORE INSERT ON public.conversas FOR EACH ROW EXECUTE FUNCTION vincular_conversa_lead();
CREATE TRIGGER update_conversas_updated_at BEFORE UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 14. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;