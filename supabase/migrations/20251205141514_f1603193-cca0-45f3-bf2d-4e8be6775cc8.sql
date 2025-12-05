-- Tabela de conversas internas
CREATE TABLE public.internal_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de participantes das conversas
CREATE TABLE public.internal_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

-- Tabela de mensagens internas
CREATE TABLE public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  file_name TEXT,
  shared_item_type TEXT,
  shared_item_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_internal_conversations_company ON public.internal_conversations(company_id);
CREATE INDEX idx_internal_participants_conversation ON public.internal_conversation_participants(conversation_id);
CREATE INDEX idx_internal_participants_user ON public.internal_conversation_participants(user_id);
CREATE INDEX idx_internal_messages_conversation ON public.internal_messages(conversation_id);
CREATE INDEX idx_internal_messages_created ON public.internal_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.internal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies para internal_conversations
CREATE POLICY "Users view conversations in their company"
ON public.internal_conversations FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users create conversations in their company"
ON public.internal_conversations FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users update conversations they participate in"
ON public.internal_conversations FOR UPDATE
USING (
  user_belongs_to_company(auth.uid(), company_id) AND
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants
    WHERE conversation_id = id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users delete conversations they created"
ON public.internal_conversations FOR DELETE
USING (user_belongs_to_company(auth.uid(), company_id) AND created_by = auth.uid());

-- RLS Policies para internal_conversation_participants
CREATE POLICY "Users view participants of their conversations"
ON public.internal_conversation_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_conversations c
    WHERE c.id = conversation_id
    AND user_belongs_to_company(auth.uid(), c.company_id)
  )
);

CREATE POLICY "Users add participants to their conversations"
ON public.internal_conversation_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internal_conversations c
    WHERE c.id = conversation_id
    AND user_belongs_to_company(auth.uid(), c.company_id)
  )
);

CREATE POLICY "Users update their own participation"
ON public.internal_conversation_participants FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users remove participants from conversations they created"
ON public.internal_conversation_participants FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.internal_conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
);

-- RLS Policies para internal_messages
CREATE POLICY "Users view messages in their conversations"
ON public.internal_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = internal_messages.conversation_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users send messages to their conversations"
ON public.internal_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.internal_conversation_participants p
    WHERE p.conversation_id = internal_messages.conversation_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users delete their own messages"
ON public.internal_messages FOR DELETE
USING (sender_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_internal_conversations_updated_at
BEFORE UPDATE ON public.internal_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_conversation_participants;

-- Storage bucket para mídia do chat interno
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('internal-chat-media', 'internal-chat-media', true, 52428800);

-- Storage policies
CREATE POLICY "Authenticated users upload internal chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'internal-chat-media');

CREATE POLICY "Authenticated users view internal chat media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'internal-chat-media');

CREATE POLICY "Users delete their own internal chat media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'internal-chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);