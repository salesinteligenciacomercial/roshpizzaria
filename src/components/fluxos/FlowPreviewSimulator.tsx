import { useState, useRef, useEffect } from 'react';
import { Node, Edge } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, RotateCcw, Bot } from 'lucide-react';

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
    setCurrentNodeId(null);

    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      setMessages([{ id: '0', text: '⚠️ Nenhum gatilho encontrado no fluxo.', from: 'bot' }]);
      return;
    }

    // Show a prompt so the user "sends" a message to trigger the flow
    setMessages([{
      id: '0',
      text: '💬 Envie uma mensagem para iniciar o fluxo.',
      from: 'bot',
    }]);
    setCurrentNodeId(triggerNode.id);
    setWaitingForInput(true);
  };

  const getNodeMessage = (node: Node): string => {
    const d = node.data || {};
    return d.message || d.welcomeMessage || d.description || d.label || '';
  };

  const executeNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      addBotMessage('✅ Fim do fluxo.');
      return;
    }

    setCurrentNodeId(nodeId);

    switch (node.type) {
      case 'trigger': {
        // Trigger is just entry point — move to next node
        goToNext(nodeId);
        break;
      }

      case 'action': {
        const actionType = node.data?.actionType;
        const msg = getNodeMessage(node);

        if (actionType === 'enviar_mensagem' && msg) {
          addBotMessage(msg);
        } else {
          addBotMessage(`⚡ ${node.data?.label || 'Ação executada'}`);
        }
        goToNext(nodeId);
        break;
      }

      case 'interactive_menu': {
        const buttons = node.data?.buttons || [];
        const msg = node.data?.welcomeMessage || node.data?.description || node.data?.label || 'Escolha uma opção:';
        addBotMessage(msg, buttons.map((b: any, i: number) => ({
          label: b.label || `Opção ${i + 1}`,
          value: b.label || `${i + 1}`,
        })));
        setWaitingForInput(true);
        break;
      }

      case 'route_department': {
        const dept = node.data?.department || 'departamento';
        const transferMsg = node.data?.transferMessage;
        if (transferMsg) {
          addBotMessage(transferMsg);
        }
        addBotMessage(`🔀 Direcionando para: ${dept}`);
        goToNext(nodeId);
        break;
      }

      case 'condition': {
        addBotMessage(`🔍 Condição: ${node.data?.label || 'verificando...'} → (simulado como verdadeiro)`);
        goToNext(nodeId);
        break;
      }

      case 'ia':
      case 'aiagent': {
        addBotMessage(`🤖 IA responderia aqui: "${node.data?.label || 'processando...'}"`);
        goToNext(nodeId);
        break;
      }

      case 'delay': {
        const val = node.data?.delayValue || '?';
        const unit = node.data?.delayUnit || 's';
        addBotMessage(`⏳ Aguardando ${val}${unit}...`);
        setTimeout(() => goToNext(nodeId), 1000);
        return; // don't fall through
      }

      default: {
        addBotMessage(`▶️ ${node.data?.label || node.type}`);
        goToNext(nodeId);
      }
    }
  };

  const goToNext = (fromNodeId: string) => {
    const outEdges = edges.filter(e => e.source === fromNodeId);
    if (outEdges.length === 0) {
      setTimeout(() => addBotMessage('✅ Fim do fluxo.'), 400);
      return;
    }
    setTimeout(() => executeNode(outEdges[0].target), 500);
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

    const node = nodes.find(n => n.id === currentNodeId);
    if (!node) return;

    // If we're at a trigger node, the user just "sent a message" to start the flow
    if (node.type === 'trigger') {
      executeNode(currentNodeId);
      return;
    }

    // Interactive menu: match button
    if (node.type === 'interactive_menu') {
      const buttons = node.data?.buttons || [];
      const outEdges = edges.filter(e => e.source === currentNodeId);

      const matchIndex = buttons.findIndex((b: any, i: number) => {
        const r = response.trim().toLowerCase();
        return r === b.label?.toLowerCase() || r === String(i + 1);
      });

      const targetEdge = outEdges[matchIndex >= 0 ? matchIndex : 0];
      if (targetEdge) {
        setTimeout(() => executeNode(targetEdge.target), 400);
      } else {
        addBotMessage('⚠️ Opção não reconhecida. Tente novamente.');
        setWaitingForInput(true);
      }
      return;
    }

    // Default: follow first edge
    const outEdges = edges.filter(e => e.source === currentNodeId);
    if (outEdges.length > 0) {
      setTimeout(() => executeNode(outEdges[0].target), 400);
    } else {
      setTimeout(() => addBotMessage('✅ Fim do fluxo.'), 400);
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
                        className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1.5 text-left transition-colors"
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
            className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
