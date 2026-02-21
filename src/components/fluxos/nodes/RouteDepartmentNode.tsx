import { Handle, Position } from 'reactflow';
import { Building2 } from 'lucide-react';

export function RouteDepartmentNode({ data }: any) {
  return (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 border-2 border-rose-400 min-w-[220px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-rose-300 !border-2 !border-white"
      />
      
      <div className="flex items-center gap-3 text-white">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
            Roteamento
          </div>
          <div className="font-bold text-sm">
            {data.label || 'Direcionar Departamento'}
          </div>
        </div>
      </div>
      
      {data.department && (
        <div className="mt-2 text-xs text-white/80">
          📍 {data.department}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-rose-300 !border-2 !border-white"
      />
    </div>
  );
}
