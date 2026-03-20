import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_SIZE = 5;
const DEFAULT_DELAY_SECONDS = 7;
const SAFE_EXECUTION_WINDOW_SECONDS = 45;
const MIN_DELAY_SECONDS = 1;

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (!cleaned.startsWith('55') && cleaned.length >= 10) {
    cleaned = `55${cleaned}`;
  }
  return cleaned;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBatchSize(delayBetweenMessages: number | null | undefined): number {
  const delaySeconds = Math.max(MIN_DELAY_SECONDS, Number(delayBetweenMessages) || DEFAULT_DELAY_SECONDS);
  const safeBatchSize = Math.floor(SAFE_EXECUTION_WINDOW_SECONDS / delaySeconds) + 1;

  return Math.max(1, Math.min(BATCH_SIZE, safeBatchSize));
}

function scheduleNextBatch(selfUrl: string, serviceRoleKey: string, campaignId: string) {
  const nextBatchPromise = fetch(selfUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
    },
    body: JSON.stringify({ campaign_id: campaignId }),
  }).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro ao auto-invocar próximo lote (${response.status}): ${errorText}`);
      return;
    }

    console.log(`✅ Próximo lote da campanha ${campaignId} agendado`);
  }).catch((err) => {
    console.error('❌ Erro ao auto-invocar próximo lote:', err.message);
  });

  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(nextBatchPromise);
    return;
  }

  void nextBatchPromise;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { campaign_id } = body;

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch campaign
    const { data: campaign, error: fetchErr } = await supabase
      .from('disparo_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (fetchErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Campaign already finished', status: campaign.status }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as sending if not already
    if (campaign.status !== 'sending') {
      await supabase.from('disparo_campaigns').update({
        status: 'sending',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaign_id);
    }

    const leads = campaign.leads_data as any[];
    let sentCount = campaign.sent_count || 0;
    let errorCount = campaign.error_count || 0;
    const errorDetails: any[] = campaign.error_details || [];
    const startIndex = sentCount + errorCount; // Resume from where we left off
    const batchSize = getBatchSize(campaign.delay_between_messages);
    const endIndex = Math.min(startIndex + batchSize, leads.length);

    console.log(`🚀 Batch: processando leads ${startIndex}-${endIndex - 1} de ${leads.length} (campanha: ${campaign.campaign_name}, lote: ${batchSize}, delay: ${campaign.delay_between_messages || DEFAULT_DELAY_SECONDS}s)`);

    for (let i = startIndex; i < endIndex; i++) {
      // Check cancellation
      if (i > startIndex) {
        const { data: check } = await supabase
          .from('disparo_campaigns')
          .select('status')
          .eq('id', campaign_id)
          .single();
        if (check?.status === 'cancelled') {
          console.log('🛑 Campanha cancelada');
          return new Response(JSON.stringify({ success: true, cancelled: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const lead = leads[i];
      const phone = lead.telefone || lead.phone;

      if (!phone) {
        errorCount++;
        errorDetails.push({ lead_id: lead.id, name: lead.name, error: 'Sem telefone' });
        await updateProgress(supabase, campaign_id, sentCount, errorCount, errorDetails);
        continue;
      }

      const formattedPhone = formatPhoneNumber(phone);
      if (formattedPhone.length < 12) {
        errorCount++;
        errorDetails.push({ lead_id: lead.id, name: lead.name, error: 'Telefone inválido' });
        await updateProgress(supabase, campaign_id, sentCount, errorCount, errorDetails);
        continue;
      }

      try {
        const payload: any = {
          numero: formattedPhone,
          company_id: campaign.company_id,
        };

        if (campaign.message_type === 'text') {
          payload.mensagem = campaign.message_content || '';
          payload.tipo_mensagem = 'text';
        } else if (campaign.message_type === 'template') {
          payload.template_name = campaign.template_name;
          payload.template_language = campaign.template_language;
          payload.template_components = campaign.template_components;
          payload.tipo_mensagem = 'template';
          payload.mensagem = `[Template: ${campaign.template_name}]`;
        } else if (campaign.message_type === 'image' || campaign.message_type === 'video') {
          payload.mensagem = campaign.message_content || '';
          payload.caption = campaign.message_content || '';
          payload.tipo_mensagem = campaign.message_type;
          if (campaign.media_storage_url) {
            payload.mediaUrl = campaign.media_storage_url;
          }
        }

        const { error: sendError } = await supabase.functions.invoke('enviar-whatsapp', {
          body: payload,
        });

        if (sendError) {
          throw new Error(sendError.message || 'Erro no envio');
        }

        sentCount++;

        // Save to conversas
        let mensagemConteudo = campaign.message_content || '';
        if (campaign.message_type === 'template') {
          mensagemConteudo = `[Template: ${campaign.template_name}]`;
        } else if (campaign.message_type === 'image' && !mensagemConteudo) {
          mensagemConteudo = '[Imagem]';
        } else if (campaign.message_type === 'video' && !mensagemConteudo) {
          mensagemConteudo = '[Vídeo]';
        }

        const conversaData: any = {
          numero: formattedPhone,
          telefone_formatado: formattedPhone,
          mensagem: mensagemConteudo,
          origem: 'WhatsApp',
          status: 'Enviada',
          tipo_mensagem: campaign.message_type,
          nome_contato: lead.name || 'Lead',
          company_id: campaign.company_id,
          lead_id: lead.id,
          campanha_nome: campaign.campaign_name,
          campanha_id: campaign_id,
          fromme: true,
          delivered: true,
          is_group: false,
        };

        if (campaign.media_storage_url && campaign.message_type !== 'text') {
          conversaData.midia_url = campaign.media_storage_url;
        }

        await supabase.from('conversas').insert([conversaData]);

      } catch (error: any) {
        console.error(`❌ Erro ao enviar para ${lead.name}:`, error.message);
        errorCount++;
        errorDetails.push({ lead_id: lead.id, name: lead.name, error: error.message });
      }

      // Update progress
      await updateProgress(supabase, campaign_id, sentCount, errorCount, errorDetails);

      // Delay between messages (only if not last in batch)
      if (i < endIndex - 1) {
        await sleep((campaign.delay_between_messages || DEFAULT_DELAY_SECONDS) * 1000);
      }
    }

    const totalProcessed = sentCount + errorCount;
    const hasMore = totalProcessed < leads.length;

    if (hasMore) {
      // Check for pause logic
      const pauseAfter = campaign.pause_after_messages || 15;
      const pauseDur = campaign.pause_duration || 120;

      if (pauseAfter > 0 && totalProcessed % pauseAfter === 0 && totalProcessed > 0) {
        console.log(`⏸️ Pausa automática: ${pauseDur}s após ${totalProcessed} mensagens`);
        await supabase.from('disparo_campaigns').update({
          sent_count: sentCount,
          error_count: errorCount,
          error_details: errorDetails,
          is_paused: true,
          updated_at: new Date().toISOString(),
        }).eq('id', campaign_id);

        await sleep(pauseDur * 1000);

        await supabase.from('disparo_campaigns').update({
          is_paused: false,
          updated_at: new Date().toISOString(),
        }).eq('id', campaign_id);
      }

      // Self-invoke for next batch (fire-and-forget)
      const selfUrl = `${supabaseUrl}/functions/v1/disparo-em-massa`;
      console.log(`🔄 Invocando próximo lote a partir do index ${totalProcessed}...`);

      scheduleNextBatch(selfUrl, supabaseServiceKey, campaign_id);

    } else {
      // All done - mark completed
      await supabase.from('disparo_campaigns').update({
        status: 'completed',
        sent_count: sentCount,
        error_count: errorCount,
        error_details: errorDetails,
        is_paused: false,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaign_id);

      console.log(`✅ Disparo concluído: ${sentCount} enviados, ${errorCount} erros`);
    }

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      errors: errorCount,
      hasMore,
      totalProcessed,
      total: leads.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Erro no disparo em massa:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function updateProgress(
  supabase: any,
  campaignId: string,
  sentCount: number,
  errorCount: number,
  errorDetails: any[],
) {
  await supabase.from('disparo_campaigns').update({
    sent_count: sentCount,
    error_count: errorCount,
    error_details: errorDetails,
    status: 'sending',
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId);
}
