import { useState, useRef, useEffect } from 'react';
import { Node, Edge } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, RotateCcw, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  from: 'bot' | 'user';
  buttons?: { label: string; value: string }[];
}

interface FlowPreviewSimulatorProps {
  nodes: Node[];
  edges: Edge[];
  open: boolean;
  onClose: () => void;
}

export function FlowPreviewSimulator({ nodes, edges, open, onClose }: FlowPreviewSimulatorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) resetSimulation();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const resetSimulation = () => {
    setMessages([]);
    setUserInput('');
    setWaitingForInput(false);
    // Find trigger node and start
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      setMessages([{ id: '0', text: '⚠️ Nenhum gatilho encontrado no fluxo.', from: 'bot' }]);
      return;
    }
    setCurrentNodeId(triggerNode.id);
    setTimeout(() => executeNode(triggerNode.id), 300);
  };

  const executeNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const label = node.data?.label || '';
    const description = node.data?.description || '';

    switch (node.type) {
      case 'trigger': {
        const text = description || label || 'Fluxo iniciado';
        addBotMessage(text);
        goToNext(nodeId);
        break;
      }
      case 'action': {
        const text = description || label || 'Ação executada';
        addBotMessage(`📤 ${text}`);
        goToNext(nodeId);
        break;
      }
      case 'interactive_menu': {
        const buttons = node.data?.buttons || [];
        const text = description || label || 'Escolha uma opção:';
        addBotMessage(text, buttons.map((b: any, i: number) => ({
          label: b.label || `Opção ${i + 1}`,
          value: b.label || `${i + 1}`,
        })));
        setCurrentNodeId(nodeId);
        setWaitingForInput(true);
        break;
      }
      case 'route_department': {
        const dept = node.data?.department || 'departamento';
        addBotMessage(`🔀 Direcionando para: ${dept}`);
        goToNext(nodeId);
        break;
      }
      case 'condition': {
        addBotMessage(`🔍 Verificando condição: ${label}`);
        // Follow first edge (simulated as "true")
        goToNext(nodeId);
        break;
      }
      case 'ia': {
        addBotMessage(`🤖 IA processando: ${label}`);
        goToNext(nodeId);
        break;
      }
      case 'delay': {
        addBotMessage(`⏳ Aguardando: ${label}`);
        setTimeout(() => goToNext(nodeId), 1000);
        break;
      }
      default: {
        addBotMessage(`▶️ ${label || node.type}`);
        goToNext(nodeId);
      }
    }
  };

  const goToNext = (fromNodeId: string) => {
    const outEdges = edges.filter(e => e.source === fromNodeId);
    if (outEdges.length === 0) {
      setTimeout(() => addBotMessage('✅ Fim do fluxo.'), 500);
      return;
    }
    // Follow first edge
    setTimeout(() => executeNode(outEdges[0].target), 600);
  };

  const addBotMessage = (text: string, buttons?: { label: string; value: string }[]) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      text,
      from: 'bot',
      buttons,
    }]);
  };

  const handleUserResponse = (response: string) => {
    if (!response.trim()) return;
    setMessages(prev => [...prev, { id: crypto.randomUUID(), text: response, from: 'user' }]);
    setUserInput('');
    setWaitingForInput(false);

    if (!currentNodeId) return;

    // Find matching edge based on button click or text
    const node = nodes.find(n => n.id === currentNodeId);
    const outEdges = edges.filter(e => e.source === currentNodeId);

    if (node?.type === 'interactive_menu') {
      const buttons = node.data?.buttons || [];
      const matchIndex = buttons.findIndex((b: any) =>
        b.label?.toLowerCase() === response.toLowerCase() ||
        response === `${buttons.indexOf(b) + 1}`
      );

      // Try to find a matching edge by label or use index
      const targetEdge = outEdges[matchIndex >= 0 ? matchIndex : 0];
      if (targetEdge) {
        setTimeout(() => executeNode(targetEdge.target), 500);
        return;
      }
    }

    // Default: follow first edge
    if (outEdges.length > 0) {
      setTimeout(() => executeNode(outEdges[0].target), 500);
    } else {
      setTimeout(() => addBotMessage('✅ Fim do fluxo.'), 500);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute right-4 bottom-14 w-[360px] h-[500px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <Bot className="h-4 w-4 text-emerald-400" />
          Simulador de Fluxo
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={resetSimulation}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.from === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.buttons && msg.buttons.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {msg.buttons.map((btn, i) => (
                      <button
                        key={i}
                        onClick={() => handleUserResponse(btn.value)}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5 text-left transition-colors"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-slate-700 bg-slate-800/50">
        <div className="flex gap-2">
          <Input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleUserResponse(userInput); }}
            placeholder={waitingForInput ? 'Digite sua resposta...' : 'Aguarde...'}
            disabled={!waitingForInput}
            className="bg-slate-800 border-slate-700 text-white text-sm"
          />
          <Button
            size="icon"
            onClick={() => handleUserResponse(userInput)}
            disabled={!waitingForInput || !userInput.trim()}
            className="bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
