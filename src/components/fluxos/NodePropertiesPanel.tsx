import { Node } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Settings2 } from 'lucide-react';
import React from 'react';

interface NodePropertiesPanelProps {
  selectedNode: Node | null;
  onUpdate: (node: Node) => void;
}

export function NodePropertiesPanel({ selectedNode, onUpdate }: NodePropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <div className="w-72 bg-slate-900 border-l border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Propriedades
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-slate-500 text-center">
            Selecione um card no canvas para editar suas propriedades
          </p>
        </div>
      </div>
    );
  }

  const updateNodeData = (key: string, value: any) => {
    const updatedNode = {
      ...selectedNode,
      data: { ...selectedNode.data, [key]: value },
    };
    onUpdate(updatedNode);
  };

  const stopPropagation = (e: React.KeyboardEvent | React.FocusEvent) => {
    e.stopPropagation();
  };

  const inputProps = {
    onFocus: stopPropagation,
    onKeyDown: stopPropagation,
    onKeyUp: stopPropagation,
    onKeyPress: stopPropagation,
  };

  const renderProperties = () => {
    switch (selectedNode.type) {
      case 'trigger':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Gatilho</Label>
              <Select 
                value={selectedNode.data.triggerType} 
                onValueChange={(v) => updateNodeData('triggerType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="nova_mensagem">Nova mensagem recebida</SelectItem>
                  <SelectItem value="novo_lead">Novo lead criado</SelectItem>
                  <SelectItem value="lead_movido">Lead movido no funil</SelectItem>
                  <SelectItem value="horario">Em horário específico</SelectItem>
                  <SelectItem value="webhook">Webhook recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Nova mensagem WhatsApp"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Descrição</Label>
              <Textarea
                value={selectedNode.data.description || ''}
                onChange={(e) => updateNodeData('description', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white resize-none"
                placeholder="Descreva quando este gatilho será acionado..."
                rows={3}
                {...inputProps}
              />
            </div>
          </>
        );

      case 'action':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Ação</Label>
              <Select 
                value={selectedNode.data.actionType} 
                onValueChange={(v) => updateNodeData('actionType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="enviar_mensagem">Enviar mensagem</SelectItem>
                  <SelectItem value="criar_lead">Criar lead</SelectItem>
                  <SelectItem value="criar_tarefa">Criar tarefa</SelectItem>
                  <SelectItem value="mover_funil">Mover no funil</SelectItem>
                  <SelectItem value="notificar_usuario">Notificar usuário</SelectItem>
                  <SelectItem value="adicionar_nota">Adicionar nota</SelectItem>
                  <SelectItem value="acionar_ia">Acionar IA</SelectItem>
                  <SelectItem value="whatsapp">Enviar WhatsApp</SelectItem>
                  <SelectItem value="email">Enviar Email</SelectItem>
                  <SelectItem value="webhook">Chamar Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Enviar mensagem de boas-vindas"
                {...inputProps}
              />
            </div>
            {(selectedNode.data.actionType === 'enviar_mensagem' || selectedNode.data.actionType === 'whatsapp') && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-medium">Mensagem</Label>
                <Textarea
                  value={selectedNode.data.message || ''}
                  onChange={(e) => updateNodeData('message', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white resize-none"
                  placeholder="Digite a mensagem..."
                  rows={4}
                  {...inputProps}
                />
              </div>
            )}
            {selectedNode.data.actionType === 'webhook' && (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-medium">URL do Webhook</Label>
                  <Input
                    value={selectedNode.data.webhookUrl || ''}
                    onChange={(e) => updateNodeData('webhookUrl', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="https://..."
                    {...inputProps}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-medium">Método HTTP</Label>
                  <Select 
                    value={selectedNode.data.httpMethod || 'POST'} 
                    onValueChange={(v) => updateNodeData('httpMethod', v)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Descrição</Label>
              <Textarea
                value={selectedNode.data.description || ''}
                onChange={(e) => updateNodeData('description', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white resize-none"
                placeholder="Descreva o que esta ação faz..."
                rows={2}
                {...inputProps}
              />
            </div>
          </>
        );

      case 'condition':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Condição</Label>
              <Select 
                value={selectedNode.data.conditionType} 
                onValueChange={(v) => updateNodeData('conditionType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="tag">Verificar tag</SelectItem>
                  <SelectItem value="etapa">Verificar etapa</SelectItem>
                  <SelectItem value="horario">Verificar horário</SelectItem>
                  <SelectItem value="palavra_chave">Palavra-chave na mensagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Cliente tem tag VIP?"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Valor a Verificar</Label>
              <Input
                value={selectedNode.data.checkValue || ''}
                onChange={(e) => updateNodeData('checkValue', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: VIP, orçamento, 09:00-18:00"
                {...inputProps}
              />
            </div>
          </>
        );

      case 'ia':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: IA Atendimento Inicial"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Prompt Personalizado</Label>
              <Textarea
                value={selectedNode.data.prompt || ''}
                onChange={(e) => updateNodeData('prompt', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white resize-none"
                placeholder="Você é um assistente que... [defina o comportamento da IA]"
                rows={5}
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Modo de Operação</Label>
              <Select 
                value={selectedNode.data.mode || 'auto'} 
                onValueChange={(v) => updateNodeData('mode', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="auto">🤖 Resposta Automática</SelectItem>
                  <SelectItem value="assisted">👤 Resposta Assistida</SelectItem>
                  <SelectItem value="classificar">🏷️ Classificar Intenção</SelectItem>
                  <SelectItem value="resposta">💬 Gerar Resposta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="text-slate-300 text-xs font-medium">Aprendizado Ativo</Label>
              <Switch
                checked={selectedNode.data.learning || false}
                onCheckedChange={(v) => updateNodeData('learning', v)}
              />
            </div>
          </>
        );

      case 'delay':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Título</Label>
              <Input
                value={selectedNode.data.label || ''}
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Aguardar 5 minutos"
                {...inputProps}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Tipo de Delay</Label>
              <Select 
                value={selectedNode.data.delayType || 'tempo'} 
                onValueChange={(v) => updateNodeData('delayType', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="tempo">⏱️ Aguardar tempo</SelectItem>
                  <SelectItem value="evento">📅 Aguardar evento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedNode.data.delayType === 'tempo' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-medium">Valor</Label>
                  <Input
                    type="number"
                    value={selectedNode.data.delayValue || ''}
                    onChange={(e) => updateNodeData('delayValue', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="5"
                    min="1"
                    {...inputProps}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-medium">Unidade</Label>
                  <Select 
                    value={selectedNode.data.delayUnit || 'minutos'} 
                    onValueChange={(v) => updateNodeData('delayUnit', v)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="segundos">Segundos</SelectItem>
                      <SelectItem value="minutos">Minutos</SelectItem>
                      <SelectItem value="horas">Horas</SelectItem>
                      <SelectItem value="dias">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-medium">Descrição</Label>
              <Textarea
                value={selectedNode.data.description || ''}
                onChange={(e) => updateNodeData('description', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white resize-none"
                placeholder="Descreva o propósito deste delay..."
                rows={2}
                {...inputProps}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const getTypeLabel = () => {
    switch (selectedNode.type) {
      case 'trigger': return 'Gatilho';
      case 'action': return 'Ação';
      case 'condition': return 'Condição';
      case 'ia': return 'IA';
      case 'delay': return 'Delay';
      default: return 'Node';
    }
  };

  const getTypeColor = () => {
    switch (selectedNode.type) {
      case 'trigger': return 'bg-emerald-500';
      case 'action': return 'bg-amber-500';
      case 'condition': return 'bg-violet-500';
      case 'ia': return 'bg-blue-500';
      case 'delay': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="w-72 bg-slate-900 border-l border-slate-700 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getTypeColor()}`} />
          <h3 className="font-bold text-white text-sm">{getTypeLabel()}</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1">ID: {selectedNode.id.slice(0, 8)}...</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderProperties()}
      </div>
    </div>
  );
}
