import { useState, useEffect, useRef } from 'react';
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

  // Subscribe to incoming calls globally
  useEffect(() => {
    if (!currentUserId) return;

    console.log('🔔 GlobalCallListener: Inscrevendo para chamadas recebidas do usuário:', currentUserId);

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`global-incoming-calls-${currentUserId}-${Date.now()}`)
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
          console.log('🔔 GlobalCallListener: Sinal recebido:', signal.signal_type);

          if (signal.signal_type === 'call-request') {
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
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 GlobalCallListener: Status da inscrição:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('🔔 GlobalCallListener: Limpando canal');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUserId]);

  // Handle accept call
  const handleAcceptCall = async () => {
    if (!incomingCall || !currentUserId) return;

    try {
      console.log('✅ GlobalCallListener: Aceitando chamada:', incomingCall.meetingId);

      // Update meeting status
      await supabase
        .from('meetings')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', incomingCall.meetingId);

      // Send accept signal
      await supabase.from('meeting_signals').insert({
        meeting_id: incomingCall.meetingId,
        from_user: currentUserId,
        to_user: incomingCall.callerId,
        signal_type: 'call-accept',
        signal_data: {},
      });

      // Open call modal
      setActiveCall({
        meetingId: incomingCall.meetingId,
        remoteUserId: incomingCall.callerId,
        remoteUserName: incomingCall.callerName,
        callType: incomingCall.callType,
        isCaller: false,
      });

      setIncomingCall(null);
    } catch (error) {
      console.error('❌ GlobalCallListener: Erro ao aceitar chamada:', error);
    }
  };

  // Handle reject call
  const handleRejectCall = async () => {
    if (!incomingCall || !currentUserId) return;

    try {
      console.log('❌ GlobalCallListener: Rejeitando chamada:', incomingCall.meetingId);

      // Update meeting status
      await supabase
        .from('meetings')
        .update({ status: 'missed' })
        .eq('id', incomingCall.meetingId);

      // Send reject signal
      await supabase.from('meeting_signals').insert({
        meeting_id: incomingCall.meetingId,
        from_user: currentUserId,
        to_user: incomingCall.callerId,
        signal_type: 'call-reject',
        signal_data: {},
      });

      setIncomingCall(null);
    } catch (error) {
      console.error('❌ GlobalCallListener: Erro ao rejeitar chamada:', error);
    }
  };

  // Handle end call
  const handleEndCall = async () => {
    if (activeCall) {
      try {
        await supabase
          .from('meetings')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
          })
          .eq('id', activeCall.meetingId);
      } catch (error) {
        console.error('Erro ao encerrar reunião:', error);
      }
    }
    setActiveCall(null);
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
