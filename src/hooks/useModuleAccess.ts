import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ModuleAccess {
  chatEquipe: boolean;
  reunioes: boolean;
  discador: boolean;
  processosComerciais: boolean;
  automacao: boolean;
}

interface CompanyModuleSettings {
  allow_chat_equipe: boolean;
  allow_reunioes: boolean;
  allow_discador: boolean;
  allow_processos_comerciais: boolean;
  allow_automacao: boolean;
  is_master_account: boolean;
}

const MODULE_KEY_MAP: Record<string, keyof ModuleAccess> = {
  'chat-equipe': 'chatEquipe',
  'reunioes': 'reunioes',
  'discador': 'discador',
  'processos': 'processosComerciais',
  'automacao': 'automacao',
};

export function useModuleAccess() {
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess>({
    chatEquipe: false,
    reunioes: false,
    discador: false,
    processosComerciais: false,
    automacao: false,
  });
  const [loading, setLoading] = useState(true);
  const [isMasterAccount, setIsMasterAccount] = useState(false);

  useEffect(() => {
    const fetchModuleAccess = async () => {
      setLoading(true);
      try {
        // Verificar se Supabase está configurado
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const isSupabaseConfigured = supabaseUrl && supabaseKey && 
          supabaseUrl !== "http://localhost:54321" && 
          supabaseKey !== "anon-key";
        
        if (!isSupabaseConfigured) {
          console.log("⚠️ [useModuleAccess] Supabase não configurado - liberando todos módulos");
          setModuleAccess({
            chatEquipe: true,
            reunioes: true,
            discador: true,
            processosComerciais: true,
            automacao: true,
          });
          setIsMasterAccount(true);
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Buscar company do usuário via função RPC
        const { data: companyData, error: companyError } = await supabase
          .rpc('get_my_company');

        if (companyError) {
          console.error("Erro ao buscar empresa:", companyError);
          setLoading(false);
          return;
        }

        if (!companyData || companyData.length === 0) {
          console.log("Nenhuma empresa encontrada para o usuário");
          setLoading(false);
          return;
        }

        const company = companyData[0];
        
        // Se é conta mestre, tem acesso a todos os módulos
        if (company.is_master_account) {
          setIsMasterAccount(true);
          setModuleAccess({
            chatEquipe: true,
            reunioes: true,
            discador: true,
            processosComerciais: true,
            automacao: true,
          });
          setLoading(false);
          return;
        }

        // Buscar configurações de módulos da empresa
        const { data: fullCompanyData, error: settingsError } = await supabase
          .from('companies')
          .select('allow_chat_equipe, allow_reunioes, allow_discador, allow_processos_comerciais, allow_automacao, is_master_account')
          .eq('id', company.id)
          .single();

        if (settingsError) {
          console.error("Erro ao buscar configurações de módulos:", settingsError);
          setLoading(false);
          return;
        }

        const settings = fullCompanyData as CompanyModuleSettings;
        
        setModuleAccess({
          chatEquipe: settings.allow_chat_equipe ?? false,
          reunioes: settings.allow_reunioes ?? false,
          discador: settings.allow_discador ?? false,
          processosComerciais: settings.allow_processos_comerciais ?? false,
          automacao: settings.allow_automacao ?? false,
        });
        setIsMasterAccount(settings.is_master_account ?? false);

      } catch (error) {
        console.error("Erro ao carregar permissões de módulos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchModuleAccess();
  }, []);

  const canAccessModule = useCallback((moduleKey: string): boolean => {
    // Conta mestre sempre tem acesso
    if (isMasterAccount) return true;

    const accessKey = MODULE_KEY_MAP[moduleKey];
    if (!accessKey) {
      // Se não está no mapeamento, é módulo básico (sempre liberado)
      return true;
    }

    return moduleAccess[accessKey];
  }, [moduleAccess, isMasterAccount]);

  return {
    moduleAccess,
    loading,
    isMasterAccount,
    canAccessModule,
  };
}
