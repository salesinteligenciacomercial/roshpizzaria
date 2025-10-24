import { useState, useCallback, useEffect } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Save, Play, Download, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { TriggerNode } from './nodes/TriggerNode';
import { ActionNode } from './nodes/ActionNode';
import { ConditionNode } from './nodes/ConditionNode';
import { IANode } from './nodes/IANode';
import { NodePropertiesPanel } from './NodePropertiesPanel';
import { NodeToolbar } from './NodeToolbar';
import { supabase } from '@/integrations/supabase/client';

interface AutomationFlow {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  active: boolean;
  company_id?: string;
  owner_id?: string;
}

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  ia: IANode,
};

interface VisualFlowBuilderProps {
  fluxoId?: string;
  onSave?: () => void;
}

export function VisualFlowBuilder({ fluxoId, onSave }: VisualFlowBuilderProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [flowName, setFlowName] = useState('Novo Fluxo');

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
      }
    } catch (error) {
      console.error('Erro ao carregar fluxo:', error);
      toast.error('Erro ao carregar fluxo');
    }
  };

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleSaveFlow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Get company_id from user_roles
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
        active: true,
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

      toast.success('Fluxo salvo com sucesso!');
      onSave?.();
    } catch (error: any) {
      console.error('Erro ao salvar fluxo:', error);
      toast.error(error?.message || 'Erro ao salvar fluxo');
    }
  };

  const handleExportFlow = () => {
    const flowData = { name: flowName, nodes, edges };
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
        toast.success('Fluxo importado com sucesso!');
      } catch (error) {
        toast.error('Erro ao importar fluxo');
      }
    };
    reader.readAsText(file);
  };

  const handleTestFlow = () => {
    toast.info('Iniciando simulação do fluxo...');
    // Implementar lógica de simulação
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Canvas Principal */}
      <Card className="flex-1 relative border-0 bg-slate-950 overflow-hidden">
        {/* Toolbar Superior */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="px-4 py-2 bg-slate-900/90 text-white border border-slate-700 rounded-lg font-semibold min-w-[200px]"
            placeholder="Nome do Fluxo"
          />
          <Button onClick={handleSaveFlow} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
          <Button onClick={handleTestFlow} size="sm" variant="outline" className="bg-slate-900/90 border-slate-700">
            <Play className="h-4 w-4 mr-2" />
            Testar
          </Button>
          <Button onClick={handleExportFlow} size="sm" variant="outline" className="bg-slate-900/90 border-slate-700">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <label>
            <Button size="sm" variant="outline" className="bg-slate-900/90 border-slate-700" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Importar
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
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-950"
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={16} 
            size={1} 
            color="#1e293b" 
          />
          <Controls className="bg-slate-900 border-slate-700" />
          <MiniMap 
            className="bg-slate-900 border border-slate-700" 
            nodeColor={(node) => {
              switch (node.type) {
                case 'trigger': return '#10b981';
                case 'action': return '#f59e0b';
                case 'condition': return '#8b5cf6';
                case 'ia': return '#3b82f6';
                default: return '#6b7280';
              }
            }}
          />
        </ReactFlow>

        {/* Node Toolbar */}
        <NodeToolbar setNodes={setNodes} setEdges={setEdges} />
      </Card>

      {/* Painel Lateral de Propriedades */}
      <NodePropertiesPanel 
        selectedNode={selectedNode} 
        onUpdate={(updatedNode) => {
          setNodes((nds) =>
            nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
          );
        }}
      />
    </div>
  );
}
