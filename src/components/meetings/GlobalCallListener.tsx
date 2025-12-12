import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IncomingCallModal } from './IncomingCallModal';
import { VideoCallModal } from './VideoCallModal';

interface IncomingCall {
  meetingId: string;
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
}

export const GlobalCallListener = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<{
    meetingId: string;
    remoteUserId: string;
    remoteUserName: string;
    callType: 'audio' | 'video';
    isCaller: boolean;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const processedCallsRef = useRef<Set<string>>(new Set()); // Track processed calls to prevent duplicates
  const isProcessingRef = useRef(false); // Prevent race conditions

  // Initialize user
  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        console.log('🔔 GlobalCallListener: Usuário inicializado:', user.id);
      }
    };
    initUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
      } else {
        setCurrentUserId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle incoming call signal
  const handleIncomingCallSignal = useCallback(async (signal: any) => {
    // Prevent duplicate processing
    if (isProcessingRef.current) {
      console.log('🔔 GlobalCallListener: Já processando uma chamada, ignorando');
      return;
    }

    // Check if we already processed this call
    if (processedCallsRef.current.has(signal.meeting_id)) {
      console.log('🔔 GlobalCallListener: Chamada já processada, ignorando:', signal.meeting_id);
      return;
    }

    // Mark as processing
    isProcessingRef.current = true;
    processedCallsRef.current.add(signal.meeting_id);

    try {
      // Get caller info
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', signal.from_user)
        .maybeSingle();

      console.log('📞 GlobalCallListener: Chamada recebida de:', callerProfile?.full_name);

      setIncomingCall({
        meetingId: signal.meeting_id,
        callerId: signal.from_user,
        callerName: callerProfile?.full_name || 'Usuário',
        callType: signal.signal_data?.callType || 'audio',
      });
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  // Subscribe to incoming calls globally
  useEffect(() => {
    if (!currentUserId) return;

    console.log('🔔 GlobalCallListener: Inscrevendo para chamadas recebidas do usuário:', currentUserId);

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Clear processed calls when user changes
    processedCallsRef.current.clear();
    
    // Reset processing flag
    isProcessingRef.current = false;

    const channelName = `global-incoming-calls-${currentUserId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_signals',
          filter: `to_user=eq.${currentUserId}`,
        },
        async (payload) => {
          const signal = payload.new as any;
          console.log('🔔 GlobalCallListener: Sinal recebido:', signal.signal_type, 'meeting:', signal.meeting_id);

          // Only process call-request signals here
          if (signal.signal_type === 'call-request') {
            // Check if we're already in a call or have an incoming call
            if (activeCall || incomingCall) {
              console.log('🔔 GlobalCallListener: Já em chamada, ignorando nova chamada');
              return;
            }
            await handleIncomingCallSignal(signal);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 GlobalCallListener: Status da inscrição:', status, 'canal:', channelName);
      });

    channelRef.current = channel;

    return () => {
      console.log('🔔 GlobalCallListener: Limpando canal:', channelName);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUserId, handleIncomingCallSignal, activeCall, incomingCall]);

  // Handle accept call
  const handleAcceptCall = async () => {
    if (!incomingCall || !currentUserId) return;

    // Capture values before clearing state
    const callData = {
      meetingId: incomingCall.meetingId,
      callerId: incomingCall.callerId,
      callerName: incomingCall.callerName,
      callType: incomingCall.callType,
    };

    // Clear incoming call state immediately to prevent duplicate
    setIncomingCall(null);

    try {
      console.log('✅ GlobalCallListener: Aceitando chamada:', callData.meetingId);

      // Update meeting status
      await supabase
        .from('meetings')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', callData.meetingId);

      // Send accept signal
      await supabase.from('meeting_signals').insert({
        meeting_id: callData.meetingId,
        from_user: currentUserId,
        to_user: callData.callerId,
        signal_type: 'call-accept',
        signal_data: {},
      });

      // Open call modal
      setActiveCall({
        meetingId: callData.meetingId,
        remoteUserId: callData.callerId,
        remoteUserName: callData.callerName,
        callType: callData.callType,
        isCaller: false,
      });
    } catch (error) {
      console.error('❌ GlobalCallListener: Erro ao aceitar chamada:', error);
      // Remove from processed calls on error so user can try again
      processedCallsRef.current.delete(callData.meetingId);
    }
  };

  // Handle reject call
  const handleRejectCall = async () => {
    if (!incomingCall || !currentUserId) return;

    const callMeetingId = incomingCall.meetingId;
    const callerId = incomingCall.callerId;

    // Clear state immediately to prevent UI issues
    setIncomingCall(null);

    try {
      console.log('❌ GlobalCallListener: Rejeitando chamada:', callMeetingId);

      // Update meeting status
      await supabase
        .from('meetings')
        .update({ status: 'missed' })
        .eq('id', callMeetingId);

      // Send reject signal
      await supabase.from('meeting_signals').insert({
        meeting_id: callMeetingId,
        from_user: currentUserId,
        to_user: callerId,
        signal_type: 'call-reject',
        signal_data: {},
      });
    } catch (error) {
      console.error('❌ GlobalCallListener: Erro ao rejeitar chamada:', error);
    }
  };

  // Handle end call
  const handleEndCall = async () => {
    if (activeCall) {
      const meetingId = activeCall.meetingId;
      
      // Clear state immediately
      setActiveCall(null);
      
      // Remove from processed calls so user can receive new calls for same meeting
      processedCallsRef.current.delete(meetingId);
      
      try {
        await supabase
          .from('meetings')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
          })
          .eq('id', meetingId);
      } catch (error) {
        console.error('Erro ao encerrar reunião:', error);
      }
    } else {
      setActiveCall(null);
    }
  };

  return (
    <>
      {/* Incoming call modal - shows on any page */}
      <IncomingCallModal
        open={!!incomingCall}
        callerName={incomingCall?.callerName || ''}
        callType={incomingCall?.callType || 'audio'}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />

      {/* Active call modal - shows when call is accepted */}
      {activeCall && currentUserId && (
        <VideoCallModal
          open={!!activeCall}
          onClose={handleEndCall}
          meetingId={activeCall.meetingId}
          localUserId={currentUserId}
          remoteUserId={activeCall.remoteUserId}
          remoteUserName={activeCall.remoteUserName}
          callType={activeCall.callType}
          isCaller={activeCall.isCaller}
          onCallEnded={handleEndCall}
        />
      )}
    </>
  );
};
