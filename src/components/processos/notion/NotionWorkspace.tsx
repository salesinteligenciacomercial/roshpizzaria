import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotionSidebar } from "./NotionSidebar";
import { NotionPage } from "./NotionPage";
import { TemplateLibrary } from "./TemplateLibrary";
import { ProcessKanban } from "./ProcessKanban";
import { ProcessCalendar } from "./ProcessCalendar";
import { WorkspacePlaybooks } from "./WorkspacePlaybooks";
import { WorkspaceCadences } from "./WorkspaceCadences";
import { WorkspaceStages } from "./WorkspaceStages";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  PanelLeftClose, 
  PanelLeft, 
  LayoutGrid, 
  CalendarDays, 
  Plus,
  BookOpen,
  Workflow,
  GitBranch
} from "lucide-react";

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

type ViewMode = 'pages' | 'kanban' | 'calendar' | 'playbooks' | 'cadences' | 'stages';

interface Stats {
  playbooks: number;
  cadences: number;
  stages: number;
}

export function NotionWorkspace({ companyId }: NotionWorkspaceProps) {
  const [selectedPage, setSelectedPage] = useState<ProcessPage | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('pages');
  const [stats, setStats] = useState<Stats>({ playbooks: 0, cadences: 0, stages: 0 });

  useEffect(() => {
    if (companyId) loadStats();
  }, [companyId, refreshTrigger]);

  const loadStats = async () => {
    if (!companyId) return;
    
    const [playbooksRes, cadencesRes, stagesRes] = await Promise.all([
      supabase.from('processes_playbooks').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('processes_routines').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('processes_stages').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    ]);

    setStats({
      playbooks: playbooksRes.count || 0,
      cadences: cadencesRes.count || 0,
      stages: stagesRes.count || 0
    });
  };

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
      setViewMode('pages');
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
      setViewMode('pages');
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
      setViewMode('pages');
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleSync = () => {
    loadStats();
    setRefreshTrigger(prev => prev + 1);
  };

  const viewModes = [
    { id: 'pages', label: 'Páginas', icon: FileText },
    { id: 'kanban', label: 'Tarefas', icon: LayoutGrid },
    { id: 'calendar', label: 'Calendário', icon: CalendarDays },
    { id: 'playbooks', label: 'Playbooks', icon: BookOpen, count: stats.playbooks },
    { id: 'cadences', label: 'Cadências', icon: Workflow, count: stats.cadences },
    { id: 'stages', label: 'Etapas', icon: GitBranch, count: stats.stages },
  ];

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
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            
            {/* View Mode Tabs */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="h-8 flex-wrap">
                {viewModes.map((mode) => (
                  <TabsTrigger 
                    key={mode.id} 
                    value={mode.id} 
                    className="h-7 px-2 text-xs gap-1 relative"
                  >
                    <mode.icon className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">{mode.label}</span>
                    {mode.count !== undefined && mode.count > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
                        {mode.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center gap-2">
            {viewMode === 'pages' && (
              <>
                <TemplateLibrary 
                  companyId={companyId} 
                  onCreateFromTemplate={handleCreateFromTemplate} 
                />
                <Button size="sm" onClick={() => handleCreatePage()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Página
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content based on view mode */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'pages' && (
            selectedPage ? (
              <NotionPage 
                page={selectedPage} 
                onPageUpdate={handlePageUpdate}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-12 w-12 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Bem-vindo ao Workspace</h2>
                  <p className="text-muted-foreground mb-6">
                    Gerencie documentos, tarefas, calendário, playbooks, cadências e etapas do seu processo comercial.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => handleCreatePage()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Página em Branco
                    </Button>
                    <TemplateLibrary 
                      companyId={companyId}
                      onCreateFromTemplate={handleCreateFromTemplate}
                    />
                  </div>
                </div>
              </div>
            )
          )}

          {viewMode === 'kanban' && (
            <div className="p-4 h-full overflow-auto">
              <ProcessKanban companyId={companyId} />
            </div>
          )}

          {viewMode === 'calendar' && (
            <div className="p-4 h-full overflow-auto">
              <ProcessCalendar companyId={companyId} />
            </div>
          )}

          {viewMode === 'playbooks' && (
            <WorkspacePlaybooks companyId={companyId} onSync={handleSync} />
          )}

          {viewMode === 'cadences' && (
            <WorkspaceCadences companyId={companyId} onSync={handleSync} />
          )}

          {viewMode === 'stages' && (
            <WorkspaceStages companyId={companyId} onSync={handleSync} />
          )}
        </div>
      </div>
    </div>
  );
}
