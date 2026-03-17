import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export interface ProspectingInteraction {
  id: string;
  company_id: string;
  daily_log_id: string | null;
  log_type: string;
  lead_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  user_id: string;
  user_name?: string;
  interaction_date: string;
  channel: string | null;
  script_used: string | null;
  outcome: string;
  interaction_summary: string | null;
  gross_value: number;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
}

export interface ProspectingScript {
  id: string;
  company_id: string;
  name: string;
  category: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

export const OUTCOME_OPTIONS = [
  { value: "contacted", label: "Contactado", color: "bg-blue-500" },
  { value: "responded", label: "Respondeu", color: "bg-cyan-500" },
  { value: "opportunity", label: "Oportunidade", color: "bg-yellow-500" },
  { value: "meeting_scheduled", label: "Reunião Agendada", color: "bg-purple-500" },
  { value: "sale_closed", label: "Venda Fechada", color: "bg-green-500" },
  { value: "no_response", label: "Sem Resposta", color: "bg-muted" },
  { value: "rejected", label: "Rejeitado", color: "bg-red-500" },
] as const;

export function useInteractions(logType: "prospecting" | "followup", days: number) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.rpc("get_my_company_id");
      if (data) setCompanyId(data);
    };
    fetch();
  }, []);

  return useQuery({
    queryKey: ["interactions", logType, days, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: rows, error } = await supabase
        .from("prospecting_interactions")
        .select("*")
        .eq("company_id", companyId!)
        .eq("log_type", logType)
        .gte("interaction_date", startDate.toISOString().slice(0, 10))
        .order("interaction_date", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((rows || []).map(r => r.user_id))];
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        if (profiles) {
          userMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || "Sem nome"]));
        }
      }

      return (rows || []).map(r => ({
        ...r,
        user_name: userMap[r.user_id] || "Desconhecido",
        gross_value: Number(r.gross_value) || 0,
      })) as ProspectingInteraction[];
    },
  });
}

export function useScripts() {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.rpc("get_my_company_id");
      if (data) setCompanyId(data);
    };
    fetch();
  }, []);

  return useQuery({
    queryKey: ["prospecting_scripts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospecting_scripts")
        .select("*")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return (data || []) as ProspectingScript[];
    },
  });
}
