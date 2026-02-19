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
  limit: number = 200
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
): Promise<number> {
  try {
    console.log(`📥 Processando ${messages.length} mensagens para salvar...`);
    
    const conversasToInsert = messages.map((msg) => {
      const phoneNumber = msg.key.remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      
      // Extrair texto da mensagem - suportar múltiplos formatos
      let messageText = "[Mídia]";
      if ((msg as any)._messageContent) {
        // Se já foi normalizado pela edge function
        messageText = (msg as any)._messageContent;
      } else if (msg.message?.conversation) {
        messageText = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        messageText = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage?.caption) {
        messageText = msg.message.imageMessage.caption || "[Imagem]";
      } else if (msg.message?.videoMessage?.caption) {
        messageText = msg.message.videoMessage.caption || "[Vídeo]";
      } else if (msg.message?.audioMessage) {
        messageText = "[Áudio]";
      } else if (msg.message?.documentMessage?.fileName) {
        messageText = `[Documento: ${msg.message.documentMessage.fileName}]`;
      } else if (msg.message?.stickerMessage) {
        messageText = "[Sticker]";
      }
      
      // Determinar tipo de mensagem
      let tipoMensagem = "text";
      if (msg.message?.imageMessage) tipoMensagem = "image";
      else if (msg.message?.videoMessage) tipoMensagem = "video";
      else if (msg.message?.audioMessage) tipoMensagem = "audio";
      else if (msg.message?.documentMessage) tipoMensagem = "document";
      else if (msg.message?.stickerMessage) tipoMensagem = "sticker";
      else if (msg.message?.contactMessage) tipoMensagem = "contact";
      else if (msg.message?.locationMessage) tipoMensagem = "location";
      
      // Verificar se é mensagem enviada ou recebida
      // O campo fromMe é crucial - usar o valor normalizado
      const isFromMe = msg.key.fromMe === true || (msg as any)._originalFromMe === true;
      
      // Criar timestamp válido
      const timestamp = msg.messageTimestamp 
        ? new Date(msg.messageTimestamp * 1000).toISOString()
        : new Date().toISOString();
      
      return {
        numero: phoneNumber,
        telefone_formatado: phoneNumber.replace(/[^0-9]/g, ""),
        mensagem: messageText,
        fromme: isFromMe,
        nome_contato: msg.pushName || phoneNumber,
        origem: "WhatsApp",
        origem_api: "evolution", // Indicar que veio da Evolution API
        status: isFromMe ? "Enviada" : "Recebida",
        tipo_mensagem: tipoMensagem,
        company_id: companyId,
        lead_id: leadId || null,
        created_at: timestamp,
      };
    });

    // Log para debug
    const enviadas = conversasToInsert.filter(c => c.fromme === true).length;
    const recebidas = conversasToInsert.filter(c => c.fromme === false).length;
    console.log(`📊 Mensagens a salvar: ${enviadas} enviadas, ${recebidas} recebidas`);

    if (conversasToInsert.length === 0) {
      console.log("⚠️ Nenhuma mensagem válida para salvar");
      return 0;
    }

    // Usar upsert para evitar duplicatas (baseado em timestamp e numero)
    const { error, data } = await supabase
      .from("conversas")
      .insert(conversasToInsert);

    if (error) {
      console.error("❌ Erro ao salvar mensagens no banco:", error);
      return 0;
    }
    
    console.log(`✅ ${conversasToInsert.length} mensagens restauradas com sucesso! (${enviadas} enviadas, ${recebidas} recebidas)`);
    return conversasToInsert.length;
  } catch (error) {
    console.error("❌ Erro ao salvar mensagens:", error);
    return 0;
  }
}
