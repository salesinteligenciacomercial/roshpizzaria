import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================
// IA DE ATENDIMENTO - PROMPT PERSONALIZADO
// ========================

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
    // PROCESSAR ARQUIVOS (IMAGENS, PDFs, etc)
    // ========================================
    let filesContent: any[] = [];
    let filesDescription = '';
    
    if (files && Array.isArray(files) && files.length > 0) {
      console.log('📎 Processando arquivos:', files.length);
      
      for (const fileData of files) {
        if (fileData.type === 'image') {
          // Imagens: enviar diretamente para o modelo multimodal
          filesContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${fileData.mimeType};base64,${fileData.base64}`
            }
          });
          filesDescription += `\n[Imagem anexada: ${fileData.name}]`;
        } else if (fileData.type === 'pdf') {
          // PDFs: adicionar descrição (modelo não lê PDFs nativamente)
          filesDescription += `\n[PDF anexado: ${fileData.name}] - Por favor, descreva o que você espera encontrar neste documento.`;
        } else if (fileData.type === 'audio') {
          // Áudios: adicionar descrição
          filesDescription += `\n[Áudio anexado: ${fileData.name}] - O áudio precisa ser transcrito para análise.`;
        } else if (fileData.type === 'video') {
          // Vídeos: adicionar descrição
          filesDescription += `\n[Vídeo anexado: ${fileData.name}] - O vídeo precisa ser processado para análise.`;
        }
      }
    }

    // ========================================
    // BUSCAR PROMPT PERSONALIZADO DA BASE DE DADOS
    // ========================================
    let promptPersonalizado = customPrompt || null;
    
    if (!promptPersonalizado && companyId) {
      const { data: iaConfig } = await supabase
        .from('ia_configurations')
        .select('custom_prompts')
        .eq('company_id', companyId)
        .single();
      
      // Buscar prompt específico para agente de atendimento
      if (iaConfig?.custom_prompts) {
        const customPrompts = iaConfig.custom_prompts as any;
        promptPersonalizado = customPrompts.atendimento || customPrompts.default || null;
      }
    }

    // ========================================
    // MONTAR CONTEXTO DINÂMICO (DADOS DO LEAD)
    // ========================================
    let contextoDinamico = '';
    
    if (leadData) {
      contextoDinamico += `
DADOS DO CLIENTE:
- Nome: ${leadData.name || 'Não informado'}
- Telefone: ${leadData.phone || leadData.telefone || 'Não informado'}
- Email: ${leadData.email || 'Não informado'}
- Empresa: ${leadData.company || 'Não informado'}
- CPF: ${leadData.cpf || 'Não informado'}
- Valor em negociação: ${leadData.value ? `R$ ${leadData.value}` : 'Não definido'}
- Status: ${leadData.status || 'novo'}
- Tags: ${leadData.tags?.join(', ') || 'Nenhuma'}
- Observações: ${leadData.notes || 'Nenhuma'}
`;

      // Buscar etapa/funil do lead
      if (leadData.etapa_id) {
        const { data: etapa } = await supabase
          .from('etapas')
          .select('nome, funil:funis(nome)')
          .eq('id', leadData.etapa_id)
          .single();
        
        if (etapa) {
          contextoDinamico += `
POSIÇÃO NO FUNIL:
- Funil: ${(etapa as any).funil?.nome || 'Não definido'}
- Etapa: ${etapa.nome}
`;
        }
      }
      
      // Buscar tarefas do lead
      if (leadData.id) {
        const { data: tarefas } = await supabase
          .from('tasks')
          .select('title, status, priority, due_date')
          .eq('lead_id', leadData.id)
          .in('status', ['pendente', 'em_andamento'])
          .limit(5);
        
        if (tarefas && tarefas.length > 0) {
          contextoDinamico += `
TAREFAS PENDENTES:
${tarefas.map((t: any) => `- ${t.title} (${t.priority}) - ${t.status}`).join('\n')}
`;
        }
      }
    }

    // Buscar histórico recente da conversa
    if (conversationId && companyId && leadData) {
      const { data: historico } = await supabase
        .from('conversas')
        .select('mensagem, fromme, created_at')
        .eq('telefone_formatado', leadData?.telefone || leadData?.phone)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (historico && historico.length > 1) {
        contextoDinamico += `
HISTÓRICO RECENTE DA CONVERSA:
${historico.slice(1).reverse().map((h: any) => 
  `${h.fromme ? 'Você' : 'Cliente'}: ${h.mensagem?.substring(0, 150)}`
).join('\n')}
`;
      }
    }

    // ========================================
    // CONSTRUIR PROMPT FINAL
    // ========================================
    let systemPrompt = '';
    
    // Se tem prompt personalizado, usar SOMENTE ele + contexto dinâmico
    if (promptPersonalizado && promptPersonalizado.trim()) {
      // Substituir variáveis no prompt personalizado
      let promptComVariaveis = promptPersonalizado
        .replace(/{lead\.name}/g, leadData?.name || 'Cliente')
        .replace(/{lead\.phone}/g, leadData?.phone || leadData?.telefone || '')
        .replace(/{lead\.email}/g, leadData?.email || '')
        .replace(/{lead\.company}/g, leadData?.company || '')
        .replace(/{company\.name}/g, 'Empresa');
      
      systemPrompt = `${promptComVariaveis}

${contextoDinamico}

AÇÕES DISPONÍVEIS (inclua UMA ação no final da resposta entre colchetes, se aplicável):
- [COLETAR_DADOS:campo=valor] - para coletar CPF, email, telefone, empresa
- [ADICIONAR_TAG:nome] - para adicionar tag ao lead
- [MOVER_FUNIL:etapa] - para mover lead no funil
- [CRIAR_TAREFA:titulo] - para criar tarefa de follow-up
- [AGENDAR] - quando cliente quiser marcar horário
- [TRANSFERIR_HUMANO] - para transferir para atendente humano`;
    } else {
      // Se NÃO tem prompt personalizado, usar prompt padrão básico
      systemPrompt = `Você é uma assistente de atendimento. Responda de forma cordial e profissional.

${contextoDinamico}

AÇÕES DISPONÍVEIS (inclua UMA ação no final da resposta entre colchetes, se aplicável):
- [COLETAR_DADOS:campo=valor] - para coletar CPF, email, telefone, empresa
- [ADICIONAR_TAG:nome] - para adicionar tag ao lead
- [MOVER_FUNIL:etapa] - para mover lead no funil
- [CRIAR_TAREFA:titulo] - para criar tarefa de follow-up
- [AGENDAR] - quando cliente quiser marcar horário
- [TRANSFERIR_HUMANO] - para transferir para atendente humano`;
    }

    console.log('🤖 IA Atendimento - Processando:', { 
      conversationId, 
      message: message?.substring(0, 50),
      hasLead: !!leadData,
      hasCustomPrompt: !!promptPersonalizado,
      hasFiles: filesContent.length > 0
    });

    // Construir conteúdo da mensagem (texto + arquivos multimodais)
    let userContent: any;
    
    if (filesContent.length > 0) {
      // Formato multimodal com imagens
      userContent = [
        { type: 'text', text: (message || 'Analise este arquivo.') + filesDescription },
        ...filesContent
      ];
    } else {
      // Apenas texto
      userContent = message + filesDescription;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione fundos à sua conta Lovable.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('❌ Erro da IA:', response.status, errorText);
      throw new Error(`Erro da IA: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Extrair ação e parâmetros da resposta
    const actionPattern = /\[(QUALIFICAR|COLETAR_DADOS|ADICIONAR_TAG|MOVER_FUNIL|CRIAR_TAREFA|AGENDAR|TRANSFERIR_HUMANO)(:([^\]]+))?\]/;
    const actionMatch = aiResponse.match(actionPattern);
    
    const action = actionMatch ? actionMatch[1] : null;
    const actionParams = actionMatch ? actionMatch[3] : null;
    
    // Remover ação da resposta
    const cleanResponse = aiResponse.replace(actionPattern, '').trim();

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
                .update({ 
                  [campo]: valor.trim(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', leadData.id);
              
              actionResult = { success: !error, campo, valor: valor.trim() };
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
              .update({ 
                tags: novasTags,
                updated_at: new Date().toISOString()
              })
              .eq('id', leadData.id);
            
            actionResult = { success: !error, tag: actionParams.trim() };
            console.log(`🏷️ Tag adicionada: ${actionParams}`);
          }
          break;
          
        case 'MOVER_FUNIL':
          if (actionParams && companyId) {
            // Buscar etapa por nome
            const { data: etapa } = await supabase
              .from('etapas')
              .select('id, funil_id')
              .ilike('nome', `%${actionParams.trim()}%`)
              .limit(1)
              .single();
            
            if (etapa) {
              const { error } = await supabase
                .from('leads')
                .update({ 
                  etapa_id: etapa.id,
                  funil_id: etapa.funil_id,
                  updated_at: new Date().toISOString()
                })
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
      }
    }

    // Log da interação para aprendizado
    try {
      await supabase.functions.invoke('ia-aprendizado', {
        body: {
          companyId,
          agentType: 'atendimento',
          inputMessage: message,
          aiResponse: cleanResponse,
          action,
          actionParams,
          actionResult,
          leadId: leadData?.id
        }
      });
    } catch (e) {
      console.warn('⚠️ Erro ao registrar aprendizado:', e);
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ IA Atendimento - Concluído em ${executionTime}ms`);

    return new Response(
      JSON.stringify({ 
        response: cleanResponse,
        action,
        actionParams,
        actionResult,
        executionTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na IA Atendimento:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        response: 'Desculpe, estou com dificuldades técnicas. Um atendente humano irá te ajudar em breve.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
