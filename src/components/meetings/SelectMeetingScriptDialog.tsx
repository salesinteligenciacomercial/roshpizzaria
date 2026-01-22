/**
 * SelectMeetingScriptDialog - Dialog para selecionar ou criar roteiro de reunião
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Trash2, Clock, FileText, 
  Briefcase, Users, Presentation, Phone
} from 'lucide-react';
import { MeetingScript, MeetingScriptStep } from './MeetingScriptPanel';

interface SelectMeetingScriptDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectScript: (script: MeetingScript) => void;
}

// Templates pré-definidos
const SCRIPT_TEMPLATES: MeetingScript[] = [
  {
    id: 'template-vendas',
    title: 'Reunião de Vendas',
    steps: [
      {
        id: 'v1',
        title: 'Abertura e Rapport',
        content: '• Apresentação pessoal\n• Quebra-gelo\n• Agradecer pela oportunidade\n• Confirmar tempo disponível',
        duration_seconds: 180,
        is_completed: false,
      },
      {
        id: 'v2',
        title: 'Descoberta e Qualificação',
        content: '• Perguntas sobre o negócio\n• Entender dores e desafios\n• Identificar necessidades\n• Mapear processo de decisão',
        duration_seconds: 300,
        is_completed: false,
      },
      {
        id: 'v3',
        title: 'Apresentação da Solução',
        content: '• Apresentar benefícios relevantes\n• Demonstrar funcionalidades\n• Cases de sucesso similares\n• Diferenciais competitivos',
        duration_seconds: 420,
        is_completed: false,
      },
      {
        id: 'v4',
        title: 'Tratamento de Objeções',
        content: '• Ouvir preocupações\n• Responder com empatia\n• Fornecer provas sociais\n• Esclarecer dúvidas',
        duration_seconds: 240,
        is_completed: false,
      },
      {
        id: 'v5',
        title: 'Fechamento e Próximos Passos',
        content: '• Resumir benefícios\n• Proposta de valor clara\n• Definir próximos passos\n• Agendar follow-up',
        duration_seconds: 180,
        is_completed: false,
      },
    ],
  },
  {
    id: 'template-followup',
    title: 'Reunião de Follow-up',
    steps: [
      {
        id: 'f1',
        title: 'Recapitulação',
        content: '• Resumir última reunião\n• Confirmar pontos acordados\n• Verificar mudanças de contexto',
        duration_seconds: 180,
        is_completed: false,
      },
      {
        id: 'f2',
        title: 'Atualizações',
        content: '• Apresentar novidades\n• Responder pendências\n• Compartilhar materiais adicionais',
        duration_seconds: 300,
        is_completed: false,
      },
      {
        id: 'f3',
        title: 'Próximos Passos',
        content: '• Definir ações concretas\n• Estabelecer prazos\n• Agendar próximo contato',
        duration_seconds: 180,
        is_completed: false,
      },
    ],
  },
  {
    id: 'template-demo',
    title: 'Demonstração de Produto',
    steps: [
      {
        id: 'd1',
        title: 'Boas-vindas',
        content: '• Apresentar participantes\n• Agenda da demonstração\n• Confirmar expectativas',
        duration_seconds: 120,
        is_completed: false,
      },
      {
        id: 'd2',
        title: 'Visão Geral',
        content: '• Overview da plataforma\n• Principais módulos\n• Benefícios-chave',
        duration_seconds: 180,
        is_completed: false,
      },
      {
        id: 'd3',
        title: 'Demonstração Prática',
        content: '• Mostrar fluxos principais\n• Funcionalidades mais relevantes\n• Casos de uso específicos',
        duration_seconds: 600,
        is_completed: false,
      },
      {
        id: 'd4',
        title: 'Perguntas e Respostas',
        content: '• Abrir para dúvidas\n• Esclarecer funcionalidades\n• Discutir customizações',
        duration_seconds: 300,
        is_completed: false,
      },
      {
        id: 'd5',
        title: 'Proposta',
        content: '• Apresentar planos\n• Condições comerciais\n• Próximos passos',
        duration_seconds: 180,
        is_completed: false,
      },
    ],
  },
  {
    id: 'template-onboarding',
    title: 'Onboarding de Cliente',
    steps: [
      {
        id: 'o1',
        title: 'Boas-vindas',
        content: '• Dar as boas-vindas\n• Apresentar equipe de suporte\n• Explicar processo de onboarding',
        duration_seconds: 180,
        is_completed: false,
      },
      {
        id: 'o2',
        title: 'Configuração Inicial',
        content: '• Acesso à plataforma\n• Configurações básicas\n• Importação de dados',
        duration_seconds: 600,
        is_completed: false,
      },
      {
        id: 'o3',
        title: 'Treinamento',
        content: '• Funcionalidades principais\n• Melhores práticas\n• Dicas de uso',
        duration_seconds: 900,
        is_completed: false,
      },
      {
        id: 'o4',
        title: 'Suporte e Recursos',
        content: '• Canais de suporte\n• Documentação disponível\n• Próximas sessões',
        duration_seconds: 180,
        is_completed: false,
      },
    ],
  },
];

const getTemplateIcon = (templateId: string) => {
  switch (templateId) {
    case 'template-vendas':
      return <Briefcase className="h-5 w-5" />;
    case 'template-followup':
      return <Phone className="h-5 w-5" />;
    case 'template-demo':
      return <Presentation className="h-5 w-5" />;
    case 'template-onboarding':
      return <Users className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
};

export const SelectMeetingScriptDialog = ({
  open,
  onClose,
  onSelectScript,
}: SelectMeetingScriptDialogProps) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'custom'>('templates');
  const [customScript, setCustomScript] = useState<MeetingScript>({
    id: `custom-${Date.now()}`,
    title: '',
    steps: [
      {
        id: `step-${Date.now()}`,
        title: '',
        content: '',
        duration_seconds: 300,
        is_completed: false,
      },
    ],
  });

  const handleSelectTemplate = (template: MeetingScript) => {
    // Create a copy with new IDs to avoid conflicts
    const scriptCopy: MeetingScript = {
      ...template,
      id: `${template.id}-${Date.now()}`,
      steps: template.steps.map(step => ({
        ...step,
        id: `${step.id}-${Date.now()}`,
        is_completed: false,
      })),
    };
    onSelectScript(scriptCopy);
    onClose();
  };

  const handleCreateCustom = () => {
    if (!customScript.title.trim() || customScript.steps.some(s => !s.title.trim())) {
      return;
    }
    onSelectScript(customScript);
    onClose();
  };

  const addStep = () => {
    setCustomScript(prev => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: `step-${Date.now()}`,
          title: '',
          content: '',
          duration_seconds: 300,
          is_completed: false,
        },
      ],
    }));
  };

  const removeStep = (stepId: string) => {
    if (customScript.steps.length <= 1) return;
    setCustomScript(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId),
    }));
  };

  const updateStep = (stepId: string, field: keyof MeetingScriptStep, value: any) => {
    setCustomScript(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId ? { ...step, [field]: value } : step
      ),
    }));
  };

  const getTotalDuration = (steps: MeetingScriptStep[]) => {
    return steps.reduce((acc, step) => acc + step.duration_seconds, 0);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Roteiro de Reunião</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'templates' | 'custom')} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="custom">Personalizado</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="flex-1 mt-4">
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-2 gap-3 pr-4">
                {SCRIPT_TEMPLATES.map((template) => {
                  const totalTime = getTotalDuration(template.steps);
                  return (
                    <div
                      key={template.id}
                      className="border rounded-lg p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          {getTemplateIcon(template.id)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{template.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{template.steps.length} etapas</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(totalTime)}
                            </span>
                          </div>
                          <div className="mt-2 space-y-0.5">
                            {template.steps.slice(0, 3).map((step, idx) => (
                              <div key={step.id} className="text-xs text-muted-foreground truncate">
                                {idx + 1}. {step.title}
                              </div>
                            ))}
                            {template.steps.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{template.steps.length - 3} mais...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="custom" className="flex-1 mt-4 flex flex-col">
            <div className="space-y-4 flex-1">
              <div>
                <Label htmlFor="script-title">Título do Roteiro</Label>
                <Input
                  id="script-title"
                  placeholder="Ex: Reunião de Proposta Comercial"
                  value={customScript.title}
                  onChange={(e) => setCustomScript(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Etapas ({customScript.steps.length})</Label>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Total: {formatDuration(getTotalDuration(customScript.steps))}</span>
                </div>
              </div>

              <ScrollArea className="h-[250px] border rounded-lg p-3">
                <div className="space-y-3">
                  {customScript.steps.map((step, index) => (
                    <div key={step.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium w-6">
                          #{index + 1}
                        </span>
                        <Input
                          placeholder="Título da etapa"
                          value={step.title}
                          onChange={(e) => updateStep(step.id, 'title', e.target.value)}
                          className="flex-1 h-8 text-sm"
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            value={Math.floor(step.duration_seconds / 60)}
                            onChange={(e) => updateStep(step.id, 'duration_seconds', parseInt(e.target.value) * 60 || 60)}
                            className="w-16 h-8 text-sm text-center"
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeStep(step.id)}
                          disabled={customScript.steps.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Conteúdo/script da etapa (opcional)"
                        value={step.content}
                        onChange={(e) => updateStep(step.id, 'content', e.target.value)}
                        className="text-sm min-h-[60px]"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button variant="outline" className="w-full" onClick={addStep}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Etapa
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {activeTab === 'custom' && (
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateCustom}
              disabled={!customScript.title.trim() || customScript.steps.some(s => !s.title.trim())}
            >
              Usar Roteiro
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
