import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export interface FollowUpLog {
  id: string;
  company_id: string;
  user_id: string;
  user_name?: string;
  log_date: string;
  source: string | null;
  followups_sent: number;
  responses: number;
  meetings_scheduled: number;
  sales_closed: number;
  gross_value: number;
  notes: string | null;
}

export function useFollowUpData(days: number) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      const { data } = await supabase.rpc("get_my_company_id");
      if (data) setCompanyId(data);
    };
    fetchCompany();
  }, []);

  return useQuery({
    queryKey: ["followup", days, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: logs, error } = await supabase
        .from("followup_daily_logs")
        .select("*")
        .eq("company_id", companyId!)
        .gte("log_date", startDate.toISOString().slice(0, 10))
        .order("log_date", { ascending: false });

      if (error) throw error;

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
        user_name: userMap[l.user_id] || "Desconhecido",
      })) as FollowUpLog[];
    },
  });
}
