import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AttendanceProtocol {
  id: string;
  protocol_number: string;
  company_id: string;
  telefone_formatado: string;
  lead_id: string | null;
  channel: string;
  started_by: string;
  attending_user_id: string | null;
  attending_user_name: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  summary: string | null;
  created_at: string;
}

export const useAttendanceProtocol = (companyId: string | null) => {
  const [activeProtocol, setActiveProtocol] = useState<AttendanceProtocol | null>(null);
  const [protocolHistory, setProtocolHistory] = useState<AttendanceProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create or get existing open protocol
  const createProtocol = useCallback(async (
    telefoneFormatado: string,
    options?: {
      channel?: string;
      startedBy?: string;
      attendingUserId?: string;
      attendingUserName?: string;
      leadId?: string;
    }
  ): Promise<string | null> => {
    if (!companyId) return null;

    try {
      const { data, error } = await supabase.rpc('create_attendance_protocol', {
        p_company_id: companyId,
        p_telefone_formatado: telefoneFormatado,
        p_channel: options?.channel || 'whatsapp',
        p_started_by: options?.startedBy || 'humano',
        p_attending_user_id: options?.attendingUserId || null,
        p_attending_user_name: options?.attendingUserName || null,
        p_lead_id: options?.leadId || null,
      });

      if (error) {
        console.error('❌ [PROTOCOL] Erro ao criar protocolo:', error);
        return null;
      }

      const result = data?.[0];
      if (result) {
        console.log(`📋 [PROTOCOL] Protocolo: ${result.protocol_number}`);
        // Update active protocol state immediately
        setActiveProtocol({
          id: result.id,
          protocol_number: result.protocol_number,
          company_id: companyId,
          telefone_formatado: telefoneFormatado,
          lead_id: options?.leadId || null,
          channel: options?.channel || 'whatsapp',
          started_by: options?.startedBy || 'humano',
          attending_user_id: options?.attendingUserId || null,
          attending_user_name: options?.attendingUserName || null,
          status: 'aberto',
          started_at: new Date().toISOString(),
          finished_at: null,
          summary: null,
          created_at: new Date().toISOString(),
        });
        return result.protocol_number;
      }
      return null;
    } catch (error) {
      console.error('❌ [PROTOCOL] Erro:', error);
      return null;
    }
  }, [companyId]);

  // Load active protocol for a contact
  const loadActiveProtocol = useCallback(async (telefoneFormatado: string) => {
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('attendance_protocols')
        .select('*')
        .eq('company_id', companyId)
        .eq('telefone_formatado', telefoneFormatado)
        .in('status', ['aberto', 'em_atendimento'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ [PROTOCOL] Erro ao carregar protocolo ativo:', error);
        return;
      }

      setActiveProtocol(data as AttendanceProtocol | null);
    } catch (error) {
      console.error('❌ [PROTOCOL] Erro:', error);
    }
  }, [companyId]);

  // Load protocol history for a contact
  const loadProtocolHistory = useCallback(async (telefoneFormatado: string) => {
    if (!companyId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_protocols')
        .select('*')
        .eq('company_id', companyId)
        .eq('telefone_formatado', telefoneFormatado)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('❌ [PROTOCOL] Erro ao carregar histórico:', error);
        return;
      }

      setProtocolHistory((data || []) as AttendanceProtocol[]);
    } catch (error) {
      console.error('❌ [PROTOCOL] Erro:', error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Finalize a protocol
  const finalizeProtocol = useCallback(async (
    protocolId: string,
    summary?: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('attendance_protocols')
        .update({
          status: 'finalizado',
          finished_at: new Date().toISOString(),
          summary: summary || null,
        })
        .eq('id', protocolId);

      if (error) {
        console.error('❌ [PROTOCOL] Erro ao finalizar protocolo:', error);
        return false;
      }

      setActiveProtocol(null);
      console.log('✅ [PROTOCOL] Protocolo finalizado');
      return true;
    } catch (error) {
      console.error('❌ [PROTOCOL] Erro:', error);
      return false;
    }
  }, []);

  // Update protocol status
  const updateProtocolStatus = useCallback(async (
    protocolId: string,
    status: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('attendance_protocols')
        .update({ status })
        .eq('id', protocolId);

      if (error) {
        console.error('❌ [PROTOCOL] Erro ao atualizar status:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ [PROTOCOL] Erro:', error);
      return false;
    }
  }, []);

  return {
    activeProtocol,
    protocolHistory,
    isLoading,
    createProtocol,
    loadActiveProtocol,
    loadProtocolHistory,
    finalizeProtocol,
    updateProtocolStatus,
  };
};
