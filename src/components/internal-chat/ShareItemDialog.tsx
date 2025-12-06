import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Users, CheckSquare, Layers, Search, Loader2, MessageCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ShareItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (itemType: string, itemId: string, itemName: string) => void;
}

interface Lead {
  id: string;
  name: string;
  email?: string;
  telefone?: string;
  phone?: string;
}

interface TaskBoard {
  id: string;
  nome: string;
}

interface TaskColumn {
  id: string;
  nome: string;
  board_id: string;
}

interface Task {
  id: string;
  title: string;
  column_id: string;
  status: string;
}

interface Funnel {
  id: string;
  nome: string;
  descricao?: string;
}

interface Stage {
  id: string;
  nome: string;
  funil_id: string;
  cor?: string;
}

export const ShareItemDialog = ({
  open,
  onOpenChange,
  onShare
}: ShareItemDialogProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lead');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Leads
  const [leads, setLeads] = useState<Lead[]>([]);

  // Tasks hierarchy
  const [boards, setBoards] = useState<TaskBoard[]>([]);
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');

  // Funnels hierarchy
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [funnelLeads, setFunnelLeads] = useState<Lead[]>([]);
  const [selectedFunnel, setSelectedFunnel] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');

  useEffect(() => {
    if (open) {
      loadInitialData();
    }
  }, [open]);

  useEffect(() => {
    if (selectedBoard) {
      loadColumns(selectedBoard);
      setSelectedColumn('');
    }
  }, [selectedBoard]);

  useEffect(() => {
    if (selectedColumn) {
      loadTasks(selectedColumn);
    }
  }, [selectedColumn]);

  useEffect(() => {
    if (selectedFunnel) {
      loadStages(selectedFunnel);
      loadFunnelLeads(selectedFunnel, selectedStage);
      setSelectedStage('');
    }
  }, [selectedFunnel]);

  useEffect(() => {
    if (selectedFunnel) {
      loadFunnelLeads(selectedFunnel, selectedStage);
    }
  }, [selectedStage]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [leadsRes, boardsRes, funnelsRes] = await Promise.all([
        supabase.from('leads').select('id, name, email, telefone, phone').order('name').limit(100),
        supabase.from('task_boards').select('id, nome').order('nome'),
        supabase.from('funis').select('id, nome, descricao').order('nome')
      ]);

      if (leadsRes.data) setLeads(leadsRes.data);
      if (boardsRes.data) setBoards(boardsRes.data);
      if (funnelsRes.data) setFunnels(funnelsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadColumns = async (boardId: string) => {
    const { data } = await supabase
      .from('task_columns')
      .select('id, nome, board_id')
      .eq('board_id', boardId)
      .order('posicao');
    if (data) setColumns(data);
  };

  const loadTasks = async (columnId: string) => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, column_id, status')
      .eq('column_id', columnId)
      .order('title');
    if (data) setTasks(data);
  };

  const loadStages = async (funnelId: string) => {
    const { data } = await supabase
      .from('etapas')
      .select('id, nome, funil_id, cor')
      .eq('funil_id', funnelId)
      .order('posicao');
    if (data) setStages(data);
  };

  const loadFunnelLeads = async (funnelId: string, stageId?: string) => {
    let query = supabase
      .from('leads')
      .select('id, name, email, telefone, phone')
      .eq('funil_id', funnelId);
    
    if (stageId) {
      query = query.eq('etapa_id', stageId);
    }
    
    const { data } = await query.order('name').limit(50);
    if (data) setFunnelLeads(data);
  };

  const getFilteredLeads = () => {
    if (!search.trim()) return leads;
    const searchLower = search.toLowerCase();
    return leads.filter(lead => 
      lead.name.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.telefone?.includes(search) ||
      lead.phone?.includes(search)
    );
  };

  const getFilteredTasks = () => {
    if (!search.trim()) return tasks;
    const searchLower = search.toLowerCase();
    return tasks.filter(task => task.title.toLowerCase().includes(searchLower));
  };

  const handleOpenConversation = (lead: Lead) => {
    const phone = lead.telefone || lead.phone;
    if (phone) {
      // Normalize phone number
      const normalizedPhone = phone.replace(/\D/g, '');
      onOpenChange(false);
      navigate(`/conversas?telefone=${normalizedPhone}`);
    }
  };

  const handleShareLead = (lead: Lead) => {
    onShare('lead', lead.id, lead.name);
  };

  const handleShareTask = (task: Task) => {
    onShare('task', task.id, task.title);
  };

  const handleShareFunnel = () => {
    if (selectedFunnel) {
      const funnel = funnels.find(f => f.id === selectedFunnel);
      if (funnel) {
        const stageName = selectedStage 
          ? stages.find(s => s.id === selectedStage)?.nome 
          : '';
        const itemName = stageName ? `${funnel.nome} - ${stageName}` : funnel.nome;
        onShare('funnel', selectedFunnel, itemName);
      }
    }
  };

  const handleShareFunnelLead = (lead: Lead) => {
    onShare('lead', lead.id, lead.name);
  };

  const resetSelections = () => {
    setSelectedBoard('');
    setSelectedColumn('');
    setSelectedFunnel('');
    setSelectedStage('');
    setSearch('');
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    resetSelections();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-lg">Compartilhar Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="lead" className="gap-2">
                <Users className="h-4 w-4" />
                Leads
              </TabsTrigger>
              <TabsTrigger value="task" className="gap-2">
                <CheckSquare className="h-4 w-4" />
                Tarefas
              </TabsTrigger>
              <TabsTrigger value="funnel" className="gap-2">
                <Layers className="h-4 w-4" />
                Funis
              </TabsTrigger>
            </TabsList>

            {/* LEADS TAB */}
            <TabsContent value="lead" className="mt-4 space-y-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[320px]">
                  <div className="space-y-1">
                    {getFilteredLeads().map(lead => (
                      <div
                        key={lead.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Users className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{lead.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {lead.email || lead.telefone || lead.phone || 'Sem contato'}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {(lead.telefone || lead.phone) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenConversation(lead)}
                              className="h-8 w-8 p-0"
                              title="Abrir conversa"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShareLead(lead)}
                            className="h-8 px-3"
                          >
                            Enviar
                          </Button>
                        </div>
                      </div>
                    ))}
                    {getFilteredLeads().length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        {search ? 'Nenhum resultado encontrado' : 'Nenhum lead disponível'}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* TASKS TAB */}
            <TabsContent value="task" className="mt-4 space-y-3">
              {/* Board Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Quadro</label>
                <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um quadro" />
                  </SelectTrigger>
                  <SelectContent>
                    {boards.map(board => (
                      <SelectItem key={board.id} value={board.id}>
                        {board.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Column Selection */}
              {selectedBoard && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Coluna</label>
                  <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(column => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tasks List */}
              {selectedColumn && (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-1">
                    {getFilteredTasks().map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                      >
                        <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                          <CheckSquare className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.status}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShareTask(task)}
                          className="h-8 px-3"
                        >
                          Enviar
                        </Button>
                      </div>
                    ))}
                    {getFilteredTasks().length === 0 && (
                      <p className="text-center text-muted-foreground py-4 text-sm">
                        Nenhuma tarefa encontrada
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}

              {!selectedBoard && (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Selecione um quadro para ver as tarefas
                </p>
              )}
            </TabsContent>

            {/* FUNNELS TAB */}
            <TabsContent value="funnel" className="mt-4 space-y-3">
              {/* Funnel Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Funil</label>
                <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels.map(funnel => (
                      <SelectItem key={funnel.id} value={funnel.id}>
                        {funnel.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stage Selection */}
              {selectedFunnel && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Etapa (opcional)</label>
                  <Select value={selectedStage} onValueChange={setSelectedStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as etapas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as etapas</SelectItem>
                      {stages.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: stage.cor || '#3b82f6' }}
                            />
                            {stage.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Share Funnel Button */}
              {selectedFunnel && (
                <Button
                  variant="default"
                  onClick={handleShareFunnel}
                  className="w-full"
                >
                  <Layers className="h-4 w-4 mr-2" />
                  Compartilhar Funil
                </Button>
              )}

              {/* Leads in Funnel (optional) */}
              {selectedFunnel && funnelLeads.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Leads no funil (opcional)
                  </label>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-1">
                      {funnelLeads.map(lead => (
                        <div
                          key={lead.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Users className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{lead.name}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShareFunnelLead(lead)}
                            className="h-7 px-2 text-xs"
                          >
                            Enviar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {!selectedFunnel && (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Selecione um funil para continuar
                </p>
              )}
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
