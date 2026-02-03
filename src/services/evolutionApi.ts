import { supabase } from "@/integrations/supabase/client";

const EVOLUTION_API_URL = import.meta.env.VITE_EVOLUTION_API_URL || "https://evo.continuum.tec.br";
const EVOLUTION_API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY;

interface EvolutionContact {
  id: string;
  pushName?: string;
  profilePicUrl?: string;
}

interface EvolutionMessage {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  message: any;
  messageTimestamp: number;
  pushName?: string;
}

export async function getInstanceName(companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("whatsapp_connections")
    .select("instance_name")
    .eq("company_id", companyId)
    .single();
  
  return data?.instance_name || null;
}

export async function getContacts(instanceName: string): Promise<EvolutionContact[]> {
  try {
    console.log("🔄 Buscando contatos via edge function:", instanceName);
    
    // Usar edge function como proxy para evitar problemas de CORS
    const { data, error } = await supabase.functions.invoke('sync-whatsapp-contacts', {
      body: { instanceName }
    });

    if (error) {
      console.error("❌ Erro ao chamar edge function:", error);
      return [];
    }

    if (!data?.contacts) {
      console.warn("⚠️ Nenhum contato retornado");
      return [];
    }

    console.log(`✅ ${data.contacts.length} contatos recebidos da Evolution API`);
    return data.contacts || [];
    
  } catch (error) {
    console.error("❌ Erro ao buscar contatos:", error);
    return [];
  }
}

export async function getMessages(
  companyId: string, 
  phoneNumber: string, 
  limit: number = 50
): Promise<any[]> {
  try {
    console.log("🔄 Buscando histórico via edge function:", { companyId, phoneNumber, limit });
    
    // Usar edge function como proxy para evitar problemas de CORS e segurança
    const { data, error } = await supabase.functions.invoke('fetch-whatsapp-messages', {
      body: { 
        phoneNumber,
        companyId,
        limit 
      }
    });

    if (error) {
      console.error("❌ Erro ao chamar edge function:", error);
      return [];
    }

    if (!data?.success) {
      console.error("❌ Erro na resposta:", data?.error || "Erro desconhecido");
      return [];
    }

    console.log(`✅ ${data.count || 0} mensagens encontradas`);
    return data.messages || [];
  } catch (error) {
    console.error("❌ Erro ao buscar mensagens da Evolution API:", error);
    return [];
  }
}

export async function syncContactsToDatabase(
  contacts: EvolutionContact[],
  companyId: string
): Promise<void> {
  try {
    // Filtrar apenas contatos válidos (não grupos)
    const validContacts = contacts.filter(contact => 
      contact.id && 
      !contact.id.includes('@g.us') && // Excluir grupos
      contact.id.includes('@s.whatsapp.net') // Apenas contatos individuais
    );

    console.log(`📋 Contatos válidos para sincronizar: ${validContacts.length} de ${contacts.length}`);

    const leadsToUpsert = validContacts.map((contact) => {
      const phone = contact.id.replace("@s.whatsapp.net", "");
      const name = contact.pushName && contact.pushName.trim() !== '' 
        ? contact.pushName 
        : phone; // Se não tem pushName, usar o telefone mesmo

      return {
        phone,
        name,
        company_id: companyId,
        source: "whatsapp",
        status: "novo",
        stage: "prospeccao",
      };
    });

    if (leadsToUpsert.length === 0) {
      console.log("⚠️ Nenhum contato válido para sincronizar");
      return;
    }

    const { error } = await supabase
      .from("leads")
      .upsert(leadsToUpsert, { 
        onConflict: "phone,company_id",
        ignoreDuplicates: false 
      });

    if (error) {
      console.error("❌ Erro ao sincronizar contatos no banco:", error);
    } else {
      console.log("✅ Contatos sincronizados com sucesso:", leadsToUpsert.length);
    }
  } catch (error) {
    console.error("❌ Erro ao sincronizar contatos:", error);
  }
}

export async function saveMessagesToDatabase(
  messages: EvolutionMessage[],
  companyId: string,
  leadId?: string
): Promise<void> {
  try {
    const conversasToInsert = messages.map((msg) => {
      const phoneNumber = msg.key.remoteJid.replace("@s.whatsapp.net", "");
      const messageText = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          msg.message?.imageMessage?.caption || 
                          "[Mídia]";
      
      return {
        numero: phoneNumber,
        telefone_formatado: phoneNumber.replace(/[^0-9]/g, ""),
        mensagem: messageText,
        fromme: msg.key.fromMe,
        nome_contato: msg.pushName || phoneNumber,
        origem: "WhatsApp",
        status: msg.key.fromMe ? "Enviada" : "Recebida",
        tipo_mensagem: msg.message?.imageMessage ? "image" : 
                       msg.message?.videoMessage ? "video" : 
                       msg.message?.audioMessage ? "audio" : 
                       msg.message?.documentMessage ? "document" : "text",
        company_id: companyId,
        lead_id: leadId,
        created_at: new Date(msg.messageTimestamp * 1000).toISOString(),
      };
    });

    const { error } = await supabase
      .from("conversas")
      .insert(conversasToInsert);

    if (error) {
      console.error("❌ Erro ao salvar mensagens no banco:", error);
    } else {
      console.log("✅ Mensagens restauradas com sucesso:", conversasToInsert.length);
    }
  } catch (error) {
    console.error("❌ Erro ao salvar mensagens:", error);
  }
}
