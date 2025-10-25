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
  compromisso: {
    id: string;
    data_hora_inicio: string;
    tipo_servico: string;
    lead_id: string;
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

    // Buscar lembretes pendentes que devem ser enviados agora
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
          lead:leads (
            name,
            phone,
            telefone
          )
        )
      `)
      .eq('status_envio', 'pendente')
      .lte('data_envio', agora);

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

    // Obter credenciais Evolution API
    const { data: whatsappConfig } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('status', 'connected')
      .limit(1)
      .single();

    if (!whatsappConfig) {
      console.error('❌ Nenhuma conexão WhatsApp ativa encontrada');
      throw new Error('Nenhuma conexão WhatsApp ativa');
    }

    const evolutionUrl = whatsappConfig.evolution_api_url || Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = whatsappConfig.evolution_api_key || Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = whatsappConfig.instance_name || Deno.env.get('EVOLUTION_INSTANCE');

    let processados = 0;
    let erros = 0;

    // Processar cada lembrete
    for (const lembrete of lembretes as Lembrete[]) {
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
          erros++;
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
          erros++;
          continue;
        }

        const telefone = lembrete.compromisso.lead.phone || lembrete.compromisso.lead.telefone;
        
        if (!telefone) {
          console.error(`❌ Telefone não encontrado para lead do compromisso ${lembrete.compromisso_id}`);
          await supabase
            .from('lembretes')
            .update({ 
              status_envio: 'erro',
              data_envio: new Date().toISOString()
            })
            .eq('id', lembrete.id);
          erros++;
          continue;
        }

        // Formatar telefone (remover caracteres não numéricos)
        const telefoneFormatado = telefone.replace(/\D/g, '');

        // Enviar mensagem via Evolution API
        if (lembrete.canal === 'whatsapp') {
          console.log(`📱 Enviando WhatsApp para: ${telefoneFormatado}`);
          
          const whatsappUrl = `${evolutionUrl}/message/sendText/${instanceName}`;
          const whatsappPayload = {
            number: telefoneFormatado,
            text: lembrete.mensagem || `Olá ${lembrete.compromisso.lead.name}! Lembramos do seu compromisso de ${lembrete.compromisso.tipo_servico} agendado para ${new Date(lembrete.compromisso.data_hora_inicio).toLocaleString('pt-BR')}.`,
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
            throw new Error(`Falha ao enviar WhatsApp: ${whatsappResponse.status}`);
          }

          const whatsappResult = await whatsappResponse.json();
          console.log(`✅ WhatsApp enviado com sucesso:`, whatsappResult);

          // Atualizar status do lembrete para enviado
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

          processados++;
          console.log(`✅ Lembrete ${lembrete.id} processado com sucesso`);
        } else {
          console.log(`⚠️ Canal ${lembrete.canal} não suportado ainda`);
          await supabase
            .from('lembretes')
            .update({ 
              status_envio: 'erro',
              data_envio: new Date().toISOString()
            })
            .eq('id', lembrete.id);
          erros++;
        }

      } catch (error) {
        console.error(`❌ Erro ao processar lembrete ${lembrete.id}:`, error);
        
        // Atualizar status para erro
        await supabase
          .from('lembretes')
          .update({ 
            status_envio: 'erro',
            data_envio: new Date().toISOString()
          })
          .eq('id', lembrete.id);
        
        erros++;
      }
    }

    console.log(`✅ Processamento concluído: ${processados} enviados, ${erros} erros`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processados,
        erros,
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
