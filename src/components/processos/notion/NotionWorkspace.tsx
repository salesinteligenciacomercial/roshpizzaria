import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotionSidebar } from "./NotionSidebar";
import { NotionPage } from "./NotionPage";
import { TemplateLibrary } from "./TemplateLibrary";
import { ProcessCalendar } from "./ProcessCalendar";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  FileText, 
  PanelLeftClose, 
  PanelLeft, 
  Plus,
  BookOpen,
  Workflow,
  GitBranch,
  CalendarDays,
  CheckSquare
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

type ContentType = 'page' | 'task' | 'playbook' | 'cadence' | 'stage';

export function NotionWorkspace({ companyId }: NotionWorkspaceProps) {
  const [selectedPage, setSelectedPage] = useState<ProcessPage | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);

  const handleSelectPage = async (page: any) => {
    if (!page) {
      setSelectedPage(null);
      return;
    }
    
    setShowCalendar(false);
    
    const { data, error } = await supabase
      .from('process_pages')
      .select('*')
      .eq('id', page.id)
      .single();
    
    if (!error && data) {
      setSelectedPage(data);
    }
  };

  const handleCreateItem = async (parentId?: string | null, type: ContentType = 'page') => {
    if (!companyId) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      
      // For playbooks, cadences, stages - create in their respective tables
      if (type === 'playbook') {
        const { error } = await supabase.from('processes_playbooks').insert({
          company_id: companyId,
          owner_id: user.user?.id,
          title: 'Novo Playbook',
          type: 'atendimento',
          content: ''
        });
        if (error) throw error;
        toast.success('Playbook criado');
        setRefreshTrigger(prev => prev + 1);
        return;
      }
      
      if (type === 'cadence') {
        const { error } = await supabase.from('processes_routines').insert({
          company_id: companyId,
          owner_id: user.user?.id,
          name: 'Nova Cadência',
          type: 'follow_up',
          steps: []
        });
        if (error) throw error;
        toast.success('Cadência criada');
        setRefreshTrigger(prev => prev + 1);
        return;
      }
      
      if (type === 'stage') {
        const { data: maxOrder } = await supabase
          .from('processes_stages')
          .select('stage_order')
          .eq('company_id', companyId)
          .order('stage_order', { ascending: false })
          .limit(1)
          .single();
        
        const { error } = await supabase.from('processes_stages').insert({
          company_id: companyId,
          owner_id: user.user?.id,
          stage_name: 'Nova Etapa',
          stage_order: (maxOrder?.stage_order || 0) + 1
        });
        if (error) throw error;
        toast.success('Etapa criada');
        setRefreshTrigger(prev => prev + 1);
        return;
      }
      
      // For pages and tasks - create in process_pages
      const iconMap: Record<string, string> = {
        page: '📄',
        task: '✅'
      };

      const titleMap: Record<string, string> = {
        page: 'Sem título',
        task: 'Nova Tarefa'
      };
      
      const { data, error } = await supabase
        .from('process_pages')
        .insert({
          company_id: companyId,
          parent_id: parentId || null,
          title: titleMap[type],
          icon: iconMap[type],
          page_type: type,
          created_by: user.user?.id,
          properties: type === 'task' ? { 
            status: 'backlog', 
            priority: 'medium',
            due_date: null,
            assignee: null,
            tags: []
          } : null
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('process_blocks').insert({
        page_id: data.id,
        block_type: 'paragraph',
        content: { text: '' },
        position: 0
      });

      setSelectedPage(data);
      setShowCalendar(false);
      setRefreshTrigger(prev => prev + 1);
      toast.success(`${titleMap[type]} criado`);
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Erro ao criar item');
    }
  };

  const handlePageUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
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
      setShowCalendar(false);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleViewCalendar = () => {
    setSelectedPage(null);
    setShowCalendar(true);
  };

  const renderContent = () => {
    if (showCalendar) {
      return (
        <div className="p-4 h-full overflow-auto">
          <ProcessCalendar companyId={companyId} />
        </div>
      );
    }

    if (showCalendar) {
      return (
        <div className="p-4 h-full overflow-auto">
          <ProcessCalendar companyId={companyId} />
        </div>
      );
    }

    if (selectedPage) {
      return (
        <NotionPage 
          page={selectedPage} 
          onPageUpdate={handlePageUpdate}
          companyId={companyId}
        />
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Bem-vindo ao Workspace</h2>
          <p className="text-muted-foreground mb-6">
            Gerencie documentos, tarefas, playbooks, cadências e etapas do seu processo comercial em um só lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Novo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuItem onClick={() => handleCreateItem(null, 'page')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Página em Branco
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateItem(null, 'task')}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Tarefa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TemplateLibrary 
              companyId={companyId}
              onCreateFromTemplate={handleCreateFromTemplate}
            />
          </div>
        </div>
      </div>
    );
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
          onCreatePage={handleCreateItem}
          onViewCalendar={handleViewCalendar}
          showCalendar={showCalendar}
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
            
            {/* Quick View Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant={showCalendar ? "secondary" : "ghost"}
                size="sm"
                onClick={handleViewCalendar}
                className="h-7 px-2 text-xs gap-1"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Calendário</span>
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <TemplateLibrary 
              companyId={companyId} 
              onCreateFromTemplate={handleCreateFromTemplate} 
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleCreateItem(null, 'page')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Página em Branco
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateItem(null, 'task')}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Tarefa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleCreateItem(null, 'playbook')}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Playbook
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateItem(null, 'cadence')}>
                  <Workflow className="h-4 w-4 mr-2" />
                  Cadência
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateItem(null, 'stage')}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Etapa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
