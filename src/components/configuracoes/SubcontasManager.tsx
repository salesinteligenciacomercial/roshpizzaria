import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Pencil, Trash2, Users, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NovaSubcontaDialog } from "./NovaSubcontaDialog";
import { EditarSubcontaDialog } from "./EditarSubcontaDialog";
import { UsuariosSubcontaDialog } from "./UsuariosSubcontaDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Subconta {
  id: string;
  name: string;
  cnpj: string | null;
  plan: string;
  status: string;
  max_users: number;
  max_leads: number;
  created_at: string;
  settings: any;
}

export function SubcontasManager() {
  const { toast } = useToast();
  const [subcontas, setSubcontas] = useState<Subconta[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaSubcontaOpen, setNovaSubcontaOpen] = useState(false);
  const [editarSubcontaOpen, setEditarSubcontaOpen] = useState(false);
  const [usuariosDialogOpen, setUsuariosDialogOpen] = useState(false);
  const [subcontaSelecionada, setSubcontaSelecionada] = useState<Subconta | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{
    total: number;
    updated: number;
    skipped?: number;
    errors: string[];
    details: Array<{ 
      companyId: string; 
      companyName: string; 
      status: string; 
      message?: string;
      updatesApplied?: string[];
    }>;
  } | null>(null);
  const [parentCompanyId, setParentCompanyId] = useState<string | null>(null);

  useEffect(() => {
    // Executar diagnóstico primeiro, depois carregar subcontas
    const inicializar = async () => {
      await carregarParentCompanyId();
      // Executar diagnóstico que também define as subcontas se encontrar
      await diagnosticarSubcontas();
      // Depois tentar carregar normalmente (pode encontrar mais subcontas)
      await carregarSubcontas();
    };
    inicializar();
  }, []);

  // Verificar e aplicar atualizações automaticamente quando subcontas são carregadas
  useEffect(() => {
    const verificarEAtualizar = async () => {
      if (subcontas.length > 0 && parentCompanyId && !atualizando) {
        // Verificar se alguma subconta precisa de atualização
        const subcontasDesatualizadas = subcontas.filter((subconta: any) => {
          const settings = subconta.settings || {};
          const systemVersion = settings.system_version || '0.0.0';
          // Se a versão do sistema da subconta é menor que a atual, precisa atualizar
          return systemVersion < '1.0.2';
        });

        if (subcontasDesatualizadas.length > 0) {
          console.log(`🔄 ${subcontasDesatualizadas.length} subconta(s) precisam de atualização`);
          // Não aplicar automaticamente, apenas avisar o usuário
          // O usuário pode clicar em "Aplicar Atualizações" quando quiser
        }
      }
    };

    verificarEAtualizar();
  }, [subcontas, parentCompanyId]);

  const carregarParentCompanyId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole, error } = await supabase.rpc('get_my_user_role');
      
      if (error) {
        console.error('Erro ao buscar role:', error);
        return;
      }

      // get_my_user_role retorna um array
      const role = Array.isArray(userRole) ? userRole[0] : userRole;

      if (role?.company_id) {
        setParentCompanyId(role.company_id);
      }
    } catch (error) {
      console.error('Erro ao carregar parent company ID:', error);
    }
  };

  const carregarSubcontas = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Iniciando carregamento de subcontas...');
      
      // Primeiro, verificar se o usuário é super_admin de uma conta mestre
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ Usuário não autenticado');
        setSubcontas([]);
        return;
      }

      // Buscar todas as roles do usuário (pode ter múltiplas empresas)
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role, company_id')
        .eq('user_id', user.id);

      if (rolesError) {
        console.error('❌ Erro ao buscar roles:', rolesError);
        throw rolesError;
      }

      console.log('👤 Todas as roles do usuário:', allRoles);

      // Buscar a role principal usando RPC (para compatibilidade)
      const { data: userRole, error: roleError } = await supabase.rpc('get_my_user_role');
      if (roleError) {
        console.warn('⚠️ Erro ao buscar role via RPC, usando roles diretas:', roleError);
      }

      const role = Array.isArray(userRole) ? userRole[0] : userRole;
      console.log('👤 Role principal do usuário:', role);

      // Encontrar todas as empresas onde o usuário é super_admin
      const superAdminCompanies = (allRoles || [])
        .filter((r: any) => r.role === 'super_admin')
        .map((r: any) => r.company_id)
        .filter(Boolean);

      console.log('🏢 Empresas onde é super_admin:', superAdminCompanies);

      if (superAdminCompanies.length === 0) {
        console.warn('⚠️ Usuário não é super_admin de nenhuma empresa');
        setSubcontas([]);
        return;
      }

      // Buscar informações das empresas para verificar quais são contas mestres
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, is_master_account, parent_company_id')
        .in('id', superAdminCompanies);

      if (companiesError) {
        console.error('❌ Erro ao buscar empresas:', companiesError);
        throw companiesError;
      }

      console.log('🏢 Dados das empresas:', companiesData);

      // Encontrar a conta mestre (ou usar a primeira empresa se não houver conta mestre explícita)
      const masterCompany = (companiesData || []).find((c: any) => c.is_master_account === true) 
        || (companiesData || [])[0];

      if (!masterCompany) {
        console.warn('⚠️ Nenhuma empresa encontrada');
        setSubcontas([]);
        return;
      }

      const masterCompanyId = masterCompany.id;
      console.log('✅ Conta mestre identificada:', masterCompanyId, masterCompany.name);

      // Usar Edge Function para buscar subcontas
      try {
        console.log('📞 Chamando Edge Function get-subcontas...');
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('get-subcontas');
        
        if (!edgeError && edgeData?.data) {
          const edgeSubcontas = Array.isArray(edgeData.data) ? edgeData.data : [];
          if (edgeSubcontas.length > 0) {
            console.log('✅ Subcontas carregadas via Edge Function:', edgeSubcontas.length);
            setSubcontas(edgeSubcontas);
            return;
          }
        } else if (edgeError) {
          console.warn('⚠️ Erro na Edge Function (continuando com fallback direto):', edgeError);
        }
      } catch (edgeErr) {
        console.warn('⚠️ Erro ao chamar Edge Function:', edgeErr);
      }

      // DIAGNÓSTICO: Verificar todas as empresas primeiro
      console.log('🔍 [DIAGNÓSTICO] Verificando todas as empresas no banco...');
      
      // Emails conhecidos das subcontas
      const emailsConhecidos = [
        'abconecta@gmail.com',
        'edsonoculos@gmail.com',
        'salesprofitadvice@gmail.com',
        'moreiragraff@gmail.com',
        'contato@jdpromotora.com.br'
      ];

      const { data: todasEmpresas, error: diagError } = await supabase
        .from('companies')
        .select('id, name, is_master_account, parent_company_id, status, created_at, settings')
        .order('created_at', { ascending: false });

      if (!diagError && todasEmpresas) {
        console.log('📊 [DIAGNÓSTICO] Total de empresas no banco:', todasEmpresas.length);
        
        // Filtrar subcontas por parent_company_id
        const subcontasPorParent = todasEmpresas.filter((e: any) => 
          e.parent_company_id === masterCompanyId && e.is_master_account === false
        );
        console.log('✅ [DIAGNÓSTICO] Subcontas encontradas por parent_company_id:', subcontasPorParent.length);

        // Buscar subcontas pelos emails conhecidos
        const subcontasPorEmail = todasEmpresas.filter((e: any) => {
          const email = e.settings?.email?.toLowerCase();
          return email && emailsConhecidos.some(known => known.toLowerCase() === email);
        });
        console.log('📧 [DIAGNÓSTICO] Subcontas encontradas por email:', subcontasPorEmail.length);

        // Combinar ambas as buscas (remover duplicatas)
        const todasSubcontas = [...new Map([
          ...subcontasPorParent,
          ...subcontasPorEmail
        ].map((s: any) => [s.id, s])).values()];

        console.log('✅ [DIAGNÓSTICO] Total de subcontas únicas encontradas:', todasSubcontas.length);
        
        if (todasSubcontas.length > 0) {
          // Buscar dados completos dessas subcontas
          const { data: fullData, error: fullError } = await supabase
            .from('companies')
            .select('id, name, cnpj, plan, status, max_users, max_leads, created_at, settings, parent_company_id, is_master_account')
            .in('id', todasSubcontas.map((e: any) => e.id))
            .order('created_at', { ascending: false });
          
          if (fullError) {
            console.error('❌ [DIAGNÓSTICO] Erro ao buscar dados completos:', fullError);
            // Usar dados básicos se a busca completa falhar
            const subcontasComInfo = todasSubcontas.map((sub: any) => ({
              ...sub,
              plan: sub.plan || 'basic',
              status: sub.status || 'active',
              max_users: sub.max_users || 5,
              max_leads: sub.max_leads || 1000,
              needsUpdate: (sub.settings?.system_version || '0.0.0') < '1.0.2'
            }));
            console.log('✅ [DIAGNÓSTICO] Usando dados básicos das subcontas encontradas');
            setSubcontas(subcontasComInfo);
            return;
          }
          
          if (fullData && fullData.length > 0) {
            console.log('✅ [DIAGNÓSTICO] Dados completos carregados:', fullData.length);
            const subcontasComInfo = fullData.map((sub: any) => ({
              ...sub,
              needsUpdate: (sub.settings?.system_version || '0.0.0') < '1.0.2'
            }));
            setSubcontas(subcontasComInfo);
            return;
          }
        } else {
          console.warn('⚠️ [DIAGNÓSTICO] Nenhuma subconta encontrada pelos métodos de busca');
          console.log('📋 [DIAGNÓSTICO] Todas as empresas:', todasEmpresas.map((e: any) => ({
            id: e.id,
            name: e.name,
            email: e.settings?.email,
            is_master: e.is_master_account,
            parent_id: e.parent_company_id,
            status: e.status
          })));
        }
      }

      // Fallback: buscar diretamente todas as subcontas
      console.log('🔄 Buscando subcontas diretamente da tabela companies...');
      console.log('🔍 Buscando subcontas com parent_company_id =', masterCompanyId);

      // Primeira tentativa: buscar por parent_company_id
      // Usar select com todas as colunas necessárias
      let { data: subcontasData, error: subcontasError } = await supabase
        .from('companies')
        .select('id, name, cnpj, plan, status, max_users, max_leads, created_at, settings, parent_company_id, is_master_account')
        .eq('parent_company_id', masterCompanyId)
        .order('created_at', { ascending: false });
      
      console.log('🔍 Resultado da busca direta:', { 
        encontradas: subcontasData?.length || 0, 
        erro: subcontasError?.message,
        masterCompanyId,
        dados: subcontasData
      });

      if (subcontasError) {
        console.error('❌ Erro ao buscar subcontas por parent_company_id:', subcontasError);
        
        // Segunda tentativa: buscar todas as empresas que não são contas mestres
        console.log('🔄 Tentando buscar todas as empresas não-mestres...');
        const { data: allCompanies, error: allError } = await supabase
          .from('companies')
          .select('*')
          .eq('is_master_account', false)
          .order('created_at', { ascending: false });

        if (allError) {
          console.error('❌ Erro ao buscar todas as empresas:', allError);
          throw subcontasError;
        }

        // Filtrar apenas as que têm parent_company_id correspondente
        subcontasData = (allCompanies || []).filter((c: any) => 
          c.parent_company_id === masterCompanyId
        );
        subcontasError = null;
      }

      console.log('✅ Subcontas encontradas:', subcontasData?.length || 0);
      console.log('📋 Dados das subcontas:', subcontasData);

      if (subcontasData && subcontasData.length > 0) {
        console.log('✅ Definindo subcontas no estado:', subcontasData.length);
        // Verificar se as subcontas têm atualizações aplicadas
        const subcontasComInfo = subcontasData.map((sub: any) => ({
          ...sub,
          needsUpdate: (sub.settings?.system_version || '0.0.0') < '1.0.2'
        }));
        setSubcontas(subcontasComInfo);
      } else {
        console.warn('⚠️ Nenhuma subconta encontrada. Verificando se há subcontas no banco...');
        
        // Última tentativa: verificar se existem subcontas no banco (sem filtro de RLS)
        const { data: allSubcontas, error: checkError } = await supabase
          .from('companies')
          .select('id, name, parent_company_id, is_master_account')
          .eq('is_master_account', false)
          .not('parent_company_id', 'is', null);

        if (!checkError && allSubcontas) {
          console.log('📊 Total de subcontas no banco (sem filtro):', allSubcontas.length);
          console.log('📋 Subcontas no banco:', allSubcontas);
          
          // Filtrar manualmente as que pertencem à conta mestre
          const filteredSubcontas = allSubcontas.filter((c: any) => 
            c.parent_company_id === masterCompanyId
          );
          
          if (filteredSubcontas.length > 0) {
            console.log('✅ Subcontas filtradas encontradas:', filteredSubcontas.length);
            console.log('📋 IDs das subcontas filtradas:', filteredSubcontas.map((c: any) => c.id));
            
            // Buscar dados completos dessas subcontas
            const { data: fullData, error: fullDataError } = await supabase
              .from('companies')
              .select('id, name, cnpj, plan, status, max_users, max_leads, created_at, settings, parent_company_id, is_master_account')
              .in('id', filteredSubcontas.map((c: any) => c.id))
              .order('created_at', { ascending: false });
            
            if (fullDataError) {
              console.error('❌ Erro ao buscar dados completos:', fullDataError);
            }
            
            if (fullData && fullData.length > 0) {
              console.log('✅ Dados completos carregados:', fullData.length);
              setSubcontas(fullData);
              return;
            } else {
              // Se não conseguiu buscar dados completos, usar os dados básicos filtrados
              console.log('⚠️ Usando dados básicos filtrados');
              setSubcontas(filteredSubcontas.map((c: any) => ({
                ...c,
                plan: c.plan || 'basic',
                status: c.status || 'active',
                max_users: c.max_users || 5,
                max_leads: c.max_leads || 1000,
                settings: c.settings || {}
              })));
              return;
            }
          }
        }
        
        // ÚLTIMA TENTATIVA: Buscar diretamente pelos emails conhecidos
        console.log('🔄 [ÚLTIMA TENTATIVA] Buscando subcontas pelos emails conhecidos...');
        const emailsConhecidos = [
          'abconecta@gmail.com',
          'edsonoculos@gmail.com',
          'salesprofitadvice@gmail.com',
          'moreiragraff@gmail.com',
          'contato@jdpromotora.com.br'
        ];

        // Buscar todas as empresas novamente e filtrar por email
        const { data: todasEmpresasFinal } = await supabase
          .from('companies')
          .select('id, name, cnpj, plan, status, max_users, max_leads, created_at, settings, parent_company_id, is_master_account')
          .order('created_at', { ascending: false });

        if (todasEmpresasFinal) {
          const subcontasPorEmail = todasEmpresasFinal.filter((e: any) => {
            const email = e.settings?.email?.toLowerCase();
            return email && emailsConhecidos.some(known => known.toLowerCase() === email);
          });

          console.log('📧 [ÚLTIMA TENTATIVA] Subcontas encontradas por email:', subcontasPorEmail.length);

          if (subcontasPorEmail.length > 0) {
            console.log('✅ [ÚLTIMA TENTATIVA] Definindo subcontas encontradas por email no estado');
            const subcontasComInfo = subcontasPorEmail.map((sub: any) => ({
              ...sub,
              needsUpdate: (sub.settings?.system_version || '0.0.0') < '1.0.2'
            }));
            setSubcontas(subcontasComInfo);
            return;
          }
        }

        setSubcontas([]);
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar subcontas:', error);
      console.error('❌ Detalhes do erro:', JSON.stringify(error, null, 2));
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar subcontas',
        description: error.message || 'Não foi possível carregar as subcontas. Verifique se você é super admin de uma conta mestre.',
      });
      setSubcontas([]);
    } finally {
      setLoading(false);
    }
  };

  const abrirEditarSubconta = (subconta: Subconta) => {
    setSubcontaSelecionada(subconta);
    setEditarSubcontaOpen(true);
  };

  const abrirGerenciarUsuarios = (subconta: Subconta) => {
    setSubcontaSelecionada(subconta);
    setUsuariosDialogOpen(true);
  };

  const deletarSubconta = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta subconta? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Subconta deletada',
        description: 'A subconta foi removida com sucesso.',
      });

      await carregarSubcontas();
    } catch (error: any) {
      console.error('Erro ao deletar subconta:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao deletar subconta',
        description: error.message,
      });
    }
  };

  const diagnosticarSubcontas = async () => {
    try {
      console.log('🔍 [DIAGNÓSTICO] Iniciando diagnóstico completo...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ [DIAGNÓSTICO] Usuário não autenticado');
        return;
      }

      // Emails conhecidos das subcontas
      const emailsConhecidos = [
        'abconecta@gmail.com',
        'edsonoculos@gmail.com',
        'salesprofitadvice@gmail.com',
        'moreiragraff@gmail.com',
        'contato@jdpromotora.com.br'
      ];

      console.log('📧 [DIAGNÓSTICO] Buscando subcontas pelos emails conhecidos...');

      // Buscar todas as empresas
      const { data: todasEmpresas } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('📊 [DIAGNÓSTICO] Total de empresas no banco:', todasEmpresas?.length || 0);
      
      // Buscar conta mestre
      const { data: userRole } = await supabase.rpc('get_my_user_role');
      const role = Array.isArray(userRole) ? userRole[0] : userRole;
      const masterCompanyId = role?.company_id;

      console.log('🏢 [DIAGNÓSTICO] Conta mestre ID:', masterCompanyId);

      if (masterCompanyId) {
        // Filtrar subcontas por parent_company_id
        const subcontasPorParent = (todasEmpresas || []).filter((e: any) => 
          e.parent_company_id === masterCompanyId && e.is_master_account === false
        );

        console.log('📋 [DIAGNÓSTICO] Subcontas encontradas por parent_company_id:', subcontasPorParent.length);

        // Buscar subcontas pelos emails conhecidos
        const subcontasPorEmail = (todasEmpresas || []).filter((e: any) => {
          const email = e.settings?.email?.toLowerCase();
          return email && emailsConhecidos.includes(email.toLowerCase());
        });

        console.log('📧 [DIAGNÓSTICO] Subcontas encontradas por email:', subcontasPorEmail.length);
        subcontasPorEmail.forEach((sub: any) => {
          console.log(`  - ${sub.name} (${sub.settings?.email})`);
          console.log(`    ID: ${sub.id}`);
          console.log(`    parent_company_id: ${sub.parent_company_id}`);
          console.log(`    masterCompanyId esperado: ${masterCompanyId}`);
          console.log(`    Match: ${sub.parent_company_id === masterCompanyId ? '✅' : '❌'}`);
        });

        // Combinar ambas as buscas
        const todasSubcontas = [...new Map([
          ...subcontasPorParent,
          ...subcontasPorEmail
        ].map((s: any) => [s.id, s])).values()];

        console.log('📋 [DIAGNÓSTICO] Total de subcontas únicas encontradas:', todasSubcontas.length);
        
        todasSubcontas.forEach((sub: any, index: number) => {
          console.log(`  ${index + 1}. ${sub.name} (${sub.id})`);
          console.log(`     - Email: ${sub.settings?.email || 'N/A'}`);
          console.log(`     - Status: ${sub.status}`);
          console.log(`     - Plano: ${sub.plan}`);
          console.log(`     - parent_company_id: ${sub.parent_company_id}`);
          console.log(`     - Versão sistema: ${sub.settings?.system_version || '0.0.0'}`);
          console.log(`     - Atualizações aplicadas: ${sub.settings?.applied_updates?.length || 0}`);
        });

        // Verificar atualizações
        const desatualizadas = todasSubcontas.filter((s: any) => {
          const version = s.settings?.system_version || '0.0.0';
          return version < '1.0.2';
        });

        if (desatualizadas.length > 0) {
          console.log(`⚠️ [DIAGNÓSTICO] ${desatualizadas.length} subconta(s) precisam de atualização`);
        }

        // Se encontrou subcontas, definir no estado
        if (todasSubcontas.length > 0) {
          console.log('✅ [DIAGNÓSTICO] Definindo subcontas no estado...');
          const subcontasComInfo = todasSubcontas.map((sub: any) => ({
            ...sub,
            needsUpdate: (sub.settings?.system_version || '0.0.0') < '1.0.2'
          }));
          setSubcontas(subcontasComInfo);
        }

        return {
          total: todasEmpresas?.length || 0,
          subcontas: todasSubcontas.length,
          desatualizadas: desatualizadas.length,
          dados: todasSubcontas
        };
      }
    } catch (error: any) {
      console.error('❌ [DIAGNÓSTICO] Erro:', error);
    }
  };

  const aplicarAtualizacoes = async (forceUpdate: boolean = false) => {
    if (!parentCompanyId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível identificar a conta matriz.',
      });
      return;
    }

    setAtualizando(true);
    setUpdateProgress(null);

    try {
      console.log('🔄 [SubcontasManager] Aplicando atualizações...', { forceUpdate });

      const { data, error } = await supabase.functions.invoke('aplicar-atualizacoes-subcontas', {
        body: {
          parentCompanyId: parentCompanyId,
          forceUpdate: forceUpdate // Permitir forçar atualização
        }
      });

      if (error) throw error;

      console.log('✅ [SubcontasManager] Atualizações aplicadas:', data);

      setUpdateProgress({
        total: data.total || 0,
        updated: data.updated || 0,
        skipped: data.skipped || 0,
        errors: data.errors || [],
        details: data.details || []
      });

      const message = forceUpdate 
        ? `${data.updated} de ${data.total} subcontas foram atualizadas (forçado).`
        : `${data.updated} de ${data.total} subcontas foram atualizadas com sucesso. ${data.skipped || 0} já estavam atualizadas.`;

      toast({
        title: 'Atualizações aplicadas!',
        description: message,
      });

      // Recarregar subcontas para refletir mudanças
      await carregarSubcontas();

    } catch (error: any) {
      console.error('❌ [SubcontasManager] Erro ao aplicar atualizações:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao aplicar atualizações',
        description: error.message || 'Não foi possível aplicar as atualizações.',
      });
    } finally {
      setAtualizando(false);
    }
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, any> = {
      free: 'secondary',
      basic: 'default',
      premium: 'default',
    };
    const labels: Record<string, string> = {
      free: 'Free',
      basic: 'Padrão',
      premium: 'Premium',
    };
    return (
      <Badge variant={variants[plan] || 'default'}>
        {labels[plan] || plan}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: 'default',
      inactive: 'secondary',
      suspended: 'destructive',
    };
    const labels: Record<string, string> = {
      active: 'Ativa',
      inactive: 'Inativa',
      suspended: 'Suspensa',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Subcontas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando subcontas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciar Subcontas / Licenças SaaS</CardTitle>
              <CardDescription>
                Crie e gerencie licenças de CRM para seus clientes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={async () => {
                  await diagnosticarSubcontas();
                  await carregarSubcontas();
                }}
                variant="ghost"
                size="icon"
                title="Recarregar lista de subcontas e executar diagnóstico"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                onClick={() => setShowUpdateDialog(true)}
                variant="outline"
                disabled={atualizando || subcontas.length === 0}
                className="border-primary/50 hover:bg-primary/10"
                title={subcontas.length === 0 ? 'Crie subcontas primeiro' : 'Aplicar melhorias e atualizações nas subcontas'}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${atualizando ? 'animate-spin' : ''}`} />
                Aplicar Atualizações
              </Button>
              <Button onClick={() => setNovaSubcontaOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Subconta
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {subcontas.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma subconta criada</h3>
              <p className="text-muted-foreground mt-2">
                Comece criando sua primeira licença de CRM para um cliente
              </p>
              <Button onClick={() => setNovaSubcontaOpen(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Subconta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {subcontas.map((subconta) => (
                <div
                  key={subconta.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <h4 className="font-semibold text-lg">{subconta.name}</h4>
                      {getPlanBadge(subconta.plan)}
                      {getStatusBadge(subconta.status)}
                      {(subconta as any).needsUpdate && (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">
                          ⚠️ Desatualizada
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                      {subconta.cnpj && (
                        <span>
                          <strong>CNPJ:</strong> {subconta.cnpj}
                        </span>
                      )}
                      <span>
                        <strong>Usuários:</strong> {subconta.max_users}
                      </span>
                      <span>
                        <strong>Leads:</strong> {subconta.max_leads}
                      </span>
                    </div>
                    {subconta.settings?.email && (
                      <div className="text-sm text-muted-foreground mt-1">
                        <strong>Contato:</strong> {subconta.settings.responsavel} • {subconta.settings.email}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      <strong>Versão:</strong> {(subconta.settings?.system_version || '0.0.0')} 
                      {(subconta as any).needsUpdate && (
                        <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                          (Precisa atualizar para 1.0.2)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirGerenciarUsuarios(subconta)}
                      title="Gerenciar usuários"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirEditarSubconta(subconta)}
                      title="Editar subconta"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deletarSubconta(subconta.id)}
                      title="Deletar subconta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Atualização */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Aplicar Atualizações nas Subcontas
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                <p>
                  Esta ação irá aplicar <strong>apenas melhorias pendentes</strong> em <strong>todas as subcontas</strong>.
                  O sistema é <strong>100% seguro</strong> e <strong>nunca altera dados existentes</strong>.
                </p>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mt-2">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    💡 Dica: Use "Forçar Atualização" se as subcontas não receberam melhorias recentes
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    🔒 Garantias de Segurança:
                  </p>
                  <ul className="list-disc list-inside text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <li>Apenas adiciona dados novos (nunca altera existentes)</li>
                    <li>Pula subcontas que já estão atualizadas</li>
                    <li>Rastreia versões aplicadas para evitar duplicações</li>
                    <li>Preserva todas as configurações existentes</li>
                  </ul>
                </div>
                <p className="mt-3 font-medium text-foreground">
                  Total de subcontas: <strong>{subcontas.length}</strong>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {updateProgress && (
            <div className="space-y-3 py-4">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso:</span>
                <span className="font-medium">
                  {updateProgress.updated} de {updateProgress.total} atualizadas
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${updateProgress.total > 0 ? (updateProgress.updated / updateProgress.total) * 100 : 0}%` }}
                />
              </div>

              {updateProgress.details.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2 mt-4">
                  {updateProgress.details.map((detail, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        detail.status === 'success'
                          ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                      }`}
                    >
                      {detail.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className="flex-1 font-medium">{detail.companyName}</span>
                      <span className="text-xs text-muted-foreground">
                        {detail.status === 'success' 
                          ? `✅ ${detail.message || 'Atualizada'}` 
                          : detail.status === 'skipped'
                          ? '⏭️ Já atualizada'
                          : '❌ Erro'}
                      </span>
                      {detail.updatesApplied && detail.updatesApplied.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {detail.updatesApplied.length} atualização(ões)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {updateProgress.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                    Erros encontrados:
                  </p>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                    {updateProgress.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={atualizando}>
              {updateProgress ? 'Fechar' : 'Cancelar'}
            </AlertDialogCancel>
            {!updateProgress && (
              <>
                <Button
                  onClick={() => aplicarAtualizacoes(true)}
                  disabled={atualizando}
                  variant="outline"
                  className="border-yellow-500/50 hover:bg-yellow-500/10"
                >
                  {atualizando ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Forçar Atualização
                    </>
                  )}
                </Button>
              <AlertDialogAction
                  onClick={() => aplicarAtualizacoes(false)}
                disabled={atualizando}
                className="bg-primary hover:bg-primary/90"
              >
                {atualizando ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Aplicar Atualizações
                  </>
                )}
              </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NovaSubcontaDialog
        open={novaSubcontaOpen}
        onOpenChange={setNovaSubcontaOpen}
        onSuccess={carregarSubcontas}
      />

      {subcontaSelecionada && (
        <>
          <EditarSubcontaDialog
            company={subcontaSelecionada}
            open={editarSubcontaOpen}
            onOpenChange={setEditarSubcontaOpen}
            onSuccess={carregarSubcontas}
          />
          <UsuariosSubcontaDialog
            open={usuariosDialogOpen}
            onOpenChange={setUsuariosDialogOpen}
            company={{
              id: subcontaSelecionada.id,
              name: subcontaSelecionada.name
            }}
          />
        </>
      )}
    </>
  );
}
