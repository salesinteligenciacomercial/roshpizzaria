import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cron Job para análise automática de leads
 * Executa diariamente para analisar leads que:
 * - Não foram analisados nas últimas 24 horas
 * - Tiveram atividade recente (mensagens, tarefas, etc.)
 * 
 * Também atualiza métricas agregadas por empresa
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[IA-CRON] Iniciando análise programada...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar todas as empresas ativas
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .eq("status", "active");

    if (!companies || companies.length === 0) {
      console.log("[IA-CRON] Nenhuma empresa ativa encontrada");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma empresa ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[IA-CRON] Processando ${companies.length} empresas`);

    const results: { companyId: string; analyzed: number; errors: number }[] = [];

    for (const company of companies) {
      try {
        const companyResult = await processCompanyLeads(supabase, company.id, supabaseUrl, supabaseServiceKey);
        results.push({ companyId: company.id, ...companyResult });
      } catch (error) {
        console.error(`[IA-CRON] Erro ao processar empresa ${company.id}:`, error);
        results.push({ companyId: company.id, analyzed: 0, errors: 1 });
      }
    }

    // 2. Processar alertas de cadências próximas
    await processUpcomingCadenceActions(supabase);

    const executionTime = Date.now() - startTime;
    const totalAnalyzed = results.reduce((sum, r) => sum + r.analyzed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    console.log(`[IA-CRON] Concluído em ${executionTime}ms - ${totalAnalyzed} leads analisados, ${totalErrors} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        executionTime,
        totalAnalyzed,
        totalErrors,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[IA-CRON] Erro geral:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

/**
 * Processa leads de uma empresa específica
 */
async function processCompanyLeads(
  supabase: any,
  companyId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ analyzed: number; errors: number }> {
  // Buscar leads que precisam de análise (não analisados nas últimas 24 horas)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Buscar leads com atividade recente
  const { data: leads } = await supabase
    .from("leads")
    .select("id, updated_at")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (!leads || leads.length === 0) {
    return { analyzed: 0, errors: 0 };
  }

  const leadIds = leads.map((l: any) => l.id);

  // Buscar leads já analisados recentemente
  const { data: recentlyAnalyzed } = await supabase
    .from("ia_lead_intelligence")
    .select("lead_id")
    .in("lead_id", leadIds)
    .gte("last_analysis_at", twentyFourHoursAgo);

  const recentlyAnalyzedIds = new Set(recentlyAnalyzed?.map((r: any) => r.lead_id) || []);
  const leadsToAnalyze = leadIds.filter((id: string) => !recentlyAnalyzedIds.has(id));

  console.log(`[IA-CRON] Empresa ${companyId}: ${leadsToAnalyze.length} leads para analisar`);

  let analyzed = 0;
  let errors = 0;

  // Processar em lotes de 50
  const batchSize = 50;
  for (let i = 0; i < leadsToAnalyze.length; i += batchSize) {
    const batch = leadsToAnalyze.slice(i, i + batchSize);
    
    // Processar batch em paralelo (máximo 10 simultâneos)
    const promises = batch.map(async (leadId: string) => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/ia-analise-comercial`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: "analyze_lead",
            leadId,
            companyId,
          }),
        });

        if (response.ok) {
          return { success: true };
        } else {
          console.error(`[IA-CRON] Erro ao analisar lead ${leadId}: ${response.status}`);
          return { success: false };
        }
      } catch (e) {
        console.error(`[IA-CRON] Erro ao analisar lead ${leadId}:`, e);
        return { success: false };
      }
    });

    const results = await Promise.all(promises);
    analyzed += results.filter(r => r.success).length;
    errors += results.filter(r => !r.success).length;
  }

  // Atualizar métricas agregadas
  await updateCommercialMetrics(supabase, companyId);

  return { analyzed, errors };
}

/**
 * Processa ações de cadência próximas e cria alertas
 */
async function processUpcomingCadenceActions(supabase: any) {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Buscar cadências ativas com próxima ação nas próximas 24h
  const { data: upcomingActions } = await supabase
    .from("lead_cadence_progress")
    .select(`
      *,
      leads:lead_id (id, name, phone, company_id)
    `)
    .eq("status", "active")
    .lte("next_action_at", in24Hours.toISOString())
    .gte("next_action_at", now.toISOString());

  if (!upcomingActions || upcomingActions.length === 0) {
    return;
  }

  console.log(`[IA-CRON] ${upcomingActions.length} ações de cadência próximas`);

  for (const action of upcomingActions) {
    // Verificar se já existe alerta para esta ação
    const { data: existingAlert } = await supabase
      .from("ia_commercial_alerts")
      .select("id")
      .eq("lead_id", action.lead_id)
      .eq("alert_type", "cadencia_proxima_acao")
      .eq("status", "pending")
      .single();

    if (!existingAlert) {
      await supabase.from("ia_commercial_alerts").insert({
        company_id: action.company_id,
        lead_id: action.lead_id,
        alert_type: "cadencia_proxima_acao",
        severity: "medium",
        title: `📅 Próxima ação: ${action.leads?.name || "Lead"}`,
        description: `Step ${action.current_step}/${action.total_steps} da cadência "${action.cadence_name}": ${action.next_action_description || "Executar próxima ação"}`,
        recommended_action: action.next_action_channel || "whatsapp",
        action_buttons: JSON.stringify([
          { label: "Ver Lead", action: "view_lead", leadId: action.lead_id },
          { label: "Concluir Step", action: "complete_step", cadenceId: action.id },
          { label: "Pausar Cadência", action: "pause_cadence", cadenceId: action.id },
        ]),
        expires_at: action.next_action_at,
      });
    }
  }
}

/**
 * Atualiza métricas comerciais agregadas por empresa
 */
async function updateCommercialMetrics(supabase: any, companyId: string) {
  const today = new Date().toISOString().split("T")[0];

  // Buscar inteligência de todos os leads
  const { data: intelligence } = await supabase
    .from("ia_lead_intelligence")
    .select("temperature, engagement_score, response_rate, purchase_intent")
    .eq("company_id", companyId);

  if (!intelligence || intelligence.length === 0) return;

  const stats = {
    total_leads_monitored: intelligence.length,
    leads_hot: intelligence.filter((i: any) => i.temperature === "quente" || i.temperature === "fechando").length,
    leads_warm: intelligence.filter((i: any) => i.temperature === "morno").length,
    leads_cold: intelligence.filter((i: any) => i.temperature === "frio").length,
    avg_engagement_score: Math.round(intelligence.reduce((sum: number, i: any) => sum + (i.engagement_score || 0), 0) / intelligence.length),
    avg_response_rate: Math.round(intelligence.reduce((sum: number, i: any) => sum + (i.response_rate || 0), 0) / intelligence.length),
  };

  // Buscar alertas
  const { data: alerts } = await supabase
    .from("ia_commercial_alerts")
    .select("alert_type")
    .eq("company_id", companyId)
    .eq("status", "pending");

  const opportunities = alerts?.filter((a: any) => 
    ["lead_quente", "oportunidade", "interesse_alto"].includes(a.alert_type)
  ).length || 0;
  
  const risks = alerts?.filter((a: any) => 
    ["lead_esfriando", "risco_perda", "sem_contato"].includes(a.alert_type)
  ).length || 0;

  // Buscar cadências ativas
  const { data: activeCadences } = await supabase
    .from("lead_cadence_progress")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active");

  const { data: completedCadences } = await supabase
    .from("lead_cadence_progress")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .gte("completed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  await supabase
    .from("ia_commercial_metrics")
    .upsert({
      company_id: companyId,
      metric_date: today,
      ...stats,
      opportunities_detected: opportunities,
      risks_detected: risks,
      pending_followups: activeCadences?.length || 0,
      completed_followups: completedCadences?.length || 0,
    }, {
      onConflict: "company_id,metric_date"
    });
}
