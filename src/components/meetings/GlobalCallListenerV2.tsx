/**
 * GlobalCallListenerV2 - Listener Global de Chamadas Refatorado
 * 
 * Responsável por:
 * - Escutar chamadas recebidas em qualquer página
 * - Escutar participantes entrando em salas públicas
 * - Gerenciar estado de chamadas ativas
 * - Prevenir chamadas duplicadas
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { IncomingCallModal } from './IncomingCallModal';
import { VideoCallModalV2 } from './VideoCallModalV2';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, X, ArrowRight } from 'lucide-react';

interface IncomingCall {
  meetingId: string;
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
}

interface ActiveCall {
  meetingId: string;
  remoteUserId: string;
  remoteUserName: string;
  callType: 'audio' | 'video';
  isCaller: boolean;
}

// Play notification sound when guest joins public meeting
const playGuestJoinNotification = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Pleasant chime sound - D5 note
    oscillator.frequency.value = 587.33;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Second chime - G5 note
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.value = 783.99;
      osc2.type = 'sine';
      
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.3);
    }, 100);
  } catch (error) {
    console.log('[CallListener] Could not play notification sound');
  }
};

interface PendingGuestJoin {
  meetingId: string;
  guestName: string;
  guestId: string;
}

export const GlobalCallListenerV2 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [pendingGuestJoin, setPendingGuestJoin] = useState<PendingGuestJoin | null>(null);

  // Refs para prevenir duplicação
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const processedMeetingsRef = useRef<Set<string>>(new Set());
  const processedGuestJoinsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);

  // ========== INITIALIZE USER ==========
  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        console.log('[CallListener] User initialized:', user.id);
      }
    };

    initUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ========== HANDLE INCOMING CALL ==========
  const handleIncomingSignal = useCallback(async (signal: any) => {
    // Prevent duplicate processing
    if (isProcessingRef.current) {
      console.log('[CallListener] Already processing, skip');
      return;
    }

    if (processedMeetingsRef.current.has(signal.meeting_id)) {
      console.log('[CallListener] Meeting already processed:', signal.meeting_id);
      return;
    }

    // Check if already in call
    if (activeCall || incomingCall) {
      console.log('[CallListener] Already in call, rejecting new call');
      return;
    }

    isProcessingRef.current = true;
    processedMeetingsRef.current.add(signal.meeting_id);

    try {
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', signal.from_user)
        .maybeSingle();

      console.log('[CallListener] Incoming call from:', callerProfile?.full_name);

      setIncomingCall({
        meetingId: signal.meeting_id,
        callerId: signal.from_user,
        callerName: callerProfile?.full_name || 'Usuário',
        callType: signal.signal_data?.callType || 'audio',
      });
    } finally {
      isProcessingRef.current = false;
    }
  }, [activeCall, incomingCall]);

  // ========== HANDLE GUEST JOIN FOR PUBLIC MEETINGS ==========
  const handleGuestJoinSignal = useCallback(async (signal: any) => {
    const signalKey = `${signal.meeting_id}-${signal.from_user}`;
    if (processedGuestJoinsRef.current.has(signalKey)) {
      console.log('[CallListener] Guest join already processed:', signalKey);
      return;
    }
    
    console.log('[CallListener] Guest joined signal received for meeting:', signal.meeting_id);
    
    // Verify this is an external meeting where current user is host
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, created_by, meeting_type')
      .eq('id', signal.meeting_id)
      .eq('created_by', currentUserId)
      .eq('meeting_type', 'external')
      .maybeSingle();
    
    if (!meeting) {
      console.log('[CallListener] Not a public meeting or not the host, ignoring');
      return;
    }
    
    processedGuestJoinsRef.current.add(signalKey);
    
    const signalData = signal.signal_data as any;
    const guestName = signalData?.guestName || 'Participante';
    
    console.log('[CallListener] Host notification - Guest joined:', guestName);
    
    // Play notification sound
    playGuestJoinNotification();
    
    // Show toast with action to go to meeting
    toast.success(
      `${guestName} entrou na sua sala de reunião`,
      {
        duration: 10000,
        icon: '👤',
        action: {
          label: 'Ir para sala',
          onClick: () => {
            navigate(`/meeting/${signal.meeting_id}`);
          },
        },
      }
    );
    
    // Also set state for potential modal
    setPendingGuestJoin({
      meetingId: signal.meeting_id,
      guestName,
      guestId: signalData?.guestId || signal.from_user,
    });
  }, [currentUserId, navigate]);

  // ========== UNIFIED SIGNAL SUBSCRIPTION ==========
  useEffect(() => {
    if (!currentUserId) return;

    // Cleanup existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Reset state on user change
    processedMeetingsRef.current.clear();
    processedGuestJoinsRef.current.clear();
    isProcessingRef.current = false;

    // Check if on public meeting page - skip guest-joined notifications there
    const isOnMeetingPage = location.pathname.startsWith('/meeting/');

    const channelId = `global-calls-unified-${currentUserId}-${Date.now()}`;
    console.log('[CallListener] Subscribing to all signals for user:', channelId);

    const channel = supabase
      .channel(channelId)
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
          console.log('[CallListener] Signal received:', signal.signal_type);

          if (signal.signal_type === 'call-request') {
            // Internal call request
            await handleIncomingSignal(signal);
          } else if (signal.signal_type === 'guest-joined' && !isOnMeetingPage) {
            // Guest joined public meeting - only handle if not already on meeting page
            await handleGuestJoinSignal(signal);
          } else if (signal.signal_type === 'group-room-invite') {
            // Group room invite from another team member
            const signalData = signal.signal_data as any;
            const hostName = signalData?.hostName || 'Colega';
            const inviteMeetingId = signalData?.meetingId || signal.meeting_id;
            
            playGuestJoinNotification();
            
            toast.info(
              `${hostName} convidou você para uma sala de grupo`,
              {
                duration: 15000,
                icon: '📹',
                action: {
                  label: 'Entrar na Sala',
                  onClick: () => {
                    // Navigate to the public meeting page as an authenticated user
                    navigate(`/meeting/${inviteMeetingId}`);
                  },
                },
              }
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('[CallListener] Unified subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUserId, handleIncomingSignal, handleGuestJoinSignal, location.pathname]);

  // ========== ACCEPT CALL ==========
  const handleAccept = async () => {
    if (!incomingCall || !currentUserId) return;

    const callData = { ...incomingCall };
    setIncomingCall(null);

    try {
      console.log('[CallListener] Accepting call:', callData.meetingId);

      // Update meeting status
      await supabase
        .from('meetings')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', callData.meetingId);

      // Send accept signal to caller
      await supabase.from('meeting_signals').insert({
        meeting_id: callData.meetingId,
        from_user: currentUserId,
        to_user: callData.callerId,
        signal_type: 'call-accept',
        signal_data: {},
      });

      // Open call modal as participant
      setActiveCall({
        meetingId: callData.meetingId,
        remoteUserId: callData.callerId,
        remoteUserName: callData.callerName,
        callType: callData.callType,
        isCaller: false,
      });

    } catch (error) {
      console.error('[CallListener] Accept error:', error);
      processedMeetingsRef.current.delete(callData.meetingId);
    }
  };

  // ========== REJECT CALL ==========
  const handleReject = async () => {
    if (!incomingCall || !currentUserId) return;

    const { meetingId, callerId } = incomingCall;
    setIncomingCall(null);

    try {
      console.log('[CallListener] Rejecting call:', meetingId);

      await supabase
        .from('meetings')
        .update({ status: 'missed' })
        .eq('id', meetingId);

      await supabase.from('meeting_signals').insert({
        meeting_id: meetingId,
        from_user: currentUserId,
        to_user: callerId,
        signal_type: 'call-reject',
        signal_data: {},
      });

    } catch (error) {
      console.error('[CallListener] Reject error:', error);
    }
  };

  // ========== END CALL ==========
  const handleEndCall = async () => {
    if (!activeCall) {
      setActiveCall(null);
      return;
    }

    const { meetingId } = activeCall;
    setActiveCall(null);
    processedMeetingsRef.current.delete(meetingId);

    try {
      await supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', meetingId);
    } catch (error) {
      console.error('[CallListener] End call error:', error);
    }
  };

  // ========== HANDLE GO TO MEETING ==========
  const handleGoToMeeting = () => {
    if (pendingGuestJoin) {
      navigate(`/meeting/${pendingGuestJoin.meetingId}`);
      setPendingGuestJoin(null);
    }
  };

  const handleDismissGuestNotification = () => {
    setPendingGuestJoin(null);
  };

  // ========== RENDER ==========
  return (
    <>
      {/* Incoming Call Modal */}
      <IncomingCallModal
        open={!!incomingCall}
        callerName={incomingCall?.callerName || ''}
        callType={incomingCall?.callType || 'audio'}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      {/* Active Call Modal */}
      {activeCall && currentUserId && (
        <VideoCallModalV2
          open={true}
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

      {/* Guest Joined Public Meeting Modal */}
      <Dialog open={!!pendingGuestJoin} onOpenChange={(open) => !open && setPendingGuestJoin(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Participante na Sala
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{pendingGuestJoin?.guestName}</span> entrou na sua sala de reunião e está aguardando.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-center py-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {pendingGuestJoin?.guestName?.charAt(0).toUpperCase() || 'P'}
                </span>
              </div>
              <span className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 rounded-full border-2 border-background animate-pulse" />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleDismissGuestNotification}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Ignorar
            </Button>
            <Button
              onClick={handleGoToMeeting}
              className="flex-1"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Ir para Sala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
