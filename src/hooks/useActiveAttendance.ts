import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para gerenciar atendimentos ativos
 * 
 * Regras de negócio:
 * 1. Quando usuário responde: cria/atualiza registro com expires_at = agora + 5 minutos
 * 2. Quando contato responde durante atendimento ativo: atualiza last_activity_at e expires_at
 * 3. Se passar 5 minutos sem interação: atendimento considerado expirado
 * 4. Novo usuário pode assumir após expiração
 */

export interface ActiveAttendance {
  id: string;
  company_id: string;
  telefone_formatado: string;
  attending_user_id: string;
  attending_user_name: string | null;
  started_at: string;
  last_activity_at: string;
  expires_at: string;
}

export interface AttendingUser {
  id: string;
  name: string;
}

// Tempo de expiração do atendimento: 5 minutos
export const TEMPO_ATENDIMENTO_ATIVO = 5 * 60 * 1000; // 5 minutos em ms

export const useActiveAttendance = (companyId: string | null) => {
  const [activeAttendances, setActiveAttendances] = useState<Map<string, ActiveAttendance>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const currentUserNameRef = useRef<string | null>(null);

  // Carregar ID e nome do usuário atual
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUserIdRef.current = user.id;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single();
          
          currentUserNameRef.current = profile?.full_name || profile?.email || 'Usuário';
        }
      } catch (error) {
        console.error('❌ [ATTENDANCE] Erro ao carregar usuário:', error);
      }
    };
    
    loadCurrentUser();
  }, []);

  // Carregar atendimentos ativos da empresa
  const loadActiveAttendances = useCallback(async () => {
    if (!companyId) return;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('active_attendances')
        .select('*')
        .eq('company_id', companyId);

      if (error) {
        console.error('❌ [ATTENDANCE] Erro ao carregar atendimentos:', error);
        return;
      }

      const attendancesMap = new Map<string, ActiveAttendance>();
      (data || []).forEach(attendance => {
        attendancesMap.set(attendance.telefone_formatado, attendance as ActiveAttendance);
      });

      setActiveAttendances(attendancesMap);
      console.log(`📋 [ATTENDANCE] ${attendancesMap.size} atendimentos ativos carregados`);
    } catch (error) {
      console.error('❌ [ATTENDANCE] Erro:', error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Carregar atendimentos quando company_id mudar
  useEffect(() => {
    if (companyId) {
      loadActiveAttendances();
    }
  }, [companyId, loadActiveAttendances]);

  // Subscription realtime para atendimentos ativos
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`active_attendances_${companyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'active_attendances',
        filter: `company_id=eq.${companyId}`
      }, (payload) => {
        console.log('🔄 [ATTENDANCE-REALTIME] Mudança detectada:', payload.eventType);
        
        if (payload.eventType === 'DELETE') {
          const oldData = payload.old as any;
          if (oldData?.telefone_formatado) {
            setActiveAttendances(prev => {
              const newMap = new Map(prev);
              newMap.delete(oldData.telefone_formatado);
              return newMap;
            });
          }
        } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const newData = payload.new as ActiveAttendance;
          setActiveAttendances(prev => {
            const newMap = new Map(prev);
            newMap.set(newData.telefone_formatado, newData);
            return newMap;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  // Iniciar/atualizar atendimento quando usuário responde
  const startOrRefreshAttendance = useCallback(async (telefoneFormatado: string): Promise<boolean> => {
    if (!companyId || !currentUserIdRef.current) {
      console.warn('⚠️ [ATTENDANCE] Sem companyId ou userId');
      return false;
    }

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TEMPO_ATENDIMENTO_ATIVO);

      // Upsert: criar ou atualizar atendimento
      const { error } = await supabase
        .from('active_attendances')
        .upsert({
          company_id: companyId,
          telefone_formatado: telefoneFormatado,
          attending_user_id: currentUserIdRef.current,
          attending_user_name: currentUserNameRef.current,
          last_activity_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        }, {
          onConflict: 'company_id,telefone_formatado'
        });

      if (error) {
        console.error('❌ [ATTENDANCE] Erro ao registrar atendimento:', error);
        return false;
      }

      console.log(`✅ [ATTENDANCE] Atendimento registrado para ${telefoneFormatado} até ${expiresAt.toLocaleTimeString()}`);
      return true;
    } catch (error) {
      console.error('❌ [ATTENDANCE] Erro:', error);
      return false;
    }
  }, [companyId]);

  // Atualizar tempo de atendimento quando há interação
  const refreshAttendance = useCallback(async (telefoneFormatado: string): Promise<boolean> => {
    if (!companyId) return false;

    const existingAttendance = activeAttendances.get(telefoneFormatado);
    if (!existingAttendance) return false;

    // Verificar se o atendimento ainda é válido
    const now = new Date();
    const expiresAt = new Date(existingAttendance.expires_at);
    
    if (now > expiresAt) {
      // Atendimento expirou, remover
      console.log(`⏰ [ATTENDANCE] Atendimento expirado para ${telefoneFormatado}`);
      return false;
    }

    // Atualizar tempo de expiração
    const newExpiresAt = new Date(now.getTime() + TEMPO_ATENDIMENTO_ATIVO);

    try {
      const { error } = await supabase
        .from('active_attendances')
        .update({
          last_activity_at: now.toISOString(),
          expires_at: newExpiresAt.toISOString(),
        })
        .eq('company_id', companyId)
        .eq('telefone_formatado', telefoneFormatado);

      if (error) {
        console.error('❌ [ATTENDANCE] Erro ao atualizar atendimento:', error);
        return false;
      }

      console.log(`🔄 [ATTENDANCE] Atendimento atualizado para ${telefoneFormatado} até ${newExpiresAt.toLocaleTimeString()}`);
      return true;
    } catch (error) {
      console.error('❌ [ATTENDANCE] Erro:', error);
      return false;
    }
  }, [companyId, activeAttendances]);

  // Obter atendimento ativo para um telefone
  const getActiveAttendance = useCallback((telefoneFormatado: string): ActiveAttendance | null => {
    const attendance = activeAttendances.get(telefoneFormatado);
    if (!attendance) return null;

    // Verificar se expirou
    const now = new Date();
    const expiresAt = new Date(attendance.expires_at);
    
    if (now > expiresAt) {
      return null; // Expirado
    }

    return attendance;
  }, [activeAttendances]);

  // Verificar se existe atendimento ativo e não expirado
  const hasActiveAttendance = useCallback((telefoneFormatado: string): boolean => {
    return getActiveAttendance(telefoneFormatado) !== null;
  }, [getActiveAttendance]);

  // Obter usuário que está atendendo
  const getAttendingUser = useCallback((telefoneFormatado: string): AttendingUser | null => {
    const attendance = getActiveAttendance(telefoneFormatado);
    if (!attendance) return null;

    return {
      id: attendance.attending_user_id,
      name: attendance.attending_user_name || 'Usuário'
    };
  }, [getActiveAttendance]);

  // Liberar atendimento manualmente
  const releaseAttendance = useCallback(async (telefoneFormatado: string): Promise<boolean> => {
    if (!companyId) return false;

    try {
      const { error } = await supabase
        .from('active_attendances')
        .delete()
        .eq('company_id', companyId)
        .eq('telefone_formatado', telefoneFormatado);

      if (error) {
        console.error('❌ [ATTENDANCE] Erro ao liberar atendimento:', error);
        return false;
      }

      console.log(`🔓 [ATTENDANCE] Atendimento liberado para ${telefoneFormatado}`);
      return true;
    } catch (error) {
      console.error('❌ [ATTENDANCE] Erro:', error);
      return false;
    }
  }, [companyId]);

  // Limpar atendimentos expirados (executar periodicamente)
  const cleanExpiredAttendances = useCallback(async () => {
    if (!companyId) return;

    try {
      const now = new Date().toISOString();
      
      const { error, count } = await supabase
        .from('active_attendances')
        .delete()
        .eq('company_id', companyId)
        .lt('expires_at', now);

      if (error) {
        console.error('❌ [ATTENDANCE] Erro ao limpar expirados:', error);
        return;
      }

      if (count && count > 0) {
        console.log(`🧹 [ATTENDANCE] ${count} atendimentos expirados removidos`);
        // Recarregar após limpeza
        loadActiveAttendances();
      }
    } catch (error) {
      console.error('❌ [ATTENDANCE] Erro:', error);
    }
  }, [companyId, loadActiveAttendances]);

  // Limpar atendimentos expirados a cada 1 minuto
  useEffect(() => {
    if (!companyId) return;

    const cleanupInterval = setInterval(() => {
      cleanExpiredAttendances();
    }, 60000); // 1 minuto

    return () => clearInterval(cleanupInterval);
  }, [companyId, cleanExpiredAttendances]);

  return {
    activeAttendances,
    isLoading,
    startOrRefreshAttendance,
    refreshAttendance,
    getActiveAttendance,
    hasActiveAttendance,
    getAttendingUser,
    releaseAttendance,
    loadActiveAttendances,
  };
};
