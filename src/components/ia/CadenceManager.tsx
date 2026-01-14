import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Phone, 
  MessageSquare, 
  Instagram,
  Mail,
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle2,
  Circle,
  Flame,
  Snowflake,
  Sun,
  Target,
  Zap,
  Calendar,
  User,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LeadIntelligence {
  id: string;
  lead_id: string;
  engagement_score: number;
  temperature: 'frio' | 'morno' | 'quente' | 'fechando';
  purchase_intent: number;
  conversation_sentiment: string;
  recommended_action: string;
  recommended_channel: string;
  objections: string[];
  days_since_last_contact: number;
  total_contact_attempts: number;
  leads?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    value?: number;
    tags?: string[];
  };
}

interface CadenceStep {
  id: string;
  day: number;
  channel: 'whatsapp' | 'call' | 'instagram' | 'email';
  action: string;
  script: string;
  variations: string[];
  completed?: boolean;
  completedAt?: string;
}

interface CadenceTemplate {
  id: string;
  name: string;
  description: string;
  temperature: string[];
  duration: number;
  steps: CadenceStep[];
}

// Templates de cadência pré-definidos
const CADENCE_TEMPLATES: CadenceTemplate[] = [
  {
    id: "cold_lead",
    name: "Lead Frio - Reengajamento",
    description: "Para leads sem contato há mais de 7 dias",
    temperature: ["frio"],
    duration: 14,
    steps: [
      {
        id: "1",
        day: 1,
        channel: "whatsapp",
        action: "Mensagem de reengajamento",
        script: "Olá {{nome}}! Tudo bem? 😊\n\nNotei que faz um tempo que não conversamos. Surgiu alguma dúvida sobre {{produto/serviço}}?\n\nEstou à disposição para ajudar!",
        variations: [
          "Oi {{nome}}! Como vai? Passando para saber se posso te ajudar com algo. 🙂",
          "{{nome}}, tudo bem? Vi que você demonstrou interesse anteriormente. Posso te ajudar com mais informações?"
        ]
      },
      {
        id: "2",
        day: 3,
        channel: "whatsapp",
        action: "Follow-up com valor",
        script: "Oi {{nome}}! 👋\n\nSei que o dia a dia é corrido, mas queria compartilhar algo que pode te interessar:\n\n✅ {{benefício_1}}\n✅ {{benefício_2}}\n\nPodemos conversar rapidinho?",
        variations: [
          "{{nome}}, separei algumas informações especiais pra você! Posso enviar?",
          "Olá! Tenho uma novidade que pode fazer diferença pra você. Quer saber mais?"
        ]
      },
      {
        id: "3",
        day: 5,
        channel: "call",
        action: "Ligação de qualificação",
        script: "Bom dia/tarde {{nome}}! Aqui é [seu nome] da [empresa].\n\nTe mandei algumas mensagens nos últimos dias e queria entender melhor:\n\n1. Você ainda tem interesse em [produto/serviço]?\n2. Qual é seu principal desafio hoje?\n3. Tem alguma dúvida que eu possa esclarecer?",
        variations: []
      },
      {
        id: "4",
        day: 7,
        channel: "whatsapp",
        action: "Última tentativa com urgência",
        script: "{{nome}}, essa é minha última tentativa de contato 😅\n\nSe não tiver interesse agora, sem problemas! Mas se quiser aproveitar {{oferta_especial}}, me avisa até amanhã.\n\nPosso te ajudar?",
        variations: [
          "Oi {{nome}}! Vou encerrar seu atendimento por aqui, mas fico disponível se precisar. É só chamar! 👋"
        ]
      },
      {
        id: "5",
        day: 14,
        channel: "email",
        action: "E-mail de despedida",
        script: "Assunto: Encerrando por aqui, {{nome}}\n\nOlá {{nome}},\n\nComo não consegui retorno, vou encerrar este contato. Mas saiba que estou à disposição sempre que precisar.\n\nGuardo seu contato e, se surgir algo do seu interesse, te aviso!\n\nAbraços,\n[Seu nome]",
        variations: []
      }
    ]
  },
  {
    id: "warm_lead",
    name: "Lead Morno - Nutrição",
    description: "Para leads com algum interesse demonstrado",
    temperature: ["morno"],
    duration: 10,
    steps: [
      {
        id: "1",
        day: 1,
        channel: "whatsapp",
        action: "Mensagem de conexão",
        script: "Oi {{nome}}! 😊\n\nLembrei de você e queria saber como estão as coisas por aí.\n\nAinda está considerando {{produto/serviço}}? Posso te ajudar com mais informações!",
        variations: [
          "{{nome}}, tudo bem? Passando para dar continuidade à nossa conversa. Tem um tempinho?",
          "Olá {{nome}}! Queria retomar nosso papo. Surgiu alguma novidade do seu lado?"
        ]
      },
      {
        id: "2",
        day: 2,
        channel: "whatsapp",
        action: "Envio de conteúdo/case",
        script: "{{nome}}, separei um material que pode te ajudar na decisão:\n\n📊 [Case de sucesso ou depoimento]\n\nIsso mostra como {{resultado_esperado}}. O que acha?",
        variations: [
          "Olha isso, {{nome}}! Um cliente nosso conseguiu {{resultado}}. Posso te contar como?"
        ]
      },
      {
        id: "3",
        day: 4,
        channel: "call",
        action: "Ligação consultiva",
        script: "{{nome}}, tudo bem? Aqui é [nome] da [empresa].\n\nQueria bater um papo rápido pra entender melhor sua situação e ver como podemos te ajudar da melhor forma.\n\n[Fazer perguntas de qualificação BANT]",
        variations: []
      },
      {
        id: "4",
        day: 6,
        channel: "whatsapp",
        action: "Proposta ou próximo passo",
        script: "{{nome}}, baseado na nossa conversa, preparei algo especial pra você:\n\n🎯 {{proposta_resumida}}\n\nPosso te enviar os detalhes? Ou prefere que a gente agende uma call rápida?",
        variations: []
      },
      {
        id: "5",
        day: 10,
        channel: "instagram",
        action: "Contato alternativo",
        script: "Oi {{nome}}! Vi que você tá por aqui também 😊\n\nQueria só confirmar se recebeu minha última mensagem no WhatsApp. Posso te ajudar com algo?",
        variations: []
      }
    ]
  },
  {
    id: "hot_lead",
    name: "Lead Quente - Fechamento",
    description: "Para leads prontos para decidir",
    temperature: ["quente", "fechando"],
    duration: 5,
    steps: [
      {
        id: "1",
        day: 1,
        channel: "whatsapp",
        action: "Mensagem de fechamento",
        script: "{{nome}}, tudo certo? 🔥\n\nSei que você está bem interessado. Vamos fechar?\n\nPosso te enviar o link de pagamento ou prefere que eu te ligue pra finalizar?",
        variations: [
          "Oi {{nome}}! Pronto pra dar o próximo passo? Estou aqui pra facilitar! 🚀",
          "{{nome}}, vi que você está quase lá! Posso ajudar a finalizar agora?"
        ]
      },
      {
        id: "2",
        day: 1,
        channel: "call",
        action: "Ligação de fechamento",
        script: "{{nome}}, aqui é [nome]!\n\nVi que você está bem avançado no processo. Queria te ligar pra:\n\n1. Tirar qualquer dúvida final\n2. Alinhar a melhor forma de pagamento\n3. Dar início ao seu {{produto/serviço}}\n\nVamos nessa?",
        variations: []
      },
      {
        id: "3",
        day: 2,
        channel: "whatsapp",
        action: "Urgência/escassez",
        script: "{{nome}}, última chance! ⏰\n\n{{oferta_especial}} só até hoje.\n\nNão quero que você perca essa oportunidade. Posso segurar pra você?",
        variations: [
          "Oi {{nome}}! Lembra da condição especial? Ela expira hoje. Vamos garantir?"
        ]
      },
      {
        id: "4",
        day: 3,
        channel: "whatsapp",
        action: "Quebra de objeção final",
        script: "{{nome}}, percebi uma hesitação. Posso perguntar:\n\nO que está te impedindo de seguir em frente?\n\n- É o valor? Tenho opções de parcelamento\n- É o prazo? Consigo priorizar sua entrega\n- É insegurança? Temos garantia de X dias\n\nMe conta! 🙂",
        variations: []
      },
      {
        id: "5",
        day: 5,
        channel: "call",
        action: "Última ligação",
        script: "{{nome}}, última tentativa aqui!\n\nSei que você tem muito interesse. Vou te fazer uma última proposta:\n\n{{oferta_irrecusavel}}\n\nO que me diz?",
        variations: []
      }
    ]
  }
];

// Scripts por contexto de objeção
const OBJECTION_SCRIPTS: Record<string, { title: string; scripts: { channel: string; script: string }[] }> = {
  preco: {
    title: "Objeção de Preço",
    scripts: [
      {
        channel: "whatsapp",
        script: "Entendo sua preocupação com o investimento, {{nome}}.\n\nMas pensa comigo: quanto você está perdendo todo mês sem {{solução}}?\n\nNosso {{produto}} se paga em {{tempo}} porque {{benefício_financeiro}}.\n\nPosso te mostrar as opções de parcelamento?"
      },
      {
        channel: "call",
        script: "Sobre o valor... Posso te fazer uma pergunta?\n\nQuanto você acha que está deixando de ganhar/economizar sem essa solução?\n\n[Deixar cliente falar]\n\nExato! Então na verdade o investimento se paga porque..."
      }
    ]
  },
  prazo: {
    title: "Objeção de Prazo",
    scripts: [
      {
        channel: "whatsapp",
        script: "Entendo que o prazo é importante pra você! ⏰\n\nPosso verificar uma priorização especial pro seu caso. Me conta:\n\n- Qual seria o prazo ideal?\n- Tem alguma data específica que precisa respeitar?"
      },
      {
        channel: "call",
        script: "Sobre o prazo, deixa eu entender melhor sua necessidade.\n\nQual é a data limite que você precisa?\n\n[Anotar]\n\nOk, vou verificar internamente e te retorno em X horas com uma proposta."
      }
    ]
  },
  confianca: {
    title: "Objeção de Confiança",
    scripts: [
      {
        channel: "whatsapp",
        script: "{{nome}}, entendo totalmente! Confiança é fundamental.\n\nOlha só alguns dados sobre nós:\n\n✅ {{tempo_mercado}} anos no mercado\n✅ {{numero_clientes}}+ clientes satisfeitos\n✅ {{garantia}} dias de garantia\n\nPosso te enviar alguns depoimentos de clientes?"
      },
      {
        channel: "call",
        script: "É muito importante que você se sinta seguro!\n\nPosso te passar contato de clientes nossos pra você conversar diretamente?\n\nAlém disso, temos garantia de {{X}} dias - se não gostar, devolvemos seu dinheiro."
      }
    ]
  },
  concorrencia: {
    title: "Objeção de Concorrência",
    scripts: [
      {
        channel: "whatsapp",
        script: "Que bom que você está pesquisando! Isso mostra que você é criterioso 👏\n\nPosso te mostrar o que nos diferencia?\n\n🔹 {{diferencial_1}}\n🔹 {{diferencial_2}}\n🔹 {{diferencial_3}}\n\nVocê encontrou isso em outro lugar?"
      },
      {
        channel: "call",
        script: "Ótimo que você está comparando! Posso perguntar:\n\nO que você mais gostou nas outras opções?\n\n[Ouvir]\n\nEntendi! E sobre {{nosso_diferencial}}, você viu algo parecido?"
      }
    ]
  },
  decisao: {
    title: "Precisa Pensar/Decidir",
    scripts: [
      {
        channel: "whatsapp",
        script: "Claro, {{nome}}! Decisões importantes merecem reflexão.\n\nPra te ajudar a pensar, posso enviar:\n\n📋 Um resumo do que conversamos\n📊 Comparativo de benefícios\n\nE fico à disposição pra tirar qualquer dúvida. Qual o melhor horário pra eu te retornar?"
      },
      {
        channel: "call",
        script: "Entendo! Mas me ajuda a entender:\n\nO que especificamente você precisa avaliar?\n\n[Ouvir]\n\nAh, sobre isso eu posso te explicar agora mesmo..."
      }
    ]
  }
};

export const CadenceManager: React.FC = () => {
  const [leadIntelligence, setLeadIntelligence] = useState<LeadIntelligence[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCadence, setExpandedCadence] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      const { data } = await supabase
        .from("ia_lead_intelligence")
        .select(`
          *,
          leads:lead_id (id, name, phone, email, value, tags)
        `)
        .eq("company_id", userRole.company_id)
        .order("engagement_score", { ascending: false })
        .limit(50);

      setLeadIntelligence((data || []) as LeadIntelligence[]);
      if (data && data.length > 0) {
        setSelectedLead(data[0] as LeadIntelligence);
      }
    } catch (error) {
      console.error("[CadenceManager] Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Script copiado!");
  };

  const getRecommendedCadence = (lead: LeadIntelligence): CadenceTemplate | null => {
    return CADENCE_TEMPLATES.find(t => 
      t.temperature.includes(lead.temperature)
    ) || CADENCE_TEMPLATES[0];
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "call": return <Phone className="h-4 w-4" />;
      case "whatsapp": return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "instagram": return <Instagram className="h-4 w-4 text-pink-500" />;
      case "email": return <Mail className="h-4 w-4 text-blue-500" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "call": return "bg-purple-100 text-purple-800 border-purple-200";
      case "whatsapp": return "bg-green-100 text-green-800 border-green-200";
      case "instagram": return "bg-pink-100 text-pink-800 border-pink-200";
      case "email": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTemperatureIcon = (temp: string) => {
    switch (temp) {
      case "fechando": return <Flame className="h-4 w-4 text-red-500" />;
      case "quente": return <Flame className="h-4 w-4 text-orange-500" />;
      case "morno": return <Sun className="h-4 w-4 text-yellow-500" />;
      default: return <Snowflake className="h-4 w-4 text-blue-500" />;
    }
  };

  const personalizeScript = (script: string, lead: LeadIntelligence): string => {
    return script
      .replace(/\{\{nome\}\}/g, lead.leads?.name || "Cliente")
      .replace(/\{\{produto\/serviço\}\}/g, "[seu produto/serviço]")
      .replace(/\{\{benefício_1\}\}/g, "[benefício 1]")
      .replace(/\{\{benefício_2\}\}/g, "[benefício 2]")
      .replace(/\{\{oferta_especial\}\}/g, "[sua oferta especial]")
      .replace(/\{\{resultado_esperado\}\}/g, "[resultado que o cliente terá]")
      .replace(/\{\{proposta_resumida\}\}/g, "[resumo da sua proposta]");
  };

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  const recommendedCadence = selectedLead ? getRecommendedCadence(selectedLead) : null;
  const leadObjections = selectedLead?.objections || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Scripts & Cadências</h2>
          <p className="text-sm text-muted-foreground">
            Roteiros personalizados e sequências de contato
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Leads */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Leads para Contato</CardTitle>
            <CardDescription>Selecione um lead para ver scripts</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-4">
                {leadIntelligence.map((intel) => (
                  <div
                    key={intel.id}
                    onClick={() => setSelectedLead(intel)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedLead?.id === intel.id 
                        ? "bg-primary/10 border border-primary/20" 
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {getTemperatureIcon(intel.temperature)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{intel.leads?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {intel.days_since_last_contact}d sem contato • {intel.total_contact_attempts || 0} tentativas
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
                {leadIntelligence.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum lead analisado ainda
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Scripts e Cadência */}
        <div className="lg:col-span-2 space-y-6">
          {selectedLead ? (
            <>
              {/* Info do Lead */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-muted">
                        <User className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{selectedLead.leads?.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${
                            selectedLead.temperature === "quente" || selectedLead.temperature === "fechando"
                              ? "bg-orange-100 text-orange-800"
                              : selectedLead.temperature === "morno"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {getTemperatureIcon(selectedLead.temperature)}
                            <span className="ml-1">{selectedLead.temperature}</span>
                          </Badge>
                          <Badge variant="outline">
                            Score: {selectedLead.engagement_score}%
                          </Badge>
                          <Badge variant="outline">
                            {selectedLead.recommended_channel}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Objeções detectadas */}
                  {leadObjections.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-sm font-medium text-amber-800">
                        ⚠️ Objeções detectadas: {leadObjections.join(", ")}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabs de Scripts */}
              <Tabs defaultValue="cadence" className="space-y-4">
                <TabsList className="w-full">
                  <TabsTrigger value="cadence" className="flex-1">
                    <Calendar className="h-4 w-4 mr-2" />
                    Cadência Recomendada
                  </TabsTrigger>
                  <TabsTrigger value="objections" className="flex-1">
                    <Target className="h-4 w-4 mr-2" />
                    Scripts por Objeção
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Cadência */}
                <TabsContent value="cadence">
                  {recommendedCadence && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{recommendedCadence.name}</CardTitle>
                            <CardDescription>{recommendedCadence.description}</CardDescription>
                          </div>
                          <Badge variant="outline">
                            {recommendedCadence.duration} dias
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {recommendedCadence.steps.map((step, index) => (
                            <Collapsible
                              key={step.id}
                              open={expandedCadence === step.id}
                              onOpenChange={() => setExpandedCadence(
                                expandedCadence === step.id ? null : step.id
                              )}
                            >
                              <div className="flex items-start gap-4">
                                {/* Timeline */}
                                <div className="flex flex-col items-center">
                                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                                    step.completed 
                                      ? "bg-green-100 border-green-500" 
                                      : "bg-background border-muted-foreground/30"
                                  }`}>
                                    {step.completed ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <span className="text-xs font-medium">{index + 1}</span>
                                    )}
                                  </div>
                                  {index < recommendedCadence.steps.length - 1 && (
                                    <div className="w-0.5 h-full min-h-[40px] bg-muted-foreground/20 mt-2" />
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 pb-4">
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-2 -ml-2">
                                      <div className="flex items-center gap-3">
                                        <Badge className={getChannelColor(step.channel)}>
                                          {getChannelIcon(step.channel)}
                                          <span className="ml-1 capitalize">{step.channel}</span>
                                        </Badge>
                                        <div>
                                          <p className="font-medium">{step.action}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Dia {step.day}
                                          </p>
                                        </div>
                                      </div>
                                      {expandedCadence === step.id ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </div>
                                  </CollapsibleTrigger>

                                  <CollapsibleContent className="mt-3 space-y-3">
                                    {/* Script Principal */}
                                    <div className="relative p-4 rounded-lg bg-muted/50 border">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          SCRIPT PRINCIPAL
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => copyToClipboard(
                                            personalizeScript(step.script, selectedLead)
                                          )}
                                        >
                                          <Copy className="h-3 w-3 mr-1" />
                                          Copiar
                                        </Button>
                                      </div>
                                      <pre className="text-sm whitespace-pre-wrap font-sans">
                                        {personalizeScript(step.script, selectedLead)}
                                      </pre>
                                    </div>

                                    {/* Variações */}
                                    {step.variations.length > 0 && (
                                      <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          VARIAÇÕES
                                        </span>
                                        {step.variations.map((variation, vIndex) => (
                                          <div 
                                            key={vIndex}
                                            className="relative p-3 rounded-lg bg-muted/30 border border-dashed"
                                          >
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="absolute top-2 right-2"
                                              onClick={() => copyToClipboard(
                                                personalizeScript(variation, selectedLead)
                                              )}
                                            >
                                              <Copy className="h-3 w-3" />
                                            </Button>
                                            <pre className="text-sm whitespace-pre-wrap font-sans pr-16">
                                              {personalizeScript(variation, selectedLead)}
                                            </pre>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Checkbox de conclusão */}
                                    <div className="flex items-center gap-2 pt-2">
                                      <Checkbox id={`step-${step.id}`} />
                                      <label 
                                        htmlFor={`step-${step.id}`}
                                        className="text-sm cursor-pointer"
                                      >
                                        Marcar como concluído
                                      </label>
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </div>
                            </Collapsible>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab: Scripts por Objeção */}
                <TabsContent value="objections">
                  <div className="space-y-4">
                    {Object.entries(OBJECTION_SCRIPTS).map(([key, obj]) => {
                      const isRelevant = leadObjections.includes(key);
                      
                      return (
                        <Card 
                          key={key}
                          className={isRelevant ? "border-amber-300 bg-amber-50/50" : ""}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base flex items-center gap-2">
                                {obj.title}
                                {isRelevant && (
                                  <Badge className="bg-amber-500 text-white">
                                    Detectada
                                  </Badge>
                                )}
                              </CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {obj.scripts.map((script, sIndex) => (
                                <div 
                                  key={sIndex}
                                  className="p-3 rounded-lg bg-muted/50 border"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge className={getChannelColor(script.channel)}>
                                      {getChannelIcon(script.channel)}
                                      <span className="ml-1 capitalize">{script.channel}</span>
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(
                                        personalizeScript(script.script, selectedLead)
                                      )}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copiar
                                    </Button>
                                  </div>
                                  <pre className="text-sm whitespace-pre-wrap font-sans">
                                    {personalizeScript(script.script, selectedLead)}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um lead para ver scripts e cadências</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CadenceManager;
