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
const NULL_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 horas para resultados sem foto

// Verificar se URL do WhatsApp expirou (pps.whatsapp.net URLs têm parâmetro oe= com timestamp hex)
function isWhatsAppUrlExpired(url: string): boolean {
  if (!url || !url.includes('pps.whatsapp.net')) return false;
  try {
    const oeMatch = url.match(/[?&]oe=([0-9a-fA-F]+)/);
    if (oeMatch) {
      const expiryTimestamp = parseInt(oeMatch[1], 16);
      const now = Math.floor(Date.now() / 1000);
      // Considerar expirada se faltam menos de 1 hora
      if (expiryTimestamp < now + 3600) {
        console.log(`⏰ [PROFILE-PICTURE] URL expirada! oe=${oeMatch[1]} (${new Date(expiryTimestamp * 1000).toISOString()}) < agora`);
        return true;
      }
    }
  } catch { /* ignore parse errors */ }
  return false;
}

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
        ].filter((v, i, arr) => v.length >= 8 && arr.indexOf(v) === i);

    for (const numberToTry of numberVariations) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
          body: JSON.stringify({ number: numberToTry }),
        });

        const responseText = await response.text();
        console.log(`📸 [EVOLUTION] Tentativa ${numberToTry} - Status: ${response.status} - Resposta: ${responseText.substring(0, 300)}`);
        
        if (response.ok || response.status === 200) {
          try {
            const data = JSON.parse(responseText);
            const pictureUrl = data.profilePictureUrl || data.url || data.profilePicture || 
              data.picture || data.imgUrl || data.profileUrl ||
              data?.data?.profilePictureUrl || data?.data?.url ||
              data?.response?.profilePictureUrl;
            if (pictureUrl && typeof pictureUrl === 'string' && pictureUrl.startsWith('http')) {
              console.log('✅ [EVOLUTION] Foto encontrada para:', numberToTry, pictureUrl.substring(0, 80));
              return pictureUrl;
            }
          } catch { /* parse error */ }
        }
      } catch (err) {
        console.log(`⚠️ [EVOLUTION] Erro na tentativa ${numberToTry}:`, err);
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
    const internationalNumber = cleanNumber.startsWith('55') ? `+${cleanNumber}` : `+55${cleanNumber}`;
    
    console.log('📘 [META] Buscando foto de perfil para:', internationalNumber);
    
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
        if (contact.status === 'valid' && contact.wa_id) {
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
  profilePictureUrl: string | null
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

// Buscar foto de perfil do Instagram via Graph API
async function getInstagramProfilePicture(
  supabase: any,
  companyId: string,
  instagramUserId: string
): Promise<string | null> {
  try {
    // Buscar token de acesso do Instagram na empresa direta
    let { data: conn } = await supabase
      .from('whatsapp_connections')
      .select('instagram_access_token, meta_access_token, instagram_account_id')
      .eq('company_id', companyId)
      .not('instagram_account_id', 'is', null)
      .maybeSingle();

    // Se não encontrou, buscar nas subcontas
    if (!conn) {
      const { data: subcontas } = await supabase
        .from('companies')
        .select('id')
        .eq('parent_company_id', companyId);

      if (subcontas && subcontas.length > 0) {
        const subIds = subcontas.map((s: any) => s.id);
        const { data: subConn } = await supabase
          .from('whatsapp_connections')
          .select('instagram_access_token, meta_access_token, instagram_account_id')
          .in('company_id', subIds)
          .not('instagram_account_id', 'is', null)
          .not('instagram_access_token', 'is', null)
          .limit(1)
          .maybeSingle();
        if (subConn) {
          console.log('✅ [INSTAGRAM-PIC] Token encontrado via subconta');
          conn = subConn;
        }
      }
    }

    // Se ainda não encontrou, buscar na empresa pai
    if (!conn) {
      const { data: parentCompany } = await supabase
        .from('companies')
        .select('parent_company_id')
        .eq('id', companyId)
        .maybeSingle();

      if (parentCompany?.parent_company_id) {
        const { data: parentConn } = await supabase
          .from('whatsapp_connections')
          .select('instagram_access_token, meta_access_token, instagram_account_id')
          .eq('company_id', parentCompany.parent_company_id)
          .not('instagram_account_id', 'is', null)
          .not('instagram_access_token', 'is', null)
          .limit(1)
          .maybeSingle();
        if (parentConn) {
          console.log('✅ [INSTAGRAM-PIC] Token encontrado via empresa pai');
          conn = parentConn;
        }
      }
    }

    const token = conn?.instagram_access_token || conn?.meta_access_token;
    if (!token) {
      console.log('⚠️ [INSTAGRAM-PIC] Nenhum token Instagram encontrado para empresa:', companyId);
      return null;
    }

    const cleanId = String(instagramUserId).replace(/^ig_/, '');
    console.log('📸 [INSTAGRAM-PIC] Buscando foto para IGSID:', cleanId);

    const userUrl = `https://graph.facebook.com/v23.0/${cleanId}?fields=name,username,profile_pic&access_token=${token}`;
    const res = await fetch(userUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.profile_pic) {
        console.log('✅ [INSTAGRAM-PIC] Foto encontrada:', data.profile_pic.substring(0, 80));
        return data.profile_pic;
      }
    } else {
      const errText = await res.text();
      console.log('⚠️ [INSTAGRAM-PIC] API retornou erro:', errText.substring(0, 200));
    }
    return null;
  } catch (e) {
    console.log('⚠️ [INSTAGRAM-PIC] Erro:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { number, company_id, force_refresh, channel } = await req.json();

    if (!number) {
      return new Response(
        JSON.stringify({ error: 'Número é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const isInstagram = channel === 'instagram' || /^\d{15,20}$/.test(String(number).replace(/^ig_/, ''));
    const isGroup = !isInstagram && /@g\.us$/.test(String(number));
    const cacheKey = `${company_id || 'global'}:${number}`;
    const cached = profilePictureCache.get(cacheKey);
    
    // Verificar se cache em memória é válido (não expirado e URL não expirada)
    const effectiveTTL = cached?.url ? CACHE_TTL : NULL_CACHE_TTL;
    const cacheValid = cached && (Date.now() - cached.timestamp) < effectiveTTL;
    const cachedUrlExpired = cached?.url ? isWhatsAppUrlExpired(cached.url) : false;
    
    if (!force_refresh && cacheValid && !cachedUrlExpired) {
      return new Response(
        JSON.stringify({ profilePictureUrl: cached.url }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let profilePictureUrl: string | null = null;
    let supabase: any = null;
    let leadName: string | null = null;
    let needsRefresh = false;

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
              // ⚡ CORREÇÃO: Verificar se a URL do WhatsApp expirou
              if (isWhatsAppUrlExpired(lead.profile_picture_url)) {
                console.log('⏰ [PROFILE-PICTURE] URL salva no lead está EXPIRADA, será renovada');
                needsRefresh = true;
                // Não usar a URL expirada
              } else {
                profilePictureUrl = lead.profile_picture_url;
              }
              break;
            }
          }
        }
      }
    }

    // 2. Buscar via API (Instagram ou WhatsApp)
    if ((!profilePictureUrl || needsRefresh) && company_id && supabase) {
      
      // 2-IG. Instagram: Buscar via Graph API
      if (isInstagram && !profilePictureUrl) {
        console.log('📸 [PROFILE-PICTURE] Canal Instagram detectado, buscando via Graph API...');
        profilePictureUrl = await getInstagramProfilePicture(supabase, company_id, String(number));
        
        // Salvar no lead se encontrou
        if (profilePictureUrl) {
          const cleanId = String(number).replace(/^ig_/, '');
          try {
            await supabase
              .from('leads')
              .update({ profile_picture_url: profilePictureUrl })
              .eq('company_id', company_id)
              .or(`telefone.eq.${cleanId},phone.eq.${cleanId}`);
          } catch (e) {
            console.log('⚠️ [PROFILE-PICTURE] Erro ao salvar foto Instagram no lead:', e);
          }
        }
      }
      
      // 2-WA. WhatsApp: Buscar via Evolution ou Meta API
      if (!isInstagram) {
        const { data: conn } = await supabase
          .from('whatsapp_connections')
          .select('instance_name, evolution_api_key, evolution_api_url, api_provider, status, meta_access_token, meta_phone_number_id')
          .eq('company_id', company_id)
          .maybeSingle();

        // 2a. Tentar Evolution API DIRETAMENTE
        if (!profilePictureUrl && conn?.instance_name && conn?.evolution_api_key && conn?.evolution_api_url) {
          console.log('📗 [PROFILE-PICTURE] Tentando Evolution API diretamente...');
          try {
            const freshUrl = await getEvolutionProfilePicture(
              conn.evolution_api_url.replace(/\/$/, ''),
              conn.instance_name,
              conn.evolution_api_key,
              String(number),
              isGroup
            );
            if (freshUrl) {
              profilePictureUrl = freshUrl;
              console.log('✅ [PROFILE-PICTURE] Foto encontrada/renovada via Evolution!');
            } else {
              console.log('⚠️ [PROFILE-PICTURE] Evolution não retornou foto');
            }
          } catch (e) {
            console.log('⚠️ [PROFILE-PICTURE] Evolution falhou:', e);
          }
        }

        // 2b. Tentar Meta API como fallback
        if (!profilePictureUrl && !isGroup && conn?.meta_access_token && conn?.meta_phone_number_id) {
          profilePictureUrl = await getMetaProfilePicture(
            conn.meta_access_token,
            conn.meta_phone_number_id,
            String(number)
          );
        }

        // Salvar foto encontrada (ou limpar URL expirada)
        if (supabase && company_id && !isGroup) {
          if (profilePictureUrl) {
            await saveProfilePictureToLead(supabase, company_id, String(number), profilePictureUrl);
          } else if (needsRefresh) {
            console.log('🗑️ [PROFILE-PICTURE] Limpando URL expirada do banco');
            await saveProfilePictureToLead(supabase, company_id, String(number), null);
          }
        }
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
