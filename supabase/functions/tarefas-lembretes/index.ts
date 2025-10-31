import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TarefaLembrete {
  id: string;
  title: string;
  due_date: string;
  assignee_id: string | null;
  responsaveis: string[];
  priority: string;
  company_id: string;
  notificacao_enviada: boolean;
  assignee?: {
    full_name: string;
    phone?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Iniciando verificação de lembretes de tarefas...');

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar tarefas com vencimento próximo (24h) que não tiveram lembrete enviado
    const agora = new Date();
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const amanhaInicio = new Date(amanha);
    amanhaInicio.setHours(0, 0, 0, 0);
    const amanhaFim = new Date(amanha);
    amanhaFim.setHours(23, 59, 59, 999);

    console.log(`📅 Buscando tarefas que vencem entre ${amanhaInicio.toISOString()} e ${amanhaFim.toISOString()}`);

    const { data: tarefas, error: tarefasError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        due_date,
        assignee_id,
        responsaveis,
        priority,
        company_id,
        notificacao_enviada,
        assignee:profiles!tasks_assignee_id_fkey(full_name, phone)
      `)
      .eq('notificacao_enviada', false)
      .gte('due_date', amanhaInicio.toISOString())
      .lte('due_date', amanhaFim.toISOString())
      .not('due_date', 'is', null);

    if (tarefasError) {
      console.error('❌ Erro ao buscar tarefas:', tarefasError);
      throw tarefasError;
    }

    console.log(`📋 ${tarefas?.length || 0} tarefas com vencimento amanhã encontradas`);

    if (!tarefas || tarefas.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma tarefa com vencimento próximo para enviar lembrete',
          processados: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Agrupar tarefas por empresa para processar eficientemente
    const tarefasPorEmpresa = tarefas.reduce((acc, tarefa) => {
      const companyId = tarefa.company_id || 'default';
      if (!acc[companyId]) acc[companyId] = [];
      acc[companyId].push(tarefa);
      return acc;
    }, {} as Record<string, typeof tarefas>);

    let totalProcessados = 0;
    let totalErros = 0;

    // Processar tarefas por empresa
    for (const [companyId, tarefasEmpresa] of Object.entries(tarefasPorEmpresa)) {
      console.log(`🏢 Processando ${tarefasEmpresa.length} tarefas da empresa ${companyId}`);

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
        // Marcar todas as tarefas desta empresa como erro
        for (const tarefa of tarefasEmpresa) {
          await supabase
            .from('tasks')
            .update({ notificacao_enviada: true }) // Marcar como enviada mesmo com erro para evitar reprocessamento
            .eq('id', tarefa.id);
        }
        totalErros += tarefasEmpresa.length;
        continue;
      }

      const evolutionUrl = whatsappConfig.evolution_api_url || Deno.env.get('EVOLUTION_API_URL');
      const evolutionApiKey = whatsappConfig.evolution_api_key || Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = whatsappConfig.instance_name || Deno.env.get('EVOLUTION_INSTANCE');

      console.log(`📱 Usando configuração WhatsApp: ${instanceName} para empresa ${companyId}`);

      // Processar tarefas desta empresa
      for (const tarefa of tarefasEmpresa as TarefaLembrete[]) {
        try {
          console.log(`📤 Processando lembrete para tarefa ${tarefa.id}: ${tarefa.title}`);

          // Determinar responsáveis pela tarefa
          const responsaveisIds = [];
          if (tarefa.assignee_id) responsaveisIds.push(tarefa.assignee_id);
          if (tarefa.responsaveis && Array.isArray(tarefa.responsaveis)) {
            responsaveisIds.push(...tarefa.responsaveis);
          }

          if (responsaveisIds.length === 0) {
            console.error(`❌ Nenhum responsável encontrado para tarefa ${tarefa.id}`);
            await supabase
              .from('tasks')
              .update({ notificacao_enviada: true })
              .eq('id', tarefa.id);
            totalErros++;
            continue;
          }

          // Buscar dados dos responsáveis
          const { data: responsaveis, error: respError } = await supabase
            .from('profiles')
            .select('id, phone, full_name')
            .in('id', responsaveisIds);

          if (respError || !responsaveis || responsaveis.length === 0) {
            console.error(`❌ Erro ao buscar responsáveis:`, respError);
            await supabase
              .from('tasks')
              .update({ notificacao_enviada: true })
              .eq('id', tarefa.id);
            totalErros++;
            continue;
          }

          // Filtrar telefones válidos
          const telefones = responsaveis
            .map(r => r.phone)
            .filter(phone => phone && phone.trim().length > 0);

          if (telefones.length === 0) {
            console.error(`❌ Nenhum telefone válido encontrado para tarefa ${tarefa.id}`);
            await supabase
              .from('tasks')
              .update({ notificacao_enviada: true })
              .eq('id', tarefa.id);
            totalErros++;
            continue;
          }

          // Formatar data de vencimento
          const dataVencimento = new Date(tarefa.due_date);
          const dataFormatada = dataVencimento.toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          // Criar mensagem personalizada baseada na prioridade
          const prioridadeEmoji = {
            'baixa': '🟢',
            'media': '🟡',
            'alta': '🟠',
            'urgente': '🔴'
          }[tarefa.priority] || '📝';

          const mensagem = `${prioridadeEmoji} *LEMBRETE DE TAREFA*\n\n📋 *${tarefa.title}*\n\n⏰ *Vence amanhã:* ${dataFormatada}\n🎯 *Prioridade:* ${tarefa.priority.toUpperCase()}\n\nPor favor, finalize esta tarefa até o prazo para manter nossa produtividade! 🚀`;

          // Enviar para todos os telefones dos responsáveis
          let todosEnviados = true;
          for (const telefone of telefones) {
            const telefoneFormatado = telefone.replace(/\D/g, '');

            console.log(`📱 Enviando WhatsApp para: ${telefoneFormatado}`);

            const whatsappUrl = `${evolutionUrl}/message/sendText/${instanceName}`;
            const whatsappPayload = {
              number: telefoneFormatado,
              text: mensagem,
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
            // Atualizar tarefa marcando lembrete como enviado
            await supabase
              .from('tasks')
              .update({ notificacao_enviada: true })
              .eq('id', tarefa.id);

            totalProcessados++;
            console.log(`✅ Lembrete enviado com sucesso para tarefa ${tarefa.id}`);
          } else {
            // Mesmo com erro, marcar como enviado para evitar reprocessamento infinito
            await supabase
              .from('tasks')
              .update({ notificacao_enviada: true })
              .eq('id', tarefa.id);

            totalErros++;
            console.log(`❌ Erro ao enviar lembrete para tarefa ${tarefa.id}, marcado como processado`);
          }

        } catch (error) {
          console.error(`❌ Erro ao processar tarefa ${tarefa.id}:`, error);

          // Mesmo com erro, marcar como enviado para evitar reprocessamento infinito
          await supabase
            .from('tasks')
            .update({ notificacao_enviada: true })
            .eq('id', tarefa.id);

          totalErros++;
        }
      }
    }

    console.log(`✅ Processamento concluído: ${totalProcessados} lembretes enviados, ${totalErros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: totalProcessados,
        erros: totalErros,
        total: tarefas.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro fatal na função de lembretes de tarefas:', error);
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