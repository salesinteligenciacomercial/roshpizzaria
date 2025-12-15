import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotionSidebar } from "./NotionSidebar";
import { NotionPage } from "./NotionPage";
import { TemplateLibrary } from "./TemplateLibrary";
import { Button } from "@/components/ui/button";
import { FileText, PanelLeftClose, PanelLeft } from "lucide-react";

interface ProcessPage {
  id: string;
  title: string;
  icon: string;
  cover_url: string | null;
  parent_id: string | null;
  page_type: string;
  is_favorite: boolean;
  is_template: boolean;
  position: number;
  properties: any;
  created_at: string;
  updated_at: string;
}

interface NotionWorkspaceProps {
  companyId: string | null;
}

export function NotionWorkspace({ companyId }: NotionWorkspaceProps) {
  const [selectedPage, setSelectedPage] = useState<ProcessPage | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelectPage = async (page: any) => {
    if (!page) {
      setSelectedPage(null);
      return;
    }
    
    // Fetch full page data
    const { data, error } = await supabase
      .from('process_pages')
      .select('*')
      .eq('id', page.id)
      .single();
    
    if (!error && data) {
      setSelectedPage(data);
    }
  };

  const handleCreatePage = async (parentId?: string | null) => {
    if (!companyId) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('process_pages')
        .insert({
          company_id: companyId,
          parent_id: parentId || null,
          title: 'Sem título',
          icon: '📄',
          page_type: 'page',
          created_by: user.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial empty block
      await supabase
        .from('process_blocks')
        .insert({
          page_id: data.id,
          block_type: 'paragraph',
          content: { text: '' },
          position: 0
        });

      setSelectedPage(data);
      setRefreshTrigger(prev => prev + 1);
      toast.success('Nova página criada');
    } catch (error) {
      console.error('Error creating page:', error);
      toast.error('Erro ao criar página');
    }
  };

  const handlePageUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
    // Reload selected page
    if (selectedPage) {
      handleSelectPage(selectedPage);
    }
  };

  const handleCreateFromTemplate = async (pageId: string) => {
    const { data } = await supabase
      .from('process_pages')
      .select('*')
      .eq('id', pageId)
      .single();
    
    if (data) {
      setSelectedPage(data);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  return (
    <div className="flex h-[calc(100vh-220px)] bg-background rounded-xl border border-border overflow-hidden">
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <NotionSidebar
          key={refreshTrigger}
          companyId={companyId}
          selectedPageId={selectedPage?.id || null}
          onSelectPage={handleSelectPage}
          onCreatePage={handleCreatePage}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <TemplateLibrary 
              companyId={companyId} 
              onCreateFromTemplate={handleCreateFromTemplate} 
            />
            <Button size="sm" onClick={() => handleCreatePage()}>
              <FileText className="h-4 w-4 mr-2" />
              Nova Página
            </Button>
          </div>
        </div>

        {/* Page Content or Empty State */}
        {selectedPage ? (
          <NotionPage 
            page={selectedPage} 
            onPageUpdate={handlePageUpdate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Bem-vindo aos Processos</h2>
              <p className="text-muted-foreground mb-6">
                Crie documentos, scripts, checklists e muito mais para padronizar seus processos comerciais.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => handleCreatePage()}>
                  <FileText className="h-4 w-4 mr-2" />
                  Criar Página em Branco
                </Button>
                <TemplateLibrary 
                  companyId={companyId}
                  onCreateFromTemplate={handleCreateFromTemplate}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
