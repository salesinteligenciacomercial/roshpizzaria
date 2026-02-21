import { Handle, Position } from 'reactflow';
import { GitBranch, Tag, Clock, MessageCircle } from 'lucide-react';

export function ConditionNode({ data }: any) {
  const getConditionIcon = () => {
    switch (data.conditionType) {
      case 'tag':
        return <Tag className="h-5 w-5" />;
      case 'etapa':
        return <GitBranch className="h-5 w-5" />;
      case 'horario':
        return <Clock className="h-5 w-5" />;
      case 'palavra_chave':
        return <MessageCircle className="h-5 w-5" />;
      default:
        return <GitBranch className="h-5 w-5" />;
    }
  };

  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 border-2 border-violet-400 min-w-[220px] max-w-[260px] break-words">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-violet-300 !border-2 !border-white"
      />
      
      <div className="flex items-center gap-3 text-white">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          {getConditionIcon()}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
            Condição
          </div>
          <div className="font-bold text-sm">
            {data.label || 'Nova Condição'}
          </div>
        </div>
      </div>
      
      {data.description && (
        <div className="mt-2 text-xs text-white/80">
          {data.description}
        </div>
      )}

      {/* Duas saídas: Sim e Não */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '35%' }}
        className="w-3 h-3 !bg-green-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '65%' }}
        className="w-3 h-3 !bg-red-400 !border-2 !border-white"
      />
      
      <div className="absolute right-[-40px] top-0 bottom-0 flex flex-col justify-center gap-4 text-[10px] text-white/70 font-semibold">
        <span>SIM</span>
        <span>NÃO</span>
      </div>
    </div>
  );
}
