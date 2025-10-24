import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { flowId, leadId, conversationId, triggerType, triggerData } = await req.json();

    console.log("Executando fluxo:", { flowId, leadId, conversationId, triggerType });

    // Buscar fluxo
    const { data: flow, error: flowError } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flowId)
      .eq("active", true)
      .single();

    if (flowError || !flow) {
      throw new Error("Fluxo não encontrado ou inativo");
    }

    // Criar log de execução
    const { data: logData, error: logError } = await supabase
      .from("automation_flow_logs")
      .insert({
        flow_id: flowId,
        lead_id: leadId,
        conversation_id: conversationId,
        company_id: flow.company_id,
        status: "running",
        execution_data: { triggerType, triggerData },
      })
      .select()
      .single();

    if (logError) {
      console.error("Erro ao criar log:", logError);
    }

    const logId = logData?.id;

    // Executar nodes sequencialmente
    const nodes = flow.nodes || [];
    const edges = flow.edges || [];
    const executionContext: any = {
      leadId,
      conversationId,
      companyId: flow.company_id,
      triggerData,
    };

    try {
      for (const node of nodes) {
        console.log("Executando node:", node.id, node.type);

        switch (node.type) {
          case "action":
            await executeAction(node, executionContext, supabase);
            break;
          case "condition":
            const conditionResult = await evaluateCondition(node, executionContext, supabase);
            executionContext.lastConditionResult = conditionResult;
            break;
          case "ia":
            await executeIA(node, executionContext, supabase);
            break;
        }
      }

      // Marcar como completo
      if (logId) {
        await supabase
          .from("automation_flow_logs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Fluxo executado com sucesso",
          executionContext,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (executionError: any) {
      console.error("Erro na execução:", executionError);

      if (logId) {
        await supabase
          .from("automation_flow_logs")
          .update({
            status: "failed",
            error_message: executionError.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      throw executionError;
    }
  } catch (error: any) {
    console.error("Erro ao executar fluxo:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function executeAction(node: any, context: any, supabase: any) {
  const { actionType, message, label } = node.data;

  console.log("Executando ação:", actionType, label);

  switch (actionType) {
    case "enviar_mensagem":
      if (message && context.conversationId) {
        // Buscar número da conversa
        const { data: conversation } = await supabase
          .from("conversas")
          .select("numero")
          .eq("id", context.conversationId)
          .single();

        if (conversation?.numero) {
          await supabase.functions.invoke("enviar-whatsapp", {
            body: {
              numero: conversation.numero,
              mensagem: message,
              tipo_mensagem: "text",
            },
          });
        }
      }
      break;

    case "criar_lead":
      if (context.leadId) {
        console.log("Lead já existe:", context.leadId);
      }
      break;

    case "mover_funil":
      if (context.leadId && node.data.etapaId) {
        await supabase
          .from("leads")
          .update({ etapa_id: node.data.etapaId })
          .eq("id", context.leadId);
      }
      break;

    case "criar_tarefa":
      if (context.leadId) {
        await supabase.from("tasks").insert({
          title: label || "Nova tarefa",
          lead_id: context.leadId,
          company_id: context.companyId,
          owner_id: context.companyId, // Usar company owner
          status: "pendente",
          priority: "media",
        });
      }
      break;

    case "adicionar_nota":
      if (context.leadId && node.data.note) {
        await supabase
          .from("leads")
          .update({
            notes: node.data.note,
          })
          .eq("id", context.leadId);
      }
      break;
  }
}

async function evaluateCondition(node: any, context: any, supabase: any): Promise<boolean> {
  const { conditionType, checkValue } = node.data;

  console.log("Avaliando condição:", conditionType, checkValue);

  switch (conditionType) {
    case "tag":
      if (context.leadId && checkValue) {
        const { data: lead } = await supabase
          .from("leads")
          .select("tags")
          .eq("id", context.leadId)
          .single();

        return lead?.tags?.includes(checkValue) || false;
      }
      return false;

    case "horario":
      const now = new Date();
      const hour = now.getHours();
      // Formato esperado: "09:00-18:00"
      if (checkValue && checkValue.includes("-")) {
        const [start, end] = checkValue.split("-").map((h: string) => parseInt(h.split(":")[0]));
        return hour >= start && hour < end;
      }
      return false;

    case "palavra_chave":
      if (context.triggerData?.message && checkValue) {
        return context.triggerData.message.toLowerCase().includes(checkValue.toLowerCase());
      }
      return false;

    default:
      return true;
  }
}

async function executeIA(node: any, context: any, supabase: any) {
  const { prompt, mode, label } = node.data;

  console.log("Executando IA:", label, mode);

  if (!context.conversationId) {
    console.log("Sem conversa para IA interagir");
    return;
  }

  // Buscar dados do lead
  let leadData = null;
  if (context.leadId) {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("id", context.leadId)
      .single();
    leadData = data;
  }

  // Chamar função de IA apropriada
  const { data: iaResponse } = await supabase.functions.invoke("ia-atendimento", {
    body: {
      conversationId: context.conversationId,
      message: context.triggerData?.message || "",
      leadData,
      customPrompt: prompt,
    },
  });

  if (iaResponse?.response && mode === "auto") {
    // Enviar resposta automaticamente
    const { data: conversation } = await supabase
      .from("conversas")
      .select("numero")
      .eq("id", context.conversationId)
      .single();

    if (conversation?.numero) {
      await supabase.functions.invoke("enviar-whatsapp", {
        body: {
          numero: conversation.numero,
          mensagem: iaResponse.response,
          tipo_mensagem: "text",
        },
      });
    }
  }

  context.lastIAResponse = iaResponse?.response;
}
