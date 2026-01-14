-- Criar bucket para avatares de usuários
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Política para visualização pública dos avatares
CREATE POLICY "Avatares são públicos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'user-avatars');

-- Política para upload do próprio avatar
CREATE POLICY "Usuários podem fazer upload do próprio avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'user-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para atualização do próprio avatar
CREATE POLICY "Usuários podem atualizar o próprio avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'user-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para exclusão do próprio avatar
CREATE POLICY "Usuários podem excluir o próprio avatar" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'user-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);