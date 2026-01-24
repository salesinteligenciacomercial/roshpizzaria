-- Atualizar o bucket conversation-media para permitir mais tipos de arquivo
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  -- Imagens
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  -- Vídeos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  -- Áudio
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  -- Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  -- Planilhas
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  'text/csv',
  'application/vnd.oasis.opendocument.spreadsheet',
  -- Apresentações
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  -- Outros formatos comuns
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
  'application/json',
  'application/xml',
  'text/xml',
  'application/octet-stream'
]
WHERE id = 'conversation-media';