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

    const { flowId, leadId, conversationId, triggerType, triggerData, conversationNumber, companyId: inputCompanyId, currentNodeId, userResponse } = await req.json();

    console.log("🚀 Executando fluxo:", { flowId, leadId, conversationId, triggerType, currentNodeId });

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

    const companyId = inputCompanyId || flow.company_id;
    const nodes: any[] = flow.nodes || [];
    const edges: any[] = flow.edges || [];

    // Criar log de execução
    const { data: logData } = await supabase
      .from("automation_flow_logs")
      .insert({
        flow_id: flowId,
        lead_id: leadId,
        conversation_id: conversationId,
        company_id: companyId,
        status: "running",
        execution_data: { triggerType, triggerData, currentNodeId },
      })
      .select()
      .single();

    const logId = logData?.id;

    const executionContext: any = {
      leadId,
      conversationId,
      companyId,
      conversationNumber,
      triggerData,
      userResponse,
    };

    try {
      // Determinar node inicial
      let startNodeId = currentNodeId;
      
      if (!startNodeId) {
        // Encontrar trigger node que corresponde ao triggerType
        const triggerNode = nodes.find((n: any) => 
          n.type === 'trigger' && n.data?.triggerType === triggerType
        );
        if (!triggerNode) {
          throw new Error(`Gatilho '${triggerType}' não encontrado no fluxo`);
        }
        startNodeId = triggerNode.id;
      }

      // Executar seguindo o grafo a partir do node inicial
      await executeFromNode(startNodeId, nodes, edges, executionContext, supabase, flowId);

      // Se o fluxo parou para aguardar input, não marcar como completo
      if (executionContext.waitingForInput) {
        if (logId) {
          await supabase
            .from("automation_flow_logs")
            .update({ status: "waiting", execution_data: { ...executionContext } })
            .eq("id", logId);
        }
        return new Response(
          JSON.stringify({ success: true, message: "Aguardando resposta do usuário", waitingForInput: true, currentNodeId: executionContext.currentNodeId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Marcar como completo
      if (logId) {
        await supabase
          .from("automation_flow_logs")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Fluxo executado com sucesso", executionContext }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (executionError: any) {
      console.error("❌ Erro na execução:", executionError);
      if (logId) {
        await supabase
          .from("automation_flow_logs")
          .update({ status: "failed", error_message: executionError.message, completed_at: new Date().toISOString() })
          .eq("id", logId);
      }
      throw executionError;
    }
  } catch (error: any) {
    console.error("❌ Erro ao executar fluxo:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============= GRAPH TRAVERSAL =============

async function executeFromNode(nodeId: string, nodes: any[], edges: any[], context: any, supabase: any, flowId: string) {
  const node = nodes.find((n: any) => n.id === nodeId);
  if (!node) {
    console.log("⚠️ Node não encontrado:", nodeId);
    return;
  }

  console.log(`▶️ Executando node: ${node.id} (${node.type})`);

  switch (node.type) {
    case 'trigger':
      // Triggers são apenas pontos de entrada, seguir para próximo
      break;

    case 'action':
      await executeAction(node, context, supabase);
      break;

    case 'condition': {
      const result = await evaluateCondition(node, context, supabase);
      // Condition tem saídas true/false - buscar edge com sourceHandle
      const nextEdge = edges.find((e: any) => 
        e.source === node.id && (result ? e.sourceHandle !== 'false' : e.sourceHandle === 'false')
      ) || edges.find((e: any) => e.source === node.id);
      
      if (nextEdge) {
        await executeFromNode(nextEdge.target, nodes, edges, context, supabase, flowId);
      }
      return; // Não seguir edges normais
    }

    case 'ia':
      await executeIA(node, context, supabase);
      break;

    case 'interactive_menu':
      await executeInteractiveMenu(node, context, supabase, flowId);
      if (context.waitingForInput) return; // Parar e aguardar resposta
      break;

    case 'route_department':
      await executeRouteDepartment(node, context, supabase);
      break;

    case 'delay':
      // Para delays, apenas logar (implementação real usaria job queue)
      console.log("⏳ Delay node:", node.data.delayValue, node.data.delayUnit);
      break;

    case 'aiagent':
      await executeAIAgent(node, context, supabase);
      break;
  }

  // Seguir todas as edges de saída deste node (exceto conditions que já foram tratadas)
  if (node.type !== 'condition' && !context.waitingForInput) {
    const outgoingEdges = edges.filter((e: any) => e.source === node.id);
    for (const edge of outgoingEdges) {
      await executeFromNode(edge.target, nodes, edges, context, supabase, flowId);
    }
  }
}

// ============= NODE EXECUTORS =============

async function executeAction(node: any, context: any, supabase: any) {
  const { actionType, message, label } = node.data;
  console.log("⚡ Ação:", actionType, label);

  switch (actionType) {
    case 'enviar_mensagem':
      if (message && context.conversationNumber) {
        await sendWhatsAppMessage(supabase, context.conversationNumber, message, context.companyId);
      }
      break;

    case 'mover_funil':
      if (context.leadId && node.data.etapaId) {
        await supabase.from("leads").update({ etapa_id: node.data.etapaId }).eq("id", context.leadId);
      }
      break;

    case 'criar_tarefa':
      if (context.leadId) {
        await supabase.from("tasks").insert({
          title: label || "Nova tarefa",
          lead_id: context.leadId,
          company_id: context.companyId,
          owner_id: context.companyId,
          status: "pendente",
          priority: "media",
        });
      }
      break;

    case 'adicionar_nota':
      if (context.leadId && node.data.note) {
        await supabase.from("leads").update({ notes: node.data.note }).eq("id", context.leadId);
      }
      break;

    case 'adicionar_tag':
      if (context.leadId && node.data.tagName) {
        const { data: lead } = await supabase.from("leads").select("tags").eq("id", context.leadId).single();
        const currentTags = lead?.tags || [];
        if (!currentTags.includes(node.data.tagName)) {
          await supabase.from("leads").update({ tags: [...currentTags, node.data.tagName] }).eq("id", context.leadId);
        }
      }
      break;

    case 'atribuir_responsavel':
      if (context.conversationNumber && node.data.assignedUserId) {
        await supabase.from("conversation_assignments").upsert({
          telefone_formatado: context.conversationNumber,
          company_id: context.companyId,
          assigned_user_id: node.data.assignedUserId,
        }, { onConflict: 'telefone_formatado,company_id' });
      }
      break;
  }
}

async function evaluateCondition(node: any, context: any, supabase: any): Promise<boolean> {
  const { conditionType, checkValue } = node.data;
  console.log("🔍 Condição:", conditionType, checkValue);

  switch (conditionType) {
    case 'tag':
      if (context.leadId && checkValue) {
        const { data: lead } = await supabase.from("leads").select("tags").eq("id", context.leadId).single();
        return lead?.tags?.includes(checkValue) || false;
      }
      return false;

    case 'horario': {
      const now = new Date();
      const hour = now.getHours();
      if (checkValue?.includes("-")) {
        const [start, end] = checkValue.split("-").map((h: string) => parseInt(h.split(":")[0]));
        return hour >= start && hour < end;
      }
      return false;
    }

    case 'palavra_chave':
      if (context.triggerData?.message && checkValue) {
        return context.triggerData.message.toLowerCase().includes(checkValue.toLowerCase());
      }
      if (context.userResponse && checkValue) {
        return context.userResponse.toLowerCase().includes(checkValue.toLowerCase());
      }
      return false;

    default:
      return true;
  }
}

async function executeIA(node: any, context: any, supabase: any) {
  const { prompt, mode, label } = node.data;
  console.log("🤖 IA:", label, mode);

  if (!context.conversationId) return;

  let leadData = null;
  if (context.leadId) {
    const { data } = await supabase.from("leads").select("*").eq("id", context.leadId).single();
    leadData = data;
  }

  const { data: iaResponse } = await supabase.functions.invoke("ia-atendimento", {
    body: {
      conversationId: context.conversationId,
      message: context.userResponse || context.triggerData?.message || "",
      leadData,
      customPrompt: prompt,
    },
  });

  if (iaResponse?.response && mode === "auto" && context.conversationNumber) {
    await sendWhatsAppMessage(supabase, context.conversationNumber, iaResponse.response, context.companyId);
  }

  context.lastIAResponse = iaResponse?.response;
}

async function executeAIAgent(node: any, context: any, supabase: any) {
  const { agentType, prompt, mode } = node.data;
  console.log("🧠 AI Agent:", agentType);

  if (!context.conversationId) return;

  const agentFunctionMap: Record<string, string> = {
    atendimento: "ia-atendimento",
    agendamento: "ia-agendamento",
    vendas: "ia-vendedora",
    suporte: "ia-suporte",
  };

  const functionName = agentFunctionMap[agentType] || "ia-atendimento";

  let leadData = null;
  if (context.leadId) {
    const { data } = await supabase.from("leads").select("*").eq("id", context.leadId).single();
    leadData = data;
  }

  const { data: iaResponse } = await supabase.functions.invoke(functionName, {
    body: {
      conversationId: context.conversationId,
      message: context.userResponse || context.triggerData?.message || "",
      leadData,
      customPrompt: prompt,
      companyId: context.companyId,
    },
  });

  if (iaResponse?.response && mode !== "assisted" && context.conversationNumber) {
    await sendWhatsAppMessage(supabase, context.conversationNumber, iaResponse.response, context.companyId);
  }

  context.lastIAResponse = iaResponse?.response;
}

async function executeInteractiveMenu(node: any, context: any, supabase: any, flowId: string) {
  const { welcomeMessage, buttons, menuStyle, aiUnderstandsFreeText } = node.data;
  
  if (!context.conversationNumber) return;

  // Se temos uma resposta do usuário, processar
  if (context.userResponse) {
    console.log("📨 Resposta do usuário ao menu:", context.userResponse);
    
    // Tentar match direto com botões
    const matchedButton = (buttons || []).find((btn: any, i: number) => {
      const response = context.userResponse.trim().toLowerCase();
      return response === btn.label?.toLowerCase() || 
             response === String(i + 1) ||
             response === btn.id;
    });

    if (matchedButton) {
      console.log("✅ Botão selecionado:", matchedButton.label);
      context.selectedButton = matchedButton;
      return; // Continuar com edges normais
    }

    // Se IA entende texto livre, usar IA para identificar intenção
    if (aiUnderstandsFreeText !== false) {
      console.log("🤖 Usando IA para entender resposta livre...");
      // Tentar transcrever se for áudio
      if (context.triggerData?.tipo_mensagem === 'audio' && context.triggerData?.midia_url) {
        try {
          const { data: transcription } = await supabase.functions.invoke("transcrever-audio", {
            body: { audioUrl: context.triggerData.midia_url },
          });
          if (transcription?.transcription) {
            context.userResponse = transcription.transcription;
            console.log("🎤 Áudio transcrito:", context.userResponse);
          }
        } catch (e) {
          console.error("❌ Erro ao transcrever:", e);
        }
      }

      // Usar IA para matching fuzzy com botões
      const buttonLabels = (buttons || []).map((b: any) => b.label).join(", ");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (LOVABLE_API_KEY) {
        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: `Você é um roteador de intenções. As opções disponíveis são: ${buttonLabels}. Responda APENAS com o nome exato da opção mais relevante ou "NENHUMA" se nenhuma opção se encaixa.` },
                { role: "user", content: context.userResponse }
              ],
            }),
          });
          
          if (aiResponse.ok) {
            const aiResult = await aiResponse.json();
            const aiChoice = aiResult.choices?.[0]?.message?.content?.trim();
            
            if (aiChoice && aiChoice !== "NENHUMA") {
              const aiMatchedButton = (buttons || []).find((btn: any) => 
                btn.label?.toLowerCase() === aiChoice.toLowerCase()
              );
              if (aiMatchedButton) {
                console.log("🤖 IA identificou intenção:", aiMatchedButton.label);
                context.selectedButton = aiMatchedButton;
                return;
              }
            }
          }
        } catch (e) {
          console.error("❌ Erro IA matching:", e);
        }
      }
    }

    // Nenhum match - reenviar menu
    console.log("⚠️ Resposta não reconhecida, reenviando menu");
  }

  // Enviar menu interativo
  const messageText = welcomeMessage || "Como posso ajudar? Escolha uma opção:";
  
  if (menuStyle === 'buttons' && (buttons || []).length <= 3) {
    // Enviar como botões interativos do WhatsApp
    await sendInteractiveButtons(supabase, context.conversationNumber, messageText, buttons || [], context.companyId);
  } else if (menuStyle === 'list') {
    // Enviar como lista interativa
    await sendInteractiveList(supabase, context.conversationNumber, messageText, buttons || [], context.companyId);
  } else {
    // Fallback: enviar como texto numerado
    let textMenu = messageText + "\n\n";
    (buttons || []).forEach((btn: any, i: number) => {
      textMenu += `${i + 1}️⃣ ${btn.label}\n`;
    });
    await sendWhatsAppMessage(supabase, context.conversationNumber, textMenu, context.companyId);
  }

  // Salvar estado e aguardar resposta
  context.waitingForInput = true;
  context.currentNodeId = node.id;

  await supabase.from("conversation_flow_state").upsert({
    conversation_number: context.conversationNumber,
    company_id: context.companyId,
    flow_id: flowId,
    current_node_id: node.id,
    context_data: { leadId: context.leadId, conversationId: context.conversationId },
    waiting_for_input: true,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }, { onConflict: 'conversation_number,company_id' });
}

async function executeRouteDepartment(node: any, context: any, supabase: any) {
  const { department, assignedUserId, transferMessage, notifyAssigned } = node.data;
  console.log("🏢 Roteamento:", department, assignedUserId);

  // Enviar mensagem de transferência
  if (transferMessage && context.conversationNumber) {
    await sendWhatsAppMessage(supabase, context.conversationNumber, transferMessage, context.companyId);
  }

  // Atribuir conversa ao usuário
  if (assignedUserId && context.conversationNumber) {
    await supabase.from("conversation_assignments").upsert({
      telefone_formatado: context.conversationNumber,
      company_id: context.companyId,
      assigned_user_id: assignedUserId,
    }, { onConflict: 'telefone_formatado,company_id' });

    // Atualizar conversas recentes com assigned_user_id
    await supabase.from("conversas")
      .update({ assigned_user_id: assignedUserId })
      .eq("telefone_formatado", context.conversationNumber)
      .eq("company_id", context.companyId);
  }

  // Limpar estado do fluxo (conversa foi roteada)
  if (context.conversationNumber) {
    await supabase.from("conversation_flow_state")
      .delete()
      .eq("conversation_number", context.conversationNumber)
      .eq("company_id", context.companyId);
  }
}

// ============= WHATSAPP HELPERS =============

async function sendWhatsAppMessage(supabase: any, numero: string, mensagem: string, companyId: string) {
  try {
    await supabase.functions.invoke("enviar-whatsapp", {
      body: { numero, mensagem, tipo_mensagem: "text", company_id: companyId },
    });
  } catch (e) {
    console.error("❌ Erro ao enviar WhatsApp:", e);
  }
}

async function sendInteractiveButtons(supabase: any, numero: string, bodyText: string, buttons: any[], companyId: string) {
  // Para Evolution API, enviar botões interativos
  try {
    await supabase.functions.invoke("enviar-whatsapp", {
      body: {
        numero,
        mensagem: bodyText,
        tipo_mensagem: "interactive_buttons",
        company_id: companyId,
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: buttons.slice(0, 3).map((btn: any, i: number) => ({
              type: "reply",
              reply: { id: btn.id || `btn_${i}`, title: (btn.label || `Opção ${i + 1}`).substring(0, 20) }
            }))
          }
        }
      },
    });
  } catch (e) {
    console.error("❌ Erro ao enviar botões:", e);
    // Fallback: enviar como texto
    let textMenu = bodyText + "\n\n";
    buttons.forEach((btn: any, i: number) => { textMenu += `${i + 1}️⃣ ${btn.label}\n`; });
    await sendWhatsAppMessage(supabase, numero, textMenu, companyId);
  }
}

async function sendInteractiveList(supabase: any, numero: string, bodyText: string, buttons: any[], companyId: string) {
  try {
    await supabase.functions.invoke("enviar-whatsapp", {
      body: {
        numero,
        mensagem: bodyText,
        tipo_mensagem: "interactive_list",
        company_id: companyId,
        interactive: {
          type: "list",
          body: { text: bodyText },
          action: {
            button: "Ver opções",
            sections: [{
              title: "Opções",
              rows: buttons.slice(0, 10).map((btn: any, i: number) => ({
                id: btn.id || `item_${i}`,
                title: (btn.label || `Opção ${i + 1}`).substring(0, 24),
              }))
            }]
          }
        }
      },
    });
  } catch (e) {
    console.error("❌ Erro ao enviar lista:", e);
    let textMenu = bodyText + "\n\n";
    buttons.forEach((btn: any, i: number) => { textMenu += `${i + 1}️⃣ ${btn.label}\n`; });
    await sendWhatsAppMessage(supabase, numero, textMenu, companyId);
  }
}
