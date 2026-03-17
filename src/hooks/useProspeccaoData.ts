import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export interface ProspeccaoLog {
  id: string;
  company_id: string;
  user_id: string;
  user_name?: string;
  log_date: string;
  channel_type: string;
  source: string | null;
  leads_prospected: number;
  responses: number;
  opportunities: number;
  meetings_scheduled: number;
  sales_closed: number;
  gross_value: number;
  ad_spend: number;
  notes: string | null;
}

export function useProspeccaoData(channelType: "organic" | "paid", days: number) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      const { data } = await supabase.rpc("get_my_company_id");
      if (data) setCompanyId(data);
    };
    fetchCompany();
  }, []);

  return useQuery({
    queryKey: ["prospeccao", channelType, days, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: logs, error } = await supabase
        .from("prospecting_daily_logs")
        .select("*")
        .eq("company_id", companyId!)
        .eq("channel_type", channelType)
        .gte("log_date", startDate.toISOString().slice(0, 10))
        .order("log_date", { ascending: false });

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set((logs || []).map(l => l.user_id))];
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

      return (logs || []).map(l => ({
        ...l,
        responses: l.responses ?? 0,
        user_name: userMap[l.user_id] || "Desconhecido",
      })) as ProspeccaoLog[];
    },
  });
}
