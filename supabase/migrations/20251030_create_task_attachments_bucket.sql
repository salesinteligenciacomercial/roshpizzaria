-- Criar bucket para anexos de tarefas
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true);

-- Políticas de segurança para o bucket
CREATE POLICY "Users can upload task attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'task-attachments'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view task attachments" ON storage.objects
FOR SELECT USING (
  bucket_id = 'task-attachments'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their task attachments" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'task-attachments'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their task attachments" ON storage.objects
FOR DELETE USING (
  bucket_id = 'task-attachments'
  AND auth.role() = 'authenticated'
);

