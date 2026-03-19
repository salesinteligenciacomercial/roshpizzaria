import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (!cleaned.startsWith('55') && cleaned.length >= 10) {
    cleaned = `55${cleaned}`;
  }
  return cleaned;
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

    // Fetch campaign data
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

    // Mark as sending
    await supabase.from('disparo_campaigns').update({
      status: 'sending',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', campaign_id);

    console.log(`🚀 Iniciando disparo: ${campaign.campaign_name} (${campaign.total_leads} leads)`);

    const leads = campaign.leads_data as any[];
    let sentCount = campaign.sent_count || 0;
    let errorCount = campaign.error_count || 0;
    const errorDetails: any[] = campaign.error_details || [];
    const startIndex = sentCount; // Resume from where we left off

    for (let i = startIndex; i < leads.length; i++) {
      // Check if campaign was cancelled
      if (i > startIndex && i % 5 === 0) {
        const { data: check } = await supabase
          .from('disparo_campaigns')
          .select('status')
          .eq('id', campaign_id)
          .single();
        if (check?.status === 'cancelled') {
          console.log('🛑 Campanha cancelada pelo usuário');
          break;
        }
      }

      const lead = leads[i];
      const phone = lead.telefone || lead.phone;

      if (!phone) {
        errorCount++;
        errorDetails.push({ lead_id: lead.id, name: lead.name, error: 'Sem telefone' });
        await updateProgress(supabase, campaign_id, sentCount, errorCount, errorDetails, false);
        continue;
      }

      const formattedPhone = formatPhoneNumber(phone);
      if (formattedPhone.length < 12) {
        errorCount++;
        errorDetails.push({ lead_id: lead.id, name: lead.name, error: 'Telefone inválido' });
        await updateProgress(supabase, campaign_id, sentCount, errorCount, errorDetails, false);
        continue;
      }

      try {
        // Build payload for enviar-whatsapp
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

        // Call enviar-whatsapp edge function
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('enviar-whatsapp', {
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

      // Update progress every message
      await updateProgress(supabase, campaign_id, sentCount, errorCount, errorDetails, false);

      // Pause logic
      const pauseAfter = campaign.pause_after_messages || 15;
      const pauseDur = campaign.pause_duration || 120;
      const processed = i - startIndex + 1;

      if (pauseAfter > 0 && processed % pauseAfter === 0 && i < leads.length - 1) {
        console.log(`⏸️ Pausa automática: ${pauseDur}s após ${processed} mensagens`);
        await updateProgress(supabase, campaign_id, sentCount, errorCount, errorDetails, true);
        await sleep(pauseDur * 1000);
        await updateProgress(supabase, campaign_id, sentCount, errorCount, errorDetails, false);
      }

      // Delay between messages
      if (i < leads.length - 1) {
        await sleep((campaign.delay_between_messages || 7) * 1000);
      }
    }

    // Mark as completed
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

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      errors: errorCount,
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
  isPaused: boolean
) {
  await supabase.from('disparo_campaigns').update({
    sent_count: sentCount,
    error_count: errorCount,
    error_details: errorDetails,
    is_paused: isPaused,
    status: 'sending',
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
