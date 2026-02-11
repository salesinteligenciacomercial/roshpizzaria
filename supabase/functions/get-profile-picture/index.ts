import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache em memória para evitar chamadas repetidas
const profilePictureCache = new Map<string, { url: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos para resultados com foto
const NULL_CACHE_TTL = 30 * 60 * 1000; // 30 minutos para resultados sem foto

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
    const cleanNumber = String(phoneNumber).replace(/\D/g, '');
    
    const numberVariations = isGroup 
      ? [String(phoneNumber)]
      : [
          cleanNumber,
          `55${cleanNumber.replace(/^55/, '')}`,
          cleanNumber.replace(/^55/, ''),
          cleanNumber.slice(-11),
          cleanNumber.slice(-10),
          cleanNumber.slice(-9),
          `55${cleanNumber.slice(-11)}`,
          `55${cleanNumber.slice(-10)}`,
        ].filter((v, i, arr) => v.length >= 8 && arr.indexOf(v) === i);

    for (const numberToTry of numberVariations) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
          body: JSON.stringify({ number: numberToTry }),
        });

        if (response.ok) {
          const data = await response.json();
          const pictureUrl = data.profilePictureUrl || data.url || data.profilePicture || data.picture || data.imgUrl || data.profileUrl;
          if (pictureUrl && typeof pictureUrl === 'string' && pictureUrl.startsWith('http')) {
            console.log('✅ [EVOLUTION] Foto encontrada para:', numberToTry);
            return pictureUrl;
          }
        }
      } catch {
        // Tentar próxima variação
      }
    }
    return null;
  } catch (error) {
    console.error('❌ [EVOLUTION] Erro:', error);
    return null;
  }
}

// Buscar foto de perfil via Meta Cloud API
async function getMetaProfilePicture(
  accessToken: string,
  phoneNumberId: string,
  contactPhone: string
): Promise<string | null> {
  try {
    const cleanNumber = String(contactPhone).replace(/\D/g, '');
    // Garantir formato internacional com +
    const internationalNumber = cleanNumber.startsWith('55') ? `+${cleanNumber}` : `+55${cleanNumber}`;
    
    console.log('📘 [META] Buscando foto de perfil para:', internationalNumber);
    
    // Meta Business API - buscar contato e foto de perfil
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/contacts`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        blocking: 'wait',
        contacts: [internationalNumber],
        force_check: true,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const contacts = data?.contacts;
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        // O wa_id confirma que o número está no WhatsApp
        if (contact.status === 'valid' && contact.wa_id) {
          // Tentar buscar foto do perfil via endpoint de perfil
          const profileUrl = `https://graph.facebook.com/v21.0/${contact.wa_id}/profile_picture`;
          const profileResp = await fetch(profileUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (profileResp.ok) {
            const profileData = await profileResp.json();
            if (profileData?.data?.url) {
              console.log('✅ [META] Foto encontrada');
              return profileData.data.url;
            }
          }
        }
      }
    }
    
    console.log('⚠️ [META] Foto não encontrada para:', internationalNumber);
    return null;
  } catch (error) {
    console.log('⚠️ [META] Erro ao buscar foto:', error);
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
    await supabase
      .from('leads')
      .update({ profile_picture_url: profilePictureUrl })
      .eq('company_id', companyId)
      .or(`telefone.ilike.%${formattedNumber}%,phone.ilike.%${formattedNumber}%`);
  } catch (error) {
    console.log('⚠️ [PROFILE-PICTURE] Não foi possível salvar foto no lead:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { number, company_id, force_refresh } = await req.json();

    if (!number) {
      return new Response(
        JSON.stringify({ error: 'Número é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const isGroup = /@g\.us$/.test(String(number));
    const cacheKey = `${company_id || 'global'}:${number}`;
    const cached = profilePictureCache.get(cacheKey);
    
    // Cache mais longo para resultados nulos (30 min) vs resultados com foto (5 min)
    const effectiveTTL = cached?.url ? CACHE_TTL : NULL_CACHE_TTL;
    
    if (!force_refresh && cached && (Date.now() - cached.timestamp) < effectiveTTL) {
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

    // 1. Buscar foto salva no lead (mais rápido)
    if (company_id && supabase && !isGroup) {
      const formattedNumber = String(number).replace(/\D/g, '');
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
            if (lead.name) leadName = lead.name;
            if (lead.profile_picture_url) {
              profilePictureUrl = lead.profile_picture_url;
              break;
            }
          }
        }
      }
    }

    // 2. Buscar via Evolution API ou Meta API
    if (!profilePictureUrl && company_id && supabase) {
      const { data: conn } = await supabase
        .from('whatsapp_connections')
        .select('instance_name, evolution_api_key, evolution_api_url, api_provider, status, meta_access_token, meta_phone_number_id')
        .eq('company_id', company_id)
        .maybeSingle();

      // 2a. Tentar Evolution API DIRETAMENTE (sem verificar estado - mais confiável)
      if (!profilePictureUrl && conn?.instance_name && conn?.evolution_api_key && conn?.evolution_api_url) {
        console.log('📗 [PROFILE-PICTURE] Tentando Evolution API diretamente...');
        try {
          profilePictureUrl = await getEvolutionProfilePicture(
            conn.evolution_api_url.replace(/\/$/, ''),
            conn.instance_name,
            conn.evolution_api_key,
            String(number),
            isGroup
          );
          if (profilePictureUrl) {
            console.log('✅ [PROFILE-PICTURE] Foto encontrada via Evolution!');
          } else {
            console.log('⚠️ [PROFILE-PICTURE] Evolution não retornou foto');
          }
        } catch (e) {
          console.log('⚠️ [PROFILE-PICTURE] Evolution falhou:', e);
        }
      }

      // 2b. Tentar Meta API como fallback (limitado - pode não funcionar para todos)
      if (!profilePictureUrl && !isGroup && conn?.meta_access_token && conn?.meta_phone_number_id) {
        profilePictureUrl = await getMetaProfilePicture(
          conn.meta_access_token,
          conn.meta_phone_number_id,
          String(number)
        );
      }

      // Salvar foto encontrada no lead
      if (profilePictureUrl && supabase && company_id && !isGroup) {
        await saveProfilePictureToLead(supabase, company_id, String(number), profilePictureUrl);
      }
    }

    // Cachear resultado
    profilePictureCache.set(cacheKey, { url: profilePictureUrl, timestamp: Date.now() });

    return new Response(
      JSON.stringify({ profilePictureUrl, leadName: leadName || null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('⚠️ Erro interno:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
