import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🎂 Iniciando envio de mensagens de aniversário...");

    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesHoje = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    // Buscar todas as empresas que têm mensagem ativa
    const { data: mensagensAtivas, error: mensagensError } = await supabase
      .from("aniversario_mensagens")
      .select("*")
      .eq("ativo", true);

    if (mensagensError) {
      console.error("Erro ao buscar mensagens:", mensagensError);
      throw mensagensError;
    }

    if (!mensagensAtivas || mensagensAtivas.length === 0) {
      console.log("Nenhuma mensagem de aniversário ativa encontrada");
      return new Response(JSON.stringify({ message: "Nenhuma mensagem ativa" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalEnviados = 0;
    let totalErros = 0;

    for (const mensagem of mensagensAtivas) {
      console.log(`📨 Processando empresa ${mensagem.company_id}...`);

      // Buscar leads aniversariantes de hoje desta empresa
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, name, phone, telefone, data_nascimento")
        .eq("company_id", mensagem.company_id)
        .not("data_nascimento", "is", null);

      if (leadsError) {
        console.error(`Erro ao buscar leads da empresa ${mensagem.company_id}:`, leadsError);
        continue;
      }

      // Filtrar aniversariantes de hoje
      const aniversariantesHoje = (leads || []).filter((lead) => {
        if (!lead.data_nascimento) return false;
        const dataNasc = new Date(lead.data_nascimento);
        return dataNasc.getDate() === diaHoje && dataNasc.getMonth() + 1 === mesHoje;
      });

      console.log(`🎂 ${aniversariantesHoje.length} aniversariantes hoje na empresa ${mensagem.company_id}`);

      for (const lead of aniversariantesHoje) {
        const telefone = lead.phone || lead.telefone;
        if (!telefone) {
          console.log(`Lead ${lead.id} sem telefone, pulando...`);
          continue;
        }

        // Verificar se já foi enviado este ano
        const { data: envioExistente } = await supabase
          .from("aniversario_envios")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("ano", anoAtual)
          .maybeSingle();

        if (envioExistente) {
          console.log(`Mensagem já enviada para ${lead.name} este ano`);
          continue;
        }

        // Calcular idade
        const dataNasc = new Date(lead.data_nascimento);
        const idade = anoAtual - dataNasc.getFullYear();

        // Formatar mensagem
        const mensagemFormatada = mensagem.mensagem
          .replace(/{nome}/g, lead.name.split(" ")[0])
          .replace(/{idade}/g, String(idade))
          .replace(/{nome_completo}/g, lead.name);

        try {
          // Preparar payload para envio via WhatsApp
          const payload: any = {
            numero: telefone.replace(/\D/g, ""),
            mensagem: mensagemFormatada,
            company_id: mensagem.company_id,
          };

          // Adicionar mídia se existir
          if (mensagem.midia_url) {
            payload.mediaUrl = mensagem.midia_url;
            // Detectar tipo de mídia pela URL
            const url = mensagem.midia_url.toLowerCase();
            if (url.match(/\.(mp4|mov|avi|webm)(\?.*)?$/)) {
              payload.tipo_mensagem = 'video';
            } else if (url.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/)) {
              payload.tipo_mensagem = 'image';
            } else if (url.match(/\.(pdf)(\?.*)?$/)) {
              payload.tipo_mensagem = 'document';
            } else {
              // Default para imagem
              payload.tipo_mensagem = 'image';
            }
            // Usar mensagem como caption
            payload.caption = mensagemFormatada;
          }

          // Enviar via WhatsApp
          const { error: envioError } = await supabase.functions.invoke("enviar-whatsapp", {
            body: payload,
          });

          if (envioError) {
            console.error(`Erro ao enviar para ${lead.name}:`, envioError);
            totalErros++;
            continue;
          }

          // Registrar envio
          await supabase.from("aniversario_envios").insert({
            company_id: mensagem.company_id,
            lead_id: lead.id,
            mensagem_id: mensagem.id,
            status: "enviado",
            ano: anoAtual,
          });

          console.log(`✅ Mensagem enviada para ${lead.name}`);
          totalEnviados++;

          // Delay entre envios
          await new Promise((r) => setTimeout(r, 1000));
        } catch (error) {
          console.error(`Erro ao enviar para ${lead.name}:`, error);
          totalErros++;
        }
      }
    }

    console.log(`🎂 Envio finalizado: ${totalEnviados} enviados, ${totalErros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        enviados: totalEnviados,
        erros: totalErros,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Erro geral:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
