import { Handle, Position } from 'reactflow';
import { LayoutList } from 'lucide-react';

export function InteractiveMenuNode({ data }: any) {
  const buttons = data.buttons || [];

  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 border-2 border-teal-400 min-w-[240px] max-w-[260px] break-words">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-teal-300 !border-2 !border-white"
      />
      
      <div className="flex items-center gap-3 text-white">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          <LayoutList className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
            Menu Interativo
          </div>
          <div className="font-bold text-sm">
            {data.label || 'Menu com Botões'}
          </div>
        </div>
      </div>
      
      {buttons.length > 0 && (
        <div className="mt-3 space-y-1">
          {buttons.slice(0, 3).map((btn: any, i: number) => (
            <div key={i} className="text-[10px] bg-white/15 rounded px-2 py-1 text-white/90">
              🔘 {btn.label || `Botão ${i + 1}`}
            </div>
          ))}
          {buttons.length > 3 && (
            <div className="text-[10px] text-white/60">+{buttons.length - 3} botões...</div>
          )}
        </div>
      )}

      {/* Multiple output handles for each button */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-teal-300 !border-2 !border-white"
      />
    </div>
  );
}
