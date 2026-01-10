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
  Phone,
  Image,
  Video,
  Mic,
  Paperclip,
  Headphones,
  Brain,
  Filter,
  Tag,
  Users,
  ShoppingCart,
  CreditCard,
  Globe,
  Database,
  RefreshCw
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const nodeCategories = [
  {
    name: 'Gatilhos',
    description: 'Inicie o fluxo com eventos',
    color: 'text-emerald-400',
    nodes: [
      { type: 'trigger', label: 'Nova Mensagem', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'nova_mensagem' },
      { type: 'trigger', label: 'Novo Lead', icon: <UserPlus className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'novo_lead' },
      { type: 'trigger', label: 'Lead Movido', icon: <GitBranch className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'lead_movido' },
      { type: 'trigger', label: 'Horário Agendado', icon: <Clock className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'horario' },
      { type: 'trigger', label: 'Webhook', icon: <Webhook className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'webhook' },
      { type: 'trigger', label: 'Tag Adicionada', icon: <Tag className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'tag_added' },
      { type: 'trigger', label: 'Compromisso Criado', icon: <Calendar className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'compromisso' },
    ]
  },
  {
    name: 'Mensagens',
    description: 'Envie mensagens e mídias',
    color: 'text-amber-400',
    nodes: [
      { type: 'action', label: 'Enviar Texto', icon: <Send className="h-4 w-4" />, color: 'bg-amber-500', subType: 'enviar_mensagem' },
      { type: 'media', label: 'Enviar Imagem', icon: <Image className="h-4 w-4" />, color: 'bg-pink-500', subType: 'imagem' },
      { type: 'media', label: 'Enviar Vídeo', icon: <Video className="h-4 w-4" />, color: 'bg-pink-500', subType: 'video' },
      { type: 'media', label: 'Enviar Áudio', icon: <Mic className="h-4 w-4" />, color: 'bg-pink-500', subType: 'audio' },
      { type: 'media', label: 'Enviar Documento', icon: <FileText className="h-4 w-4" />, color: 'bg-pink-500', subType: 'documento' },
      { type: 'media', label: 'Enviar Arquivo', icon: <Paperclip className="h-4 w-4" />, color: 'bg-pink-500', subType: 'arquivo' },
    ]
  },
  {
    name: 'Agentes de IA',
    description: 'Use IAs treinadas',
    color: 'text-blue-400',
    badge: 'NOVO',
    nodes: [
      { type: 'aiagent', label: 'IA Atendimento', icon: <Headphones className="h-4 w-4" />, color: 'bg-cyan-500', subType: 'atendimento' },
      { type: 'aiagent', label: 'IA Agendamento', icon: <Calendar className="h-4 w-4" />, color: 'bg-indigo-500', subType: 'agendamento' },
      { type: 'aiagent', label: 'IA Vendas', icon: <ShoppingCart className="h-4 w-4" />, color: 'bg-emerald-500', subType: 'vendas' },
      { type: 'aiagent', label: 'IA Suporte', icon: <Brain className="h-4 w-4" />, color: 'bg-orange-500', subType: 'suporte' },
      { type: 'aiagent', label: 'IA Qualificação', icon: <Sparkles className="h-4 w-4" />, color: 'bg-purple-500', subType: 'qualificacao' },
      { type: 'ia', label: 'IA Personalizada', icon: <Bot className="h-4 w-4" />, color: 'bg-blue-500', subType: 'custom' },
    ]
  },
  {
    name: 'Integrações',
    description: 'Conecte com canais',
    color: 'text-green-400',
    nodes: [
      { type: 'action', label: 'WhatsApp', icon: <Phone className="h-4 w-4" />, color: 'bg-green-600', subType: 'whatsapp' },
      { type: 'action', label: 'Instagram', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-gradient-to-br from-purple-500 to-pink-500', subType: 'instagram' },
      { type: 'action', label: 'Email', icon: <Mail className="h-4 w-4" />, color: 'bg-red-500', subType: 'email' },
      { type: 'action', label: 'Webhook', icon: <Globe className="h-4 w-4" />, color: 'bg-slate-500', subType: 'webhook' },
      { type: 'action', label: 'API Externa', icon: <Database className="h-4 w-4" />, color: 'bg-slate-600', subType: 'api' },
    ]
  },
  {
    name: 'Ações CRM',
    description: 'Gerencie leads e tarefas',
    color: 'text-orange-400',
    nodes: [
      { type: 'action', label: 'Criar Lead', icon: <UserPlus className="h-4 w-4" />, color: 'bg-amber-500', subType: 'criar_lead' },
      { type: 'action', label: 'Mover no Funil', icon: <Target className="h-4 w-4" />, color: 'bg-amber-500', subType: 'mover_funil' },
      { type: 'action', label: 'Adicionar Tag', icon: <Tag className="h-4 w-4" />, color: 'bg-amber-500', subType: 'adicionar_tag' },
      { type: 'action', label: 'Criar Tarefa', icon: <Calendar className="h-4 w-4" />, color: 'bg-amber-500', subType: 'criar_tarefa' },
      { type: 'action', label: 'Atribuir Responsável', icon: <Users className="h-4 w-4" />, color: 'bg-amber-500', subType: 'atribuir_responsavel' },
      { type: 'action', label: 'Adicionar Nota', icon: <FileText className="h-4 w-4" />, color: 'bg-amber-500', subType: 'adicionar_nota' },
      { type: 'action', label: 'Notificar Usuário', icon: <Bell className="h-4 w-4" />, color: 'bg-amber-500', subType: 'notificar_usuario' },
      { type: 'action', label: 'Agendar Compromisso', icon: <Calendar className="h-4 w-4" />, color: 'bg-amber-500', subType: 'agendar_compromisso' },
    ]
  },
  {
    name: 'Condições',
    description: 'Defina regras e caminhos',
    color: 'text-violet-400',
    nodes: [
      { type: 'condition', label: 'Verificar Tag', icon: <Tag className="h-4 w-4" />, color: 'bg-violet-500', subType: 'tag' },
      { type: 'condition', label: 'Verificar Etapa', icon: <Target className="h-4 w-4" />, color: 'bg-violet-500', subType: 'etapa' },
      { type: 'condition', label: 'Verificar Horário', icon: <Clock className="h-4 w-4" />, color: 'bg-violet-500', subType: 'horario' },
      { type: 'condition', label: 'Palavra-Chave', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-violet-500', subType: 'palavra_chave' },
      { type: 'condition', label: 'Filtro Avançado', icon: <Filter className="h-4 w-4" />, color: 'bg-violet-500', subType: 'filtro' },
      { type: 'condition', label: 'Dia da Semana', icon: <Calendar className="h-4 w-4" />, color: 'bg-violet-500', subType: 'dia_semana' },
    ]
  },
  {
    name: 'Controle',
    description: 'Controle o fluxo',
    color: 'text-slate-400',
    nodes: [
      { type: 'delay', label: 'Aguardar Tempo', icon: <Timer className="h-4 w-4" />, color: 'bg-slate-600', subType: 'tempo' },
      { type: 'delay', label: 'Aguardar Evento', icon: <Clock className="h-4 w-4" />, color: 'bg-slate-600', subType: 'evento' },
      { type: 'delay', label: 'Loop/Repetir', icon: <RefreshCw className="h-4 w-4" />, color: 'bg-slate-600', subType: 'loop' },
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
    <div className="w-72 bg-slate-900 border-r border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <h3 className="font-bold text-white text-lg">Componentes</h3>
        <p className="text-xs text-slate-400 mt-1">Arraste para o canvas</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-5">
          {nodeCategories.map((category) => (
            <div key={category.name} className="space-y-2">
              <div className="px-2 flex items-center justify-between">
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${category.color}`}>
                    {category.name}
                  </h4>
                  <p className="text-[10px] text-slate-500">{category.description}</p>
                </div>
                {category.badge && (
                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-blue-600">
                    {category.badge}
                  </Badge>
                )}
              </div>
              
              <div className="space-y-1">
                {category.nodes.map((node, index) => (
                  <div
                    key={`${node.type}-${node.subType}-${index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node)}
                    className={`
                      flex items-center gap-3 p-2.5 rounded-lg cursor-grab active:cursor-grabbing
                      bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 
                      hover:border-slate-600 transition-all duration-200
                      hover:shadow-lg hover:shadow-slate-900/50 hover:scale-[1.02]
                      group
                    `}
                  >
                    <div className={`p-1.5 rounded-md ${node.color} shadow-sm group-hover:shadow-md transition-shadow`}>
                      {node.icon}
                    </div>
                    <span className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">
                      {node.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t border-slate-700 bg-slate-800/50">
        <p className="text-[10px] text-slate-500 text-center">
          💡 Dica: Conecte os nodes arrastando das bolinhas
        </p>
      </div>
    </div>
  );
}
