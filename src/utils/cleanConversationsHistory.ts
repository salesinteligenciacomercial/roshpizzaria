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
 * ⚡ Usa deleção em lotes pequenos para evitar timeout e respeitar RLS
 */
export const cleanSupabaseConversations = async (onProgress?: (progress: number, deletedCount: number, totalMessages: number) => void): Promise<{ success: boolean; deletedCount?: number; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Usuário não autenticado" };
    }
    
    // Buscar company_id ATUAL do usuário (apenas a empresa ativa)
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();
    
    if (roleError || !userRole?.company_id) {
      return { success: false, error: "Erro ao buscar empresa do usuário" };
    }
    
    const currentCompanyId = userRole.company_id;
    
    // Contar quantas mensagens serão deletadas
    const { count } = await supabase
      .from('conversas')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', currentCompanyId);
    
    const totalMessages = count || 0;
    
    console.log(`🧹 Deletando ${totalMessages} conversas da empresa atual em lotes pequenos...`);
    
    // Notificar progresso inicial
    if (onProgress) {
      onProgress(0, 0, totalMessages);
    }
    
    // Deletar em lotes PEQUENOS para evitar timeout e problemas de RLS
    const BATCH_SIZE = 500; // Reduzido para evitar timeout
    let deletedTotal = 0;
    let hasMore = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 100; // Segurança contra loops infinitos
    
    while (hasMore && attempts < MAX_ATTEMPTS) {
      attempts++;
      
      try {
        // Buscar IDs de um lote
        const { data: batch, error: fetchError } = await supabase
          .from('conversas')
          .select('id')
          .eq('company_id', currentCompanyId)
          .limit(BATCH_SIZE);
        
        if (fetchError) {
          console.error('❌ Erro ao buscar lote:', fetchError);
          return { success: false, error: fetchError.message };
        }
        
        if (!batch || batch.length === 0) {
          hasMore = false;
          break;
        }
        
        // Deletar lote
        const batchIds = batch.map(c => c.id);
        const { error: deleteError } = await supabase
          .from('conversas')
          .delete()
          .in('id', batchIds);
        
        if (deleteError) {
          console.error('❌ Erro ao deletar lote:', deleteError);
          // Tentar continuar com próximo lote mesmo com erro
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        
        deletedTotal += batch.length;
        console.log(`📊 Progresso: ${deletedTotal}/${totalMessages} conversas deletadas (tentativa ${attempts})`);
        
        // Notificar progresso
        if (onProgress && totalMessages > 0) {
          const progress = Math.round((deletedTotal / totalMessages) * 100);
          onProgress(progress, deletedTotal, totalMessages);
        }
        
        // Se deletou menos que o tamanho do lote, não há mais registros
        if (batch.length < BATCH_SIZE) {
          hasMore = false;
        }
        
        // Pausa maior entre lotes para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (batchError: any) {
        console.error('❌ Erro no lote:', batchError);
        // Continuar mesmo com erro
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`✅ ${deletedTotal} mensagens deletadas da tabela conversas`);
    return { success: true, deletedCount: deletedTotal };
    
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
export const cleanAllConversationsHistory = async (
  companyId?: string,
  onProgress?: (progress: number, deletedCount: number, totalMessages: number) => void
): Promise<{
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
    const supabaseResult = await cleanSupabaseConversations(onProgress);
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

