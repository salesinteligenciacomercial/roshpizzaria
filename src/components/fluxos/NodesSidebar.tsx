import { 
  Zap, 
  Send, 
  GitBranch, 
  Bot, 
  Webhook, 
  Clock, 
  Mail, 
  MessageSquare,
  Calendar,
  UserPlus,
  Target,
  Bell,
  FileText,
  Timer,
  Sparkles,
  Phone
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DraggableNodeProps {
  type: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  category: string;
}

const nodeCategories = [
  {
    name: 'Gatilhos',
    description: 'Inicie o fluxo com eventos',
    nodes: [
      { type: 'trigger', label: 'Nova Mensagem', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'nova_mensagem' },
      { type: 'trigger', label: 'Novo Lead', icon: <UserPlus className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'novo_lead' },
      { type: 'trigger', label: 'Lead Movido', icon: <GitBranch className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'lead_movido' },
      { type: 'trigger', label: 'Horário', icon: <Clock className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'horario' },
      { type: 'trigger', label: 'Webhook', icon: <Webhook className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'webhook' },
    ]
  },
  {
    name: 'Ações',
    description: 'Execute tarefas automaticamente',
    nodes: [
      { type: 'action', label: 'Enviar Mensagem', icon: <Send className="h-4 w-4" />, color: 'bg-amber-500', subType: 'enviar_mensagem' },
      { type: 'action', label: 'Criar Lead', icon: <UserPlus className="h-4 w-4" />, color: 'bg-amber-500', subType: 'criar_lead' },
      { type: 'action', label: 'Criar Tarefa', icon: <Calendar className="h-4 w-4" />, color: 'bg-amber-500', subType: 'criar_tarefa' },
      { type: 'action', label: 'Mover no Funil', icon: <Target className="h-4 w-4" />, color: 'bg-amber-500', subType: 'mover_funil' },
      { type: 'action', label: 'Notificar Usuário', icon: <Bell className="h-4 w-4" />, color: 'bg-amber-500', subType: 'notificar_usuario' },
      { type: 'action', label: 'Adicionar Nota', icon: <FileText className="h-4 w-4" />, color: 'bg-amber-500', subType: 'adicionar_nota' },
    ]
  },
  {
    name: 'Integrações',
    description: 'Conecte com serviços externos',
    nodes: [
      { type: 'action', label: 'WhatsApp', icon: <Phone className="h-4 w-4" />, color: 'bg-green-600', subType: 'whatsapp' },
      { type: 'action', label: 'Email', icon: <Mail className="h-4 w-4" />, color: 'bg-red-500', subType: 'email' },
      { type: 'action', label: 'Webhook', icon: <Webhook className="h-4 w-4" />, color: 'bg-slate-500', subType: 'webhook' },
    ]
  },
  {
    name: 'Condições',
    description: 'Defina regras e caminhos',
    nodes: [
      { type: 'condition', label: 'Verificar Tag', icon: <GitBranch className="h-4 w-4" />, color: 'bg-violet-500', subType: 'tag' },
      { type: 'condition', label: 'Verificar Etapa', icon: <Target className="h-4 w-4" />, color: 'bg-violet-500', subType: 'etapa' },
      { type: 'condition', label: 'Verificar Horário', icon: <Clock className="h-4 w-4" />, color: 'bg-violet-500', subType: 'horario' },
      { type: 'condition', label: 'Palavra-Chave', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-violet-500', subType: 'palavra_chave' },
    ]
  },
  {
    name: 'Inteligência Artificial',
    description: 'Use IA para respostas inteligentes',
    nodes: [
      { type: 'ia', label: 'IA Atendimento', icon: <Bot className="h-4 w-4" />, color: 'bg-blue-500', subType: 'atendimento' },
      { type: 'ia', label: 'Classificar Intenção', icon: <Sparkles className="h-4 w-4" />, color: 'bg-blue-500', subType: 'classificar' },
      { type: 'ia', label: 'Gerar Resposta', icon: <Bot className="h-4 w-4" />, color: 'bg-blue-500', subType: 'resposta' },
    ]
  },
  {
    name: 'Controle',
    description: 'Controle o fluxo de execução',
    nodes: [
      { type: 'delay', label: 'Aguardar Tempo', icon: <Timer className="h-4 w-4" />, color: 'bg-slate-600', subType: 'tempo' },
      { type: 'delay', label: 'Aguardar Evento', icon: <Clock className="h-4 w-4" />, color: 'bg-slate-600', subType: 'evento' },
    ]
  },
];

interface NodesSidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: string, subType: string, label: string) => void;
}

export function NodesSidebar({ onDragStart }: NodesSidebarProps) {
  const handleDragStart = (event: React.DragEvent, node: { type: string; subType: string; label: string }) => {
    event.dataTransfer.setData('application/reactflow-type', node.type);
    event.dataTransfer.setData('application/reactflow-subtype', node.subType);
    event.dataTransfer.setData('application/reactflow-label', node.label);
    event.dataTransfer.effectAllowed = 'move';
    onDragStart(event, node.type, node.subType, node.label);
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <h3 className="font-bold text-white text-lg">Componentes</h3>
        <p className="text-xs text-slate-400 mt-1">Arraste para o canvas</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {nodeCategories.map((category) => (
            <div key={category.name} className="space-y-2">
              <div className="px-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {category.name}
                </h4>
                <p className="text-[10px] text-slate-500">{category.description}</p>
              </div>
              
              <div className="space-y-1">
                {category.nodes.map((node, index) => (
                  <div
                    key={`${node.type}-${node.subType}-${index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node)}
                    className={`
                      flex items-center gap-3 p-2.5 rounded-lg cursor-grab active:cursor-grabbing
                      bg-slate-800 hover:bg-slate-750 border border-slate-700 
                      hover:border-slate-600 transition-all duration-200
                      hover:shadow-lg hover:scale-[1.02]
                    `}
                  >
                    <div className={`p-1.5 rounded-md ${node.color}`}>
                      {node.icon}
                    </div>
                    <span className="text-sm text-slate-200 font-medium">
                      {node.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
