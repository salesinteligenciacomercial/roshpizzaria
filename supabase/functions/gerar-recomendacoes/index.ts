import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, dryRun = false } = await req.json();
    if (!companyId) {
      return new Response(JSON.stringify({ error: 'companyId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar leads da empresa
    const { data: leads } = await supabase
      .from('leads')
      .select('id, name, phone, stage, updated_at, last_interaction_at')
      .eq('company_id', companyId)
      .limit(500);

    const now = new Date();
    const toInsert: any[] = [];

    for (const lead of (leads || [])) {
      const lastTs = new Date(lead.last_interaction_at || lead.updated_at || now);
      const days = Math.round((now.getTime() - lastTs.getTime()) / (24 * 60 * 60 * 1000));

      // Recomendação de follow-up por inatividade
      if (days >= 7) {
        toInsert.push({
          company_id: companyId,
          lead_id: lead.id,
          recommendation_type: 'followup',
          recommendation_data: { message: `Enviar follow-up para ${lead.name} — inativo há ${days} dias` },
          confidence_score: 0.7,
          status: 'pending'
        });
      }

      // Risco de perda em estágio 'prospect' com inatividade longa
      if ((lead.stage === 'prospect' || lead.stage === 'novo') && days >= 14) {
        toInsert.push({
          company_id: companyId,
          lead_id: lead.id,
          recommendation_type: 'risk',
          recommendation_data: { message: `Risco de perda para ${lead.name}. Sugerir oferta/contato imediato.` },
          confidence_score: 0.6,
          status: 'pending'
        });
      }
    }

    if (!dryRun && toInsert.length > 0) {
      await supabase.from('recommendation_engine').insert(toInsert);
    }

    return new Response(JSON.stringify({ generated: toInsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (e: any) {
    console.error('Erro em gerar-recomendacoes:', e);
    return new Response(JSON.stringify({ error: e.message || 'Erro interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});



