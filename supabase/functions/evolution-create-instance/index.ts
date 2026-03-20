import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') ?? '';
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? '';

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action, instanceName, companyId } = body;

    console.log('📱 [EVOLUTION-CREATE] Action:', action, 'Instance:', instanceName);

    // Clean base URL
    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, '');

    // ============ ACTION: create ============
    if (action === 'create') {
      if (!instanceName || !companyId) {
        return new Response(JSON.stringify({ error: 'instanceName e companyId são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 1. Create instance on Evolution API
      console.log('🔧 [EVOLUTION] Criando instância:', instanceName);
      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });

      const createData = await createRes.json();
      console.log('📡 [EVOLUTION] Resposta create:', JSON.stringify(createData));

      if (!createRes.ok) {
        // If instance already exists, try to connect instead
        if (createData?.response?.message?.includes?.('already') || createRes.status === 403) {
          console.log('⚠️ [EVOLUTION] Instância já existe, tentando conectar...');
          // Fall through to connect action
        } else {
          return new Response(JSON.stringify({ error: 'Erro ao criar instância na Evolution API', details: createData }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 2. Configure webhook automatically
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const webhookUrl = `${supabaseUrl}/functions/v1/webhook-conversas?instance=${instanceName}`;
      console.log('🔗 [EVOLUTION] Configurando webhook:', webhookUrl);

      try {
        const webhookRes = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
          body: JSON.stringify({
            webhook: {
              url: webhookUrl,
              webhookByEvents: false,
              webhookBase64: true,
              events: [
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'CONNECTION_UPDATE',
                'CONTACTS_UPSERT',
              ],
              enabled: true,
            }
          }),
        });
        const webhookData = await webhookRes.json();
        console.log('✅ [EVOLUTION] Webhook configurado:', JSON.stringify(webhookData));
      } catch (whErr) {
        console.error('⚠️ [EVOLUTION] Erro ao configurar webhook (não crítico):', whErr);
      }

      // 3. Extract QR code
      let qrCodeBase64 = createData?.qrcode?.base64 || null;
      let pairingCode = createData?.qrcode?.pairingCode || null;

      // If no QR from create, try connect endpoint
      if (!qrCodeBase64) {
        console.log('🔄 [EVOLUTION] Buscando QR via connect endpoint...');
        try {
          const connectRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
          });
          const connectData = await connectRes.json();
          console.log('📡 [EVOLUTION] Resposta connect:', JSON.stringify(connectData));
          qrCodeBase64 = connectData?.base64 || connectData?.qrcode?.base64 || null;
          pairingCode = connectData?.pairingCode || connectData?.qrcode?.pairingCode || null;
        } catch (err) {
          console.error('❌ [EVOLUTION] Erro ao buscar QR via connect:', err);
        }
      }

      // 4. Save connection in database (upsert to handle existing instances)
      const { data: conn, error: dbError } = await supabase
        .from('whatsapp_connections')
        .upsert({
          company_id: companyId,
          instance_name: instanceName,
          evolution_api_url: baseUrl,
          evolution_api_key: EVOLUTION_API_KEY,
          status: 'connecting',
          qr_code_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        }, { onConflict: 'instance_name' })
        .select()
        .single();

      if (dbError) {
        console.error('❌ [DB] Erro ao salvar conexão:', dbError);
        return new Response(JSON.stringify({ error: 'Erro ao salvar conexão no banco', details: dbError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        connection: conn,
        qrcode: qrCodeBase64,
        pairingCode,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ ACTION: refresh_qr ============
    if (action === 'refresh_qr') {
      if (!instanceName) {
        return new Response(JSON.stringify({ error: 'instanceName é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ⚡ CORREÇÃO: Buscar URL e API key específicas da instância no banco
      const { data: connData } = await supabase
        .from('whatsapp_connections')
        .select('evolution_api_url, evolution_api_key')
        .eq('instance_name', instanceName)
        .single();

      const instanceBaseUrl = connData?.evolution_api_url?.replace(/\/+$/, '') || baseUrl;
      const instanceApiKey = connData?.evolution_api_key || EVOLUTION_API_KEY;

      console.log('🔄 [EVOLUTION] Refresh QR para:', instanceName, '| URL:', instanceBaseUrl);
      const connectRes = await fetch(`${instanceBaseUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'apikey': instanceApiKey },
      });
      const connectData = await connectRes.json();
      console.log('📡 [EVOLUTION] Resposta refresh:', JSON.stringify(connectData));

      const qrCodeBase64 = connectData?.base64 || connectData?.qrcode?.base64 || null;
      const pairingCode = connectData?.pairingCode || connectData?.qrcode?.pairingCode || null;

      return new Response(JSON.stringify({
        success: true,
        qrcode: qrCodeBase64,
        pairingCode,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ ACTION: check_status ============
    if (action === 'check_status') {
      if (!instanceName && !companyId) {
        return new Response(JSON.stringify({ error: 'instanceName ou companyId é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Buscar conexão no banco com api_provider
      const connQuery = instanceName
        ? supabase.from('whatsapp_connections').select('*').eq('instance_name', instanceName).single()
        : supabase.from('whatsapp_connections').select('*').eq('company_id', companyId).single();
      
      const { data: connData } = await connQuery;

      const apiProvider = connData?.api_provider || 'evolution';

      // ============ META API CHECK ============
      if (apiProvider === 'meta' || apiProvider === 'both') {
        const metaToken = connData?.meta_access_token;
        const metaPhoneId = connData?.meta_phone_number_id;

        if (!metaToken || !metaPhoneId) {
          // Meta not configured - if 'both', fall through to Evolution check
          if (apiProvider === 'meta') {
            return new Response(JSON.stringify({
              success: true,
              state: 'disconnected',
              isConnected: false,
              provider: 'meta',
              reason: 'Meta API não configurada (falta token ou phone_number_id)',
            }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          // For 'both', continue to Evolution check below
        } else {
          // Validate Meta token by calling the phone number endpoint
          console.log('🔍 [META] Verificando status da conexão Meta API...');
          try {
            const metaRes = await fetch(
              `https://graph.facebook.com/v18.0/${metaPhoneId}?fields=verified_name,quality_rating,display_phone_number&access_token=${metaToken}`
            );
            const metaData = await metaRes.json();
            
            if (metaRes.ok && metaData.verified_name) {
              console.log('✅ [META] Conexão Meta OK:', metaData.verified_name);
              
              // Update DB status
              await supabase
                .from('whatsapp_connections')
                .update({
                  status: 'connected',
                  last_connected_at: new Date().toISOString(),
                })
                .eq('id', connData.id);

              return new Response(JSON.stringify({
                success: true,
                state: 'connected',
                isConnected: true,
                provider: 'meta',
                verified_name: metaData.verified_name,
                quality_rating: metaData.quality_rating,
                display_phone_number: metaData.display_phone_number,
              }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            } else {
              console.warn('⚠️ [META] Token inválido ou expirado:', JSON.stringify(metaData));
              
              // If meta-only, mark disconnected
              if (apiProvider === 'meta') {
                await supabase
                  .from('whatsapp_connections')
                  .update({ status: 'disconnected' })
                  .eq('id', connData.id);

                return new Response(JSON.stringify({
                  success: true,
                  state: 'disconnected',
                  isConnected: false,
                  provider: 'meta',
                  reason: metaData?.error?.message || 'Token Meta inválido ou expirado',
                }), {
                  status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
              // For 'both', fall through to Evolution
            }
          } catch (metaErr) {
            console.error('❌ [META] Erro ao verificar:', metaErr);
            if (apiProvider === 'meta') {
              return new Response(JSON.stringify({
                success: true,
                state: 'error',
                isConnected: false,
                provider: 'meta',
                reason: String(metaErr),
              }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
        }
      }

      // ============ EVOLUTION API CHECK ============
      if (apiProvider === 'evolution' || apiProvider === 'both') {
        if (!instanceName && !connData?.instance_name) {
          return new Response(JSON.stringify({ error: 'instanceName é obrigatório para Evolution API' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const instName = instanceName || connData.instance_name;
        const instanceBaseUrl = connData?.evolution_api_url?.replace(/\/+$/, '') || baseUrl;
        const instanceApiKey = connData?.evolution_api_key || EVOLUTION_API_KEY;

        console.log('🔍 [EVOLUTION] Verificando status:', instName, '| URL:', instanceBaseUrl);
        const stateRes = await fetch(`${instanceBaseUrl}/instance/connectionState/${instName}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'apikey': instanceApiKey },
        });
        const stateData = await stateRes.json();
        console.log('📡 [EVOLUTION] Estado:', JSON.stringify(stateData));

        const state = stateData?.instance?.state || stateData?.state || 'unknown';
        const isConnected = state === 'open' || state === 'connected';

        // If connected, update DB AND re-verify webhook configuration
        if (isConnected) {
          await supabase
            .from('whatsapp_connections')
            .update({
              status: 'connected',
              last_connected_at: new Date().toISOString(),
            })
            .eq('id', connData.id);
          
          // Re-configure webhook
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          const webhookUrl = `${supabaseUrl}/functions/v1/webhook-conversas?instance=${instName}`;
          
          console.log('🔗 [EVOLUTION] Re-verificando webhook após conexão:', webhookUrl);
          
          try {
            const webhookRes = await fetch(`${instanceBaseUrl}/webhook/set/${instName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': instanceApiKey },
              body: JSON.stringify({
                webhook: {
                  url: webhookUrl,
                  webhookByEvents: false,
                  webhookBase64: true,
                  events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'CONTACTS_UPSERT'],
                  enabled: true,
                }
              }),
            });
            const webhookData = await webhookRes.json();
            console.log('✅ [EVOLUTION] Webhook re-configurado:', JSON.stringify(webhookData));
          } catch (whErr) {
            console.error('⚠️ [EVOLUTION] Erro ao re-configurar webhook:', whErr);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          state,
          isConnected,
          provider: 'evolution',
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        state: 'unknown',
        isConnected: false,
        reason: 'Nenhum provedor configurado',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida. Use: create, refresh_qr, check_status' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [EVOLUTION-CREATE] Erro geral:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
