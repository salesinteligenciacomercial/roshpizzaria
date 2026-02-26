import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================
// IA DE ATENDIMENTO - VERSÃO HUMANIZADA
// Respostas naturais, conversacionais e semelhantes a um humano real
// ========================

// Função para obter saudação baseada no horário
function getSaudacao(): string {
  const now = new Date();
  // Ajustar para fuso horário do Brasil (UTC-3)
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  if (brHour >= 5 && brHour < 12) return 'Bom dia';
  if (brHour >= 12 && brHour < 18) return 'Boa tarde';
  return 'Boa noite';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { conversationId, message, leadData, companyId, customPrompt, files } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // ========================================
    // BUSCAR CONFIGURAÇÕES DA IA
    // ========================================
    let iaConfig: any = null;
    let promptPersonalizado: string | null = typeof customPrompt === 'string' ? customPrompt : null;
    let knowledgeBase: any = null;
    let blockedTags: string[] = [];
    let blockedFunnels: string[] = [];
    let blockedStages: string[] = [];
    
    if (companyId) {
      const { data: config } = await supabase
        .from('ia_configurations')
        .select('*')
        .eq('company_id', companyId)
        .single();
      
      iaConfig = config;
      
      if (config?.custom_prompts) {
        const customPrompts = config.custom_prompts as any;
        const prompt = customPrompts.atendimento?.custom_prompt || customPrompts.atendimento?.prompt || customPrompts.default || null;
        promptPersonalizado = typeof prompt === 'string' ? prompt : null;
        
        knowledgeBase = customPrompts.atendimento?.knowledge_base || null;
      }
      
      blockedTags = config?.blocked_tags || [];
      blockedFunnels = config?.blocked_funnels || [];
      blockedStages = config?.blocked_stages || [];
    }

    // ========================================
    // VERIFICAR BLOQUEIOS
    // ========================================
    if (leadData) {
      if (blockedTags.length > 0 && leadData.tags) {
        const hasBlockedTag = leadData.tags.some((tag: string) => blockedTags.includes(tag));
        if (hasBlockedTag) {
          console.log('⛔ Lead bloqueado por tag');
          return new Response(
            JSON.stringify({ blocked: true, reason: 'Tag bloqueada', response: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      if (blockedFunnels.length > 0 && leadData.funil_id && blockedFunnels.includes(leadData.funil_id)) {
        console.log('⛔ Lead bloqueado por funil');
        return new Response(
          JSON.stringify({ blocked: true, reason: 'Funil bloqueado', response: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (blockedStages.length > 0 && leadData.etapa_id && blockedStages.includes(leadData.etapa_id)) {
        console.log('⛔ Lead bloqueado por etapa');
        return new Response(
          JSON.stringify({ blocked: true, reason: 'Etapa bloqueada', response: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========================================
    // PROCESSAR ARQUIVOS
    // ========================================
    let filesContent: any[] = [];
    let filesDescription = '';
    
    if (files && Array.isArray(files) && files.length > 0) {
      console.log('📎 Processando arquivos:', files.length);
      
      for (const fileData of files) {
        if (fileData.type === 'image') {
          filesContent.push({
            type: 'image_url',
            image_url: { url: `data:${fileData.mimeType};base64,${fileData.base64}` }
          });
          filesDescription += `\n[O cliente enviou uma imagem: ${fileData.name}]`;
        } else if (fileData.type === 'pdf') {
          filesDescription += `\n[O cliente enviou um PDF: ${fileData.name}]`;
        } else if (fileData.type === 'audio') {
          filesDescription += `\n[O cliente enviou um áudio: ${fileData.name}]`;
          try {
            const { data: transcricao } = await supabase.functions.invoke('transcrever-audio', {
              body: { audioBase64: fileData.base64, mimeType: fileData.mimeType }
            });
            if (transcricao?.text) {
              filesDescription = filesDescription.replace(
                `[O cliente enviou um áudio: ${fileData.name}]`,
                `[Áudio transcrito do cliente: "${transcricao.text}"]`
              );
            }
          } catch (e) {
            console.warn('⚠️ Erro na transcrição:', e);
          }
        } else if (fileData.type === 'video') {
          filesDescription += `\n[O cliente enviou um vídeo: ${fileData.name}]`;
        }
      }
    }

    // ========================================
    // MONTAR CONTEXTO DINÂMICO
    // ========================================
    let contextoDinamico = '';
    const saudacao = getSaudacao();
    
    if (leadData) {
      contextoDinamico += `
DADOS DO CLIENTE (use naturalmente, NÃO repita todos de uma vez):
- Nome: ${leadData.name || 'Não informado'}
- Telefone: ${leadData.phone || leadData.telefone || 'Não informado'}
- Email: ${leadData.email || 'Não informado'}
- Empresa: ${leadData.company || 'Não informado'}
- CPF: ${leadData.cpf || 'Não informado'}
- Valor: ${leadData.value ? `R$ ${leadData.value}` : 'Não definido'}
- Status: ${leadData.status || 'novo'}
- Tags: ${leadData.tags?.join(', ') || 'Nenhuma'}
- Observações: ${leadData.notes || 'Nenhuma'}
`;

      if (leadData.etapa_id) {
        const { data: etapa } = await supabase
          .from('etapas')
          .select('nome, funil:funis(nome)')
          .eq('id', leadData.etapa_id)
          .single();
        
        if (etapa) {
          contextoDinamico += `- Funil: ${(etapa as any).funil?.nome || '?'} → Etapa: ${etapa.nome}\n`;
        }
      }
      
      if (leadData.id) {
        const { data: tarefas } = await supabase
          .from('tasks')
          .select('title, status, priority, due_date')
          .eq('lead_id', leadData.id)
          .in('status', ['pendente', 'em_andamento'])
          .limit(5);
        
        if (tarefas && tarefas.length > 0) {
          contextoDinamico += `\nTAREFAS PENDENTES:\n${tarefas.map((t: any) => `- ${t.title} (${t.priority})`).join('\n')}\n`;
        }
        
        const { data: compromissos } = await supabase
          .from('compromissos')
          .select('data_hora_inicio, tipo_servico, status')
          .eq('lead_id', leadData.id)
          .gte('data_hora_inicio', new Date().toISOString())
          .neq('status', 'cancelado')
          .limit(3);
        
        if (compromissos && compromissos.length > 0) {
          contextoDinamico += `\nCOMPROMISSOS AGENDADOS:\n${compromissos.map((c: any) => 
            `- ${new Date(c.data_hora_inicio).toLocaleDateString('pt-BR')} às ${new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${c.tipo_servico}`
          ).join('\n')}\n`;
        }
      }
    }

    // Base de conhecimento
    if (knowledgeBase) {
      if (knowledgeBase.empresa) {
        contextoDinamico += `\nSUA EMPRESA:\n- Nome: ${knowledgeBase.empresa.nome || '?'}\n- Segmento: ${knowledgeBase.empresa.segmento || '?'}\n- Horário: ${knowledgeBase.empresa.horario || '?'}\n- Endereço: ${knowledgeBase.empresa.endereco || '?'}\n- Contato: ${knowledgeBase.empresa.contato || '?'}\n`;
      }
      if (knowledgeBase.produtos && knowledgeBase.produtos.length > 0) {
        contextoDinamico += `\nPRODUTOS/SERVIÇOS:\n${knowledgeBase.produtos.map((p: any) => `- ${p.nome}: ${p.descricao} ${p.preco ? `(${p.preco})` : ''}`).join('\n')}\n`;
      }
      if (knowledgeBase.faqs && knowledgeBase.faqs.length > 0) {
        contextoDinamico += `\nPERGUNTAS FREQUENTES:\n${knowledgeBase.faqs.map((f: any) => `P: ${f.pergunta}\nR: ${f.resposta}`).join('\n\n')}\n`;
      }
      if (knowledgeBase.informacoes_extras) {
        contextoDinamico += `\nINFO EXTRA:\n${knowledgeBase.informacoes_extras}\n`;
      }
    }

    // ========================================
    // BUSCAR HISTÓRICO COMO ARRAY DE MENSAGENS
    // ========================================
    const historyCount = iaConfig?.history_messages_count || 15;
    const conversationMessages: { role: string; content: string }[] = [];
    
    if (companyId && leadData && iaConfig?.read_conversation_history !== false) {
      const telefoneParaHistorico = leadData?.telefone || leadData?.phone;
      if (telefoneParaHistorico) {
        const telefoneLimpo = telefoneParaHistorico.replace(/[^0-9]/g, '');
        const { data: historico } = await supabase
          .from('conversas')
          .select('mensagem, fromme, created_at')
          .eq('telefone_formatado', telefoneLimpo)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(historyCount);
        
        if (historico && historico.length > 1) {
          // Reverter para ordem cronológica, excluir a mensagem atual (primeira)
          const mensagensAnteriores = historico.slice(1).reverse();
          for (const msg of mensagensAnteriores) {
            if (msg.mensagem && msg.mensagem.trim()) {
              conversationMessages.push({
                role: msg.fromme ? 'assistant' : 'user',
                content: msg.mensagem.substring(0, 500)
              });
            }
          }
        }
      }
    }

    // Detectar se é primeira mensagem
    const isPrimeiraMensagem = conversationMessages.length === 0;

    // ========================================
    // CONSTRUIR PROMPT HUMANIZADO
    // ========================================
    const nomeEmpresa = knowledgeBase?.empresa?.nome || 'nossa empresa';
    const nomeCliente = leadData?.name?.split(' ')[0] || ''; // Primeiro nome apenas
    
    let systemPrompt = '';
    
    if (promptPersonalizado && promptPersonalizado.trim()) {
      // Substituir variáveis
      let promptComVariaveis = promptPersonalizado
        .replace(/{lead\.name}/g, leadData?.name || 'Cliente')
        .replace(/{lead\.phone}/g, leadData?.phone || leadData?.telefone || '')
        .replace(/{lead\.email}/g, leadData?.email || '')
        .replace(/{lead\.company}/g, leadData?.company || '')
        .replace(/{company\.name}/g, nomeEmpresa)
        .replace(/{saudacao}/g, saudacao);
      
      systemPrompt = `${promptComVariaveis}

${contextoDinamico}

REGRAS DE HUMANIZAÇÃO (OBRIGATÓRIO):
- NUNCA diga que é uma IA, assistente virtual, robô ou bot
- Responda como se fosse um atendente humano real da equipe
- Máximo 2-3 frases curtas por mensagem (como WhatsApp real)
- Use linguagem natural e informal quando apropriado
- Evite listas e formatação elaborada — escreva como uma pessoa normal digitaria
- Não repita o nome do cliente a cada mensagem
- ${saudacao} — use essa saudação se for a primeira interação
- Se não souber algo, diga "vou verificar com a equipe" em vez de "não tenho essa informação"
- Use emojis com muita moderação (máximo 1 por mensagem, e nem sempre)
- Não faça perguntas demais de uma vez — no máximo 1 pergunta por mensagem

AÇÕES INTERNAS (inclua UMA no final, entre colchetes, NUNCA mostre ao cliente):
[COLETAR_DADOS:campo=valor] | [ADICIONAR_TAG:nome] | [MOVER_FUNIL:etapa] | [CRIAR_TAREFA:titulo] | [AGENDAR] | [TRANSFERIR_HUMANO] | [QUALIFICAR]`;
    } else {
      systemPrompt = `Você é ${nomeCliente ? `o atendente que está conversando com ${nomeCliente}` : 'um atendente'} da equipe de ${nomeEmpresa}.

CONTEXTO:
- Horário atual: ${saudacao}
- ${isPrimeiraMensagem ? 'Esta é a PRIMEIRA mensagem do cliente — cumprimente naturalmente.' : 'Conversa já em andamento — NÃO cumprimente novamente.'}

${contextoDinamico}

COMO VOCÊ DEVE SE COMPORTAR:
1. Você é um HUMANO da equipe, NÃO uma IA. Jamais revele que é artificial.
2. Escreva como uma pessoa real no WhatsApp: frases curtas, diretas, naturais.
3. Máximo 2-3 frases por mensagem. Nada de parágrafos longos.
4. Use linguagem amigável e profissional ao mesmo tempo.
5. Não repita o nome do cliente em toda mensagem.
6. Se não souber algo: "Deixa eu verificar aqui com a equipe e já te retorno, tá?"
7. Emojis: no máximo 1 por mensagem, e nem sempre. Nada de 😊🎉✨ em tudo.
8. Faça no máximo 1 pergunta por mensagem.
9. Não faça listas formatadas. Escreva como texto corrido.
10. Se o cliente pedir para agendar, use [AGENDAR].
11. Se sentir que precisa de um humano de verdade, use [TRANSFERIR_HUMANO].

AÇÕES INTERNAS (coloque UMA no final da resposta se necessário, entre colchetes — o cliente NUNCA verá):
[COLETAR_DADOS:campo=valor] | [ADICIONAR_TAG:nome] | [MOVER_FUNIL:etapa] | [CRIAR_TAREFA:titulo] | [AGENDAR] | [TRANSFERIR_HUMANO] | [QUALIFICAR]`;
    }

    console.log('🤖 IA Atendimento - Processando:', { 
      conversationId, 
      message: message?.substring(0, 50),
      hasLead: !!leadData,
      hasCustomPrompt: !!promptPersonalizado,
      hasFiles: filesContent.length > 0,
      isPrimeiraMensagem,
      historicMessages: conversationMessages.length
    });

    // ========================================
    // CONSTRUIR MESSAGES ARRAY (histórico real)
    // ========================================
    const messagesArray: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Adicionar histórico como mensagens separadas
    for (const msg of conversationMessages) {
      messagesArray.push(msg);
    }

    // Adicionar mensagem atual
    let userContent: any;
    if (filesContent.length > 0) {
      userContent = [
        { type: 'text', text: (message || 'Analise este arquivo.') + filesDescription },
        ...filesContent
      ];
    } else {
      userContent = message + filesDescription;
    }
    messagesArray.push({ role: 'user', content: userContent });

    // ========================================
    // CHAMAR IA
    // ========================================
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messagesArray,
        max_tokens: 300, // Respostas curtas como WhatsApp real
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições. Tente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('❌ Erro da IA:', response.status, errorText);
      throw new Error(`Erro da IA: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // ========================================
    // EXTRAIR E LIMPAR AÇÕES (regex robusto)
    // ========================================
    // Capturar todas as variações de ações, inclusive com espaços
    const actionPatterns = [
      /\[\s*(QUALIFICAR|COLETAR_DADOS|ADICIONAR_TAG|MOVER_FUNIL|CRIAR_TAREFA|AGENDAR|TRANSFERIR_HUMANO)\s*(?::\s*([^\]]*))?\s*\]/gi,
    ];
    
    let action: string | null = null;
    let actionParams: string | null = null;
    let cleanResponse = aiResponse;
    
    for (const pattern of actionPatterns) {
      const match = pattern.exec(aiResponse);
      if (match) {
        action = match[1].toUpperCase();
        actionParams = match[2]?.trim() || null;
        break;
      }
    }
    
    // Remover TODAS as ações da resposta (inclusive múltiplas)
    cleanResponse = cleanResponse
      .replace(/\[\s*(QUALIFICAR|COLETAR_DADOS|ADICIONAR_TAG|MOVER_FUNIL|CRIAR_TAREFA|AGENDAR|TRANSFERIR_HUMANO)\s*(?::\s*[^\]]*)?\s*\]/gi, '')
      .replace(/\n{3,}/g, '\n\n') // Remover linhas vazias extras
      .trim();

    // Executar ações automaticamente
    let actionResult = null;
    
    if (action && leadData?.id) {
      switch (action) {
        case 'COLETAR_DADOS':
          if (actionParams) {
            const [campo, valor] = actionParams.split('=');
            if (campo && valor) {
              const { error } = await supabase
                .from('leads')
                .update({ [campo.trim()]: valor.trim(), updated_at: new Date().toISOString() })
                .eq('id', leadData.id);
              actionResult = { success: !error, campo: campo.trim(), valor: valor.trim() };
              console.log(`📝 Dados coletados: ${campo}=${valor}`);
            }
          }
          break;
          
        case 'ADICIONAR_TAG':
          if (actionParams) {
            const tagsAtuais = leadData.tags || [];
            const novasTags = [...new Set([...tagsAtuais, actionParams.trim()])];
            const { error } = await supabase
              .from('leads')
              .update({ tags: novasTags, updated_at: new Date().toISOString() })
              .eq('id', leadData.id);
            actionResult = { success: !error, tag: actionParams.trim() };
            console.log(`🏷️ Tag adicionada: ${actionParams}`);
          }
          break;
          
        case 'MOVER_FUNIL':
          if (actionParams && companyId) {
            const { data: etapa } = await supabase
              .from('etapas')
              .select('id, funil_id')
              .ilike('nome', `%${actionParams.trim()}%`)
              .limit(1)
              .single();
            
            if (etapa) {
              const { error } = await supabase
                .from('leads')
                .update({ etapa_id: etapa.id, funil_id: etapa.funil_id, updated_at: new Date().toISOString() })
                .eq('id', leadData.id);
              actionResult = { success: !error, etapa: actionParams.trim() };
              console.log(`📊 Lead movido para: ${actionParams}`);
            }
          }
          break;
          
        case 'CRIAR_TAREFA':
          if (actionParams && companyId) {
            const { data: user } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('company_id', companyId)
              .limit(1)
              .single();
            
            if (user) {
              const { error } = await supabase
                .from('tasks')
                .insert({
                  title: actionParams.trim(),
                  lead_id: leadData.id,
                  company_id: companyId,
                  owner_id: user.user_id,
                  status: 'pendente',
                  priority: 'media'
                });
              actionResult = { success: !error, titulo: actionParams.trim() };
              console.log(`✅ Tarefa criada: ${actionParams}`);
            }
          }
          break;
          
        case 'QUALIFICAR':
          const { error: qualError } = await supabase
            .from('leads')
            .update({ status: 'qualificado', updated_at: new Date().toISOString() })
            .eq('id', leadData.id);
          actionResult = { success: !qualError };
          console.log('✨ Lead qualificado');
          break;
          
        case 'AGENDAR':
          actionResult = { success: true, nextAgent: 'agendamento', message: 'Transferindo para agendamento...' };
          console.log('📅 Iniciando fluxo de agendamento');
          break;
      }
    }

    // Registrar aprendizado
    try {
      await supabase
        .from('ia_training_data')
        .insert({
          company_id: companyId,
          agent_type: 'atendimento',
          conversation_id: conversationId,
          lead_id: leadData?.id,
          input_message: message,
          ai_response: cleanResponse,
          context_data: {
            hasFiles: files?.length > 0,
            action,
            actionParams,
            hasKnowledgeBase: !!knowledgeBase,
            isPrimeiraMensagem,
            historicoCount: conversationMessages.length
          }
        });
    } catch (e) {
      console.warn('⚠️ Erro ao registrar aprendizado:', e);
    }

    const executionTime = Date.now() - startTime;
    
    // Calcular delay simulado para parecer humano (baseado no tamanho da resposta)
    // Simula ~40-80 palavras por minuto de digitação
    const palavras = cleanResponse.split(/\s+/).length;
    const delayMs = Math.min(Math.max(palavras * 150, 1500), 6000); // Min 1.5s, Max 6s
    
    console.log(`✅ IA Atendimento - Concluído em ${executionTime}ms (delay sugerido: ${delayMs}ms)`);

    return new Response(
      JSON.stringify({ 
        response: cleanResponse,
        action,
        actionParams,
        actionResult,
        executionTime,
        suggestedDelay: delayMs, // Delay para o webhook usar
        nextAgent: action === 'AGENDAR' ? 'agendamento' : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na IA Atendimento:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        response: 'Desculpe, tive um probleminha aqui. Já vou te retornar!'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
