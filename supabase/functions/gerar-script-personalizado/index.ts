import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConversationMessage {
  mensagem: string;
  fromme: boolean;
  created_at: string;
}

interface LeadIntelligence {
  objections: unknown[] | null;
  interests: unknown[] | null;
  conversation_sentiment: string | null;
  temperature: string | null;
  recommended_action: string | null;
  days_since_last_contact: number | null;
}

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  value: number | null;
  tags: string[] | null;
  funis: { nome: string }[] | null;
  etapas: { nome: string }[] | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, context, company_id } = await req.json();
    
    console.log("[gerar-script] Iniciando para lead:", lead_id, "contexto:", context);

    if (!lead_id || !context || !company_id) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios: lead_id, context, company_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[gerar-script] LOVABLE_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração de IA não encontrada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar dados do lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        id, name, phone, email, value, tags,
        funis:funil_id(nome),
        etapas:etapa_id(nome)
      `)
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("[gerar-script] Lead não encontrado:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[gerar-script] Lead encontrado:", lead.name);

    // 2. Buscar histórico de conversas
    const { data: conversations } = await supabase
      .from("conversas")
      .select("mensagem, fromme, created_at")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(30);

    // 3. Buscar inteligência comercial existente
    const { data: intelligence } = await supabase
      .from("ia_lead_intelligence")
      .select("objections, interests, conversation_sentiment, temperature, recommended_action, days_since_last_contact")
      .eq("lead_id", lead_id)
      .maybeSingle();

    // 4. Buscar scripts de sucesso como referência
    const { data: successfulScripts } = await supabase
      .from("ia_scripts")
      .select("script_template, success_rate, name")
      .eq("company_id", company_id)
      .eq("trigger_context", context)
      .gte("success_rate", 60)
      .order("success_rate", { ascending: false })
      .limit(2);

    // 5. Buscar dados da empresa
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", company_id)
      .single();

    // Formatar histórico de conversas
    const conversationHistory = conversations && conversations.length > 0
      ? (conversations as ConversationMessage[]).reverse().map(c => {
          const sender = c.fromme ? "[EMPRESA]" : "[LEAD]";
          return `${sender}: ${c.mensagem}`;
        }).join("\n")
      : "Sem histórico de conversas anterior.";

    // Extrair objeções e interesses
    const typedIntelligence = intelligence as LeadIntelligence | null;
    const objections = typedIntelligence?.objections 
      ? (Array.isArray(typedIntelligence.objections) ? typedIntelligence.objections.join(", ") : "Nenhuma detectada")
      : "Não analisado";
    
    const interests = typedIntelligence?.interests
      ? (Array.isArray(typedIntelligence.interests) ? typedIntelligence.interests.join(", ") : "Não identificados")
      : "Não analisado";

    // Mapear contexto para descrição
    const contextDescriptions: Record<string, string> = {
      primeiro_contato: "primeiro contato inicial com o lead",
      follow_up: "follow-up após alguns dias sem resposta",
      objecao_preco: "contornar objeção de preço/valor",
      objecao_prazo: "lidar com solicitação de mais tempo para decidir",
      fechamento: "fechamento da negociação",
      reengajamento: "reengajar lead que esfriou",
      apresentacao: "apresentar produto/serviço",
      qualificacao: "qualificar necessidades do lead",
    };

    // Referência de scripts de sucesso
    const scriptReference = successfulScripts && successfulScripts.length > 0
      ? `\n\nSCRIPTS DE SUCESSO PARA REFERÊNCIA (não copiar, apenas inspirar):\n${
          successfulScripts.map(s => `- ${s.name} (${s.success_rate}% sucesso): "${s.script_template.substring(0, 150)}..."`).join("\n")
        }`
      : "";

    // 6. Montar prompt para IA
    const systemPrompt = `Você é um especialista em vendas consultivas para a empresa "${company?.name || 'nossa empresa'}".
Seu objetivo é criar scripts de abordagem personalizados e eficazes baseados no contexto completo do lead.

Regras:
- Use tom empático, profissional e natural (não robótico)
- O script deve ter entre 3-5 parágrafos curtos
- Use emojis com moderação (1-2 no máximo)
- Inclua uma pergunta ou call-to-action claro no final
- Se houver objeções detectadas, enderece-as de forma consultiva
- Personalize usando o nome do lead e contexto da conversa anterior
- Nunca seja agressivo ou insistente
- Foque em valor, não em preço`;

    const typedLead = lead as unknown as Lead;
    const funilNome = typedLead.funis && typedLead.funis.length > 0 ? typedLead.funis[0].nome : 'Não definido';
    const etapaNome = typedLead.etapas && typedLead.etapas.length > 0 ? typedLead.etapas[0].nome : 'Não definida';
    
    const userPrompt = `DADOS DO LEAD:
- Nome: ${typedLead.name}
- Valor em negociação: ${typedLead.value ? `R$ ${typedLead.value.toLocaleString('pt-BR')}` : 'Não definido'}
- Tags: ${typedLead.tags?.join(", ") || 'Nenhuma'}
- Funil: ${funilNome}
- Etapa: ${etapaNome}

ANÁLISE DO LEAD:
- Temperatura: ${typedIntelligence?.temperature || 'Não analisada'}
- Sentimento: ${typedIntelligence?.conversation_sentiment || 'Não analisado'}
- Dias sem contato: ${typedIntelligence?.days_since_last_contact || 'Desconhecido'}
- Objeções detectadas: ${objections}
- Interesses identificados: ${interests}

HISTÓRICO DE CONVERSA (últimas mensagens):
${conversationHistory}

CONTEXTO SOLICITADO: ${contextDescriptions[context] || context}
${scriptReference}

Gere um script de abordagem personalizado para este lead considerando todo o contexto acima.`;

    console.log("[gerar-script] Chamando Lovable AI...");

    // 7. Chamar Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_personalized_script",
            description: "Gera um script de vendas personalizado",
            parameters: {
              type: "object",
              properties: {
                script: {
                  type: "string",
                  description: "O script de abordagem completo, pronto para usar"
                },
                suggested_channel: {
                  type: "string",
                  enum: ["whatsapp", "email", "call"],
                  description: "Canal recomendado para envio"
                },
                key_points: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-4 pontos-chave abordados no script"
                },
                objection_handled: {
                  type: "string",
                  description: "Principal objeção endereçada, se houver"
                },
                tone: {
                  type: "string",
                  enum: ["consultivo", "urgente", "empático", "direto"],
                  description: "Tom utilizado no script"
                }
              },
              required: ["script", "suggested_channel", "key_points"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_personalized_script" } }
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error("[gerar-script] Erro da IA:", status, errorText);
      
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao gerar script com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("[gerar-script] Resposta da IA recebida");

    // Extrair resultado do tool call
    let result;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        result = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback para resposta direta
        const content = aiData.choices?.[0]?.message?.content || "";
        result = {
          script: content,
          suggested_channel: "whatsapp",
          key_points: ["Personalizado para o contexto"],
          objection_handled: null,
          tone: "consultivo"
        };
      }
    } catch (parseError) {
      console.error("[gerar-script] Erro ao parsear resposta:", parseError);
      result = {
        script: aiData.choices?.[0]?.message?.content || "Erro ao gerar script",
        suggested_channel: "whatsapp",
        key_points: [],
        objection_handled: null,
        tone: "consultivo"
      };
    }

    // 8. Salvar script gerado para métricas
    const { error: insertError } = await supabase
      .from("ia_scripts_generated")
      .insert({
        company_id,
        lead_id,
        context,
        script_content: result.script,
        objections_addressed: result.objection_handled ? [result.objection_handled] : null,
        key_points: result.key_points,
        suggested_channel: result.suggested_channel,
      });

    if (insertError) {
      console.warn("[gerar-script] Erro ao salvar métrica:", insertError);
    }

    console.log("[gerar-script] Script gerado com sucesso!");

    return new Response(
      JSON.stringify({
        success: true,
        lead_name: typedLead.name,
        context,
        ...result
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[gerar-script] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
