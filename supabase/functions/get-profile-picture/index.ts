import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { number, company_id } = await req.json();

    console.log('📥 [PROFILE-PICTURE] Requisição recebida:', { number, company_id: company_id || 'NÃO FORNECIDO' });

    if (!number) {
      console.error('❌ Número não fornecido');
      return new Response(
        JSON.stringify({ error: 'Número é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const globalApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const defaultInstance = Deno.env.get('EVOLUTION_INSTANCE');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!evolutionUrl) {
      console.error('❌ EVOLUTION_API_URL não configurado');
      return new Response(
        JSON.stringify({ error: 'Configuração da API não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolver instância e API key por empresa, se fornecida
    let instanceName: string | null = defaultInstance || null;
    let instanceApiKey: string | null = globalApiKey || null;
    let instanceApiUrl: string | null = null;

    console.log('🔍 [PROFILE-PICTURE] Resolvendo instância...', { 
      hasCompanyId: !!company_id, 
      hasDefaultInstance: !!defaultInstance,
      hasGlobalApiKey: !!globalApiKey 
    });

    if (company_id && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: conn } = await supabase
          .from('whatsapp_connections')
          .select('instance_name, evolution_api_key, evolution_api_url')
          .eq('company_id', company_id)
          .eq('status', 'connected')
          .maybeSingle();
        
        console.log('🔍 [PROFILE-PICTURE] Conexão encontrada:', { 
          found: !!conn, 
          instanceName: conn?.instance_name,
          hasApiKey: !!conn?.evolution_api_key,
          apiUrl: conn?.evolution_api_url 
        });
        
        if (conn?.instance_name) instanceName = conn.instance_name;
        if (conn?.evolution_api_key) instanceApiKey = conn.evolution_api_key;
        if (conn?.evolution_api_url) instanceApiUrl = conn.evolution_api_url;
      } catch (e) {
        console.error('❌ [PROFILE-PICTURE] Erro ao buscar conexão por company_id:', e);
      }
    } else {
      console.log('⚠️ [PROFILE-PICTURE] Usando configuração global (company_id não fornecido ou sem env vars)');
    }

    if (!instanceName) {
      console.error('❌ EVOLUTION_INSTANCE não configurado e company_id sem instância');
      return new Response(
        JSON.stringify({ error: 'Instância não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instanceApiKey) {
      console.error('❌ Nenhuma API key disponível (instância/global)');
      return new Response(
        JSON.stringify({ error: 'API key ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Buscando foto de perfil para:', number, 'instância:', instanceName);

    // Verificar se é um grupo (termina com @g.us)
    const isGroup = /@g\.us$/.test(String(number));
    console.log('📋 Tipo de contato:', isGroup ? 'GRUPO' : 'CONTATO INDIVIDUAL');

    // Endpoint Evolution API v2
    const url = `${instanceApiUrl || evolutionUrl}/chat/fetchProfilePictureUrl/${instanceName}`;
    console.log('📡 Chamando Evolution API:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instanceApiKey,
      },
      body: JSON.stringify({ 
        // Para grupos, manter o formato completo (com @g.us)
        // Para contatos individuais, remover caracteres não numéricos
        number: isGroup ? String(number) : String(number).replace(/\D/g, '')
      }),
    });

    console.log('📥 Status da resposta:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da Evolution API:', response.status, errorText);
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ profilePictureUrl: null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao buscar foto de perfil',
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('✅ Foto de perfil obtida com sucesso');

    return new Response(
      JSON.stringify({ 
        profilePictureUrl: data.profilePictureUrl || data.url || null 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('⚠️ Erro interno:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao buscar foto de perfil',
        details: err instanceof Error ? err.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
