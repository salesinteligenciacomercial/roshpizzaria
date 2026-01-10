import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================
// IA DE ATENDIMENTO - VERSÃO MELHORADA
// Com processamento de mídias, integração com agendamento e base de conhecimento
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
        const prompt = customPrompts.atendimento?.prompt || customPrompts.atendimento || customPrompts.default || null;
        promptPersonalizado = typeof prompt === 'string' ? prompt : null;
        
        // Extrair base de conhecimento
        knowledgeBase = customPrompts.atendimento?.knowledge_base || null;
      }
      
      // Carregar configurações de bloqueio
      blockedTags = config?.blocked_tags || [];
      blockedFunnels = config?.blocked_funnels || [];
      blockedStages = config?.blocked_stages || [];
    }

    // ========================================
    // VERIFICAR BLOQUEIOS
    // ========================================
    if (leadData) {
      // Verificar bloqueio por tags
      if (blockedTags.length > 0 && leadData.tags) {
        const hasBlockedTag = leadData.tags.some((tag: string) => blockedTags.includes(tag));
        if (hasBlockedTag) {
          console.log('⛔ Lead bloqueado por tag');
          return new Response(
            JSON.stringify({ 
              blocked: true, 
              reason: 'Tag bloqueada',
              response: null 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Verificar bloqueio por funil/etapa
      if (blockedFunnels.length > 0 && leadData.funil_id && blockedFunnels.includes(leadData.funil_id)) {
        console.log('⛔ Lead bloqueado por funil');
        return new Response(
          JSON.stringify({ 
            blocked: true, 
            reason: 'Funil bloqueado',
            response: null 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (blockedStages.length > 0 && leadData.etapa_id && blockedStages.includes(leadData.etapa_id)) {
        console.log('⛔ Lead bloqueado por etapa');
        return new Response(
          JSON.stringify({ 
            blocked: true, 
            reason: 'Etapa bloqueada',
            response: null 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========================================
    // PROCESSAR ARQUIVOS (IMAGENS, PDFs, ÁUDIOS, VÍDEOS)
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
          filesDescription += `\n[Imagem anexada: ${fileData.name}] - Analise esta imagem e descreva o que você vê.`;
        } else if (fileData.type === 'pdf') {
          // PDFs: tentar extrair texto se possível
          filesDescription += `\n[PDF anexado: ${fileData.name}] - O cliente enviou um documento PDF. Pergunte sobre o conteúdo ou solicite informações específicas.`;
        } else if (fileData.type === 'audio') {
          // Áudios: chamar transcrição se disponível
          filesDescription += `\n[Áudio anexado: ${fileData.name}] - O cliente enviou um áudio. Se necessário, solicite que transcreva ou repita por texto.`;
          
          // Tentar transcrever o áudio
          try {
            const { data: transcricao } = await supabase.functions.invoke('transcrever-audio', {
              body: { 
                audioBase64: fileData.base64,
                mimeType: fileData.mimeType
              }
            });
            
            if (transcricao?.text) {
              filesDescription = filesDescription.replace(
                `[Áudio anexado: ${fileData.name}]`,
                `[Áudio transcrito: "${transcricao.text}"]`
              );
            }
          } catch (e) {
            console.warn('⚠️ Erro na transcrição:', e);
          }
        } else if (fileData.type === 'video') {
          filesDescription += `\n[Vídeo anexado: ${fileData.name}] - O cliente enviou um vídeo. Pergunte sobre o conteúdo.`;
        }
      }
    }

    // ========================================
    // MONTAR CONTEXTO DINÂMICO (DADOS DO LEAD + BASE DE CONHECIMENTO)
    // ========================================
    let contextoDinamico = '';
    
    // Contexto do lead
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
        
        // Buscar compromissos do lead
        const { data: compromissos } = await supabase
          .from('compromissos')
          .select('data_hora_inicio, tipo_servico, status')
          .eq('lead_id', leadData.id)
          .gte('data_hora_inicio', new Date().toISOString())
          .neq('status', 'cancelado')
          .limit(3);
        
        if (compromissos && compromissos.length > 0) {
          contextoDinamico += `
COMPROMISSOS AGENDADOS:
${compromissos.map((c: any) => `- ${new Date(c.data_hora_inicio).toLocaleDateString('pt-BR')} às ${new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${c.tipo_servico}`).join('\n')}
`;
        }
      }
    }

    // Adicionar base de conhecimento ao contexto
    if (knowledgeBase) {
      if (knowledgeBase.empresa) {
        contextoDinamico += `
INFORMAÇÕES DA EMPRESA:
- Nome: ${knowledgeBase.empresa.nome || 'Não informado'}
- Descrição: ${knowledgeBase.empresa.descricao || 'Não informada'}
- Segmento: ${knowledgeBase.empresa.segmento || 'Não informado'}
- Horário: ${knowledgeBase.empresa.horario || 'Não informado'}
- Endereço: ${knowledgeBase.empresa.endereco || 'Não informado'}
- Contato: ${knowledgeBase.empresa.contato || 'Não informado'}
`;
      }
      
      if (knowledgeBase.produtos && knowledgeBase.produtos.length > 0) {
        contextoDinamico += `
PRODUTOS/SERVIÇOS DISPONÍVEIS:
${knowledgeBase.produtos.map((p: any) => `- ${p.nome}: ${p.descricao} ${p.preco ? `(${p.preco})` : ''}`).join('\n')}
`;
      }
      
      if (knowledgeBase.faqs && knowledgeBase.faqs.length > 0) {
        contextoDinamico += `
PERGUNTAS FREQUENTES:
${knowledgeBase.faqs.map((f: any) => `P: ${f.pergunta}\nR: ${f.resposta}`).join('\n\n')}
`;
      }
      
      if (knowledgeBase.informacoes_extras) {
        contextoDinamico += `
INFORMAÇÕES ADICIONAIS:
${knowledgeBase.informacoes_extras}
`;
      }
    }

    // Buscar histórico recente da conversa
    const historyCount = iaConfig?.history_messages_count || 10;
    if (conversationId && companyId && leadData && iaConfig?.read_conversation_history !== false) {
      const { data: historico } = await supabase
        .from('conversas')
        .select('mensagem, fromme, created_at')
        .eq('telefone_formatado', leadData?.telefone || leadData?.phone)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(historyCount);
      
      if (historico && historico.length > 1) {
        contextoDinamico += `
HISTÓRICO RECENTE DA CONVERSA (últimas ${historico.length - 1} mensagens):
${historico.slice(1).reverse().map((h: any) => 
  `${h.fromme ? '[Você]' : '[Cliente]'}: ${h.mensagem?.substring(0, 200)}`
).join('\n')}
`;
      }
    }

    // ========================================
    // DETECTAR INTENÇÃO DE AGENDAMENTO
    // ========================================
    const msgLower = message?.toLowerCase() || '';
    const agendamentoKeywords = ['agendar', 'marcar', 'horário', 'horario', 'consulta', 'disponível', 'disponivel', 'vaga', 'quando posso', 'quero marcar'];
    const isAgendamentoIntent = agendamentoKeywords.some(k => msgLower.includes(k));

    // ========================================
    // CONSTRUIR PROMPT FINAL
    // ========================================
    let systemPrompt = '';
    
    if (promptPersonalizado && promptPersonalizado.trim()) {
      // Substituir variáveis no prompt personalizado
      let promptComVariaveis = promptPersonalizado
        .replace(/{lead\.name}/g, leadData?.name || 'Cliente')
        .replace(/{lead\.phone}/g, leadData?.phone || leadData?.telefone || '')
        .replace(/{lead\.email}/g, leadData?.email || '')
        .replace(/{lead\.company}/g, leadData?.company || '')
        .replace(/{company\.name}/g, knowledgeBase?.empresa?.nome || 'Empresa');
      
      systemPrompt = `${promptComVariaveis}

${contextoDinamico}

AÇÕES DISPONÍVEIS (inclua UMA ação no final da resposta entre colchetes, se aplicável):
- [COLETAR_DADOS:campo=valor] - para coletar CPF, email, telefone, empresa
- [ADICIONAR_TAG:nome] - para adicionar tag ao lead
- [MOVER_FUNIL:etapa] - para mover lead no funil
- [CRIAR_TAREFA:titulo] - para criar tarefa de follow-up
- [AGENDAR] - quando cliente quiser marcar horário (inicia fluxo de agendamento)
- [TRANSFERIR_HUMANO] - para transferir para atendente humano
- [QUALIFICAR] - para marcar lead como qualificado`;
    } else {
      systemPrompt = `Você é uma assistente de atendimento virtual. Responda de forma cordial, profissional e objetiva.

${contextoDinamico}

DIRETRIZES:
- Seja prestativo e empático
- Responda de forma concisa (máximo 3 parágrafos)
- Use emojis com moderação para criar conexão
- Se não souber responder algo, admita e ofereça encaminhar para um humano
- Se o cliente quiser agendar algo, use a ação [AGENDAR]

AÇÕES DISPONÍVEIS (inclua UMA ação no final da resposta entre colchetes, se aplicável):
- [COLETAR_DADOS:campo=valor] - para coletar CPF, email, telefone, empresa
- [ADICIONAR_TAG:nome] - para adicionar tag ao lead
- [MOVER_FUNIL:etapa] - para mover lead no funil
- [CRIAR_TAREFA:titulo] - para criar tarefa de follow-up
- [AGENDAR] - quando cliente quiser marcar horário
- [TRANSFERIR_HUMANO] - para transferir para atendente humano
- [QUALIFICAR] - para marcar lead como qualificado`;
    }

    console.log('🤖 IA Atendimento - Processando:', { 
      conversationId, 
      message: message?.substring(0, 50),
      hasLead: !!leadData,
      hasCustomPrompt: !!promptPersonalizado,
      hasFiles: filesContent.length > 0,
      hasKnowledgeBase: !!knowledgeBase,
      isAgendamentoIntent
    });

    // Construir conteúdo da mensagem (texto + arquivos multimodais)
    let userContent: any;
    
    if (filesContent.length > 0) {
      userContent = [
        { type: 'text', text: (message || 'Analise este arquivo.') + filesDescription },
        ...filesContent
      ];
    } else {
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
        max_tokens: 1000,
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
          
        case 'QUALIFICAR':
          const { error: qualError } = await supabase
            .from('leads')
            .update({ 
              status: 'qualificado',
              updated_at: new Date().toISOString()
            })
            .eq('id', leadData.id);
          
          actionResult = { success: !qualError };
          console.log('✨ Lead qualificado');
          break;
          
        case 'AGENDAR':
          // Sinalizar que deve transferir para IA de agendamento
          actionResult = { 
            success: true, 
            nextAgent: 'agendamento',
            message: 'Transferindo para agendamento...' 
          };
          console.log('📅 Iniciando fluxo de agendamento');
          break;
      }
    }

    // Registrar interação para aprendizado
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
            hasKnowledgeBase: !!knowledgeBase
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
        executionTime,
        nextAgent: action === 'AGENDAR' ? 'agendamento' : undefined
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
