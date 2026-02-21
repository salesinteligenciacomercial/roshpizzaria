import { Handle, Position } from 'reactflow';
import { Timer, Clock } from 'lucide-react';

export function DelayNode({ data }: any) {
  const getDelayIcon = () => {
    switch (data.delayType) {
      case 'tempo':
        return <Timer className="h-5 w-5" />;
      case 'evento':
        return <Clock className="h-5 w-5" />;
      default:
        return <Timer className="h-5 w-5" />;
    }
  };

  const formatDelay = () => {
    if (data.delayValue && data.delayUnit) {
      return `${data.delayValue} ${data.delayUnit}`;
    }
    return null;
  };

  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 border-2 border-slate-500 min-w-[220px] max-w-[260px] break-words">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-slate-400 !border-2 !border-white"
      />
      
      <div className="flex items-center gap-3 text-white">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          {getDelayIcon()}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
            Aguardar
          </div>
          <div className="font-bold text-sm">
            {data.label || 'Delay'}
          </div>
        </div>
      </div>
      
      {formatDelay() && (
        <div className="mt-2 text-xs text-white/80 bg-white/10 rounded p-2">
          ⏱️ {formatDelay()}
        </div>
      )}
      
      {data.description && (
        <div className="mt-2 text-xs text-white/70">
          {data.description}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-slate-400 !border-2 !border-white"
      />
    </div>
  );
}
