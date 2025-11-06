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
    const response = await fetch(`${EVOLUTION_API_URL}/chat/findContacts/${instanceName}`, {
      method: "GET",
      headers: {
        "apikey": EVOLUTION_API_KEY || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("❌ Erro ao buscar contatos:", response.statusText);
      return [];
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("❌ Erro ao buscar contatos da Evolution API:", error);
    return [];
  }
}

export async function getMessages(
  instanceName: string, 
  phoneNumber: string, 
  limit: number = 15
): Promise<any[]> {
  try {
    // Formatar número para o padrão do WhatsApp
    const formattedNumber = phoneNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    
    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`,
      {
        method: "POST",
        headers: {
          "apikey": EVOLUTION_API_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          where: {
            key: {
              remoteJid: formattedNumber,
            },
          },
          limit,
        }),
      }
    );

    if (!response.ok) {
      console.error("❌ Erro ao buscar mensagens:", response.statusText);
      return [];
    }

    const data = await response.json();
    return data || [];
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
