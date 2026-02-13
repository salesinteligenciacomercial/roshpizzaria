import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  NodeChange,
  EdgeChange,
  Connection,
  BackgroundVariant,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, Play, Download, Upload, ArrowLeft, Settings2, Zap, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TriggerNode } from './nodes/TriggerNode';
import { ActionNode } from './nodes/ActionNode';
import { ConditionNode } from './nodes/ConditionNode';
import { IANode } from './nodes/IANode';
import { DelayNode } from './nodes/DelayNode';
import { MediaNode } from './nodes/MediaNode';
import { AIAgentNode } from './nodes/AIAgentNode';
import { InteractiveMenuNode } from './nodes/InteractiveMenuNode';
import { RouteDepartmentNode } from './nodes/RouteDepartmentNode';
import { NodePropertiesPanel } from './NodePropertiesPanel';
import { NodesSidebar } from './NodesSidebar';
import { FlowSettingsDialog } from './FlowSettingsDialog';
import { supabase } from '@/integrations/supabase/client';

interface AutomationFlow {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  active: boolean;
  company_id?: string;
  owner_id?: string;
  settings?: FlowSettings;
}

interface FlowSettings {
  schedule?: {
    enabled: boolean;
    days: string[];
    startTime: string;
    endTime: string;
  };
  filters?: {
    tags?: string[];
    funnels?: string[];
    stages?: string[];
  };
  limits?: {
    maxExecutions?: number;
    cooldownMinutes?: number;
  };
}

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  ia: IANode,
  delay: DelayNode,
  media: MediaNode,
  aiagent: AIAgentNode,
  interactive_menu: InteractiveMenuNode,
  route_department: RouteDepartmentNode,
};

interface VisualFlowBuilderProps {
  fluxoId?: string;
  onSave?: () => void;
  onBack?: () => void;
}

function FlowCanvas({ fluxoId, onSave, onBack }: VisualFlowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [flowName, setFlowName] = useState('Novo Fluxo');
  const [flowActive, setFlowActive] = useState(false);
  const [flowSettings, setFlowSettings] = useState<FlowSettings>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (fluxoId) {
      loadFlow(fluxoId);
    }
  }, [fluxoId]);

  const loadFlow = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('automation_flows' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const flowData = data as any;
        setFlowName(flowData.name || 'Fluxo sem nome');
        setNodes(flowData.nodes || []);
        setEdges(flowData.edges || []);
        setFlowActive(flowData.active || false);
        setFlowSettings(flowData.settings || {});
      }
    } catch (error) {
      console.error('Erro ao carregar fluxo:', error);
      toast.error('Erro ao carregar fluxo');
    }
  };

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      setHasChanges(true);
    },
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      setHasChanges(true);
    },
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({
        ...connection,
        animated: true,
        style: { stroke: '#64748b', strokeWidth: 2 },
      }, eds));
      setHasChanges(true);
    },
    []
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleDragStart = useCallback(
    (event: React.DragEvent, nodeType: string, subType: string, label: string) => {
      // Already handled in NodesSidebar
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-type');
      const subType = event.dataTransfer.getData('application/reactflow-subtype');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (!type || !reactFlowWrapper.current) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const getDataKey = (type: string) => {
        switch (type) {
          case 'trigger': return 'triggerType';
          case 'action': return 'actionType';
          case 'condition': return 'conditionType';
          case 'ia': return 'mode';
          case 'delay': return 'delayType';
          case 'media': return 'mediaType';
          case 'aiagent': return 'agentType';
          case 'interactive_menu': return 'menuType';
          case 'route_department': return 'routeType';
          default: return 'type';
        }
      };

      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position,
        data: {
          label: label || `Novo ${type}`,
          [getDataKey(type)]: subType,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setHasChanges(true);
      toast.success(`${label || type} adicionado!`);
    },
    [project]
  );

  const handleSaveFlow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRoles?.company_id) {
        throw new Error('Empresa não encontrada');
      }

      const flowData = {
        name: flowName,
        nodes: nodes as any,
        edges: edges as any,
        active: flowActive,
        settings: flowSettings as any,
        company_id: userRoles.company_id,
        owner_id: user.id,
        updated_at: new Date().toISOString(),
      };

      if (fluxoId) {
        const { error } = await supabase
          .from('automation_flows' as any)
          .update(flowData)
          .eq('id', fluxoId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('automation_flows' as any)
          .insert(flowData);

        if (error) throw error;
      }

      setHasChanges(false);
      toast.success('Fluxo salvo com sucesso!');
      onSave?.();
    } catch (error: any) {
      console.error('Erro ao salvar fluxo:', error);
      toast.error(error?.message || 'Erro ao salvar fluxo');
    }
  };

  const handleExportFlow = () => {
    const flowData = { name: flowName, nodes, edges, settings: flowSettings };
    const dataStr = JSON.stringify(flowData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${flowName.replace(/\s+/g, '_')}.json`;
    link.click();
    toast.success('Fluxo exportado!');
  };

  const handleImportFlow = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const flowData = JSON.parse(e.target?.result as string);
        setFlowName(flowData.name || 'Fluxo Importado');
        setNodes(flowData.nodes || []);
        setEdges(flowData.edges || []);
        setFlowSettings(flowData.settings || {});
        setHasChanges(true);
        toast.success('Fluxo importado com sucesso!');
      } catch (error) {
        toast.error('Erro ao importar fluxo');
      }
    };
    reader.readAsText(file);
  };

  const handleTestFlow = () => {
    if (nodes.length === 0) {
      toast.error('Adicione componentes ao fluxo antes de testar');
      return;
    }
    
    const hasTrigger = nodes.some(n => n.type === 'trigger');
    if (!hasTrigger) {
      toast.warning('Seu fluxo precisa de pelo menos um Gatilho');
      return;
    }
    
    toast.info('Iniciando simulação do fluxo...');
  };

  const handleUpdateNode = useCallback((updatedNode: Node) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setSelectedNode(updatedNode);
    setHasChanges(true);
  }, []);

  const toggleFlowActive = async () => {
    const newStatus = !flowActive;
    setFlowActive(newStatus);
    setHasChanges(true);
    
    if (fluxoId) {
      try {
        await supabase
          .from('automation_flows')
          .update({ active: newStatus })
          .eq('id', fluxoId);
        toast.success(newStatus ? 'Fluxo ativado!' : 'Fluxo desativado');
      } catch (error) {
        toast.error('Erro ao atualizar status');
      }
    }
  };

  const getFlowValidation = () => {
    const issues: string[] = [];
    
    if (nodes.length === 0) {
      issues.push('Adicione componentes ao fluxo');
    }
    
    const hasTrigger = nodes.some(n => n.type === 'trigger');
    if (!hasTrigger && nodes.length > 0) {
      issues.push('Adicione um Gatilho para iniciar');
    }
    
    const orphanNodes = nodes.filter(n => {
      if (n.type === 'trigger') return false;
      const hasIncoming = edges.some(e => e.target === n.id);
      return !hasIncoming;
    });
    
    if (orphanNodes.length > 0) {
      issues.push(`${orphanNodes.length} componente(s) não conectado(s)`);
    }
    
    return issues;
  };

  const validationIssues = getFlowValidation();

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Sidebar com nodes arrastáveis */}
      <NodesSidebar onDragStart={handleDragStart} />

      {/* Canvas Central */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar Superior */}
        <div className="flex items-center gap-3 p-3 bg-slate-900/95 border-b border-slate-800 backdrop-blur-sm">
          {onBack && (
            <Button 
              onClick={onBack} 
              size="sm" 
              variant="ghost" 
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          )}
          
          <div className="flex items-center gap-2">
            <Zap className={`h-5 w-5 ${flowActive ? 'text-emerald-400' : 'text-slate-500'}`} />
            <Input
              type="text"
              value={flowName}
              onChange={(e) => { setFlowName(e.target.value); setHasChanges(true); }}
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="max-w-[200px] bg-slate-800 text-white border-slate-700 font-semibold"
              placeholder="Nome do Fluxo"
            />
          </div>
          
          <Button
            onClick={toggleFlowActive}
            size="sm"
            variant={flowActive ? "default" : "outline"}
            className={flowActive ? "bg-emerald-600 hover:bg-emerald-700" : "border-slate-700"}
          >
            {flowActive ? "Ativo" : "Inativo"}
          </Button>

          {hasChanges && (
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/50">
              Não salvo
            </Badge>
          )}

          {validationIssues.length > 0 && (
            <Badge variant="outline" className="text-orange-400 border-orange-400/50 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {validationIssues.length} aviso(s)
            </Badge>
          )}
          
          <div className="flex-1" />

          <Button 
            onClick={() => setSettingsOpen(true)} 
            size="sm" 
            variant="outline" 
            className="border-slate-700 text-slate-300 hover:text-white"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Regras
          </Button>
          
          <Button onClick={handleSaveFlow} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
          <Button onClick={handleTestFlow} size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:text-white">
            <Play className="h-4 w-4 mr-2" />
            Testar
          </Button>
          <Button onClick={handleExportFlow} size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:text-white">
            <Download className="h-4 w-4" />
          </Button>
          <label>
            <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:text-white cursor-pointer" asChild>
              <span>
                <Upload className="h-4 w-4" />
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFlow}
              className="hidden"
            />
          </label>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            nodesFocusable={false}
            edgesFocusable={false}
            selectNodesOnDrag={false}
            fitView
            className="bg-slate-950"
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={20} 
              size={1} 
              color="#334155" 
            />
            <Controls className="bg-slate-900 border-slate-700 [&>button]:bg-slate-800 [&>button]:border-slate-700 [&>button]:text-white [&>button:hover]:bg-slate-700" />
            <MiniMap 
              className="bg-slate-900 border border-slate-700" 
              nodeColor={(node) => {
                switch (node.type) {
                  case 'trigger': return '#10b981';
                  case 'action': return '#f59e0b';
                  case 'condition': return '#8b5cf6';
                  case 'ia': return '#3b82f6';
                  case 'delay': return '#64748b';
                  case 'media': return '#ec4899';
                  case 'interactive_menu': return '#14b8a6';
                  case 'route_department': return '#f43f5e';
                  case 'aiagent': return '#06b6d4';
                  default: return '#6b7280';
                }
              }}
              maskColor="rgba(15, 23, 42, 0.8)"
            />
          </ReactFlow>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-500">
          <span>{nodes.length} componente(s) • {edges.length} conexão(ões)</span>
          <span>Arraste componentes da sidebar para o canvas</span>
        </div>
      </div>

      {/* Painel Lateral de Propriedades */}
      <NodePropertiesPanel 
        selectedNode={selectedNode} 
        onUpdate={handleUpdateNode}
      />

      {/* Dialog de Configurações */}
      <FlowSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={flowSettings}
        onSave={(newSettings) => {
          setFlowSettings(newSettings);
          setHasChanges(true);
          setSettingsOpen(false);
          toast.success('Regras atualizadas!');
        }}
      />
    </div>
  );
}

export function VisualFlowBuilder(props: VisualFlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
