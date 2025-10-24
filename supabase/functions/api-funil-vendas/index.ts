import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's company_id
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!userRole?.company_id) {
      return new Response(JSON.stringify({ error: "User not associated with any company" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const companyId = userRole.company_id;
    const { action, data } = await req.json();
    console.log(`Action: ${action}`, data);

    switch (action) {
      case "criar_lead": {
        const { nome, telefone, email, cpf, valor, etapa_id, funil_id, company, source, notes } = data;
        const { data: lead, error } = await supabase
          .from("leads")
          .insert([{
            nome: nome,
            telefone,
            email,
            cpf,
            value: valor || 0,
            etapa_id,
            funil_id,
            company,
            source,
            notes,
            phone: telefone,
            owner_id: user.id,
            company_id: companyId
          }])
          .select()
          .single();

        if (error) {
          console.error("Error creating lead:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data: lead }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "mover_lead": {
        const { lead_id, nova_etapa_id } = data;
        const { error } = await supabase
          .from("leads")
          .update({ etapa_id: nova_etapa_id })
          .eq("id", lead_id);

        if (error) {
          console.error("Error moving lead:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "criar_funil": {
        const { nome, descricao } = data;
        const { data: funil, error } = await supabase
          .from("funis")
          .insert([{ nome, descricao, owner_id: user.id, company_id: companyId }])
          .select()
          .single();

        if (error) {
          console.error("Error creating funil:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data: funil }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "criar_etapa": {
        const { nome, funil_id, posicao, cor } = data;
        const { data: etapa, error } = await supabase
          .from("etapas")
          .insert([{ nome, funil_id, posicao: posicao || 0, cor: cor || '#3b82f6', company_id: companyId }])
          .select()
          .single();

        if (error) {
          console.error("Error creating etapa:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data: etapa }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_lead": {
        const { lead_id } = data;
        const { error } = await supabase
          .from("leads")
          .delete()
          .eq("id", lead_id);

        if (error) {
          console.error("Error deleting lead:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error("Error in api-funil-vendas:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});