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

    // Buscar lembretes pendentes ou em retry que devem ser enviados agora
    const agora = new Date().toISOString();
    const { data: lembretes, error: lembretesError } = await supabase
      .from('lembretes')
      .select(`
        *,
        compromisso:compromissos (
          id,
          data_hora_inicio,
          tipo_servico,
          lead_id,
          company_id,
          lead:leads (
            name,
            phone,
            telefone
          )
        )
      `)
      .or('status_envio.eq.pendente,status_envio.eq.retry')
      .or(`data_envio.lte.${agora},proxima_tentativa.lte.${agora}`)
      .lte('tentativas', 2); // Máximo 3 tentativas (0, 1, 2)

    if (lembretesError) {
      console.error('❌ Erro ao buscar lembretes:', lembretesError);
      throw lembretesError;
    }

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
      console.log(`🏢 Processando ${lembretesEmpresa.length} lembretes da empresa ${companyId}`);

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
        for (const lembrete of lembretesEmpresa) {
          await supabase
            .from('lembretes')
            .update({
              status_envio: 'erro',
              data_envio: new Date().toISOString()
            })
            .eq('id', lembrete.id);
        }
        totalErros += lembretesEmpresa.length;
        continue;
      }

      const evolutionUrl = whatsappConfig.evolution_api_url || Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = whatsappConfig.evolution_api_key || Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = whatsappConfig.instance_name || Deno.env.get('EVOLUTION_INSTANCE');

      console.log(`📱 Usando configuração WhatsApp: ${instanceName} para empresa ${companyId}`);

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

            // Enviar mensagem via Evolution API
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

              // Enviar para todos os telefones
              let todosEnviados = true;
              for (const telefone of telefones) {
                const telefoneFormatado = telefone.replace(/\D/g, '');

                console.log(`📱 Enviando WhatsApp para: ${telefoneFormatado}`);

                const whatsappUrl = `${evolutionUrl}/message/sendText/${instanceName}`;
                const whatsappPayload = {
                  number: telefoneFormatado,
                  text: lembrete.mensagem || `Olá! Lembramos do compromisso de ${lembrete.compromisso.tipo_servico} agendado para ${new Date(lembrete.compromisso.data_hora_inicio).toLocaleString('pt-BR')}.`,
                };

                console.log(`🌐 Chamando Evolution API: ${whatsappUrl}`);

                const whatsappResponse = await fetch(whatsappUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': evolutionApiKey,
                  },
                  body: JSON.stringify(whatsappPayload),
                });

                console.log(`📥 Status da resposta: ${whatsappResponse.status}`);

                if (!whatsappResponse.ok) {
                  const errorText = await whatsappResponse.text();
                  console.error(`❌ Erro ao enviar WhatsApp:`, errorText);
                  todosEnviados = false;
                } else {
                  const whatsappResult = await whatsappResponse.json();
                  console.log(`✅ WhatsApp enviado com sucesso:`, whatsappResult);
                }
              }

              if (todosEnviados) {
                // Atualizar status do lembrete para enviado
                await supabase
                  .from('lembretes')
                  .update({
                    status_envio: 'enviado',
                    data_envio: new Date().toISOString(),
                    tentativas: (lembrete.tentativas || 0) + 1
                  })
                  .eq('id', lembrete.id);

                // Atualizar flag no compromisso
                await supabase
                  .from('compromissos')
                  .update({ lembrete_enviado: true })
                  .eq('id', lembrete.compromisso_id);

                totalProcessados++;
                console.log(`✅ Lembrete ${lembrete.id} processado com sucesso`);
              } else {
                // Sistema de retry com backoff exponencial
                const tentativasAtuais = (lembrete.tentativas || 0) + 1;

                if (tentativasAtuais < 3) {
                  // Calcular próxima tentativa com backoff: 5min, 15min, 60min
                  const backoffTimes = [5, 15, 60]; // minutos
                  const proximaTentativa = new Date();
                  proximaTentativa.setMinutes(proximaTentativa.getMinutes() + backoffTimes[tentativasAtuais - 1]);

                  await supabase
                    .from('lembretes')
                    .update({
                      status_envio: 'retry',
                      tentativas: tentativasAtuais,
                      proxima_tentativa: proximaTentativa.toISOString(),
                      data_envio: new Date().toISOString()
                    })
                    .eq('id', lembrete.id);

                  console.log(`🔄 Lembrete ${lembrete.id} agendado para retry ${tentativasAtuais}/3 em ${proximaTentativa.toISOString()}`);
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
                const backoffTimes = [5, 15, 60];
                const proximaTentativa = new Date();
                proximaTentativa.setMinutes(proximaTentativa.getMinutes() + backoffTimes[tentativasAtuais - 1]);

                await supabase
                  .from('lembretes')
                  .update({
                    status_envio: 'retry',
                    tentativas: tentativasAtuais,
                    proxima_tentativa: proximaTentativa.toISOString(),
                    data_envio: new Date().toISOString()
                  })
                  .eq('id', lembrete.id);

                console.log(`🔄 Lembrete ${lembrete.id} (canal não suportado) agendado para retry ${tentativasAtuais}/3`);
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
              const backoffTimes = [5, 15, 60];
              const proximaTentativa = new Date();
              proximaTentativa.setMinutes(proximaTentativa.getMinutes() + backoffTimes[tentativasAtuais - 1]);

              await supabase
                .from('lembretes')
                .update({
                  status_envio: 'retry',
                  tentativas: tentativasAtuais,
                  proxima_tentativa: proximaTentativa.toISOString(),
                  data_envio: new Date().toISOString()
                })
                .eq('id', lembrete.id);

              console.log(`🔄 Lembrete ${lembrete.id} (erro de processamento) agendado para retry ${tentativasAtuais}/3`);
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
