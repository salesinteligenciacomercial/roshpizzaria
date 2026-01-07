import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadgenEntry {
  id: string;
  changes: Array<{
    field: string;
    value: {
      leadgen_id: string;
      form_id: string;
      page_id: string;
      created_time: number;
      ad_id?: string;
      adset_id?: string;
      campaign_id?: string;
    };
  }>;
}

interface LeadFormData {
  name: string;
  values: string[];
}

interface GraphLeadData {
  id: string;
  created_time: string;
  field_data: LeadFormData[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    // Webhook verification (GET request from Meta)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('[webhook-leadgen] Verification request:', { mode, token: token?.substring(0, 10) + '...' });

      const verifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('[webhook-leadgen] Verification successful');
        return new Response(challenge, { status: 200 });
      } else {
        console.error('[webhook-leadgen] Verification failed - token mismatch');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // Handle POST (lead events)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[webhook-leadgen] Received event:', JSON.stringify(body, null, 2));

      // Validate it's a page object with leadgen field
      if (body.object !== 'page') {
        console.log('[webhook-leadgen] Not a page object, ignoring');
        return new Response(JSON.stringify({ status: 'ignored' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const entries: LeadgenEntry[] = body.entry || [];
      const results: any[] = [];

      for (const entry of entries) {
        const pageId = entry.id;

        for (const change of entry.changes) {
          if (change.field !== 'leadgen') {
            console.log('[webhook-leadgen] Not a leadgen field, skipping:', change.field);
            continue;
          }

          const leadgenData = change.value;
          console.log('[webhook-leadgen] Processing lead:', leadgenData);

          try {
            // Find company by page_id from whatsapp_config or meta_integrations
            const { data: metaConfig } = await supabase
              .from('whatsapp_config')
              .select('company_id')
              .or(`meta_page_id.eq.${pageId},instagram_account_id.eq.${pageId}`)
              .limit(1)
              .single();

            let companyId = metaConfig?.company_id;

            // If not found, try to get from lead_ad_forms
            if (!companyId) {
              const { data: formConfig } = await supabase
                .from('lead_ad_forms')
                .select('company_id')
                .eq('page_id', pageId)
                .limit(1)
                .single();

              companyId = formConfig?.company_id;
            }

            if (!companyId) {
              console.error('[webhook-leadgen] No company found for page_id:', pageId);
              results.push({ leadgen_id: leadgenData.leadgen_id, status: 'error', error: 'company_not_found' });
              continue;
            }

            // Get form configuration
            const { data: formConfig } = await supabase
              .from('lead_ad_forms')
              .select('*')
              .eq('form_id', leadgenData.form_id)
              .eq('company_id', companyId)
              .single();

            // Get access token for fetching lead data
            const { data: whatsappConfig } = await supabase
              .from('whatsapp_config')
              .select('meta_access_token')
              .eq('company_id', companyId)
              .single();

            const accessToken = whatsappConfig?.meta_access_token;

            if (!accessToken) {
              console.error('[webhook-leadgen] No access token for company:', companyId);
              results.push({ leadgen_id: leadgenData.leadgen_id, status: 'error', error: 'no_access_token' });
              continue;
            }

            // Fetch full lead data from Meta Graph API
            const leadUrl = `https://graph.facebook.com/v18.0/${leadgenData.leadgen_id}?access_token=${accessToken}`;
            console.log('[webhook-leadgen] Fetching lead data from:', leadUrl.substring(0, 80) + '...');

            const leadResponse = await fetch(leadUrl);
            const leadData: GraphLeadData = await leadResponse.json();

            if (!leadResponse.ok) {
              console.error('[webhook-leadgen] Error fetching lead:', leadData);
              results.push({ leadgen_id: leadgenData.leadgen_id, status: 'error', error: 'fetch_lead_failed' });
              continue;
            }

            console.log('[webhook-leadgen] Lead data received:', JSON.stringify(leadData, null, 2));

            // Parse lead fields
            const fieldData = leadData.field_data || [];
            const getFieldValue = (name: string): string => {
              const field = fieldData.find(f => 
                f.name.toLowerCase().includes(name.toLowerCase()) ||
                f.name.toLowerCase() === name.toLowerCase()
              );
              return field?.values?.[0] || '';
            };

            const leadName = getFieldValue('full_name') || getFieldValue('nome') || getFieldValue('name') || 'Lead Ads';
            const leadEmail = getFieldValue('email');
            const leadPhone = getFieldValue('phone_number') || getFieldValue('telefone') || getFieldValue('phone');

            // Normalize phone
            const normalizedPhone = leadPhone.replace(/[^0-9]/g, '');

            // Check if lead already exists
            const { data: existingLead } = await supabase
              .from('leads')
              .select('id, tags')
              .eq('company_id', companyId)
              .or(`email.eq.${leadEmail},telefone.eq.${normalizedPhone},phone.eq.${normalizedPhone}`)
              .limit(1)
              .single();

            // Build auto tags
            const autoTags = ['Lead Ads', 'Facebook'];
            if (formConfig?.auto_tags) {
              autoTags.push(...formConfig.auto_tags);
            }

            // Get campaign info if available
            let campaignName = '';
            if (leadgenData.campaign_id && accessToken) {
              try {
                const campaignUrl = `https://graph.facebook.com/v18.0/${leadgenData.campaign_id}?fields=name&access_token=${accessToken}`;
                const campaignResponse = await fetch(campaignUrl);
                const campaignData = await campaignResponse.json();
                if (campaignData.name) {
                  campaignName = campaignData.name;
                  autoTags.push(campaignName);
                }
              } catch (e) {
                console.log('[webhook-leadgen] Could not fetch campaign name:', e);
              }
            }

            // Collect all custom field data as notes
            const customFields = fieldData
              .filter(f => !['full_name', 'nome', 'name', 'email', 'phone_number', 'telefone', 'phone'].some(n => f.name.toLowerCase().includes(n)))
              .map(f => `${f.name}: ${f.values.join(', ')}`)
              .join('\n');

            const leadNotes = [
              `📣 Lead capturado via Lead Ads`,
              `📅 Data: ${new Date().toLocaleString('pt-BR')}`,
              campaignName ? `🎯 Campanha: ${campaignName}` : '',
              customFields ? `\n📝 Dados do formulário:\n${customFields}` : ''
            ].filter(Boolean).join('\n');

            let leadId: string;

            if (existingLead) {
              // Update existing lead
              const existingTags = existingLead.tags || [];
              const mergedTags = [...new Set([...existingTags, ...autoTags])];

              const { error: updateError } = await supabase
                .from('leads')
                .update({
                  tags: mergedTags,
                  notes: leadNotes,
                  lead_source_type: 'lead_ads',
                  ad_id: leadgenData.ad_id || null,
                  adset_id: leadgenData.adset_id || null,
                  campaign_id: leadgenData.campaign_id || null,
                  form_id: leadgenData.form_id,
                  utm_source: 'facebook',
                  utm_medium: 'lead_ads',
                  utm_campaign: campaignName || null,
                  conversion_timestamp: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingLead.id);

              if (updateError) {
                console.error('[webhook-leadgen] Error updating lead:', updateError);
                results.push({ leadgen_id: leadgenData.leadgen_id, status: 'error', error: 'update_failed' });
                continue;
              }

              leadId = existingLead.id;
              console.log('[webhook-leadgen] Updated existing lead:', leadId);
            } else {
              // Create new lead
              const newLead = {
                name: leadName,
                email: leadEmail || null,
                telefone: normalizedPhone || null,
                phone: normalizedPhone || null,
                company_id: companyId,
                tags: autoTags,
                notes: leadNotes,
                source: 'Lead Ads',
                status: 'novo',
                lead_source_type: 'lead_ads',
                ad_id: leadgenData.ad_id || null,
                adset_id: leadgenData.adset_id || null,
                campaign_id: leadgenData.campaign_id || null,
                form_id: leadgenData.form_id,
                utm_source: 'facebook',
                utm_medium: 'lead_ads',
                utm_campaign: campaignName || null,
                conversion_timestamp: new Date().toISOString(),
                funil_id: formConfig?.auto_funil_id || null,
                etapa_id: formConfig?.auto_etapa_id || null,
                responsavel_id: formConfig?.auto_responsavel_id || null
              };

              const { data: createdLead, error: createError } = await supabase
                .from('leads')
                .insert(newLead)
                .select('id')
                .single();

              if (createError) {
                console.error('[webhook-leadgen] Error creating lead:', createError);
                results.push({ leadgen_id: leadgenData.leadgen_id, status: 'error', error: 'create_failed' });
                continue;
              }

              leadId = createdLead.id;
              console.log('[webhook-leadgen] Created new lead:', leadId);
            }

            // Trigger AI qualification if enabled
            if (formConfig?.auto_qualify_with_ia) {
              try {
                console.log('[webhook-leadgen] Triggering AI qualification for lead:', leadId);

                const qualificationPrompt = formConfig.qualification_prompt || 
                  `Analise este lead de campanha de tráfego pago e classifique sua qualidade:
                  - Nome: ${leadName}
                  - Email: ${leadEmail || 'Não informado'}
                  - Telefone: ${leadPhone || 'Não informado'}
                  - Campanha: ${campaignName || 'Não identificada'}
                  - Dados adicionais: ${customFields || 'Nenhum'}
                  
                  Classifique como: Quente, Morno ou Frio
                  Sugira próximos passos para abordagem.`;

                // Call ia-atendimento for qualification
                const iaResponse = await supabase.functions.invoke('ia-tools', {
                  body: {
                    action: 'qualificar_lead',
                    lead_id: leadId,
                    company_id: companyId,
                    prompt: qualificationPrompt
                  }
                });

                console.log('[webhook-leadgen] AI qualification response:', iaResponse);
              } catch (iaError) {
                console.error('[webhook-leadgen] AI qualification error:', iaError);
                // Don't fail the whole process if AI fails
              }
            }

            // Send WhatsApp notification if enabled
            if (formConfig?.notify_whatsapp && formConfig?.notify_phone) {
              try {
                console.log('[webhook-leadgen] Sending WhatsApp notification');

                const notificationMessage = `🎉 *Novo Lead Capturado!*\n\n` +
                  `📛 Nome: ${leadName}\n` +
                  `📧 Email: ${leadEmail || 'Não informado'}\n` +
                  `📱 Telefone: ${leadPhone || 'Não informado'}\n` +
                  `🎯 Campanha: ${campaignName || 'Lead Ads'}\n` +
                  `📅 ${new Date().toLocaleString('pt-BR')}`;

                await supabase.functions.invoke('enviar-whatsapp-meta', {
                  body: {
                    to: formConfig.notify_phone,
                    message: notificationMessage,
                    company_id: companyId
                  }
                });
              } catch (notifyError) {
                console.error('[webhook-leadgen] Notification error:', notifyError);
              }
            }

            results.push({ leadgen_id: leadgenData.leadgen_id, lead_id: leadId, status: 'success' });

          } catch (leadError) {
            console.error('[webhook-leadgen] Error processing lead:', leadError);
            results.push({ leadgen_id: leadgenData.leadgen_id, status: 'error', error: String(leadError) });
          }
        }
      }

      console.log('[webhook-leadgen] Processing complete:', results);

      return new Response(JSON.stringify({ status: 'received', results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('[webhook-leadgen] Fatal error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
