/**
 * Utilitário para limpar histórico de conversas/mensagens
 * 
 * ATENÇÃO: Este script limpa APENAS:
 * - Tabela 'conversas' no Supabase (apenas dados, mantém estrutura)
 * - Caches do localStorage relacionados a conversas
 * 
 * NÃO ALTERA:
 * - Funil de vendas (tabela leads, kanban, etc)
 * - Tarefas
 * - Agenda
 * - Outros dados do sistema
 */

import { supabase } from "@/integrations/supabase/client";

// Chaves do localStorage relacionadas a conversas
// ⚠️ IMPORTANTE: Manter lista específica para não afetar outras funcionalidades
const CONVERSATION_CACHE_KEYS = [
  "continuum_conversations",
  "continuum_conversations_cache",
  "continuum_conversations_cache_timestamp",
  "conversas_cache_v1",
  // Chaves específicas de cache de conversas
  "conversas_cache",
  "conversations_cache",
];

/**
 * Limpa todas as mensagens da tabela conversas no Supabase
 * Mantém a estrutura da tabela intacta
 * ⚠️ DELETA TODAS AS CONVERSAS do owner_id do usuário (todas as empresas)
 */
export const cleanSupabaseConversations = async (): Promise<{ success: boolean; deletedCount?: number; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Usuário não autenticado" };
    }
    
    // Buscar TODAS as company_ids que o usuário tem acesso
    const { data: userCompanies, error: companiesError } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', user.id);
    
    if (companiesError || !userCompanies || userCompanies.length === 0) {
      return { success: false, error: "Erro ao buscar empresas do usuário" };
    }
    
    const companyIds = userCompanies.map(ur => ur.company_id);
    
    // Contar quantas mensagens serão deletadas
    const { count } = await supabase
      .from('conversas')
      .select('*', { count: 'exact', head: true })
      .in('company_id', companyIds);
    
    const totalMessages = count || 0;
    
    console.log(`🧹 Deletando ${totalMessages} conversas de ${companyIds.length} empresa(s)...`);
    
    // Deletar TODAS as conversas de TODAS as empresas do usuário
    const { error: deleteError } = await supabase
      .from('conversas')
      .delete()
      .in('company_id', companyIds);
    
    if (deleteError) {
      console.error('❌ Erro ao limpar conversas:', deleteError);
      return { success: false, error: deleteError.message };
    }
    
    console.log(`✅ ${totalMessages} mensagens deletadas da tabela conversas (todas as empresas)`);
    return { success: true, deletedCount: totalMessages };
    
  } catch (error: any) {
    console.error('❌ Erro ao limpar conversas do Supabase:', error);
    return { success: false, error: error.message || "Erro desconhecido" };
  }
};

/**
 * Limpa todos os caches do localStorage relacionados a conversas
 */
export const cleanLocalStorageConversations = (): { success: boolean; cleanedKeys: string[] } => {
  const cleanedKeys: string[] = [];
  
  try {
    // Limpar cada chave de cache relacionada a conversas
    CONVERSATION_CACHE_KEYS.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          localStorage.removeItem(key);
          cleanedKeys.push(key);
          console.log(`✅ Cache removido: ${key}`);
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao remover cache ${key}:`, error);
      }
    });
    
    // ⚠️ CORREÇÃO: NÃO remover chaves genéricas que contenham "conversa" ou "conversation"
    // Isso pode afetar outras funcionalidades. Apenas remover chaves específicas listadas acima.
    // Se precisar adicionar novas chaves, adicione à lista CONVERSATION_CACHE_KEYS
    
    console.log(`✅ Total de ${cleanedKeys.length} caches removidos do localStorage`);
    return { success: true, cleanedKeys };
    
  } catch (error) {
    console.error('❌ Erro ao limpar localStorage:', error);
    return { success: false, cleanedKeys };
  }
};

/**
 * Função de diagnóstico: verifica se outras funcionalidades foram afetadas
 */
export const diagnoseSystemHealth = async (companyId?: string): Promise<{
  leads: { count: number; error?: string };
  tasks: { count: number; error?: string };
  funis: { count: number; error?: string };
  etapas: { count: number; error?: string };
  whatsappConnections: { count: number; error?: string };
}> => {
  try {
    let currentCompanyId = companyId;
    
    if (!currentCompanyId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();
        currentCompanyId = userRole?.company_id;
      }
    }

    const results = {
      leads: { count: 0, error: undefined as string | undefined },
      tasks: { count: 0, error: undefined as string | undefined },
      funis: { count: 0, error: undefined as string | undefined },
      etapas: { count: 0, error: undefined as string | undefined },
      whatsappConnections: { count: 0, error: undefined as string | undefined },
    };

    // Verificar leads
    try {
      const { count, error } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', currentCompanyId || '');
      results.leads = { count: count || 0, error: error?.message };
    } catch (e: any) {
      results.leads = { count: 0, error: e.message };
    }

    // Verificar tarefas
    try {
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', currentCompanyId || '');
      results.tasks = { count: count || 0, error: error?.message };
    } catch (e: any) {
      results.tasks = { count: 0, error: e.message };
    }

    // Verificar funis
    try {
      const { count, error } = await supabase
        .from('funis')
        .select('*', { count: 'exact', head: true });
      results.funis = { count: count || 0, error: error?.message };
    } catch (e: any) {
      results.funis = { count: 0, error: e.message };
    }

    // Verificar etapas
    try {
      const { count, error } = await supabase
        .from('etapas')
        .select('*', { count: 'exact', head: true });
      results.etapas = { count: count || 0, error: error?.message };
    } catch (e: any) {
      results.etapas = { count: 0, error: e.message };
    }

    // Verificar conexões WhatsApp
    try {
      const { count, error } = await supabase
        .from('whatsapp_connections')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', currentCompanyId || '');
      results.whatsappConnections = { count: count || 0, error: error?.message };
    } catch (e: any) {
      results.whatsappConnections = { count: 0, error: e.message };
    }

    return results;
  } catch (error: any) {
    console.error('❌ Erro ao diagnosticar sistema:', error);
    throw error;
  }
};

/**
 * Função principal: limpa todo o histórico de conversas
 * - Limpa tabela conversas no Supabase (TODAS as empresas do usuário)
 * - Limpa todos os caches do localStorage
 * - ⚠️ GARANTE que não afeta outras funcionalidades
 */
export const cleanAllConversationsHistory = async (companyId?: string): Promise<{
  success: boolean;
  supabaseResult?: { deletedCount?: number };
  localStorageResult?: { cleanedKeys: string[] };
  diagnosis?: Awaited<ReturnType<typeof diagnoseSystemHealth>>;
  error?: string;
}> => {
  try {
    console.log('🧹 Iniciando limpeza TOTAL do histórico de conversas (todas as empresas)...');
    
    // ⚡ DIAGNÓSTICO ANTES: Verificar estado do sistema antes da limpeza
    console.log('🔍 Verificando estado do sistema antes da limpeza...');
    const diagnosisBefore = await diagnoseSystemHealth(companyId);
    console.log('📊 Estado antes:', diagnosisBefore);
    
    // 1. Limpar Supabase (TODAS as conversas de TODAS as empresas do usuário)
    const supabaseResult = await cleanSupabaseConversations();
    if (!supabaseResult.success) {
      return {
        success: false,
        error: `Erro ao limpar Supabase: ${supabaseResult.error}`,
        diagnosis: diagnosisBefore,
      };
    }
    
    // 2. Limpar localStorage (APENAS chaves específicas de conversas)
    const localStorageResult = cleanLocalStorageConversations();
    
    // ⚡ DIAGNÓSTICO DEPOIS: Verificar se algo foi afetado
    console.log('🔍 Verificando estado do sistema após a limpeza...');
    const diagnosisAfter = await diagnoseSystemHealth(companyId);
    console.log('📊 Estado depois:', diagnosisAfter);
    
    // Verificar se alguma funcionalidade foi afetada
    const issues: string[] = [];
    if (diagnosisAfter.leads.count !== diagnosisBefore.leads.count) {
      issues.push(`⚠️ Leads: ${diagnosisBefore.leads.count} → ${diagnosisAfter.leads.count}`);
    }
    if (diagnosisAfter.tasks.count !== diagnosisBefore.tasks.count) {
      issues.push(`⚠️ Tarefas: ${diagnosisBefore.tasks.count} → ${diagnosisAfter.tasks.count}`);
    }
    if (diagnosisAfter.funis.count !== diagnosisBefore.funis.count) {
      issues.push(`⚠️ Funis: ${diagnosisBefore.funis.count} → ${diagnosisAfter.funis.count}`);
    }
    if (diagnosisAfter.etapas.count !== diagnosisBefore.etapas.count) {
      issues.push(`⚠️ Etapas: ${diagnosisBefore.etapas.count} → ${diagnosisAfter.etapas.count}`);
    }
    if (diagnosisAfter.whatsappConnections.count !== diagnosisBefore.whatsappConnections.count) {
      issues.push(`⚠️ Conexões WhatsApp: ${diagnosisBefore.whatsappConnections.count} → ${diagnosisAfter.whatsappConnections.count}`);
    }
    
    if (issues.length > 0) {
      console.error('❌ ATENÇÃO: Funcionalidades afetadas pela limpeza:', issues);
      return {
        success: false,
        error: `Funcionalidades afetadas: ${issues.join(', ')}`,
        supabaseResult: {
          deletedCount: supabaseResult.deletedCount,
        },
        localStorageResult: {
          cleanedKeys: localStorageResult.cleanedKeys,
        },
        diagnosis: diagnosisAfter,
      };
    }
    
    console.log('✅ Limpeza do histórico de conversas concluída com sucesso!');
    console.log('✅ Todas as outras funcionalidades estão intactas.');
    
    return {
      success: true,
      supabaseResult: {
        deletedCount: supabaseResult.deletedCount,
      },
      localStorageResult: {
        cleanedKeys: localStorageResult.cleanedKeys,
      },
      diagnosis: diagnosisAfter,
    };
    
  } catch (error: any) {
    console.error('❌ Erro ao limpar histórico de conversas:', error);
    return {
      success: false,
      error: error.message || "Erro desconhecido",
    };
  }
};

