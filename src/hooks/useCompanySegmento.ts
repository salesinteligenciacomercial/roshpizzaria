import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isSegmentoFinanceiro, isSegmentoJuridico } from "@/lib/segmentos";

interface CompanySegmentoResult {
  segmento: string | null;
  isJuridico: boolean;
  isFinanceiro: boolean;
  isMasterAccount: boolean;
  companyId: string | null;
  loading: boolean;
}

export function useCompanySegmento(): CompanySegmentoResult {
  const [segmento, setSegmento] = useState<string | null>(null);
  const [isMasterAccount, setIsMasterAccount] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: role } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!role?.company_id) return;
        setCompanyId(role.company_id);

        const { data: company } = await supabase
          .from("companies")
          .select("segmento, is_master_account")
          .eq("id", role.company_id)
          .maybeSingle();

        if (company) {
          setSegmento(company.segmento);
          setIsMasterAccount(!!company.is_master_account);
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return {
    segmento,
    isJuridico: isMasterAccount || isSegmentoJuridico(segmento),
    isFinanceiro: isMasterAccount || isSegmentoFinanceiro(segmento),
    isMasterAccount,
    companyId,
    loading,
  };
}
