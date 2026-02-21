import { Handle, Position } from 'reactflow';
import { MessageSquare, UserPlus, GitBranch, Clock, Zap, Hash } from 'lucide-react';

export function TriggerNode({ data }: any) {
  const getTriggerIcon = () => {
    switch (data.triggerType) {
      case 'nova_mensagem':
        return <MessageSquare className="h-5 w-5" />;
      case 'novo_lead':
        return <UserPlus className="h-5 w-5" />;
      case 'lead_movido':
        return <GitBranch className="h-5 w-5" />;
      case 'horario':
        return <Clock className="h-5 w-5" />;
      case 'palavra_chave':
        return <Hash className="h-5 w-5" />;
      default:
        return <Zap className="h-5 w-5" />;
    }
  };

  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 border-2 border-emerald-400 min-w-[220px]">
      <div className="flex items-center gap-3 text-white">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          {getTriggerIcon()}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
            Gatilho
          </div>
          <div className="font-bold text-sm">
            {data.label || 'Novo Gatilho'}
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
        className="w-3 h-3 !bg-emerald-300 !border-2 !border-white"
      />
    </div>
  );
}
