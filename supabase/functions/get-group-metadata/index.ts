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
    const { groupId, company_id } = await req.json();

    console.log('📥 [GROUP-METADATA] Requisição recebida:', { groupId, company_id: company_id || 'NÃO FORNECIDO' });

    if (!groupId) {
      console.error('❌ ID do grupo não fornecido');
      return new Response(
        JSON.stringify({ error: 'ID do grupo é obrigatório' }),
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

    console.log('🔍 [GROUP-METADATA] Resolvendo instância...', { 
      hasCompanyId: !!company_id, 
      hasDefaultInstance: !!defaultInstance,
      hasGlobalApiKey: !!globalApiKey 
    });

    // Se company_id fornecido, buscar configuração específica da empresa
    if (company_id && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        console.log('🔍 Buscando configuração da empresa:', company_id);
        
        const supabaseResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/whatsapp_connections?company_id=eq.${company_id}&select=*&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            }
          }
        );

        if (supabaseResponse.ok) {
          const connections = await supabaseResponse.json();
          if (connections && connections.length > 0) {
            const conn = connections[0];
            instanceName = conn.instance_name || instanceName;
            instanceApiKey = conn.evolution_api_key || instanceApiKey;
            instanceApiUrl = conn.evolution_api_url || null;
            console.log('✅ Usando configuração da empresa:', { instanceName, hasCustomUrl: !!instanceApiUrl });
          } else {
            console.log('⚠️ Nenhuma conexão encontrada para a empresa, usando configuração global');
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar configuração da empresa:', error);
      }
    }

    if (!instanceName || !instanceApiKey) {
      console.error('❌ Instância ou API key não configurados');
      return new Response(
        JSON.stringify({ 
          error: 'Instância WhatsApp não configurada',
          details: 'Configure uma instância no menu Configurações > WhatsApp'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Instância resolvida:', instanceName);
    console.log('📋 Group ID:', groupId);

    // Endpoint Evolution API v2 para buscar metadados do grupo
    const url = `${instanceApiUrl || evolutionUrl}/group/fetchAllGroups/${instanceName}`;
    console.log('📡 Chamando Evolution API:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instanceApiKey,
      },
    });

    console.log('📥 Status da resposta:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da Evolution API:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao buscar metadados do grupo',
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const groups = await response.json();
    console.log('📥 Grupos recebidos:', groups?.length || 0);

    // Procurar o grupo específico
    const group = groups?.find((g: any) => g.id === groupId || g.remoteJid === groupId);

    if (!group) {
      console.log('⚠️ Grupo não encontrado na lista');
      return new Response(
        JSON.stringify({ groupName: 'Grupo', groupSubject: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Metadados do grupo obtidos:', {
      subject: group.subject || group.name,
      participants: group.participants?.length || 0
    });

    return new Response(
      JSON.stringify({ 
        groupName: group.subject || group.name || 'Grupo',
        groupSubject: group.subject || group.name || null,
        participants: group.participants || [],
        groupId: group.id || group.remoteJid
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('⚠️ Erro interno:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao buscar metadados do grupo',
        details: err instanceof Error ? err.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
