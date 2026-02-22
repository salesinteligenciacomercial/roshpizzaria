import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Monitor, MonitorOff, Circle, Square, Loader2, Users, Copy, Check,
  FileText, Download, X, MessageSquare, BookOpen, MessageCircle,
  UserCheck, UserX, Bell
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MeetingScriptPanel, MeetingScript } from '@/components/meetings/MeetingScriptPanel';
import { SelectMeetingScriptDialog } from '@/components/meetings/SelectMeetingScriptDialog';
import { CameraFiltersPanel } from '@/components/meetings/CameraFiltersPanel';
import { MeetingChatPanel } from '@/components/meetings/MeetingChatPanel';
import { useCameraFilters } from '@/hooks/useCameraFilters';
import { useBackgroundBlur } from '@/hooks/useBackgroundBlur';
import { useMeetingChat } from '@/hooks/useMeetingChat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ICE Servers with TURN fallback
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

// Find supported mime type for recording
const getSupportedMimeType = () => {
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
};

// Play notification sound when participant joins
const playJoinNotification = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 587.33;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
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
    console.log('Could not play notification sound');
  }
};

interface PendingJoinRequest {
  guestId: string;
  guestName: string;
  timestamp: number;
}

interface RemoteParticipant {
  stream: MediaStream;
  name: string;
}

const PublicMeeting = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [guestName, setGuestName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [meetingExists, setMeetingExists] = useState<boolean | null>(null);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [hostName, setHostName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [publicLink, setPublicLink] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Call state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // Multi-participant: map of guestId -> { stream, name }
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [waitingForGuests, setWaitingForGuests] = useState(false);
  
  // Participant admission state
  const [pendingJoinRequests, setPendingJoinRequests] = useState<PendingJoinRequest[]>([]);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [waitingForAdmission, setWaitingForAdmission] = useState(false);
  const [admissionRejected, setAdmissionRejected] = useState(false);
  const processedJoinRequestsRef = useRef<Set<string>>(new Set());
  
  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Array<{ text: string; timestamp: string; speaker: string }>>([]);
  const [showTranscriptions, setShowTranscriptions] = useState(false);
  
  // Script state
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [activeScript, setActiveScript] = useState<MeetingScript | null>(null);

  // Camera filters
  const {
    filters: cameraFilters,
    activePreset: cameraPreset,
    updateFilter: updateCameraFilter,
    applyPreset: applyCameraPreset,
    resetFilters: resetCameraFilters,
    getFilterStyle,
  } = useCameraFilters();

  // Background blur
  const {
    isBlurEnabled,
    isModelLoading: isBlurLoading,
    options: blurOptions,
    toggleBlur,
    updateOptions: updateBlurOptions,
    startProcessing: startBlurProcessing,
    stopProcessing: stopBlurProcessing,
  } = useBackgroundBlur();

  // Canvas ref for background blur
  const blurCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  // Multi-participant: Map of guestId -> RTCPeerConnection
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const hasRemoteDescriptionsRef = useRef<Map<string, boolean>>(new Map());
  const iceCandidateQueuesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  // Keep track of accepted guest names for linking offers to names
  const acceptedGuestNamesRef = useRef<Map<string, string>>(new Map());
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  
  // Transcription refs
  const transcriptionRecorderRef = useRef<MediaRecorder | null>(null);
  const transcriptionChunksRef = useRef<Blob[]>([]);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const guestIdRef = useRef<string>(`guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const processedGuestJoinsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track processed offers to avoid duplicates
  const processedOffersRef = useRef<Set<string>>(new Set());
  
  // For guest: single peer connection ref (guest only connects to host)
  const guestPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const guestHasRemoteDescRef = useRef(false);
  const guestIceCandidateQueueRef = useRef<RTCIceCandidate[]>([]);
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const currentChatUserId = isHost ? (hostId || 'host') : guestIdRef.current;
  const currentChatUserName = isHost ? (guestName || 'Anfitrião') : guestName;
  const { 
    messages: chatMessages, 
    unreadCount: chatUnreadCount, 
    sendMessage: sendChatMessage,
    markAsRead: markChatAsRead,
    isLoading: isChatLoading
  } = useMeetingChat(
    hasJoined ? meetingId || null : null, 
    currentChatUserId, 
    currentChatUserName
  );

  // Helper: get first remote stream (for backward compat in recording/transcription)
  const getFirstRemoteStream = useCallback((): MediaStream | null => {
    const entries = Array.from(remoteParticipants.values());
    return entries.length > 0 ? entries[0].stream : null;
  }, [remoteParticipants]);

  // ========== BACKGROUND BLUR PROCESSING ==========
  useEffect(() => {
    if (isBlurEnabled && localStream && localVideoRef.current && blurCanvasRef.current) {
      startBlurProcessing(localVideoRef.current, blurCanvasRef.current);
    } else {
      stopBlurProcessing();
    }
  }, [isBlurEnabled, localStream, startBlurProcessing, stopBlurProcessing]);

  // Check if meeting exists and if current user is host
  useEffect(() => {
    const checkMeeting = async () => {
      if (!meetingId) return;
      
      const { data, error } = await supabase
        .from('meetings')
        .select('id, status, created_by, participant_names, public_link')
        .eq('id', meetingId)
        .eq('meeting_type', 'external')
        .maybeSingle();

      if (error || !data) {
        setMeetingExists(false);
        return;
      }

      if (data.status === 'ended') {
        setMeetingEnded(true);
        setMeetingExists(true);
        return;
      }

      setMeetingExists(true);
      setHostName(data.participant_names?.[0] || 'Anfitrião');
      setHostId(data.created_by);
      setPublicLink(data.public_link || `${window.location.origin}/meeting/${meetingId}`);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === data.created_by) {
        setIsHost(true);
        setGuestName(data.participant_names?.[0] || 'Anfitrião');
      }
    };

    checkMeeting();
  }, [meetingId]);

  // Poll for guest-joined signals when host is waiting
  useEffect(() => {
    if (!isHost || !hasJoined || !meetingId) return;

    const pollForGuests = async () => {
      try {
        const { data: pendingJoins, error } = await supabase
          .from('meeting_signals')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('signal_type', 'guest-joined')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (error) return;
        
        if (pendingJoins && pendingJoins.length > 0) {
          for (const join of pendingJoins) {
            const joinKey = `${join.meeting_id}-${join.from_user}`;
            if (processedGuestJoinsRef.current.has(joinKey)) continue;
            
            processedGuestJoinsRef.current.add(joinKey);
            const joinData = join.signal_data as any;
            playJoinNotification();
            toast.success(`${joinData?.guestName || 'Participante'} entrou na reunião`, {
              duration: 5000,
              icon: '👤',
            });
            setWaitingForGuests(false);
          }
        }
      } catch (error) {
        console.error('[Host Poll] Error:', error);
      }
    };

    pollIntervalRef.current = setInterval(pollForGuests, 2000);
    pollForGuests();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isHost, hasJoined, meetingId]);

  // ========== HOST: Create a new peer connection for a specific guest ==========
  const createPeerConnectionForGuest = useCallback((guestPeerId: string, guestPeerName: string, existingLocalStream: MediaStream) => {
    console.log(`[Host] Creating peer connection for guest: ${guestPeerName} (${guestPeerId})`);
    
    // Clean up existing connection for this guest if any
    const existingPc = peerConnectionsRef.current.get(guestPeerId);
    if (existingPc) {
      existingPc.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(guestPeerId, pc);
    hasRemoteDescriptionsRef.current.set(guestPeerId, false);
    iceCandidateQueuesRef.current.set(guestPeerId, []);

    // Add local tracks to the new connection
    existingLocalStream.getTracks().forEach(track => {
      pc.addTrack(track, existingLocalStream);
    });

    pc.ontrack = (event) => {
      console.log(`[Host] Received remote track from guest ${guestPeerName}`);
      const remoteMediaStream = event.streams[0];
      setRemoteParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(guestPeerId, { stream: remoteMediaStream, name: guestPeerName });
        return newMap;
      });
      setIsConnecting(false);
      setWaitingForGuests(false);
      
      if (!callIntervalRef.current) {
        callIntervalRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await supabase.from('meeting_signals').insert([{
          meeting_id: meetingId!,
          from_user: 'host',
          to_user: guestPeerId,
          signal_type: 'ice-candidate',
          signal_data: JSON.parse(JSON.stringify({ candidate: event.candidate.toJSON() })),
        }]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[Host] Connection state for ${guestPeerName}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
        setWaitingForGuests(false);
        if (!callIntervalRef.current) {
          callIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        }
      } else if (pc.connectionState === 'failed') {
        pc.restartIce();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        // Remove participant when disconnected
        console.log(`[Host] Guest ${guestPeerName} disconnected`);
        setRemoteParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(guestPeerId);
          return newMap;
        });
        peerConnectionsRef.current.delete(guestPeerId);
        hasRemoteDescriptionsRef.current.delete(guestPeerId);
        iceCandidateQueuesRef.current.delete(guestPeerId);
      }
    };

    return pc;
  }, [meetingId]);

  // ========== HOST: Process offer from a specific guest ==========
  const processGuestOffer = useCallback(async (guestPeerId: string, sdpData: any, existingLocalStream: MediaStream) => {
    const offerKey = `${guestPeerId}-offer`;
    if (processedOffersRef.current.has(offerKey)) {
      console.log(`[Host] Already processed offer from ${guestPeerId}, skipping`);
      return;
    }
    processedOffersRef.current.add(offerKey);

    const guestPeerName = acceptedGuestNamesRef.current.get(guestPeerId) || 'Participante';
    
    let pc = peerConnectionsRef.current.get(guestPeerId);
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      pc = createPeerConnectionForGuest(guestPeerId, guestPeerName, existingLocalStream);
    }

    const hasRemoteDesc = hasRemoteDescriptionsRef.current.get(guestPeerId);
    if (hasRemoteDesc) {
      console.log(`[Host] Already has remote desc for ${guestPeerId}, skipping`);
      return;
    }

    if (pc.signalingState !== 'stable') {
      console.log(`[Host] PC not stable for ${guestPeerId}, state: ${pc.signalingState}`);
      return;
    }

    try {
      console.log(`[Host] Setting remote description for ${guestPeerName}...`);
      await pc.setRemoteDescription(new RTCSessionDescription(sdpData));
      hasRemoteDescriptionsRef.current.set(guestPeerId, true);

      // Process queued ICE candidates
      const queue = iceCandidateQueuesRef.current.get(guestPeerId) || [];
      while (queue.length > 0) {
        const candidate = queue.shift();
        if (candidate) {
          try { await pc.addIceCandidate(candidate); } catch (e) { console.error('ICE err:', e); }
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await supabase.from('meeting_signals').insert([{
        meeting_id: meetingId!,
        from_user: 'host',
        to_user: guestPeerId,
        signal_type: 'answer',
        signal_data: JSON.parse(JSON.stringify({ sdp: answer })),
      }]);
      console.log(`[Host] Answer sent to ${guestPeerName}`);
      setWaitingForGuests(false);
      setIsConnecting(false);
    } catch (error) {
      console.error(`[Host] Error processing offer from ${guestPeerName}:`, error);
      // Allow retry
      processedOffersRef.current.delete(offerKey);
    }
  }, [meetingId, createPeerConnectionForGuest]);

  // Initialize WebRTC as Host
  const initializeWebRTCAsHost = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.warn);
      }

      // Subscribe to signals from guests
      const channel = supabase
        .channel(`public-meeting-host-${meetingId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'meeting_signals',
            filter: `meeting_id=eq.${meetingId}`,
          },
          async (payload) => {
            const signal = payload.new as any;
            if (signal.from_user === 'host') return;
            
            const guestPeerId = signal.from_user;

            if (signal.signal_type === 'offer') {
              console.log(`[Host Realtime] Offer from ${guestPeerId}`);
              await processGuestOffer(guestPeerId, signal.signal_data.sdp, stream);
            } else if (signal.signal_type === 'ice-candidate' && signal.from_user !== 'host') {
              const candidate = new RTCIceCandidate(signal.signal_data.candidate);
              const pc = peerConnectionsRef.current.get(guestPeerId);
              const hasRemoteDesc = hasRemoteDescriptionsRef.current.get(guestPeerId);

              if (pc && hasRemoteDesc) {
                try { await pc.addIceCandidate(candidate); } catch (e) { console.error('ICE err:', e); }
              } else {
                // Queue it
                const queue = iceCandidateQueuesRef.current.get(guestPeerId) || [];
                queue.push(candidate);
                iceCandidateQueuesRef.current.set(guestPeerId, queue);
              }
            } else if (signal.signal_type === 'guest-joined') {
              console.log('[Host Realtime] Guest joined:', signal.signal_data);
              playJoinNotification();
              toast.success(`${signal.signal_data?.guestName || 'Participante'} entrou na reunião`, {
                duration: 5000,
                icon: '👤',
              });
              setWaitingForGuests(false);
            } else if (signal.signal_type === 'join-request') {
              const reqData = signal.signal_data as any;
              const guestReqId = reqData?.guestId || signal.from_user;
              if (!processedJoinRequestsRef.current.has(guestReqId)) {
                processedJoinRequestsRef.current.add(guestReqId);
                playJoinNotification();
                setPendingJoinRequests(prev => [...prev, {
                  guestId: guestReqId,
                  guestName: reqData?.guestName || 'Participante',
                  timestamp: Date.now(),
                }]);
                setShowPendingRequests(true);
                toast.info(`${reqData?.guestName || 'Participante'} quer entrar na reunião`, {
                  duration: 10000,
                  icon: '🔔',
                });
              }
            } else if (signal.signal_type === 'call-end') {
              // A specific guest ended - remove their connection
              const pc = peerConnectionsRef.current.get(guestPeerId);
              if (pc) {
                pc.close();
                peerConnectionsRef.current.delete(guestPeerId);
                setRemoteParticipants(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(guestPeerId);
                  return newMap;
                });
              }
              // If signal is broadcast to all, end meeting
              if (signal.to_user === 'host' || signal.to_user === 'all') {
                // Just remove that guest
              }
            } else if (signal.signal_type === 'screen-share-status') {
              const shareData = signal.signal_data as { isSharing: boolean };
              setRemoteIsScreenSharing(shareData.isSharing);
            }
          }
        )
        .subscribe((status) => {
          console.log('Host subscription status:', status);
        });

      channelRef.current = channel;
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Poll for pending offers from already-accepted guests
      const checkAndProcessOffers = async () => {
        const { data: pendingOffers, error } = await supabase
          .from('meeting_signals')
          .select('*')
          .eq('meeting_id', meetingId!)
          .eq('signal_type', 'offer')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (error || !pendingOffers) return;
        
        for (const offer of pendingOffers) {
          const guestPeerId = offer.from_user;
          if (processedOffersRef.current.has(`${guestPeerId}-offer`)) continue;
          // Only process if this guest was accepted
          if (acceptedGuestNamesRef.current.has(guestPeerId)) {
            await processGuestOffer(guestPeerId, (offer.signal_data as any).sdp, stream);
          }
        }
      };
      
      await checkAndProcessOffers();
      
      // Continuous polling for new offers
      const offerPollInterval = setInterval(async () => {
        await checkAndProcessOffers();
      }, 2000);
      
      // Store cleanup
      const originalCleanup = channelRef.current;
      channelRef.current = {
        ...originalCleanup,
        unsubscribe: () => {
          clearInterval(offerPollInterval);
          return originalCleanup?.unsubscribe();
        },
      } as any;
      
      setIsConnecting(false);
      toast.success('Sala iniciada! Aguardando participantes...');

    } catch (error) {
      console.error('Error initializing WebRTC as host:', error);
      toast.error('Erro ao acessar câmera/microfone');
    }
  };

  // Initialize WebRTC as Guest (creates offer)
  const initializeWebRTCAsGuest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.warn);
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      guestPeerConnectionRef.current = pc;
      guestHasRemoteDescRef.current = false;
      guestIceCandidateQueueRef.current = [];

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        console.log('[Guest] Received remote track');
        const remoteMediaStream = event.streams[0];
        setRemoteParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set('host', { stream: remoteMediaStream, name: hostName });
          return newMap;
        });
        setIsConnecting(false);
        
        if (!callIntervalRef.current) {
          callIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        }
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await supabase.from('meeting_signals').insert([{
            meeting_id: meetingId!,
            from_user: guestIdRef.current,
            to_user: 'host',
            signal_type: 'ice-candidate',
            signal_data: JSON.parse(JSON.stringify({ candidate: event.candidate.toJSON() })),
          }]);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[Guest] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsConnecting(false);
          if (!callIntervalRef.current) {
            callIntervalRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 1000);
          }
        } else if (pc.connectionState === 'failed') {
          pc.restartIce();
        }
      };

      // Subscribe to signals
      const channel = supabase
        .channel(`public-meeting-${meetingId}-${guestIdRef.current}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'meeting_signals',
            filter: `meeting_id=eq.${meetingId}`,
          },
          async (payload) => {
            const signal = payload.new as any;
            // Only process signals directed to this guest
            if (signal.to_user !== guestIdRef.current && signal.to_user !== 'guest') return;

            if (signal.signal_type === 'answer') {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data.sdp));
                guestHasRemoteDescRef.current = true;
                // Process queued candidates
                while (guestIceCandidateQueueRef.current.length > 0) {
                  const candidate = guestIceCandidateQueueRef.current.shift();
                  if (candidate) {
                    try { await pc.addIceCandidate(candidate); } catch (e) { console.error('ICE err:', e); }
                  }
                }
              }
            } else if (signal.signal_type === 'ice-candidate' && signal.from_user !== guestIdRef.current) {
              const candidate = new RTCIceCandidate(signal.signal_data.candidate);
              if (guestHasRemoteDescRef.current) {
                try { await pc.addIceCandidate(candidate); } catch (e) { console.error('ICE err:', e); }
              } else {
                guestIceCandidateQueueRef.current.push(candidate);
              }
            } else if (signal.signal_type === 'call-end') {
              handleEndCall();
            } else if (signal.signal_type === 'screen-share-status') {
              const shareData = signal.signal_data as { isSharing: boolean };
              setRemoteIsScreenSharing(shareData.isSharing);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
      
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send join-request and wait for host approval
      if (hostId) {
        await supabase.from('meeting_signals').insert([{
          meeting_id: meetingId!,
          from_user: guestIdRef.current,
          to_user: 'host',
          signal_type: 'join-request',
          signal_data: { guestName, guestId: guestIdRef.current },
        }]);
        await supabase.from('meeting_signals').insert([{
          meeting_id: meetingId!,
          from_user: guestIdRef.current,
          to_user: hostId,
          signal_type: 'join-request',
          signal_data: { guestName, guestId: guestIdRef.current },
        }]);
        setWaitingForAdmission(true);
      }

      // Helper to send offer after admission
      const sendOfferToHost = async () => {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        
        await supabase.from('meeting_signals').insert([{
          meeting_id: meetingId!,
          from_user: guestIdRef.current,
          to_user: 'host',
          signal_type: 'offer',
          signal_data: JSON.parse(JSON.stringify({ sdp: offer })),
        }]);

        if (hostId) {
          await supabase.from('meeting_signals').insert([{
            meeting_id: meetingId!,
            from_user: guestIdRef.current,
            to_user: hostId,
            signal_type: 'guest-joined',
            signal_data: { guestName, guestId: guestIdRef.current },
          }]);
        }

        console.log('[Guest] Offer sent after admission');
        
        // Poll for answer
        const pollForAnswer = async () => {
          if (guestHasRemoteDescRef.current) return;
          const { data: answers } = await supabase
            .from('meeting_signals')
            .select('*')
            .eq('meeting_id', meetingId!)
            .eq('to_user', guestIdRef.current)
            .eq('signal_type', 'answer')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (answers && answers.length > 0 && pc.signalingState === 'have-local-offer') {
            const answerData = answers[0].signal_data as any;
            await pc.setRemoteDescription(new RTCSessionDescription(answerData.sdp));
            guestHasRemoteDescRef.current = true;
            while (guestIceCandidateQueueRef.current.length > 0) {
              const candidate = guestIceCandidateQueueRef.current.shift();
              if (candidate) {
                try { await pc.addIceCandidate(candidate); } catch (e) {}
              }
            }
          }
        };
        
        setTimeout(pollForAnswer, 1000);
        setTimeout(pollForAnswer, 3000);
        setTimeout(pollForAnswer, 5000);
        setTimeout(pollForAnswer, 8000);
      };

      // Listen for admission response via realtime
      const admissionChannel = supabase
        .channel(`admission-${meetingId}-${guestIdRef.current}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'meeting_signals',
            filter: `meeting_id=eq.${meetingId}`,
          },
          async (payload) => {
            const signal = payload.new as any;
            if (signal.to_user !== guestIdRef.current) return;

            if (signal.signal_type === 'join-accepted') {
              console.log('[Guest] Admission accepted!');
              setWaitingForAdmission(false);
              supabase.removeChannel(admissionChannel);
              await sendOfferToHost();
            } else if (signal.signal_type === 'join-rejected') {
              setWaitingForAdmission(false);
              setAdmissionRejected(true);
              supabase.removeChannel(admissionChannel);
              toast.error('O anfitrião recusou sua entrada na reunião');
            }
          }
        )
        .subscribe();

      // Also poll for admission response
      const pollAdmission = setInterval(async () => {
        const { data: responses } = await supabase
          .from('meeting_signals')
          .select('*')
          .eq('meeting_id', meetingId!)
          .eq('to_user', guestIdRef.current)
          .in('signal_type', ['join-accepted', 'join-rejected'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (responses && responses.length > 0) {
          const resp = responses[0];
          if (resp.signal_type === 'join-accepted') {
            clearInterval(pollAdmission);
            setWaitingForAdmission(false);
            supabase.removeChannel(admissionChannel);
            await sendOfferToHost();
          } else if (resp.signal_type === 'join-rejected') {
            clearInterval(pollAdmission);
            setWaitingForAdmission(false);
            setAdmissionRejected(true);
            supabase.removeChannel(admissionChannel);
            toast.error('O anfitrião recusou sua entrada na reunião');
          }
        }
      }, 2000);

    } catch (error) {
      console.error('Error initializing WebRTC as guest:', error);
      toast.error('Erro ao acessar câmera/microfone');
    }
  };

  const handleJoinMeeting = async () => {
    if (!guestName.trim() && !isHost) {
      toast.error('Digite seu nome para entrar');
      return;
    }

    await supabase
      .from('meetings')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', meetingId);

    setHasJoined(true);
    
    if (isHost) {
      initializeWebRTCAsHost();
    } else {
      initializeWebRTCAsGuest();
    }
  };

  // ========== HOST: ACCEPT/REJECT GUEST ==========
  const handleAcceptGuest = async (guest: PendingJoinRequest) => {
    console.log('[Host] Accepting guest:', guest.guestName, guest.guestId);
    
    // Store accepted guest name for later when offer arrives
    acceptedGuestNamesRef.current.set(guest.guestId, guest.guestName);
    
    await supabase.from('meeting_signals').insert([{
      meeting_id: meetingId!,
      from_user: 'host',
      to_user: guest.guestId,
      signal_type: 'join-accepted',
      signal_data: { guestName: guest.guestName },
    }]);

    setPendingJoinRequests(prev => prev.filter(r => r.guestId !== guest.guestId));
    toast.success(`${guest.guestName} foi aceito na reunião`);
  };

  const handleRejectGuest = async (guest: PendingJoinRequest) => {
    await supabase.from('meeting_signals').insert([{
      meeting_id: meetingId!,
      from_user: 'host',
      to_user: guest.guestId,
      signal_type: 'join-rejected',
      signal_data: { guestName: guest.guestName },
    }]);

    setPendingJoinRequests(prev => prev.filter(r => r.guestId !== guest.guestId));
    toast.info(`${guest.guestName} foi recusado`);
  };

  const handleAcceptAllGuests = async () => {
    for (const guest of pendingJoinRequests) {
      await handleAcceptGuest(guest);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleScreenShare = async () => {
    // Get all peer connections
    const allPcs = isHost 
      ? Array.from(peerConnectionsRef.current.values()) 
      : (guestPeerConnectionRef.current ? [guestPeerConnectionRef.current] : []);
    
    if (allPcs.length === 0) return;

    try {
      if (isScreenSharing) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        
        for (const pc of allPcs) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
        
        if (originalVideoTrackRef.current) {
          originalVideoTrackRef.current.stop();
        }
        
        const audioTracks = localStream?.getAudioTracks() || [];
        setLocalStream(new MediaStream([...audioTracks, videoTrack]));
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([...audioTracks, videoTrack]);
        }
        
        // Notify all participants
        await supabase.from('meeting_signals').insert([{
          meeting_id: meetingId!,
          from_user: isHost ? 'host' : guestIdRef.current,
          to_user: isHost ? 'guest' : 'host',
          signal_type: 'screen-share-status',
          signal_data: { isSharing: false },
        }]);
        
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        originalVideoTrackRef.current = localStream?.getVideoTracks()[0] || null;
        
        for (const pc of allPcs) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(screenTrack);
          }
        }
        
        screenTrack.onended = () => {
          toggleScreenShare();
        };
        
        await supabase.from('meeting_signals').insert([{
          meeting_id: meetingId!,
          from_user: isHost ? 'host' : guestIdRef.current,
          to_user: isHost ? 'guest' : 'host',
          signal_type: 'screen-share-status',
          signal_data: { isSharing: true },
        }]);
        
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const startRecording = () => {
    const streams: MediaStream[] = [];
    if (localStream) streams.push(localStream);
    const firstRemote = getFirstRemoteStream();
    if (firstRemote) streams.push(firstRemote);

    if (streams.length === 0) {
      toast.error('Nenhum stream disponível');
      return;
    }

    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      streams.forEach(stream => {
        if (stream.getAudioTracks().length > 0) {
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(destination);
        }
      });

      const videoTrack = localStream?.getVideoTracks()[0] || firstRemote?.getVideoTracks()[0];
      const combinedStream = new MediaStream([
        ...destination.stream.getAudioTracks(),
        ...(videoTrack ? [videoTrack] : []),
      ]);

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reuniao_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Gravação salva!');
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Gravação iniciada');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Erro ao iniciar gravação');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  // Transcription functions
  const startTranscription = useCallback(async () => {
    const streams: MediaStream[] = [];
    if (localStream) streams.push(localStream);
    const firstRemote = getFirstRemoteStream();
    if (firstRemote) streams.push(firstRemote);

    if (streams.length === 0) {
      toast.error('Nenhum stream de áudio disponível');
      return;
    }

    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      streams.forEach(stream => {
        if (stream.getAudioTracks().length > 0) {
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(destination);
        }
      });

      const audioStream = destination.stream;
      const mimeType = 'audio/webm;codecs=opus';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        toast.error('Formato de áudio não suportado');
        return;
      }

      const recorder = new MediaRecorder(audioStream, { mimeType });
      transcriptionRecorderRef.current = recorder;
      transcriptionChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          transcriptionChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      setIsTranscribing(true);
      setShowTranscriptions(true);

      transcriptionIntervalRef.current = setInterval(async () => {
        if (transcriptionChunksRef.current.length === 0) return;

        const audioBlob = new Blob(transcriptionChunksRef.current, { type: mimeType });
        transcriptionChunksRef.current = [];

        if (audioBlob.size < 1000) return;

        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            const base64Audio = base64data.split(',')[1];

            const { data, error } = await supabase.functions.invoke('transcrever-reuniao', {
              body: { audio: base64Audio, language: 'pt' }
            });

            if (error) return;

            if (data?.text && data.text.trim().length > 0) {
              const timestamp = new Date().toLocaleTimeString('pt-BR', { 
                hour: '2-digit', minute: '2-digit', second: '2-digit'
              });
              
              setTranscriptions(prev => [...prev, {
                text: data.text.trim(),
                timestamp,
                speaker: isHost ? guestName : 'Participante'
              }]);
            }
          };
        } catch (err) {
          console.error('Error processing transcription:', err);
        }
      }, 10000);

      toast.success('Transcrição iniciada');
    } catch (error) {
      console.error('Error starting transcription:', error);
      toast.error('Erro ao iniciar transcrição');
    }
  }, [localStream, getFirstRemoteStream, isHost, guestName]);

  const stopTranscription = useCallback(() => {
    if (transcriptionRecorderRef.current && isTranscribing) {
      transcriptionRecorderRef.current.stop();
      setIsTranscribing(false);
      
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
        transcriptionIntervalRef.current = null;
      }
      
      toast.success('Transcrição encerrada');
    }
  }, [isTranscribing]);

  const downloadTranscription = useCallback(() => {
    if (transcriptions.length === 0) {
      toast.error('Nenhuma transcrição disponível');
      return;
    }

    const content = transcriptions.map(t => 
      `[${t.timestamp}] ${t.speaker}: ${t.text}`
    ).join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao_reuniao_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Transcrição salva!');
  }, [transcriptions]);

  const handleEndCall = async () => {
    if (isRecording) stopRecording();
    if (isTranscribing) stopTranscription();
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    
    localStream?.getTracks().forEach(track => track.stop());
    
    // Close all peer connections
    if (isHost) {
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
    } else {
      guestPeerConnectionRef.current?.close();
    }
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Signal call end
    if (isHost) {
      await supabase.from('meeting_signals').insert([{
        meeting_id: meetingId!,
        from_user: 'host',
        to_user: 'guest',
        signal_type: 'call-end',
        signal_data: {},
      }]);
    } else {
      await supabase.from('meeting_signals').insert([{
        meeting_id: meetingId!,
        from_user: guestIdRef.current,
        to_user: 'host',
        signal_type: 'call-end',
        signal_data: {},
      }]);
    }

    await supabase
      .from('meetings')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', meetingId);

    setMeetingEnded(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get participants count
  const participantCount = remoteParticipants.size + 1; // +1 for self
  const remoteParticipantsList = Array.from(remoteParticipants.entries());

  // Meeting not found
  if (meetingExists === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Reunião não encontrada</CardTitle>
            <CardDescription>
              O link da reunião pode estar incorreto ou a reunião foi encerrada.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Meeting ended
  if (meetingEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Reunião encerrada</CardTitle>
            <CardDescription>
              A reunião foi finalizada. Obrigado por participar!
              {callDuration > 0 && (
                <span className="block mt-2">
                  Duração: {formatTime(callDuration)}
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Loading
  if (meetingExists === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Guest waiting for admission
  if (waitingForAdmission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <CardTitle>Aguardando aprovação</CardTitle>
            <CardDescription>
              O anfitrião precisa aceitar sua entrada na reunião. Por favor, aguarde...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Guest admission rejected
  if (admissionRejected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <UserX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Entrada recusada</CardTitle>
            <CardDescription>
              O anfitrião recusou sua entrada nesta reunião.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Join screen
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              {isHost ? <Video className="h-8 w-8 text-primary" /> : <Users className="h-8 w-8 text-primary" />}
            </div>
            <CardTitle>
              {isHost ? 'Iniciar Reunião' : 'Entrar na Reunião'}
            </CardTitle>
            <CardDescription>
              {isHost 
                ? 'Você é o anfitrião desta reunião' 
                : `${hostName} está te aguardando`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isHost && (
              <Input
                placeholder="Digite seu nome"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinMeeting()}
              />
            )}
            
            {isHost && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground mb-2">Link para convidados:</p>
                <div className="flex gap-2">
                  <Input value={publicLink} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            <Button className="w-full" onClick={handleJoinMeeting}>
              <Video className="h-4 w-4 mr-2" />
              {isHost ? 'Iniciar Sala ao Vivo' : 'Entrar na Reunião'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========== CALL SCREEN ==========
  // Determine grid layout based on participant count
  const getVideoGridClass = () => {
    const count = remoteParticipantsList.length;
    if (count === 0) return '';
    if (count === 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    return 'grid-cols-3 grid-rows-3';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-lg font-semibold text-primary">
              {(isHost ? guestName : hostName).charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-semibold">{isHost ? 'Você (Anfitrião)' : hostName}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {waitingForGuests ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span>Aguardando participantes...</span>
                </>
              ) : isConnecting && remoteParticipants.size === 0 ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span>{formatTime(callDuration)}</span>
                  {participantCount > 1 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {participantCount}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isHost && pendingJoinRequests.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPendingRequests(!showPendingRequests)}
              className="relative"
            >
              <Bell className="h-4 w-4 mr-2" />
              Solicitações
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingJoinRequests.length}
              </Badge>
            </Button>
          )}

          {isHost && (
            <Button variant="outline" size="sm" onClick={copyLink}>
              {copied ? (
                <Check className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Copiar Link
            </Button>
          )}

          {isRecording && (
            <div className="flex items-center gap-2 text-destructive">
              <Circle className="h-3 w-3 fill-current animate-pulse" />
              <span className="text-sm font-medium">REC {formatTime(recordingTime)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Pending Join Requests Panel */}
      {isHost && showPendingRequests && pendingJoinRequests.length > 0 && (
        <div className="absolute top-16 right-4 z-50 w-80 bg-background border rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Solicitações de Entrada</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleAcceptAllGuests} className="text-xs h-7">
                <UserCheck className="h-3 w-3 mr-1" />
                Aceitar todos
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPendingRequests(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {pendingJoinRequests.map((req) => (
              <div key={req.guestId} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {req.guestName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{req.guestName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleAcceptGuest(req)}
                    title="Aceitar"
                  >
                    <UserCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleRejectGuest(req)}
                    title="Recusar"
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video area - Grid layout for multiple participants */}
      <div className="flex-1 relative bg-muted/50 overflow-hidden">
        {remoteParticipantsList.length > 0 ? (
          <div className={`grid ${getVideoGridClass()} w-full h-full gap-1`}>
            {remoteParticipantsList.map(([peerId, participant]) => (
              <div key={peerId} className="relative bg-muted/80 overflow-hidden">
                <video
                  autoPlay
                  playsInline
                  className={`w-full h-full ${remoteIsScreenSharing ? 'object-contain bg-black' : 'object-cover'}`}
                  ref={(el) => {
                    if (el && el.srcObject !== participant.stream) {
                      el.srcObject = participant.stream;
                      el.play().catch(console.warn);
                    }
                  }}
                />
                {/* Participant name label */}
                <div className="absolute bottom-2 left-2 bg-background/80 text-foreground text-xs px-2 py-1 rounded">
                  {participant.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              {waitingForGuests ? (
                <>
                  <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Sala ao Vivo</h3>
                  <p className="text-muted-foreground mb-4">Aguardando participantes entrarem...</p>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl font-semibold text-primary">
                      {(isHost ? 'G' : hostName.charAt(0)).toUpperCase()}
                    </span>
                  </div>
                  {isConnecting && (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Aguardando conexão...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Screen share indicator */}
        {remoteIsScreenSharing && (
          <div className="absolute top-4 left-4 bg-primary/90 text-primary-foreground text-sm px-3 py-1.5 rounded-lg flex items-center gap-2 z-10">
            <Monitor className="h-4 w-4" />
            <span>Participante está compartilhando a tela</span>
          </div>
        )}

        {/* Local video (small, bottom-right) */}
        <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border border-border bg-background z-10">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={isBlurEnabled ? 'hidden' : 'w-full h-full object-cover'}
            style={!isBlurEnabled ? getFilterStyle() : undefined}
          />
          
          {isBlurEnabled && (
            <canvas
              ref={blurCanvasRef}
              className="w-full h-full object-cover"
              style={getFilterStyle()}
            />
          )}
          
          {isBlurLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-1" />
                <span className="text-[10px] text-muted-foreground">Carregando IA...</span>
              </div>
            </div>
          )}
          
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <VideoOff className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          
          <div className="absolute bottom-1 left-1 bg-background/80 text-foreground text-[10px] px-1.5 py-0.5 rounded">
            Você
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-6 border-t bg-background">
        <Button
          variant={isAudioEnabled ? 'secondary' : 'destructive'}
          size="lg"
          className="rounded-full h-14 w-14"
          onClick={toggleAudio}
        >
          {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>

        <Button
          variant={isVideoEnabled ? 'secondary' : 'destructive'}
          size="lg"
          className="rounded-full h-14 w-14"
          onClick={toggleVideo}
        >
          {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>

        <CameraFiltersPanel
          filters={cameraFilters}
          activePreset={cameraPreset}
          onUpdateFilter={updateCameraFilter}
          onApplyPreset={applyCameraPreset}
          onReset={resetCameraFilters}
          isBlurEnabled={isBlurEnabled}
          isBlurLoading={isBlurLoading}
          blurOptions={blurOptions}
          onToggleBlur={toggleBlur}
          onUpdateBlurOptions={updateBlurOptions}
        />

        <Button
          variant={isScreenSharing ? 'default' : 'secondary'}
          size="lg"
          className="rounded-full h-14 w-14"
          onClick={toggleScreenShare}
        >
          {isScreenSharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
        </Button>

        <Button
          variant={isRecording ? 'destructive' : 'secondary'}
          size="lg"
          className="rounded-full h-14 w-14"
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? 'Parar gravação' : 'Gravar reunião'}
        >
          {isRecording ? <Square className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
        </Button>

        <Button
          variant={isTranscribing ? 'default' : 'secondary'}
          size="lg"
          className="rounded-full h-14 w-14"
          onClick={isTranscribing ? stopTranscription : startTranscription}
          title={isTranscribing ? 'Parar transcrição' : 'Transcrever áudio'}
        >
          <FileText className="h-6 w-6" />
        </Button>

        <Button
          variant={activeScript ? 'default' : 'secondary'}
          size="lg"
          className="rounded-full h-14 w-14"
          onClick={() => activeScript ? setActiveScript(null) : setShowScriptDialog(true)}
          title={activeScript ? 'Fechar roteiro' : 'Abrir roteiro de reunião'}
        >
          <BookOpen className="h-6 w-6" />
        </Button>

        <Button
          variant={showChat ? 'default' : 'secondary'}
          size="lg"
          className="rounded-full h-14 w-14 relative"
          onClick={() => {
            setShowChat(!showChat);
            if (!showChat) markChatAsRead();
          }}
          title={showChat ? 'Fechar chat' : 'Abrir chat'}
        >
          <MessageCircle className="h-6 w-6" />
          {chatUnreadCount > 0 && !showChat && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
            </span>
          )}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          className="rounded-full h-14 w-14"
          onClick={handleEndCall}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>

      {/* Transcription Panel */}
      {showTranscriptions && (
        <div className="absolute right-4 top-4 bottom-24 w-80 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg flex flex-col">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Transcrição</span>
              {isTranscribing && (
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-1">
              {transcriptions.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={downloadTranscription}
                  title="Baixar transcrição"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowTranscriptions(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-3">
            {transcriptions.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                {isTranscribing 
                  ? 'Aguardando áudio para transcrever...' 
                  : 'Inicie a transcrição para ver o texto aqui'
                }
              </div>
            ) : (
              <div className="space-y-3">
                {transcriptions.map((t, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-medium">{t.speaker}</span>
                      <span>•</span>
                      <span>{t.timestamp}</span>
                    </div>
                    <p className="text-foreground">{t.text}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Meeting Script Dialog */}
      <SelectMeetingScriptDialog
        open={showScriptDialog}
        onClose={() => setShowScriptDialog(false)}
        onSelectScript={(script) => {
          setActiveScript(script);
          setShowScriptDialog(false);
        }}
      />

      {/* Meeting Script Panel */}
      {activeScript && (
        <MeetingScriptPanel
          script={activeScript}
          onClose={() => setActiveScript(null)}
          onScriptUpdate={(updatedScript) => setActiveScript(updatedScript)}
        />
      )}

      {/* Meeting Chat Panel */}
      <MeetingChatPanel
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        messages={chatMessages}
        currentUserId={currentChatUserId}
        onSendMessage={sendChatMessage}
        isLoading={isChatLoading}
      />
    </div>
  );
};

export default PublicMeeting;
