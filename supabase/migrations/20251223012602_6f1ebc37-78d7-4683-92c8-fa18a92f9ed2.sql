-- Criar bucket para armazenar mídias de conversas permanentemente
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'conversation-media', 
  'conversation-media', 
  true,
  52428800, -- 50MB limite
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'application/pdf', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- Política para permitir leitura pública (mídias são exibidas no chat)
CREATE POLICY "Mídias de conversas são públicas para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'conversation-media');

-- Política para permitir upload por usuários autenticados
CREATE POLICY "Usuários autenticados podem fazer upload de mídias"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'conversation-media' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir update por usuários autenticados
CREATE POLICY "Usuários autenticados podem atualizar mídias"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'conversation-media' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir delete por usuários autenticados (limpeza)
CREATE POLICY "Usuários autenticados podem deletar mídias"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'conversation-media' 
  AND auth.role() = 'authenticated'
);