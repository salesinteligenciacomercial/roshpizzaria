import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversionEvent {
  event_name: string;
  event_time?: number;
  action_source: 'website' | 'app' | 'physical_store' | 'chat' | 'other';
  event_source_url?: string;
  user_data: {
    email?: string;
    phone?: string;
    fn?: string; // first name
    ln?: string; // last name
    external_id?: string;
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string; // Facebook click ID
    fbp?: string; // Facebook browser ID
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_name?: string;
    content_category?: string;
    content_ids?: string[];
    content_type?: string;
    order_id?: string;
    predicted_ltv?: number;
    num_items?: number;
    search_string?: string;
    status?: string;
    delivery_category?: string;
  };
  // UTM params
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

interface WebhookPayload {
  company_slug?: string;
  company_id?: string;
  pixel_id?: string;
  event: ConversionEvent;
  test_event_code?: string;
}

// Hash function for user data (Meta requires SHA256 hashing)
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
      const body: WebhookPayload = await req.json();
      console.log('[meta-conversions-api] Received event:', JSON.stringify(body, null, 2));

      const { company_slug, company_id, event, test_event_code } = body;

      // Find company
      let resolvedCompanyId = company_id;
      if (!resolvedCompanyId && company_slug) {
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('domain', company_slug)
          .single();
        resolvedCompanyId = company?.id;
      }

      if (!resolvedCompanyId) {
        return new Response(JSON.stringify({ error: 'Company not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get Meta configuration
      const { data: tenantIntegration } = await supabase
        .from('tenant_integrations')
        .select('meta_access_token, pixel_id')
        .eq('company_id', resolvedCompanyId)
        .single();

      const accessToken = tenantIntegration?.meta_access_token;
      const pixelId = body.pixel_id || tenantIntegration?.pixel_id;

      if (!accessToken || !pixelId) {
        console.error('[meta-conversions-api] Missing configuration:', { hasToken: !!accessToken, pixelId });
        return new Response(JSON.stringify({ error: 'Meta configuration not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Prepare user data with hashing
      const hashedUserData: any = {};

      if (event.user_data.email) {
        hashedUserData.em = [await hashData(event.user_data.email)];
      }
      if (event.user_data.phone) {
        const cleanPhone = event.user_data.phone.replace(/[^0-9]/g, '');
        hashedUserData.ph = [await hashData(cleanPhone)];
      }
      if (event.user_data.fn) {
        hashedUserData.fn = [await hashData(event.user_data.fn)];
      }
      if (event.user_data.ln) {
        hashedUserData.ln = [await hashData(event.user_data.ln)];
      }
      if (event.user_data.external_id) {
        hashedUserData.external_id = [await hashData(event.user_data.external_id)];
      }
      if (event.user_data.client_ip_address) {
        hashedUserData.client_ip_address = event.user_data.client_ip_address;
      }
      if (event.user_data.client_user_agent) {
        hashedUserData.client_user_agent = event.user_data.client_user_agent;
      }
      if (event.user_data.fbc) {
        hashedUserData.fbc = event.user_data.fbc;
      }
      if (event.user_data.fbp) {
        hashedUserData.fbp = event.user_data.fbp;
      }

      // Prepare Meta Conversions API payload
      const metaPayload = {
        data: [{
          event_name: event.event_name,
          event_time: event.event_time || Math.floor(Date.now() / 1000),
          action_source: event.action_source || 'website',
          event_source_url: event.event_source_url,
          user_data: hashedUserData,
          custom_data: event.custom_data,
        }],
        ...(test_event_code && { test_event_code })
      };

      console.log('[meta-conversions-api] Sending to Meta:', JSON.stringify(metaPayload, null, 2));

      // Send to Meta Conversions API
      const metaResponse = await fetch(
        `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metaPayload)
        }
      );

      const metaResult = await metaResponse.json();
      console.log('[meta-conversions-api] Meta response:', metaResult);

      // Now create/update lead in CRM
      const normalizedPhone = event.user_data.phone?.replace(/[^0-9]/g, '') || '';
      const email = event.user_data.email || '';

      // Build auto tags
      const autoTags = ['Pixel', 'Site', event.event_name];
      if (event.utm_campaign) {
        autoTags.push(event.utm_campaign);
      }

      // Extract click ID info for attribution
      let campaignId = null;
      let adId = null;
      if (event.user_data.fbc) {
        // fbc format: fb.1.timestamp.campaign_id
        const fbcParts = event.user_data.fbc.split('.');
        if (fbcParts.length >= 4) {
          campaignId = fbcParts[3];
        }
      }

      // Check existing lead
      const leadQuery = [];
      if (email) leadQuery.push(`email.eq.${email}`);
      if (normalizedPhone) leadQuery.push(`telefone.eq.${normalizedPhone}`);
      if (normalizedPhone) leadQuery.push(`phone.eq.${normalizedPhone}`);

      let leadId = null;

      if (leadQuery.length > 0) {
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id, tags')
          .eq('company_id', resolvedCompanyId)
          .or(leadQuery.join(','))
          .limit(1)
          .single();

        if (existingLead) {
          // Update existing lead with conversion data
          const existingTags = existingLead.tags || [];
          const mergedTags = [...new Set([...existingTags, ...autoTags])];

          await supabase
            .from('leads')
            .update({
              tags: mergedTags,
              lead_source_type: 'pixel',
              utm_source: event.utm_source || 'facebook',
              utm_medium: event.utm_medium || 'pixel',
              utm_campaign: event.utm_campaign,
              utm_content: event.utm_content,
              utm_term: event.utm_term,
              campaign_id: campaignId,
              conversion_timestamp: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingLead.id);

          leadId = existingLead.id;
          console.log('[meta-conversions-api] Updated lead:', leadId);
        } else if (event.event_name === 'Lead' || event.event_name === 'CompleteRegistration') {
          // Create new lead only for lead-type events
          const leadName = [event.user_data.fn, event.user_data.ln].filter(Boolean).join(' ') || 'Lead do Site';

          const { data: newLead } = await supabase
            .from('leads')
            .insert({
              name: leadName,
              email: email || null,
              telefone: normalizedPhone || null,
              phone: normalizedPhone || null,
              company_id: resolvedCompanyId,
              tags: autoTags,
              source: 'Site',
              status: 'novo',
              lead_source_type: 'pixel',
              utm_source: event.utm_source || 'facebook',
              utm_medium: event.utm_medium || 'pixel',
              utm_campaign: event.utm_campaign,
              utm_content: event.utm_content,
              utm_term: event.utm_term,
              campaign_id: campaignId,
              conversion_timestamp: new Date().toISOString(),
              notes: `📊 Lead capturado via Pixel\n🎯 Evento: ${event.event_name}\n📅 ${new Date().toLocaleString('pt-BR')}`
            })
            .select('id')
            .single();

          leadId = newLead?.id;
          console.log('[meta-conversions-api] Created lead:', leadId);
        }
      }

      // Log conversion event
      try {
        await supabase
          .from('pixel_events')
          .insert({
            company_id: resolvedCompanyId,
            event_name: event.event_name,
            event_time: new Date((event.event_time || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
            lead_id: leadId,
            user_email: email || null,
            user_phone: normalizedPhone || null,
            fbc: event.user_data.fbc,
            fbp: event.user_data.fbp,
            utm_source: event.utm_source,
            utm_medium: event.utm_medium,
            utm_campaign: event.utm_campaign,
            utm_content: event.utm_content,
            utm_term: event.utm_term,
            event_source_url: event.event_source_url,
            custom_data: event.custom_data,
            meta_response: metaResult
          });
      } catch (logError) {
        console.log('[meta-conversions-api] Pixel events logging failed:', logError);
      }

      return new Response(JSON.stringify({
        success: metaResponse.ok,
        meta_response: metaResult,
        lead_id: leadId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET - Return integration status and snippet
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const companyId = url.searchParams.get('company_id');

      if (!companyId) {
        return new Response(JSON.stringify({ error: 'company_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: config } = await supabase
        .from('tenant_integrations')
        .select('pixel_id, meta_access_token')
        .eq('company_id', companyId)
        .single();

      const { data: company } = await supabase
        .from('companies')
        .select('domain')
        .eq('id', companyId)
        .single();

      const webhookUrl = `${supabaseUrl}/functions/v1/meta-conversions-api`;

      // JavaScript snippet for website
      const jsSnippet = `
<!-- Meta Pixel Code with Server-Side Tracking -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${config?.pixel_id || 'YOUR_PIXEL_ID'}');
fbq('track', 'PageView');

// Server-side event helper
window.trackServerEvent = async function(eventName, userData, customData) {
  try {
    await fetch('${webhookUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: '${companyId}',
        event: {
          event_name: eventName,
          action_source: 'website',
          event_source_url: window.location.href,
          user_data: {
            ...userData,
            client_user_agent: navigator.userAgent,
            fbc: document.cookie.match(/_fbc=([^;]+)/)?.[1],
            fbp: document.cookie.match(/_fbp=([^;]+)/)?.[1]
          },
          custom_data: customData,
          utm_source: new URLSearchParams(window.location.search).get('utm_source'),
          utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
          utm_content: new URLSearchParams(window.location.search).get('utm_content'),
          utm_term: new URLSearchParams(window.location.search).get('utm_term')
        }
      })
    });
  } catch (e) { console.error('Server event failed:', e); }
};

// Example: Track lead form submission
// trackServerEvent('Lead', { email: 'user@email.com', phone: '11999999999', fn: 'Nome' });
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${config?.pixel_id || 'YOUR_PIXEL_ID'}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->
`;

      return new Response(JSON.stringify({
        configured: !!(config?.pixel_id && config?.meta_access_token),
        pixel_id: config?.pixel_id,
        webhook_url: webhookUrl,
        company_slug: company?.domain,
        js_snippet: jsSnippet
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('[meta-conversions-api] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
