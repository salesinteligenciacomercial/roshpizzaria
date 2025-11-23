import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Lembrete {
  id: string;
  compromisso_id: string;
  canal: string;
  mensagem: string;
  horas_antecedencia: number;
  data_envio: string;
  status_envio: string;
  destinatario?: string;
  telefone_responsavel?: string;
  tentativas?: number;
  proxima_tentativa?: string;
      compromisso: {
        id: string;
        data_hora_inicio: string;
        tipo_servico: string;
        lead_id: string;
        company_id?: string;
        usuario_responsavel_id?: string;
        lead: {
          name: string;
          phone?: string;
          telefone?: string;
        };
      };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Iniciando verificação de lembretes...');

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Configuração do backoff exponencial para retry (em horas)
    // Tentativa 1: 1h, Tentativa 2: 3h, Tentativa 3: 24h
    const BACKOFF_TIMES_HOURS = [1, 3, 24];

    // Buscar lembretes pendentes ou em retry que devem ser enviados agora
    const agora = new Date().toISOString();
    
    // Buscar lembretes pendentes com data_envio <= agora OU em retry com proxima_tentativa <= agora
    // Máximo 3 tentativas (0, 1, 2 = 3 tentativas)
    const { data: lembretesPendentes, error: pendentesError } = await supabase
      .from('lembretes')
      .select(`
        *,
        compromisso:compromissos (
          id,
          data_hora_inicio,
          tipo_servico,
          lead_id,
          company_id,
          usuario_responsavel_id,
          lead:leads (
            name,
            phone,
            telefone
          )
        )
      `)
      .eq('status_envio', 'pendente')
      .lte('data_envio', agora)
      .lte('tentativas', 2);
    
    const { data: lembretesRetry, error: retryError } = await supabase
      .from('lembretes')
      .select(`
        *,
        compromisso:compromissos (
          id,
          data_hora_inicio,
          tipo_servico,
          lead_id,
          company_id,
          usuario_responsavel_id,
          lead:leads (
            name,
            phone,
            telefone
          )
        )
      `)
      .eq('status_envio', 'retry')
      .lte('proxima_tentativa', agora)
      .lte('tentativas', 2);
    
    if (pendentesError || retryError) {
      const lembretesError = pendentesError || retryError;
      console.error('❌ Erro ao buscar lembretes:', lembretesError);
      throw lembretesError;
    }
    
    // Combinar resultados e remover duplicatas
    const lembretesMap = new Map();
    [...(lembretesPendentes || []), ...(lembretesRetry || [])].forEach(lembrete => {
      lembretesMap.set(lembrete.id, lembrete);
    });
    const lembretes = Array.from(lembretesMap.values());

    console.log(`📋 ${lembretes?.length || 0} lembretes pendentes encontrados`);

    if (!lembretes || lembretes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum lembrete pendente para enviar',
          processados: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Para cada lembrete, obter a configuração WhatsApp da empresa correspondente
    // Primeiro, vamos agrupar lembretes por empresa para processar eficientemente
    const lembretesPorEmpresa = lembretes.reduce((acc, lembrete) => {
      const companyId = lembrete.compromisso?.company_id || 'default';
      if (!acc[companyId]) acc[companyId] = [];
      acc[companyId].push(lembrete);
      return acc;
    }, {} as Record<string, typeof lembretes>);

    let totalProcessados = 0;
    let totalErros = 0;

    // Processar lembretes por empresa
    for (const [companyId, lembretesEmpresa] of Object.entries(lembretesPorEmpresa)) {
      const lembretes = lembretesEmpresa as any[];
      console.log(`🏢 Processando ${lembretes.length} lembretes da empresa ${companyId}`);

      // Obter configuração WhatsApp da empresa
      let whatsappConfig = null;

      if (companyId !== 'default') {
        // Tentar buscar configuração da empresa específica
        const { data: configEmpresa } = await supabase
          .from('whatsapp_connections')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'connected')
          .limit(1)
          .single();

        whatsappConfig = configEmpresa;
      }

      // Fallback para configuração global (sem company_id) se não encontrou específica
      if (!whatsappConfig) {
        console.log(`🔄 Usando configuração global para empresa ${companyId}`);
        const { data: configGlobal } = await supabase
          .from('whatsapp_connections')
          .select('*')
          .is('company_id', null)
          .eq('status', 'connected')
          .limit(1)
          .single();

        whatsappConfig = configGlobal;
      }

      if (!whatsappConfig) {
        console.error(`❌ Nenhuma conexão WhatsApp ativa encontrada para empresa ${companyId}`);
        // Marcar todos os lembretes desta empresa como erro
        for (const lembrete of lembretes) {
          await supabase
            .from('lembretes')
            .update({
              status_envio: 'erro',
              data_envio: new Date().toISOString()
            })
            .eq('id', lembrete.id);
        }
        totalErros += lembretes.length;
        continue;
      }

      console.log(`📱 Usando configuração WhatsApp da empresa ${companyId}`);

      // Processar lembretes desta empresa
      for (const lembrete of lembretesEmpresa as Lembrete[]) {
        try {
          console.log(`📤 Processando lembrete ${lembrete.id}`);

          // Validar dados do compromisso
          if (!lembrete.compromisso) {
            console.error(`❌ Compromisso não encontrado para lembrete ${lembrete.id}`);
            await supabase
              .from('lembretes')
              .update({
                status_envio: 'erro',
                data_envio: new Date().toISOString()
              })
              .eq('id', lembrete.id);
            totalErros++;
            continue;
          }

          // Validar dados do lead
          if (!lembrete.compromisso.lead) {
            console.error(`❌ Lead não encontrado para compromisso ${lembrete.compromisso_id}`);
            await supabase
              .from('lembretes')
              .update({
                status_envio: 'erro',
                data_envio: new Date().toISOString()
              })
              .eq('id', lembrete.id);
            totalErros++;
            continue;
          }

          // Enviar mensagem via edge function enviar-whatsapp
          if (lembrete.canal === 'whatsapp') {
            const destinatario = lembrete.destinatario || 'lead';
            const telefones: string[] = [];

            // Determinar quais telefones enviar baseado no destinatário
            if (destinatario === 'lead' || destinatario === 'ambos') {
              const leadTelefone = lembrete.compromisso.lead.phone || lembrete.compromisso.lead.telefone;
              if (leadTelefone) {
                telefones.push(leadTelefone);
              }
            }

            if (destinatario === 'responsavel' || destinatario === 'ambos') {
              if (lembrete.telefone_responsavel) {
                telefones.push(lembrete.telefone_responsavel);
              }
            }

            if (telefones.length === 0) {
              console.error(`❌ Nenhum telefone disponível para lembrete ${lembrete.id}`);
              await supabase
                .from('lembretes')
                .update({
                  status_envio: 'erro',
                  data_envio: new Date().toISOString()
                })
                .eq('id', lembrete.id);
              totalErros++;
              continue;
            }

            // Enviar para todos os telefones usando edge function enviar-whatsapp
            let todosEnviados = true;
            const mensagemLembrete = lembrete.mensagem || `Olá! Lembramos do compromisso de ${lembrete.compromisso.tipo_servico} agendado para ${new Date(lembrete.compromisso.data_hora_inicio).toLocaleString('pt-BR')}.`;
            
            for (const telefone of telefones) {
              const telefoneFormatado = telefone.replace(/\D/g, '');

              console.log(`📱 Enviando WhatsApp para: ${telefoneFormatado} via edge function`);

              try {
                // Chamar edge function enviar-whatsapp
                const { data: sendResult, error: sendError } = await supabase.functions.invoke(
                  'enviar-whatsapp',
                  {
                    body: {
                      numero: telefoneFormatado,
                      mensagem: mensagemLembrete,
                      company_id: lembrete.compromisso.company_id || companyId,
                    },
                  }
                );

                if (sendError || !sendResult?.success) {
                  console.error(`❌ Erro ao enviar WhatsApp via edge function:`, sendError || sendResult);
                  todosEnviados = false;
                } else {
                  console.log(`✅ WhatsApp enviado com sucesso via edge function`);
                  
                  // Salvar mensagem de lembrete na tabela conversas para ficar visível no CRM
                  try {
                    const leadNome = lembrete.compromisso.lead?.name || 'Contato';
                    const { error: dbError } = await supabase.from('conversas').insert([{
                      numero: telefoneFormatado,
                      telefone_formatado: telefoneFormatado,
                      mensagem: mensagemLembrete,
                      origem: 'WhatsApp',
                      status: 'Enviada',
                      tipo_mensagem: 'text',
                      nome_contato: leadNome,
                      company_id: lembrete.compromisso.company_id || companyId,
                      lead_id: lembrete.compromisso.lead_id,
                      fromme: true,
                    }]);
                    
                    if (dbError) {
                      console.error(`❌ Erro ao salvar mensagem de lembrete no banco:`, dbError);
                    } else {
                      console.log(`✅ Mensagem de lembrete salva no banco de dados`);
                    }
                  } catch (saveError) {
                    console.error(`❌ Erro ao salvar mensagem de lembrete no banco:`, saveError);
                  }
                }
              } catch (error) {
                console.error(`❌ Erro ao chamar edge function enviar-whatsapp:`, error);
                todosEnviados = false;
              }
            }

            if (todosEnviados) {
              // Atualizar status do lembrete para enviado (sucesso)
              // Não incrementar tentativas em caso de sucesso
              await supabase
                .from('lembretes')
                .update({
                  status_envio: 'enviado',
                  data_envio: new Date().toISOString()
                })
                .eq('id', lembrete.id);

              // Atualizar flag no compromisso
              await supabase
                .from('compromissos')
                .update({ lembrete_enviado: true })
                .eq('id', lembrete.compromisso_id);

              // Criar notificação para o responsável do compromisso
              if (lembrete.compromisso.usuario_responsavel_id) {
                try {
                  const dataCompromisso = new Date(lembrete.compromisso.data_hora_inicio);
                  const mensagemNotificacao = `Lembrete enviado: Compromisso de ${lembrete.compromisso.tipo_servico} agendado para ${dataCompromisso.toLocaleString('pt-BR')}`;
                  
                  // Criar entrada na tabela de notificações (se existir) ou usar outro método
                  // Por enquanto, vamos criar uma entrada em uma tabela de notificações simples
                  // ou usar um campo no compromisso que o frontend pode verificar
                  
                  // Tentar inserir em uma tabela de notificações (se existir)
                  const { error: notifError } = await supabase.from('notificacoes').insert([{
                    usuario_id: lembrete.compromisso.usuario_responsavel_id,
                    tipo: 'lembrete_enviado',
                    titulo: 'Lembrete Enviado',
                    mensagem: mensagemNotificacao,
                    compromisso_id: lembrete.compromisso_id,
                    company_id: lembrete.compromisso.company_id || companyId,
                    lida: false,
                    created_at: new Date().toISOString()
                  }]).select();
                  
                  if (notifError) {
                    // Se a tabela não existir, apenas logar (não é crítico)
                    console.log(`ℹ️ Tabela de notificações não encontrada ou erro ao criar notificação:`, notifError.message);
                  } else {
                    console.log(`✅ Notificação criada para o responsável do compromisso`);
                  }
                } catch (notifError) {
                  console.log(`ℹ️ Erro ao criar notificação (não crítico):`, notifError);
                }
              }

              totalProcessados++;
              console.log(`✅ Lembrete ${lembrete.id} processado com sucesso`);
            } else {
              // Sistema de retry com backoff exponencial
              const tentativasAtuais = (lembrete.tentativas || 0) + 1;

              if (tentativasAtuais < 3) {
                // Calcular próxima tentativa com backoff exponencial: 1h, 3h, 24h
                const proximaTentativa = new Date();
                const horasBackoff = BACKOFF_TIMES_HOURS[tentativasAtuais - 1];
                proximaTentativa.setHours(proximaTentativa.getHours() + horasBackoff);

                await supabase
                  .from('lembretes')
                  .update({
                    status_envio: 'retry',
                    tentativas: tentativasAtuais,
                    proxima_tentativa: proximaTentativa.toISOString(),
                    data_envio: new Date().toISOString()
                  })
                  .eq('id', lembrete.id);

                console.log(`🔄 Lembrete ${lembrete.id} agendado para retry ${tentativasAtuais}/3 em ${proximaTentativa.toISOString()} (backoff: ${horasBackoff}h)`);
              } else {
                // Máximo de tentativas atingido
                await supabase
                  .from('lembretes')
                  .update({
                    status_envio: 'erro',
                    tentativas: tentativasAtuais,
                    data_envio: new Date().toISOString()
                  })
                  .eq('id', lembrete.id);

                totalErros++;
                console.log(`❌ Lembrete ${lembrete.id} falhou após ${tentativasAtuais} tentativas`);
              }
            }
          } else {
            console.log(`⚠️ Canal ${lembrete.canal} não suportado ainda`);
            // Mesmo para canais não suportados, aplicar retry se ainda houver tentativas
            const tentativasAtuais = (lembrete.tentativas || 0) + 1;

            if (tentativasAtuais < 3) {
              // Backoff exponencial: 1h, 3h, 24h
              const proximaTentativa = new Date();
              const horasBackoff = BACKOFF_TIMES_HOURS[tentativasAtuais - 1];
              proximaTentativa.setHours(proximaTentativa.getHours() + horasBackoff);

              await supabase
                .from('lembretes')
                .update({
                  status_envio: 'retry',
                  tentativas: tentativasAtuais,
                  proxima_tentativa: proximaTentativa.toISOString(),
                  data_envio: new Date().toISOString()
                })
                .eq('id', lembrete.id);

              console.log(`🔄 Lembrete ${lembrete.id} (canal não suportado) agendado para retry ${tentativasAtuais}/3 em ${proximaTentativa.toISOString()} (backoff: ${horasBackoff}h)`);
            } else {
              await supabase
                .from('lembretes')
                .update({
                  status_envio: 'erro',
                  tentativas: tentativasAtuais,
                  data_envio: new Date().toISOString()
                })
                .eq('id', lembrete.id);
              totalErros++;
            }
          }

        } catch (error) {
          console.error(`❌ Erro ao processar lembrete ${lembrete.id}:`, error);

          // Sistema de retry para erros de processamento
          const tentativasAtuais = (lembrete.tentativas || 0) + 1;

          if (tentativasAtuais < 3) {
            // Backoff exponencial: 1h, 3h, 24h
            const proximaTentativa = new Date();
            const horasBackoff = BACKOFF_TIMES_HOURS[tentativasAtuais - 1];
            proximaTentativa.setHours(proximaTentativa.getHours() + horasBackoff);

            await supabase
              .from('lembretes')
              .update({
                status_envio: 'retry',
                tentativas: tentativasAtuais,
                proxima_tentativa: proximaTentativa.toISOString(),
                data_envio: new Date().toISOString()
              })
              .eq('id', lembrete.id);

            console.log(`🔄 Lembrete ${lembrete.id} (erro de processamento) agendado para retry ${tentativasAtuais}/3 em ${proximaTentativa.toISOString()} (backoff: ${horasBackoff}h)`);
          } else {
            await supabase
              .from('lembretes')
              .update({
                status_envio: 'erro',
                tentativas: tentativasAtuais,
                data_envio: new Date().toISOString()
              })
              .eq('id', lembrete.id);

            totalErros++;
            console.log(`❌ Lembrete ${lembrete.id} falhou após ${tentativasAtuais} tentativas (erro de processamento)`);
          }
        }
      }
    }

    console.log(`✅ Processamento concluído: ${totalProcessados} enviados, ${totalErros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: totalProcessados,
        erros: totalErros,
        total: lembretes.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro fatal na função de lembretes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
