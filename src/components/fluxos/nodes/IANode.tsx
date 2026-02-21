import { Handle, Position } from 'reactflow';
import { Bot, Sparkles } from 'lucide-react';

export function IANode({ data }: any) {
  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-blue-400 min-w-[240px] relative overflow-hidden">
      {/* Efeito de brilho */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
      
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-blue-300 !border-2 !border-white"
      />
      
      <div className="flex items-center gap-3 text-white relative z-10">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide opacity-90">
            <Sparkles className="h-3 w-3" />
            IA Conversacional
          </div>
          <div className="font-bold text-sm">
            {data.label || 'Interação IA'}
          </div>
        </div>
      </div>
      
      {data.prompt && (
        <div className="mt-2 text-xs text-white/80 bg-white/10 rounded p-2 backdrop-blur-sm">
          {data.prompt.substring(0, 60)}...
        </div>
      )}
      
      {data.mode && (
        <div className="mt-2">
          <span className="text-[10px] px-2 py-1 bg-white/20 rounded-full font-semibold">
            {data.mode === 'auto' ? '🤖 Automático' : '👤 Assistido'}
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-blue-300 !border-2 !border-white"
      />
    </div>
  );
}
