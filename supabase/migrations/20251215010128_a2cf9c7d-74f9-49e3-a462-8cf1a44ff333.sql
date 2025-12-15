
-- =====================================================
-- MÓDULO PROCESSOS COMERCIAIS ESTILO NOTION
-- Estrutura de páginas hierárquicas e blocos de conteúdo
-- =====================================================

-- Tabela de páginas (documentos) hierárquica
CREATE TABLE public.process_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.process_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sem título',
  icon TEXT DEFAULT '📄',
  cover_url TEXT,
  page_type TEXT NOT NULL DEFAULT 'page',
  properties JSONB DEFAULT '{}',
  is_template BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de blocos (conteúdo)
CREATE TABLE public.process_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.process_pages(id) ON DELETE CASCADE,
  parent_block_id UUID REFERENCES public.process_blocks(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'paragraph',
  content JSONB NOT NULL DEFAULT '{}',
  properties JSONB DEFAULT '{}',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de comentários em blocos
CREATE TABLE public.process_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.process_blocks(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES public.process_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  parent_comment_id UUID REFERENCES public.process_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de histórico de versões
CREATE TABLE public.process_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.process_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  blocks_snapshot JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_process_pages_company ON public.process_pages(company_id);
CREATE INDEX idx_process_pages_parent ON public.process_pages(parent_id);
CREATE INDEX idx_process_pages_type ON public.process_pages(page_type);
CREATE INDEX idx_process_pages_favorite ON public.process_pages(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_process_blocks_page ON public.process_blocks(page_id);
CREATE INDEX idx_process_blocks_parent ON public.process_blocks(parent_block_id);
CREATE INDEX idx_process_comments_block ON public.process_comments(block_id);
CREATE INDEX idx_process_comments_page ON public.process_comments(page_id);
CREATE INDEX idx_process_page_versions_page ON public.process_page_versions(page_id);

-- Habilitar RLS
ALTER TABLE public.process_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_page_versions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para process_pages
CREATE POLICY "Company users manage pages"
ON public.process_pages FOR ALL
USING (user_belongs_to_company(auth.uid(), company_id));

-- Políticas RLS para process_blocks
CREATE POLICY "Company users manage blocks"
ON public.process_blocks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.process_pages p
    WHERE p.id = process_blocks.page_id
    AND user_belongs_to_company(auth.uid(), p.company_id)
  )
);

-- Políticas RLS para process_comments
CREATE POLICY "Company users manage comments"
ON public.process_comments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.process_pages p
    WHERE p.id = process_comments.page_id
    AND user_belongs_to_company(auth.uid(), p.company_id)
  )
);

-- Políticas RLS para process_page_versions
CREATE POLICY "Company users view versions"
ON public.process_page_versions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.process_pages p
    WHERE p.id = process_page_versions.page_id
    AND user_belongs_to_company(auth.uid(), p.company_id)
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_process_pages_updated_at
BEFORE UPDATE ON public.process_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_blocks_updated_at
BEFORE UPDATE ON public.process_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_comments_updated_at
BEFORE UPDATE ON public.process_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários descritivos
COMMENT ON TABLE public.process_pages IS 'Páginas hierárquicas estilo Notion para processos comerciais';
COMMENT ON TABLE public.process_blocks IS 'Blocos de conteúdo para páginas (paragraph, heading, checklist, etc.)';
COMMENT ON TABLE public.process_comments IS 'Comentários em blocos específicos com suporte a threads';
COMMENT ON TABLE public.process_page_versions IS 'Histórico de versões de páginas para restauração';
