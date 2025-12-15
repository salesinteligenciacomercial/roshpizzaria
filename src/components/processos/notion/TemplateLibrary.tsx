import { useState } from "react";
import { 
  FileText,
  Phone,
  MessageSquare,
  Mail,
  Target,
  CheckSquare,
  BarChart3,
  Users,
  Handshake,
  AlertTriangle,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  blocks: Array<{
    block_type: string;
    content: any;
  }>;
}

const TEMPLATES: Template[] = [
  {
    id: 'script-telefone',
    title: 'Script de Atendimento Telefônico',
    description: 'Roteiro completo para ligações de prospecção e atendimento',
    icon: <Phone className="h-5 w-5" />,
    category: 'Vendas',
    blocks: [
      { block_type: 'heading1', content: { text: 'Script de Atendimento Telefônico' } },
      { block_type: 'callout', content: { text: '💡 Use este script como guia, adaptando ao contexto de cada ligação' } },
      { block_type: 'heading2', content: { text: '1. Abertura' } },
      { block_type: 'paragraph', content: { text: 'Olá, [Nome]! Aqui é [Seu Nome] da [Empresa]. Tudo bem com você?' } },
      { block_type: 'heading2', content: { text: '2. Apresentação' } },
      { block_type: 'paragraph', content: { text: 'Estou entrando em contato porque...' } },
      { block_type: 'heading2', content: { text: '3. Qualificação (BANT)' } },
      { block_type: 'checklist', content: { text: 'Budget - Qual o orçamento disponível?', checked: false } },
      { block_type: 'checklist', content: { text: 'Authority - Quem toma a decisão?', checked: false } },
      { block_type: 'checklist', content: { text: 'Need - Qual a necessidade/dor?', checked: false } },
      { block_type: 'checklist', content: { text: 'Timeline - Qual o prazo?', checked: false } },
      { block_type: 'heading2', content: { text: '4. Tratamento de Objeções' } },
      { block_type: 'toggle', content: { text: '"Não tenho interesse"' } },
      { block_type: 'toggle', content: { text: '"Está muito caro"' } },
      { block_type: 'toggle', content: { text: '"Preciso pensar"' } },
      { block_type: 'heading2', content: { text: '5. Fechamento' } },
      { block_type: 'paragraph', content: { text: 'Posso agendar uma demonstração para [data/hora]?' } },
    ]
  },
  {
    id: 'script-whatsapp',
    title: 'Script WhatsApp - Primeiro Contato',
    description: 'Mensagens prontas para iniciar conversas pelo WhatsApp',
    icon: <MessageSquare className="h-5 w-5" />,
    category: 'Vendas',
    blocks: [
      { block_type: 'heading1', content: { text: 'Script WhatsApp - Primeiro Contato' } },
      { block_type: 'heading2', content: { text: 'Mensagem 1 - Apresentação' } },
      { block_type: 'quote', content: { text: 'Olá, [Nome]! 👋\n\nAqui é [Seu Nome] da [Empresa].\n\nVi que você demonstrou interesse em [produto/serviço] e gostaria de ajudar você a [benefício principal].' } },
      { block_type: 'heading2', content: { text: 'Mensagem 2 - Gancho de Valor' } },
      { block_type: 'quote', content: { text: 'Posso te enviar um [material/proposta] personalizado?\n\nNossos clientes geralmente conseguem [resultado concreto] em [prazo].' } },
      { block_type: 'heading2', content: { text: 'Follow-up (após 24h sem resposta)' } },
      { block_type: 'quote', content: { text: 'Oi [Nome]! 😊\n\nSó passando para checar se você teve a chance de ver minha mensagem anterior.\n\nFique à vontade para me responder quando puder!' } },
    ]
  },
  {
    id: 'cadencia-email',
    title: 'Cadência de Follow-up E-mail',
    description: 'Sequência de e-mails para nutrição de leads',
    icon: <Mail className="h-5 w-5" />,
    category: 'Marketing',
    blocks: [
      { block_type: 'heading1', content: { text: 'Cadência de Follow-up E-mail' } },
      { block_type: 'heading2', content: { text: 'Dia 1 - E-mail de Boas-vindas' } },
      { block_type: 'paragraph', content: { text: 'Assunto: Bem-vindo à [Empresa]! 🎉' } },
      { block_type: 'heading2', content: { text: 'Dia 3 - E-mail de Valor' } },
      { block_type: 'paragraph', content: { text: 'Assunto: [Recurso] que pode ajudar você' } },
      { block_type: 'heading2', content: { text: 'Dia 7 - E-mail de Case' } },
      { block_type: 'paragraph', content: { text: 'Assunto: Como [Cliente] alcançou [Resultado]' } },
      { block_type: 'heading2', content: { text: 'Dia 14 - E-mail de Oferta' } },
      { block_type: 'paragraph', content: { text: 'Assunto: Oferta especial para você 🎁' } },
    ]
  },
  {
    id: 'checklist-bant',
    title: 'Checklist de Qualificação BANT',
    description: 'Perguntas essenciais para qualificar leads',
    icon: <CheckSquare className="h-5 w-5" />,
    category: 'Qualificação',
    blocks: [
      { block_type: 'heading1', content: { text: 'Checklist de Qualificação BANT' } },
      { block_type: 'heading2', content: { text: '💰 Budget (Orçamento)' } },
      { block_type: 'checklist', content: { text: 'Qual o orçamento disponível para este projeto?', checked: false } },
      { block_type: 'checklist', content: { text: 'Já investiu em soluções similares antes?', checked: false } },
      { block_type: 'checklist', content: { text: 'Há verba aprovada para este ano?', checked: false } },
      { block_type: 'heading2', content: { text: '👤 Authority (Autoridade)' } },
      { block_type: 'checklist', content: { text: 'Quem toma a decisão final?', checked: false } },
      { block_type: 'checklist', content: { text: 'Há outras pessoas envolvidas no processo?', checked: false } },
      { block_type: 'checklist', content: { text: 'Como funciona o processo de aprovação?', checked: false } },
      { block_type: 'heading2', content: { text: '🎯 Need (Necessidade)' } },
      { block_type: 'checklist', content: { text: 'Qual o principal problema a ser resolvido?', checked: false } },
      { block_type: 'checklist', content: { text: 'Qual o impacto deste problema no negócio?', checked: false } },
      { block_type: 'checklist', content: { text: 'Já tentou outras soluções?', checked: false } },
      { block_type: 'heading2', content: { text: '⏰ Timeline (Prazo)' } },
      { block_type: 'checklist', content: { text: 'Quando pretende implementar a solução?', checked: false } },
      { block_type: 'checklist', content: { text: 'Há algum evento/prazo específico?', checked: false } },
      { block_type: 'checklist', content: { text: 'Qual a urgência da resolução?', checked: false } },
    ]
  },
  {
    id: 'playbook-objecoes',
    title: 'Playbook de Objeções',
    description: 'Respostas prontas para as objeções mais comuns',
    icon: <AlertTriangle className="h-5 w-5" />,
    category: 'Vendas',
    blocks: [
      { block_type: 'heading1', content: { text: 'Playbook de Objeções' } },
      { block_type: 'callout', content: { text: '🎯 Lembre-se: Objeções são oportunidades de esclarecer e agregar valor!' } },
      { block_type: 'heading2', content: { text: '"Está muito caro"' } },
      { block_type: 'paragraph', content: { text: 'Resposta: "Entendo sua preocupação com o investimento. Posso perguntar: caro em relação a quê? Quando olhamos para o ROI, nossos clientes geralmente recuperam o investimento em X meses..."' } },
      { block_type: 'heading2', content: { text: '"Preciso pensar"' } },
      { block_type: 'paragraph', content: { text: 'Resposta: "Claro, é uma decisão importante! Para ajudar sua reflexão, posso perguntar: qual o principal ponto que você gostaria de avaliar melhor?"' } },
      { block_type: 'heading2', content: { text: '"Já uso outro fornecedor"' } },
      { block_type: 'paragraph', content: { text: 'Resposta: "Ótimo que você já tem uma solução! Como está sendo sua experiência? Nosso diferencial é [X], que pode complementar o que você já tem..."' } },
      { block_type: 'heading2', content: { text: '"Não é prioridade agora"' } },
      { block_type: 'paragraph', content: { text: 'Resposta: "Entendo! Posso perguntar: o que faria isso se tornar prioridade? Geralmente nossos clientes percebem que [problema] impacta diretamente em [métrica de negócio]..."' } },
    ]
  },
  {
    id: 'checklist-fechamento',
    title: 'Checklist de Fechamento',
    description: 'Etapas finais antes de fechar uma venda',
    icon: <Handshake className="h-5 w-5" />,
    category: 'Vendas',
    blocks: [
      { block_type: 'heading1', content: { text: 'Checklist de Fechamento' } },
      { block_type: 'heading2', content: { text: 'Pré-Fechamento' } },
      { block_type: 'checklist', content: { text: 'Lead qualificado (BANT completo)', checked: false } },
      { block_type: 'checklist', content: { text: 'Proposta enviada e validada', checked: false } },
      { block_type: 'checklist', content: { text: 'Objeções tratadas', checked: false } },
      { block_type: 'checklist', content: { text: 'Decisor identificado e engajado', checked: false } },
      { block_type: 'heading2', content: { text: 'No Fechamento' } },
      { block_type: 'checklist', content: { text: 'Confirmar termos e condições', checked: false } },
      { block_type: 'checklist', content: { text: 'Alinhar próximos passos', checked: false } },
      { block_type: 'checklist', content: { text: 'Definir data de início/implementação', checked: false } },
      { block_type: 'checklist', content: { text: 'Coletar dados para contrato', checked: false } },
      { block_type: 'heading2', content: { text: 'Pós-Fechamento' } },
      { block_type: 'checklist', content: { text: 'Enviar contrato para assinatura', checked: false } },
      { block_type: 'checklist', content: { text: 'Agendar onboarding', checked: false } },
      { block_type: 'checklist', content: { text: 'Apresentar equipe de Customer Success', checked: false } },
      { block_type: 'checklist', content: { text: 'Registrar venda no CRM', checked: false } },
    ]
  },
  {
    id: 'dashboard-metricas',
    title: 'Dashboard de Métricas Semanais',
    description: 'Template para acompanhamento de KPIs semanais',
    icon: <BarChart3 className="h-5 w-5" />,
    category: 'Gestão',
    blocks: [
      { block_type: 'heading1', content: { text: 'Dashboard de Métricas Semanais' } },
      { block_type: 'paragraph', content: { text: 'Semana de DD/MM a DD/MM' } },
      { block_type: 'heading2', content: { text: '📊 Métricas de Atividade' } },
      { block_type: 'bullet_list', content: { text: 'Ligações realizadas: __' } },
      { block_type: 'bullet_list', content: { text: 'E-mails enviados: __' } },
      { block_type: 'bullet_list', content: { text: 'Reuniões agendadas: __' } },
      { block_type: 'bullet_list', content: { text: 'Propostas enviadas: __' } },
      { block_type: 'heading2', content: { text: '💰 Métricas de Resultado' } },
      { block_type: 'bullet_list', content: { text: 'Novos leads: __' } },
      { block_type: 'bullet_list', content: { text: 'Leads qualificados: __' } },
      { block_type: 'bullet_list', content: { text: 'Vendas fechadas: __' } },
      { block_type: 'bullet_list', content: { text: 'Valor total: R$ __' } },
      { block_type: 'heading2', content: { text: '🎯 Metas vs Realizado' } },
      { block_type: 'bullet_list', content: { text: 'Meta: __' } },
      { block_type: 'bullet_list', content: { text: 'Realizado: __' } },
      { block_type: 'bullet_list', content: { text: 'Gap: __' } },
      { block_type: 'heading2', content: { text: '📝 Observações e Próximos Passos' } },
      { block_type: 'paragraph', content: { text: '' } },
    ]
  },
];

interface TemplateLibraryProps {
  companyId: string | null;
  onCreateFromTemplate: (pageId: string) => void;
}

export function TemplateLibrary({ companyId, onCreateFromTemplate }: TemplateLibraryProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  const categories = [...new Set(TEMPLATES.map(t => t.category))];

  const createFromTemplate = async (template: Template) => {
    if (!companyId) {
      toast.error('Erro: ID da empresa não encontrado');
      return;
    }

    setCreating(template.id);
    try {
      const { data: user } = await supabase.auth.getUser();

      // Create the page
      const { data: page, error: pageError } = await supabase
        .from('process_pages')
        .insert({
          company_id: companyId,
          title: template.title,
          icon: '📄',
          page_type: 'page',
          created_by: user.user?.id
        })
        .select()
        .single();

      if (pageError) throw pageError;

      // Create blocks
      const blocksToInsert = template.blocks.map((block, index) => ({
        page_id: page.id,
        block_type: block.block_type,
        content: block.content,
        position: index
      }));

      const { error: blocksError } = await supabase
        .from('process_blocks')
        .insert(blocksToInsert);

      if (blocksError) throw blocksError;

      toast.success('Página criada a partir do template!');
      setOpen(false);
      onCreateFromTemplate(page.id);
    } catch (error) {
      console.error('Error creating from template:', error);
      toast.error('Erro ao criar página');
    } finally {
      setCreating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Biblioteca de Templates
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {categories.map(category => (
              <div key={category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {TEMPLATES.filter(t => t.category === category).map(template => (
                    <Card 
                      key={template.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => createFromTemplate(template)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {template.icon}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {template.blocks.length} blocos
                          </Badge>
                        </div>
                        <CardTitle className="text-base mt-2">{template.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          size="sm" 
                          className="w-full"
                          disabled={creating === template.id}
                        >
                          {creating === template.id ? 'Criando...' : 'Usar Template'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
