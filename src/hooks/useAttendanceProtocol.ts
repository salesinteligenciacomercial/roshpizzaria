import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_PROTOCOL_WELCOME = `Olá, {nome}! 👋\n\nSeu protocolo de atendimento é *{protocolo}*.\nGuarde este número para futuras referências.\n\nComo posso te ajudar?`;

export const getProtocolWelcomeTemplate = (): string => {
  return localStorage.getItem('continuum_protocol_welcome_template') || DEFAULT_PROTOCOL_WELCOME;
};

export const setProtocolWelcomeTemplate = (template: string) => {
  localStorage.setItem('continuum_protocol_welcome_template', template);
};

export const isProtocolWelcomeEnabled = (): boolean => {
  return localStorage.getItem('continuum_protocol_welcome_enabled') !== 'false';
};

export const setProtocolWelcomeEnabled = (enabled: boolean) => {
  localStorage.setItem('continuum_protocol_welcome_enabled', enabled ? 'true' : 'false');
};

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

export interface CreateProtocolResult {
  protocolNumber: string | null;
  isNew: boolean;
}

export const useAttendanceProtocol = (companyId: string | null) => {
  const [activeProtocol, setActiveProtocol] = useState<AttendanceProtocol | null>(null);
  const [protocolHistory, setProtocolHistory] = useState<AttendanceProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Send welcome message with protocol number
  const sendProtocolWelcomeMessage = useCallback(async (
    telefoneFormatado: string,
    protocolNumber: string,
    contactName?: string,
  ) => {
    if (!companyId || !isProtocolWelcomeEnabled()) return;

    const template = getProtocolWelcomeTemplate();
    const message = template
      .replace(/{protocolo}/g, protocolNumber)
      .replace(/{nome}/g, contactName || 'cliente');

    try {
      console.log('📋 [PROTOCOL-WELCOME] Enviando mensagem de boas-vindas:', protocolNumber);
      await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          company_id: companyId,
          numero: telefoneFormatado,
          mensagem: message,
          tipo_mensagem: 'text',
        },
      });

      // Persist in conversas table
      await supabase.from('conversas').insert({
        company_id: companyId,
        numero: telefoneFormatado,
        telefone_formatado: telefoneFormatado,
        mensagem: message,
        fromme: true,
        status: 'sent',
        origem: 'manual',
        sent_by: 'system_protocol',
        tipo_mensagem: 'text',
      });
      console.log('✅ [PROTOCOL-WELCOME] Mensagem enviada com sucesso');
    } catch (err) {
      console.error('❌ [PROTOCOL-WELCOME] Erro ao enviar:', err);
    }
  }, [companyId]);

  // Create or get existing open protocol for a contact
  const createProtocol = useCallback(async (
    telefoneFormatado: string,
    options?: {
      channel?: string;
      startedBy?: string;
      attendingUserId?: string;
      attendingUserName?: string;
      leadId?: string;
      contactName?: string;
      sendWelcome?: boolean;
      forceNew?: boolean;
    }
  ): Promise<CreateProtocolResult> => {
    if (!companyId) return { protocolNumber: null, isNew: false };

    try {
      // Unless forceNew, check if there's already an open protocol for THIS contact
      if (!options?.forceNew) {
        const { data: existing } = await supabase
          .from('attendance_protocols')
          .select('id, protocol_number')
          .eq('company_id', companyId)
          .eq('telefone_formatado', telefoneFormatado)
          .in('status', ['aberto', 'em_atendimento'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          // Protocol already exists for THIS contact, reuse it
          setActiveProtocol(prev => prev?.id === existing.id ? prev : {
            id: existing.id,
            protocol_number: existing.protocol_number,
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
          return { protocolNumber: existing.protocol_number, isNew: false };
        }
      }

      // Always create a NEW protocol with a unique number
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
        return { protocolNumber: null, isNew: false };
      }

      const result = data?.[0];
      if (result) {
        console.log(`📋 [PROTOCOL] Novo protocolo criado: ${result.protocol_number} para ${telefoneFormatado}`);
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

        // Send welcome message for newly created protocols
        if (options?.sendWelcome !== false) {
          sendProtocolWelcomeMessage(telefoneFormatado, result.protocol_number, options?.contactName);
        }

        return { protocolNumber: result.protocol_number, isNew: true };
      }
      return { protocolNumber: null, isNew: false };
    } catch (error) {
      console.error('❌ [PROTOCOL] Erro:', error);
      return { protocolNumber: null, isNew: false };
    }
  }, [companyId, sendProtocolWelcomeMessage]);

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
