import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadData {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  tags?: string[];
  funil_id?: string;
  etapa_id?: string;
  value?: number;
  created_at?: string;
  company_id?: string;
}

interface ConversationData {
  mensagem: string;
  fromme: boolean;
  created_at: string;
  tipo_mensagem?: string;
}

interface AnalysisResult {
  engagement_score: number;
  temperature: 'frio' | 'morno' | 'quente' | 'fechando';
  purchase_intent: number;
  conversation_sentiment: 'positivo' | 'neutro' | 'negativo' | 'frustrado' | 'entusiasmado';
  detected_intent: string;
  objections: string[];
  interests: string[];
  recommended_channel: 'whatsapp' | 'instagram' | 'call' | 'email' | 'any';
  recommended_action: string;
  next_action_date: string | null;
  suggested_script: string;
  last_message_summary: string;
  key_topics: string[];
  days_since_last_contact?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const { 
      action, 
      leadId, 
      companyId, 
      conversationHistory,
      analyzeAll = false 
    } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[IA-ANALISE-COMERCIAL] Action: ${action}, LeadId: ${leadId}, CompanyId: ${companyId}`);

    // =====================================================
    // AÇÃO: Analisar um lead específico
    // =====================================================
    if (action === "analyze_lead" && leadId) {
      // Buscar dados do lead
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (leadError || !lead) {
        throw new Error(`Lead não encontrado: ${leadId}`);
      }

      // Buscar histórico de conversas
      const { data: conversations } = await supabase
        .from("conversas")
        .select("mensagem, fromme, created_at, tipo_mensagem")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(50);

      // Buscar tarefas relacionadas
      const { data: tasks } = await supabase
        .from("tarefas")
        .select("titulo, status, due_date")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10);

      // Buscar compromissos
      const { data: appointments } = await supabase
        .from("compromissos")
        .select("titulo, data_hora_inicio, status")
        .eq("lead_id", leadId)
        .order("data_hora_inicio", { ascending: false })
        .limit(5);

      // Análise com IA
      const analysis = await analyzeLeadWithAI(
        lead,
        conversations || [],
        tasks || [],
        appointments || [],
        lovableApiKey
      );

      // Salvar/atualizar inteligência do lead
      const { error: upsertError } = await supabase
        .from("ia_lead_intelligence")
        .upsert({
          lead_id: leadId,
          company_id: lead.company_id,
          ...analysis,
          last_analysis_at: new Date().toISOString(),
        }, {
          onConflict: "lead_id"
        });

      if (upsertError) {
        console.error("[IA-ANALISE-COMERCIAL] Erro ao salvar análise:", upsertError);
      }

      // Criar alertas se necessário
      await createAlertsIfNeeded(supabase, lead, analysis);

      const executionTime = Date.now() - startTime;
      console.log(`[IA-ANALISE-COMERCIAL] Análise concluída em ${executionTime}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          analysis,
          executionTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // AÇÃO: Analisar todos os leads de uma empresa (batch)
    // =====================================================
    if (action === "analyze_batch" && companyId) {
      // Buscar leads que precisam de análise (não analisados nas últimas 6 horas)
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

      const { data: leads } = await supabase
        .from("leads")
        .select("id")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(50);

      const leadIds = leads?.map(l => l.id) || [];

      // Buscar leads já analisados recentemente
      const { data: recentlyAnalyzed } = await supabase
        .from("ia_lead_intelligence")
        .select("lead_id")
        .in("lead_id", leadIds)
        .gte("last_analysis_at", sixHoursAgo);

      const recentlyAnalyzedIds = new Set(recentlyAnalyzed?.map(r => r.lead_id) || []);
      const leadsToAnalyze = leadIds.filter(id => !recentlyAnalyzedIds.has(id));

      console.log(`[IA-ANALISE-COMERCIAL] Analisando ${leadsToAnalyze.length} leads`);

      let analyzed = 0;
      for (const leadId of leadsToAnalyze.slice(0, 10)) { // Limitar a 10 por vez
        try {
          // Chamar recursivamente para cada lead
          const response = await fetch(`${supabaseUrl}/functions/v1/ia-analise-comercial`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              action: "analyze_lead",
              leadId,
              companyId,
            }),
          });

          if (response.ok) analyzed++;
        } catch (e) {
          console.error(`[IA-ANALISE-COMERCIAL] Erro ao analisar lead ${leadId}:`, e);
        }
      }

      // Atualizar métricas agregadas
      await updateCommercialMetrics(supabase, companyId);

      return new Response(
        JSON.stringify({
          success: true,
          analyzed,
          total: leadsToAnalyze.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // AÇÃO: Obter dashboard de inteligência comercial
    // =====================================================
    if (action === "get_dashboard" && companyId) {
      // Buscar métricas agregadas
      const { data: metrics } = await supabase
        .from("ia_commercial_metrics")
        .select("*")
        .eq("company_id", companyId)
        .order("metric_date", { ascending: false })
        .limit(30);

      // Buscar inteligência de todos os leads
      const { data: leadIntelligence } = await supabase
        .from("ia_lead_intelligence")
        .select(`
          *,
          leads:lead_id (
            id, name, phone, email, tags, value, created_at,
            funis:funil_id (nome),
            etapas:etapa_id (nome, cor)
          )
        `)
        .eq("company_id", companyId)
        .order("engagement_score", { ascending: false })
        .limit(100);

      // Buscar alertas pendentes
      const { data: alerts } = await supabase
        .from("ia_commercial_alerts")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);

      // Calcular estatísticas
      const stats = calculateDashboardStats(leadIntelligence || [], alerts || []);

      return new Response(
        JSON.stringify({
          success: true,
          metrics: metrics || [],
          leadIntelligence: leadIntelligence || [],
          alerts: alerts || [],
          stats,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // AÇÃO: Obter script sugerido para um lead
    // =====================================================
    if (action === "get_script" && leadId) {
      const { data: intelligence } = await supabase
        .from("ia_lead_intelligence")
        .select("*")
        .eq("lead_id", leadId)
        .single();

      const { data: lead } = await supabase
        .from("leads")
        .select("*, funis:funil_id(nome), etapas:etapa_id(nome)")
        .eq("id", leadId)
        .single();

      if (!intelligence || !lead) {
        return new Response(
          JSON.stringify({ success: false, error: "Lead ou inteligência não encontrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // Gerar script personalizado com IA
      const script = await generatePersonalizedScript(lead, intelligence, lovableApiKey);

      return new Response(
        JSON.stringify({ success: true, script }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // AÇÃO: Marcar alerta como visto/acionado
    // =====================================================
    if (action === "update_alert") {
      const { alertId, status, actionedBy } = await req.json();

      const updateData: any = { status };
      if (status === "seen") updateData.seen_at = new Date().toISOString();
      if (status === "actioned") {
        updateData.actioned_at = new Date().toISOString();
        updateData.actioned_by = actionedBy;
      }

      const { error } = await supabase
        .from("ia_commercial_alerts")
        .update(updateData)
        .eq("id", alertId);

      return new Response(
        JSON.stringify({ success: !error }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não reconhecida" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error: unknown) {
    console.error("[IA-ANALISE-COMERCIAL] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// =====================================================
// FUNÇÃO: Analisar lead com IA
// =====================================================
async function analyzeLeadWithAI(
  lead: LeadData,
  conversations: ConversationData[],
  tasks: any[],
  appointments: any[],
  apiKey?: string
): Promise<AnalysisResult> {
  // Calcular métricas básicas
  const lastContact = conversations[0]?.created_at;
  const daysSinceLastContact = lastContact 
    ? Math.floor((Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const leadMessages = conversations.filter(c => !c.fromme);
  const ourMessages = conversations.filter(c => c.fromme);
  const responseRate = ourMessages.length > 0 
    ? (leadMessages.length / ourMessages.length) * 100 
    : 0;

  // Análise de sentimento e intenção básica (sem IA como fallback)
  let analysis: AnalysisResult = {
    engagement_score: calculateEngagementScore(conversations, daysSinceLastContact, responseRate),
    temperature: determineTemperature(daysSinceLastContact, responseRate, conversations.length),
    purchase_intent: calculatePurchaseIntent(conversations),
    conversation_sentiment: analyzeSentiment(conversations),
    detected_intent: detectIntent(conversations),
    objections: detectObjections(conversations),
    interests: detectInterests(conversations),
    recommended_channel: "whatsapp",
    recommended_action: determineNextAction(daysSinceLastContact, responseRate),
    next_action_date: calculateNextActionDate(daysSinceLastContact),
    suggested_script: "",
    last_message_summary: conversations[0]?.mensagem?.substring(0, 200) || "",
    key_topics: extractTopics(conversations),
  };

  // Se temos API key, usar IA para análise mais profunda
  if (apiKey) {
    try {
      const conversationText = conversations
        .slice(0, 20)
        .map(c => `${c.fromme ? "EMPRESA" : "LEAD"}: ${c.mensagem}`)
        .reverse()
        .join("\n");

      const prompt = `Você é um especialista em inteligência comercial. Analise esta conversa e retorne uma análise detalhada.

DADOS DO LEAD:
- Nome: ${lead.name}
- Valor potencial: R$ ${lead.value || 0}
- Tags: ${lead.tags?.join(", ") || "nenhuma"}
- Dias sem contato: ${daysSinceLastContact}
- Taxa de resposta: ${responseRate.toFixed(1)}%

HISTÓRICO DE CONVERSA:
${conversationText || "Sem histórico de conversa"}

TAREFAS PENDENTES:
${tasks.map(t => `- ${t.titulo} (${t.status})`).join("\n") || "Nenhuma"}

COMPROMISSOS:
${appointments.map(a => `- ${a.titulo} em ${a.data_hora_inicio}`).join("\n") || "Nenhum"}

Analise e forneça:
1. Score de engajamento (0-100)
2. Temperatura do lead (frio/morno/quente/fechando)
3. Probabilidade de compra (0-100)
4. Sentimento da conversa (positivo/neutro/negativo/frustrado/entusiasmado)
5. Intenção detectada
6. Lista de objeções detectadas
7. Interesses identificados
8. Canal recomendado (whatsapp/instagram/call/email)
9. Próxima ação recomendada
10. Resumo da última interação
11. Tópicos-chave discutidos
12. Script sugerido para próximo contato`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "Você é um especialista em inteligência comercial e análise de conversas. Responda de forma estruturada e objetiva."
            },
            { role: "user", content: prompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "analyze_lead",
              description: "Retorna análise comercial estruturada do lead",
              parameters: {
                type: "object",
                properties: {
                  engagement_score: { type: "number", description: "Score de 0-100" },
                  temperature: { type: "string", enum: ["frio", "morno", "quente", "fechando"] },
                  purchase_intent: { type: "number", description: "Probabilidade 0-100" },
                  conversation_sentiment: { type: "string", enum: ["positivo", "neutro", "negativo", "frustrado", "entusiasmado"] },
                  detected_intent: { type: "string", description: "Intenção principal detectada" },
                  objections: { type: "array", items: { type: "string" }, description: "Lista de objeções" },
                  interests: { type: "array", items: { type: "string" }, description: "Lista de interesses" },
                  recommended_channel: { type: "string", enum: ["whatsapp", "instagram", "call", "email", "any"] },
                  recommended_action: { type: "string", description: "Próxima ação recomendada" },
                  suggested_script: { type: "string", description: "Script sugerido para próximo contato" },
                  last_message_summary: { type: "string", description: "Resumo da última interação" },
                  key_topics: { type: "array", items: { type: "string" }, description: "Tópicos-chave" }
                },
                required: ["engagement_score", "temperature", "purchase_intent", "conversation_sentiment", "recommended_action"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "analyze_lead" } }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const aiAnalysis = JSON.parse(toolCall.function.arguments);
          analysis = {
            ...analysis,
            ...aiAnalysis,
            next_action_date: calculateNextActionDate(daysSinceLastContact),
          };
        }
      } else if (response.status === 429) {
        console.warn("[IA-ANALISE-COMERCIAL] Rate limit atingido, usando análise básica");
      } else if (response.status === 402) {
        console.warn("[IA-ANALISE-COMERCIAL] Créditos insuficientes, usando análise básica");
      }
    } catch (e) {
      console.error("[IA-ANALISE-COMERCIAL] Erro na análise com IA:", e);
    }
  }

  return analysis;
}

// =====================================================
// FUNÇÕES AUXILIARES DE ANÁLISE
// =====================================================

function calculateEngagementScore(conversations: ConversationData[], daysSinceContact: number, responseRate: number): number {
  let score = 50;
  
  // Fator: quantidade de mensagens
  score += Math.min(conversations.length * 2, 20);
  
  // Fator: taxa de resposta
  score += Math.min(responseRate / 2, 15);
  
  // Fator: tempo sem contato (penalidade)
  if (daysSinceContact > 7) score -= 20;
  else if (daysSinceContact > 3) score -= 10;
  else if (daysSinceContact <= 1) score += 10;
  
  // Fator: mensagens recentes do lead
  const recentLeadMessages = conversations.filter(c => !c.fromme && 
    new Date(c.created_at) > new Date(Date.now() - 48 * 60 * 60 * 1000)).length;
  score += recentLeadMessages * 5;
  
  return Math.max(0, Math.min(100, score));
}

function determineTemperature(daysSinceContact: number, responseRate: number, messageCount: number): 'frio' | 'morno' | 'quente' | 'fechando' {
  if (daysSinceContact > 14 || messageCount < 2) return "frio";
  if (daysSinceContact > 7 || responseRate < 30) return "morno";
  if (responseRate > 70 && daysSinceContact <= 2) return "fechando";
  return "quente";
}

function calculatePurchaseIntent(conversations: ConversationData[]): number {
  const positiveKeywords = ["quero", "preciso", "orçamento", "preço", "comprar", "fechar", "contratar", "interesse"];
  const negativeKeywords = ["não", "caro", "depois", "pensar", "talvez", "sei não"];
  
  let intent = 30;
  
  for (const conv of conversations.filter(c => !c.fromme)) {
    const text = conv.mensagem.toLowerCase();
    positiveKeywords.forEach(kw => { if (text.includes(kw)) intent += 5; });
    negativeKeywords.forEach(kw => { if (text.includes(kw)) intent -= 3; });
  }
  
  return Math.max(0, Math.min(100, intent));
}

function analyzeSentiment(conversations: ConversationData[]): 'positivo' | 'neutro' | 'negativo' | 'frustrado' | 'entusiasmado' {
  const positiveWords = ["ótimo", "excelente", "perfeito", "adorei", "top", "obrigado", "maravilha", "show"];
  const negativeWords = ["péssimo", "horrível", "decepcionado", "frustrado", "raiva", "absurdo", "ruim"];
  const enthusiasticWords = ["muito", "demais", "super", "incrível", "amei", "!!"];
  
  let positiveScore = 0;
  let negativeScore = 0;
  let enthusiasmScore = 0;
  
  for (const conv of conversations.filter(c => !c.fromme)) {
    const text = conv.mensagem.toLowerCase();
    positiveWords.forEach(w => { if (text.includes(w)) positiveScore++; });
    negativeWords.forEach(w => { if (text.includes(w)) negativeScore++; });
    enthusiasticWords.forEach(w => { if (text.includes(w)) enthusiasmScore++; });
  }
  
  if (negativeScore > positiveScore + 2) return "frustrado";
  if (negativeScore > positiveScore) return "negativo";
  if (enthusiasmScore > 3) return "entusiasmado";
  if (positiveScore > negativeScore) return "positivo";
  return "neutro";
}

function detectIntent(conversations: ConversationData[]): string {
  const leadMessages = conversations.filter(c => !c.fromme).map(c => c.mensagem.toLowerCase()).join(" ");
  
  if (leadMessages.includes("preço") || leadMessages.includes("valor") || leadMessages.includes("custo")) return "consulta_preco";
  if (leadMessages.includes("agendar") || leadMessages.includes("horário") || leadMessages.includes("marcar")) return "agendamento";
  if (leadMessages.includes("problema") || leadMessages.includes("não funciona") || leadMessages.includes("reclamação")) return "suporte";
  if (leadMessages.includes("quero") || leadMessages.includes("comprar") || leadMessages.includes("fechar")) return "compra";
  if (leadMessages.includes("dúvida") || leadMessages.includes("como funciona") || leadMessages.includes("?")) return "informacao";
  
  return "geral";
}

function detectObjections(conversations: ConversationData[]): string[] {
  const objections: string[] = [];
  const leadMessages = conversations.filter(c => !c.fromme).map(c => c.mensagem.toLowerCase()).join(" ");
  
  if (leadMessages.includes("caro") || leadMessages.includes("muito valor") || leadMessages.includes("não tenho")) {
    objections.push("preço");
  }
  if (leadMessages.includes("demora") || leadMessages.includes("prazo") || leadMessages.includes("rápido")) {
    objections.push("prazo");
  }
  if (leadMessages.includes("confiança") || leadMessages.includes("garantia") || leadMessages.includes("seguro")) {
    objections.push("confiança");
  }
  if (leadMessages.includes("concorrente") || leadMessages.includes("outro") || leadMessages.includes("comparar")) {
    objections.push("concorrência");
  }
  if (leadMessages.includes("pensar") || leadMessages.includes("decidir") || leadMessages.includes("depois")) {
    objections.push("decisão");
  }
  
  return objections;
}

function detectInterests(conversations: ConversationData[]): string[] {
  const interests: string[] = [];
  const leadMessages = conversations.filter(c => !c.fromme).map(c => c.mensagem.toLowerCase()).join(" ");
  
  // Detectar interesses por palavras-chave
  const interestMap: Record<string, string> = {
    "desconto": "desconto",
    "promoção": "promoção",
    "parcelamento": "pagamento",
    "forma de pagamento": "pagamento",
    "entrega": "entrega",
    "garantia": "garantia",
    "suporte": "suporte",
    "treinamento": "treinamento",
    "demo": "demonstração",
  };
  
  for (const [keyword, interest] of Object.entries(interestMap)) {
    if (leadMessages.includes(keyword) && !interests.includes(interest)) {
      interests.push(interest);
    }
  }
  
  return interests;
}

function determineNextAction(daysSinceContact: number, responseRate: number): string {
  if (daysSinceContact > 14) return "reengajamento";
  if (daysSinceContact > 7) return "follow_up_urgente";
  if (daysSinceContact > 3) return "follow_up";
  if (responseRate > 70) return "proposta";
  if (responseRate > 40) return "qualificação";
  return "nutricao";
}

function calculateNextActionDate(daysSinceContact: number): string {
  const now = new Date();
  let daysToAdd = 1;
  
  if (daysSinceContact > 14) daysToAdd = 0; // Urgente
  else if (daysSinceContact > 7) daysToAdd = 0;
  else if (daysSinceContact > 3) daysToAdd = 1;
  else daysToAdd = 2;
  
  now.setDate(now.getDate() + daysToAdd);
  return now.toISOString();
}

function extractTopics(conversations: ConversationData[]): string[] {
  const topics: string[] = [];
  const allText = conversations.map(c => c.mensagem.toLowerCase()).join(" ");
  
  const topicKeywords: Record<string, string> = {
    "preço": "preço",
    "valor": "valor",
    "orçamento": "orçamento",
    "prazo": "prazo",
    "entrega": "entrega",
    "qualidade": "qualidade",
    "garantia": "garantia",
    "suporte": "suporte",
    "pagamento": "pagamento",
    "desconto": "desconto",
  };
  
  for (const [keyword, topic] of Object.entries(topicKeywords)) {
    if (allText.includes(keyword) && !topics.includes(topic)) {
      topics.push(topic);
    }
  }
  
  return topics.slice(0, 5);
}

// =====================================================
// FUNÇÃO: Criar alertas baseados na análise
// =====================================================
async function createAlertsIfNeeded(supabase: any, lead: LeadData, analysis: AnalysisResult) {
  const alerts: any[] = [];
  
  // Alerta: Lead quente
  if (analysis.temperature === "fechando" || analysis.engagement_score > 80) {
    alerts.push({
      company_id: lead.company_id,
      lead_id: lead.id,
      alert_type: "lead_quente",
      severity: "high",
      title: `🔥 Lead quente: ${lead.name}`,
      description: `Lead com alta probabilidade de conversão (${analysis.purchase_intent}%). ${analysis.recommended_action}`,
      recommended_action: analysis.recommended_action,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  // Alerta: Lead esfriando
  const daysSinceContact = analysis.days_since_last_contact ?? 0;
  if (daysSinceContact > 5 && analysis.temperature !== "frio") {
    alerts.push({
      company_id: lead.company_id,
      lead_id: lead.id,
      alert_type: "lead_esfriando",
      severity: "medium",
      title: `⚠️ Lead esfriando: ${lead.name}`,
      description: `${daysSinceContact} dias sem contato. Risco de perder interesse.`,
      recommended_action: "follow_up_urgente",
    });
  }
  
  // Alerta: Objeção detectada
  if (analysis.objections.length > 0) {
    alerts.push({
      company_id: lead.company_id,
      lead_id: lead.id,
      alert_type: "objecao_detectada",
      severity: "medium",
      title: `💡 Objeções detectadas: ${lead.name}`,
      description: `Objeções: ${analysis.objections.join(", ")}. Prepare argumentos de contorno.`,
      recommended_action: "contornar_objecao",
      action_data: { objections: analysis.objections },
    });
  }
  
  // Inserir alertas (evitar duplicatas)
  for (const alert of alerts) {
    const { data: existing } = await supabase
      .from("ia_commercial_alerts")
      .select("id")
      .eq("lead_id", alert.lead_id)
      .eq("alert_type", alert.alert_type)
      .eq("status", "pending")
      .single();
    
    if (!existing) {
      await supabase.from("ia_commercial_alerts").insert(alert);
    }
  }
}

// =====================================================
// FUNÇÃO: Atualizar métricas comerciais agregadas
// =====================================================
async function updateCommercialMetrics(supabase: any, companyId: string) {
  const today = new Date().toISOString().split("T")[0];
  
  // Buscar inteligência de todos os leads
  const { data: intelligence } = await supabase
    .from("ia_lead_intelligence")
    .select("temperature, engagement_score, response_rate")
    .eq("company_id", companyId);
  
  if (!intelligence || intelligence.length === 0) return;
  
  const stats = {
    total_leads_monitored: intelligence.length,
    leads_hot: intelligence.filter((i: any) => i.temperature === "quente" || i.temperature === "fechando").length,
    leads_warm: intelligence.filter((i: any) => i.temperature === "morno").length,
    leads_cold: intelligence.filter((i: any) => i.temperature === "frio").length,
    avg_engagement_score: intelligence.reduce((sum: number, i: any) => sum + (i.engagement_score || 0), 0) / intelligence.length,
    avg_response_rate: intelligence.reduce((sum: number, i: any) => sum + (i.response_rate || 0), 0) / intelligence.length,
  };
  
  // Buscar alertas
  const { data: alerts } = await supabase
    .from("ia_commercial_alerts")
    .select("alert_type")
    .eq("company_id", companyId)
    .eq("status", "pending");
  
  const opportunities = alerts?.filter((a: any) => ["lead_quente", "oportunidade", "interesse_alto"].includes(a.alert_type)).length || 0;
  const risks = alerts?.filter((a: any) => ["lead_esfriando", "risco_perda", "sem_contato"].includes(a.alert_type)).length || 0;
  
  await supabase
    .from("ia_commercial_metrics")
    .upsert({
      company_id: companyId,
      metric_date: today,
      ...stats,
      opportunities_detected: opportunities,
      risks_detected: risks,
    }, {
      onConflict: "company_id,metric_date"
    });
}

// =====================================================
// FUNÇÃO: Calcular estatísticas do dashboard
// =====================================================
function calculateDashboardStats(intelligence: any[], alerts: any[]) {
  return {
    totalLeads: intelligence.length,
    hotLeads: intelligence.filter(i => i.temperature === "quente" || i.temperature === "fechando").length,
    warmLeads: intelligence.filter(i => i.temperature === "morno").length,
    coldLeads: intelligence.filter(i => i.temperature === "frio").length,
    avgEngagement: intelligence.length > 0 
      ? Math.round(intelligence.reduce((sum, i) => sum + (i.engagement_score || 0), 0) / intelligence.length)
      : 0,
    avgPurchaseIntent: intelligence.length > 0
      ? Math.round(intelligence.reduce((sum, i) => sum + (i.purchase_intent || 0), 0) / intelligence.length)
      : 0,
    criticalAlerts: alerts.filter(a => a.severity === "critical").length,
    highAlerts: alerts.filter(a => a.severity === "high").length,
    pendingAlerts: alerts.length,
    topObjections: countObjections(intelligence),
  };
}

function countObjections(intelligence: any[]): { name: string; count: number }[] {
  const counts: Record<string, number> = {};
  
  for (const i of intelligence) {
    const objections = i.objections || [];
    for (const obj of objections) {
      counts[obj] = (counts[obj] || 0) + 1;
    }
  }
  
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// =====================================================
// FUNÇÃO: Gerar script personalizado
// =====================================================
async function generatePersonalizedScript(lead: any, intelligence: any, apiKey?: string): Promise<string> {
  if (!apiKey) {
    return generateBasicScript(lead, intelligence);
  }

  try {
    const prompt = `Gere um script de abordagem comercial personalizado para:

LEAD: ${lead.name}
TEMPERATURA: ${intelligence.temperature}
SENTIMENTO: ${intelligence.conversation_sentiment}
OBJEÇÕES: ${(intelligence.objections || []).join(", ") || "nenhuma identificada"}
INTERESSES: ${(intelligence.interests || []).join(", ") || "não identificados"}
ÚLTIMA AÇÃO: ${intelligence.recommended_action}
RESUMO: ${intelligence.last_message_summary || "Sem histórico"}

Gere um script curto (máximo 3 parágrafos) e natural para retomar o contato. Seja empático e focado em resolver as objeções.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em vendas consultivas. Escreva scripts naturais e empáticos." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || generateBasicScript(lead, intelligence);
    }
  } catch (e) {
    console.error("[IA-ANALISE-COMERCIAL] Erro ao gerar script:", e);
  }

  return generateBasicScript(lead, intelligence);
}

function generateBasicScript(lead: any, intelligence: any): string {
  const greeting = `Olá ${lead.name}! Tudo bem?`;
  
  let body = "";
  if (intelligence.temperature === "frio") {
    body = "Notei que faz um tempo que não conversamos. Gostaria de saber se posso ajudá-lo com algo?";
  } else if (intelligence.objections?.includes("preço")) {
    body = "Entendo sua preocupação com o investimento. Temos algumas condições especiais que podem se adequar melhor ao seu orçamento.";
  } else if (intelligence.temperature === "quente" || intelligence.temperature === "fechando") {
    body = "Vi que você demonstrou bastante interesse! Posso preparar uma proposta personalizada para você?";
  } else {
    body = "Gostaria de retomar nossa conversa e entender melhor como posso ajudá-lo.";
  }

  return `${greeting}\n\n${body}\n\nFico no aguardo do seu retorno!`;
}
