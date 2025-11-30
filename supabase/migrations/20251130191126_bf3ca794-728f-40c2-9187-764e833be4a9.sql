-- Adicionar novos campos de configuração de IA
ALTER TABLE ia_configurations 
ADD COLUMN IF NOT EXISTS block_by_tags BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS read_conversation_history BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS history_messages_count INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS block_by_funnel BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_funnels UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS blocked_stages UUID[] DEFAULT '{}';