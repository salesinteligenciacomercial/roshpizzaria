import { Handle, Position } from 'reactflow';
import { Send, UserPlus, Calendar, GitBranch, Bell, FileText, Bot } from 'lucide-react';

export function ActionNode({ data }: any) {
  const getActionIcon = () => {
    switch (data.actionType) {
      case 'enviar_mensagem':
        return <Send className="h-5 w-5" />;
      case 'criar_lead':
        return <UserPlus className="h-5 w-5" />;
      case 'criar_tarefa':
        return <Calendar className="h-5 w-5" />;
      case 'mover_funil':
        return <GitBranch className="h-5 w-5" />;
      case 'notificar_usuario':
        return <Bell className="h-5 w-5" />;
      case 'adicionar_nota':
        return <FileText className="h-5 w-5" />;
      case 'acionar_ia':
        return <Bot className="h-5 w-5" />;
      default:
        return <Send className="h-5 w-5" />;
    }
  };

  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 border-2 border-amber-400 min-w-[220px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-amber-300 !border-2 !border-white"
      />
      
      <div className="flex items-center gap-3 text-white">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          {getActionIcon()}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
            Ação
          </div>
          <div className="font-bold text-sm">
            {data.label || 'Nova Ação'}
          </div>
        </div>
      </div>
      
      {data.description && (
        <div className="mt-2 text-xs text-white/80">
          {data.description}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-amber-300 !border-2 !border-white"
      />
    </div>
  );
}
