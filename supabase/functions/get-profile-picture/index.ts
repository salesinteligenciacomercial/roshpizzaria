import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache em memória para evitar chamadas repetidas
const profilePictureCache = new Map<string, { url: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

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

    // Tentar múltiplas variações do número
    const numberVariations = isGroup 
      ? [String(phoneNumber)]
      : [
          String(phoneNumber).replace(/\D/g, ''),
          String(phoneNumber),
          // Com código do país
          String(phoneNumber).replace(/\D/g, '').replace(/^55/, ''),
          // Sem código do país  
          '55' + String(phoneNumber).replace(/\D/g, '').replace(/^55/, '')
        ];

    for (const numberToTry of numberVariations) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey,
          },
          body: JSON.stringify({ number: numberToTry }),
        });

        if (response.ok) {
          const data = await response.json();
          const pictureUrl = data.profilePictureUrl || data.url || data.profilePicture || data.picture;
          if (pictureUrl) {
            console.log('✅ [EVOLUTION] Foto encontrada para variação:', numberToTry);
            return pictureUrl;
          }
        }
      } catch (varError) {
        // Ignorar erro individual e tentar próxima variação
        console.log(`⚠️ [EVOLUTION] Variação ${numberToTry} falhou, tentando próxima...`);
      }
    }

    console.log('⚠️ [EVOLUTION] Nenhuma variação retornou foto');
    return null;
  } catch (error) {
    console.error('❌ [EVOLUTION] Erro ao buscar foto de perfil:', error);
    return null;
  }
}

// Salvar foto no lead para cache persistente
async function saveProfilePictureToLead(
  supabase: any,
  companyId: string,
  phoneNumber: string,
  profilePictureUrl: string
): Promise<void> {
  try {
    const formattedNumber = String(phoneNumber).replace(/\D/g, '');
    
    // Atualizar lead se existir
    await supabase
      .from('leads')
      .update({ profile_picture_url: profilePictureUrl })
      .eq('company_id', companyId)
      .or(`telefone.ilike.%${formattedNumber}%,phone.ilike.%${formattedNumber}%`);
      
    console.log('💾 [PROFILE-PICTURE] Foto salva no lead para cache persistente');
  } catch (error) {
    console.log('⚠️ [PROFILE-PICTURE] Não foi possível salvar foto no lead:', error);
  }
}

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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Verificar se é um grupo (termina com @g.us)
    const isGroup = /@g\.us$/.test(String(number));
    console.log('📋 Tipo de contato:', isGroup ? 'GRUPO' : 'CONTATO INDIVIDUAL');

    // Verificar cache em memória
    const cacheKey = `${company_id || 'global'}:${number}`;
    const cached = profilePictureCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('📦 [CACHE] Retornando foto do cache em memória');
      return new Response(
        JSON.stringify({ profilePictureUrl: cached.url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let profilePictureUrl: string | null = null;
    let supabase: any = null;
    let leadName: string | null = null;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }

    // Primeiro, tentar buscar foto de perfil salva no lead (capturada via webhook Meta)
    if (company_id && supabase && !isGroup) {
      const formattedNumber = String(number).replace(/\D/g, '');
      console.log('🔍 [PROFILE-PICTURE] Buscando foto de perfil no lead para:', formattedNumber);
      
      // Buscar com múltiplas variações de telefone
      const phoneVariations = [
        formattedNumber,
        formattedNumber.replace(/^55/, ''),
        '55' + formattedNumber.replace(/^55/, ''),
        formattedNumber.slice(-9),
        formattedNumber.slice(-8)
      ];
      
      for (const phoneVar of phoneVariations) {
        if (phoneVar.length >= 8) {
          const { data: lead } = await supabase
            .from('leads')
            .select('profile_picture_url, name')
            .eq('company_id', company_id)
            .or(`telefone.ilike.%${phoneVar}%,phone.ilike.%${phoneVar}%`)
            .limit(1)
            .maybeSingle();
          
          if (lead) {
            // Capturar nome para fallback
            if (lead.name) leadName = lead.name;
            
            if (lead.profile_picture_url) {
              console.log('✅ [PROFILE-PICTURE] Foto encontrada no lead com variação:', phoneVar);
              profilePictureUrl = lead.profile_picture_url;
              break;
            }
          }
        }
      }
    }

    // Se não encontrou no lead, buscar via Evolution API (mesmo se api_provider='both' ou 'meta')
    // A Evolution pode estar configurada mesmo quando Meta é o principal
    if (!profilePictureUrl && company_id && supabase) {
      // Buscar conexão SEM filtrar por status='connected' para obter credenciais Evolution
      const { data: conn } = await supabase
        .from('whatsapp_connections')
        .select('instance_name, evolution_api_key, evolution_api_url, api_provider, status')
        .eq('company_id', company_id)
        .maybeSingle();
      
      console.log('🔍 [PROFILE-PICTURE] Conexão encontrada:', { 
        found: !!conn, 
        instanceName: conn?.instance_name,
        hasEvolutionKey: !!conn?.evolution_api_key,
        hasApiUrl: !!conn?.evolution_api_url,
        apiProvider: conn?.api_provider,
        status: conn?.status
      });

      // Tentar Evolution API se tiver credenciais (independente do api_provider)
      if (conn?.instance_name && conn?.evolution_api_key && conn?.evolution_api_url) {
        console.log('📗 Tentando Evolution API para foto de perfil (api_provider:', conn?.api_provider, ')...');
        
        // Verificar se Evolution está realmente acessível antes de tentar
        try {
          const stateUrl = `${conn.evolution_api_url.replace(/\/$/, '')}/instance/connectionState/${conn.instance_name}`;
          const stateResp = await fetch(stateUrl, {
            headers: { 'apikey': conn.evolution_api_key },
          });
          
          if (stateResp.ok) {
            const stateData = await stateResp.json();
            const isEvolutionConnected = stateData?.instance?.state === 'open' || 
                                         stateData?.state === 'open' ||
                                         stateData?.status === 'open';
            
            console.log('📗 [PROFILE-PICTURE] Status Evolution:', stateData?.instance?.state || stateData?.state || stateData?.status);
            
            if (isEvolutionConnected) {
              profilePictureUrl = await getEvolutionProfilePicture(
                conn.evolution_api_url.replace(/\/$/, ''),
                conn.instance_name,
                conn.evolution_api_key,
                String(number),
                isGroup
              );

              // Salvar foto no lead para cache persistente
              if (profilePictureUrl && supabase && company_id && !isGroup) {
                await saveProfilePictureToLead(supabase, company_id, String(number), profilePictureUrl);
              }
            } else {
              console.log('⚠️ [PROFILE-PICTURE] Evolution não está conectada, não é possível buscar foto');
            }
          }
        } catch (evolutionError) {
          console.log('⚠️ [PROFILE-PICTURE] Erro ao verificar/usar Evolution API:', evolutionError);
        }
      }
    }

    // Cachear resultado em memória (mesmo se nulo para evitar chamadas repetidas)
    profilePictureCache.set(cacheKey, {
      url: profilePictureUrl,
      timestamp: Date.now()
    });

    console.log('✅ Resultado:', profilePictureUrl ? 'Foto encontrada' : 'Sem foto (usar placeholder no frontend)');

    // Retornar também o nome do lead para ajudar no fallback
    return new Response(
      JSON.stringify({ 
        profilePictureUrl,
        leadName: leadName || null
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
