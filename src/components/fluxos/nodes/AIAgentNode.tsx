import { Handle, Position } from 'reactflow';
import { Bot, Sparkles, Calendar, MessageCircle, Brain, Headphones } from 'lucide-react';

export function AIAgentNode({ data }: any) {
  const getAgentIcon = () => {
    switch (data.agentType) {
      case 'atendimento':
        return <Headphones className="h-5 w-5" />;
      case 'agendamento':
        return <Calendar className="h-5 w-5" />;
      case 'vendas':
        return <MessageCircle className="h-5 w-5" />;
      case 'suporte':
        return <Brain className="h-5 w-5" />;
      case 'qualificacao':
        return <Sparkles className="h-5 w-5" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  const getAgentLabel = () => {
    switch (data.agentType) {
      case 'atendimento': return 'IA Atendimento';
      case 'agendamento': return 'IA Agendamento';
      case 'vendas': return 'IA Vendas';
      case 'suporte': return 'IA Suporte';
      case 'qualificacao': return 'IA Qualificação';
      default: return 'Agente IA';
    }
  };

  const getAgentColor = () => {
    switch (data.agentType) {
      case 'atendimento': return 'from-cyan-500 to-cyan-600 border-cyan-400';
      case 'agendamento': return 'from-indigo-500 to-indigo-600 border-indigo-400';
      case 'vendas': return 'from-emerald-500 to-emerald-600 border-emerald-400';
      case 'suporte': return 'from-orange-500 to-orange-600 border-orange-400';
      case 'qualificacao': return 'from-purple-500 to-purple-600 border-purple-400';
      default: return 'from-blue-500 to-blue-600 border-blue-400';
    }
  };

  return (
    <div className={`px-6 py-4 shadow-lg rounded-lg bg-gradient-to-br ${getAgentColor()} border-2 min-w-[240px] max-w-[260px] break-words relative overflow-hidden`}>
      {/* Efeito de brilho animado */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
      
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-white/80 !border-2 !border-white"
      />
      
      <div className="flex items-center gap-3 text-white relative z-10">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          {getAgentIcon()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide opacity-90">
            <Sparkles className="h-3 w-3" />
            {getAgentLabel()}
          </div>
          <div className="font-bold text-sm">
            {data.label || 'Chamar Agente IA'}
          </div>
        </div>
      </div>
      
      {data.prompt && (
        <div className="mt-2 text-xs text-white/80 bg-white/10 rounded p-2 backdrop-blur-sm">
          💬 {data.prompt.substring(0, 50)}...
        </div>
      )}
      
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
          data.mode === 'auto' ? 'bg-green-400/30 text-green-100' : 'bg-yellow-400/30 text-yellow-100'
        }`}>
          {data.mode === 'auto' ? '🤖 Automático' : '👤 Assistido'}
        </span>
        {data.learning && (
          <span className="text-[10px] px-2 py-1 bg-blue-400/30 rounded-full font-semibold text-blue-100">
            📚 Aprendendo
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-white/80 !border-2 !border-white"
      />
    </div>
  );
}
