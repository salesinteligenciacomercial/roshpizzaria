import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Buscar foto de perfil via Evolution API
async function getEvolutionProfilePicture(
  apiUrl: string,
  instanceName: string,
  apiKey: string,
  phoneNumber: string,
  isGroup: boolean
): Promise<string | null> {
  try {
    const url = `${apiUrl}/chat/fetchProfilePictureUrl/${instanceName}`;
    console.log('📗 [EVOLUTION] Buscando foto de perfil:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({ 
        number: isGroup ? String(phoneNumber) : String(phoneNumber).replace(/\D/g, '')
      }),
    });

    if (!response.ok) {
      console.log('⚠️ [EVOLUTION] Resposta não OK:', response.status);
      return null;
    }

    const data = await response.json();
    return data.profilePictureUrl || data.url || null;
  } catch (error) {
    console.error('❌ [EVOLUTION] Erro ao buscar foto de perfil:', error);
    return null;
  }
}

Deno.serve(async (req) => {
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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const globalApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const defaultInstance = Deno.env.get('EVOLUTION_INSTANCE');

    // Verificar se é um grupo (termina com @g.us)
    const isGroup = /@g\.us$/.test(String(number));
    console.log('📋 Tipo de contato:', isGroup ? 'GRUPO' : 'CONTATO INDIVIDUAL');

    let profilePictureUrl: string | null = null;

    // Primeiro, tentar buscar foto de perfil salva no lead (capturada via webhook Meta)
    if (company_id && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && !isGroup) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const formattedNumber = String(number).replace(/\D/g, '');
      console.log('🔍 [PROFILE-PICTURE] Buscando foto de perfil no lead para:', formattedNumber);
      
      const { data: lead } = await supabase
        .from('leads')
        .select('profile_picture_url')
        .eq('company_id', company_id)
        .or(`telefone.ilike.%${formattedNumber}%,phone.ilike.%${formattedNumber}%`)
        .not('profile_picture_url', 'is', null)
        .limit(1)
        .maybeSingle();
      
      if (lead?.profile_picture_url) {
        console.log('✅ [PROFILE-PICTURE] Foto encontrada no lead (Meta webhook)');
        profilePictureUrl = lead.profile_picture_url;
      }
    }

    // Se não encontrou no lead, buscar via APIs
    if (!profilePictureUrl && company_id && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: conn } = await supabase
        .from('whatsapp_connections')
        .select('instance_name, evolution_api_key, evolution_api_url, api_provider, meta_access_token, meta_phone_number_id')
        .eq('company_id', company_id)
        .eq('status', 'connected')
        .maybeSingle();
      
      console.log('🔍 [PROFILE-PICTURE] Conexão encontrada:', { 
        found: !!conn, 
        apiProvider: conn?.api_provider,
        instanceName: conn?.instance_name,
        hasEvolutionKey: !!conn?.evolution_api_key,
        hasMetaToken: !!conn?.meta_access_token
      });

      if (conn) {
        // Tentar Evolution API se disponível
        if (conn.instance_name && conn.evolution_api_key) {
          const apiUrl = conn.evolution_api_url || evolutionUrl;
          if (apiUrl) {
            console.log('📗 Tentando Evolution API para foto de perfil...');
            profilePictureUrl = await getEvolutionProfilePicture(
              apiUrl.replace(/\/$/, ''),
              conn.instance_name,
              conn.evolution_api_key,
              String(number),
              isGroup
            );
          }
        }
      }
    }

    // Fallback para configuração global se não encontrou via company
    if (!profilePictureUrl && evolutionUrl && globalApiKey && defaultInstance) {
      console.log('📗 Usando Evolution global como fallback...');
      profilePictureUrl = await getEvolutionProfilePicture(
        evolutionUrl.replace(/\/$/, ''),
        defaultInstance,
        globalApiKey,
        String(number),
        isGroup
      );
    }

    console.log('✅ Resultado:', profilePictureUrl ? 'Foto encontrada' : 'Sem foto');

    return new Response(
      JSON.stringify({ profilePictureUrl }),
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
