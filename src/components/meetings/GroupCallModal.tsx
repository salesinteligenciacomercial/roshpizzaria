/**
 * GroupCallModal - Modal de chamada em grupo multi-usuário
 * 
 * Baseado na lógica mesh WebRTC do PublicMeeting.tsx, mas renderizado
 * inline como modal no Chat Equipe. Suporta N participantes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Monitor, MonitorOff, Circle, Square, Loader2, Users, Copy, Check,
  FileText, Download, X, MessageCircle, BookOpen, MessageSquare,
  UserCheck, UserX, Bell
} from 'lucide-react';
import { MeetingScriptPanel, MeetingScript } from '@/components/meetings/MeetingScriptPanel';
import { SelectMeetingScriptDialog } from '@/components/meetings/SelectMeetingScriptDialog';
import { CameraFiltersPanel } from '@/components/meetings/CameraFiltersPanel';
import { MeetingChatPanel } from '@/components/meetings/MeetingChatPanel';
import { useCameraFilters } from '@/hooks/useCameraFilters';
import { useBackgroundBlur } from '@/hooks/useBackgroundBlur';
import { useMeetingChat } from '@/hooks/useMeetingChat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
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

const getSupportedMimeType = () => {
  const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
};

const playJoinNotification = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 587.33; osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch { /* silent */ }
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

interface GroupCallModalProps {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  hostUserId: string;
  hostUserName: string;
}

export const GroupCallModal = ({ open, onClose, meetingId, hostUserId, hostUserName }: GroupCallModalProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showParticipantList, setShowParticipantList] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<PendingJoinRequest[]>([]);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Array<{ text: string; timestamp: string; speaker: string }>>([]);
  const [showTranscriptions, setShowTranscriptions] = useState(false);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [activeScript, setActiveScript] = useState<MeetingScript | null>(null);
  const [showChat, setShowChat] = useState(false);

  const {
    filters: cameraFilters, activePreset: cameraPreset,
    updateFilter: updateCameraFilter, applyPreset: applyCameraPreset,
    resetFilters: resetCameraFilters, getFilterStyle,
  } = useCameraFilters();

  const {
    isBlurEnabled, isModelLoading: isBlurLoading, options: blurOptions,
    toggleBlur, updateOptions: updateBlurOptions,
    startProcessing: startBlurProcessing, stopProcessing: stopBlurProcessing,
  } = useBackgroundBlur();

  const blurCanvasRef = useRef<HTMLCanvasElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const hasRemoteDescriptionsRef = useRef<Map<string, boolean>>(new Map());
  const iceCandidateQueuesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const peerNamesRef = useRef<Map<string, string>>(new Map());
  const processedJoinRequestsRef = useRef<Set<string>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const transcriptionRecorderRef = useRef<MediaRecorder | null>(null);
  const transcriptionChunksRef = useRef<Blob[]>([]);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const myPeerId = 'host'; // Authenticated user is always host in group calls

  // Chat
  const {
    messages: chatMessages, unreadCount: chatUnreadCount,
    sendMessage: sendChatMessage, markAsRead: markChatAsRead,
    isLoading: isChatLoading,
  } = useMeetingChat(meetingId, hostUserId, hostUserName);

  // Keep local video in sync
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(console.warn);
      }
    }
  }, [localStream, remoteParticipants]);

  // Background blur
  useEffect(() => {
    if (isBlurEnabled && localStream && localVideoRef.current && blurCanvasRef.current) {
      startBlurProcessing(localVideoRef.current, blurCanvasRef.current);
    } else {
      stopBlurProcessing();
    }
  }, [isBlurEnabled, localStream, startBlurProcessing, stopBlurProcessing]);

  // Create peer connection
  const createPeerConnection = useCallback((peerId: string, peerName: string, stream: MediaStream): RTCPeerConnection => {
    const existingPc = peerConnectionsRef.current.get(peerId);
    if (existingPc) existingPc.close();

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(peerId, pc);
    hasRemoteDescriptionsRef.current.set(peerId, false);
    iceCandidateQueuesRef.current.set(peerId, []);
    peerNamesRef.current.set(peerId, peerName);

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(peerId, { stream: remoteStream, name: peerName });
        return newMap;
      });
      setIsConnecting(false);
      if (!callIntervalRef.current) {
        callIntervalRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await supabase.from('meeting_signals').insert([{
          meeting_id: meetingId,
          from_user: myPeerId,
          to_user: peerId,
          signal_type: 'ice-candidate',
          signal_data: JSON.parse(JSON.stringify({ candidate: event.candidate.toJSON() })),
        }]);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setIsConnecting(false);
        if (!callIntervalRef.current) {
          callIntervalRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
        }
      } else if (pc.connectionState === 'failed') {
        pc.restartIce();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        setRemoteParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(peerId);
          return newMap;
        });
        peerConnectionsRef.current.delete(peerId);
      }
    };

    return pc;
  }, [meetingId]);

  // Process offer
  const processOffer = useCallback(async (fromPeerId: string, sdpData: any, stream: MediaStream) => {
    const peerName = peerNamesRef.current.get(fromPeerId) || 'Participante';
    let pc = peerConnectionsRef.current.get(fromPeerId);
    
    if (pc) {
      if (pc.connectionState === 'connected') return;
      if (pc.signalingState === 'have-local-offer') {
        if (myPeerId > fromPeerId) {
          pc.close();
          peerConnectionsRef.current.delete(fromPeerId);
        } else {
          return;
        }
      } else {
        pc.close();
        peerConnectionsRef.current.delete(fromPeerId);
      }
    }
    
    pc = createPeerConnection(fromPeerId, peerName, stream);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdpData));
      hasRemoteDescriptionsRef.current.set(fromPeerId, true);

      const queue = iceCandidateQueuesRef.current.get(fromPeerId) || [];
      while (queue.length > 0) {
        const candidate = queue.shift();
        if (candidate) try { await pc.addIceCandidate(candidate); } catch {}
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await supabase.from('meeting_signals').insert([{
        meeting_id: meetingId,
        from_user: myPeerId,
        to_user: fromPeerId,
        signal_type: 'answer',
        signal_data: JSON.parse(JSON.stringify({ sdp: answer })),
      }]);
    } catch (error) {
      console.error(`[Host] Error processing offer from ${peerName}:`, error);
    }
  }, [meetingId, createPeerConnection]);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (fromPeerId: string, candidateData: any) => {
    const candidate = new RTCIceCandidate(candidateData);
    const pc = peerConnectionsRef.current.get(fromPeerId);
    const hasRemoteDesc = hasRemoteDescriptionsRef.current.get(fromPeerId);

    if (pc && hasRemoteDesc) {
      try { await pc.addIceCandidate(candidate); } catch {}
    } else {
      const queue = iceCandidateQueuesRef.current.get(fromPeerId) || [];
      queue.push(candidate);
      iceCandidateQueuesRef.current.set(fromPeerId, queue);
    }
  }, []);

  // Accept guest
  const handleAcceptGuest = async (guest: PendingJoinRequest) => {
    peerNamesRef.current.set(guest.guestId, guest.guestName);
    
    const existingPeers: Array<{ peerId: string; peerName: string }> = [];
    peerConnectionsRef.current.forEach((_, peerId) => {
      existingPeers.push({ peerId, peerName: peerNamesRef.current.get(peerId) || 'Participante' });
    });

    await supabase.from('meeting_signals').insert([{
      meeting_id: meetingId,
      from_user: 'host',
      to_user: guest.guestId,
      signal_type: 'join-accepted',
      signal_data: { guestName: guest.guestName, existingPeers },
    }]);

    // Notify existing peers
    const notifyPromises = Array.from(peerConnectionsRef.current.keys()).map(existingPeerId =>
      supabase.from('meeting_signals').insert([{
        meeting_id: meetingId,
        from_user: 'host',
        to_user: existingPeerId,
        signal_type: 'new-peer-joined',
        signal_data: { peerId: guest.guestId, peerName: guest.guestName },
      }])
    );
    await Promise.all(notifyPromises);

    setPendingJoinRequests(prev => prev.filter(r => r.guestId !== guest.guestId));
    toast.success(`${guest.guestName} foi aceito na sala`);
  };

  const handleRejectGuest = async (guest: PendingJoinRequest) => {
    await supabase.from('meeting_signals').insert([{
      meeting_id: meetingId,
      from_user: 'host',
      to_user: guest.guestId,
      signal_type: 'join-rejected',
      signal_data: { guestName: guest.guestName },
    }]);
    setPendingJoinRequests(prev => prev.filter(r => r.guestId !== guest.guestId));
  };

  const handleAcceptAllGuests = async () => {
    for (const guest of pendingJoinRequests) await handleAcceptGuest(guest);
  };

  // Initialize WebRTC as host
  useEffect(() => {
    if (!open) return;

    let mounted = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        setLocalStream(stream);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(console.warn);
        }

        // Update meeting status
        await supabase.from('meetings').update({
          status: 'active',
          started_at: new Date().toISOString(),
        }).eq('id', meetingId);

        // Subscribe to signals
        const channel = supabase
          .channel(`group-call-host-${meetingId}-${Date.now()}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'meeting_signals',
            filter: `meeting_id=eq.${meetingId}`,
          }, async (payload) => {
            const signal = payload.new as any;
            if (signal.from_user === 'host') return;
            if (signal.to_user !== 'host' && signal.to_user !== 'all') return;

            const fromPeerId = signal.from_user;

            if (signal.signal_type === 'offer') {
              const currentStream = localStreamRef.current;
              if (currentStream) await processOffer(fromPeerId, signal.signal_data.sdp, currentStream);
            } else if (signal.signal_type === 'ice-candidate') {
              await handleIceCandidate(fromPeerId, signal.signal_data.candidate);
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
                toast.info(`${reqData?.guestName || 'Participante'} quer entrar na sala`);
              }
            } else if (signal.signal_type === 'guest-joined') {
              playJoinNotification();
              toast.success(`${signal.signal_data?.guestName || 'Participante'} entrou na sala`);
            } else if (signal.signal_type === 'call-end') {
              const pc = peerConnectionsRef.current.get(fromPeerId);
              if (pc) {
                pc.close();
                peerConnectionsRef.current.delete(fromPeerId);
                setRemoteParticipants(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(fromPeerId);
                  return newMap;
                });
              }
            } else if (signal.signal_type === 'screen-share-status') {
              setRemoteIsScreenSharing((signal.signal_data as any).isSharing);
            }
          })
          .subscribe();

        channelRef.current = channel;

        // Poll for pending offers
        const checkOffers = async () => {
          const currentStream = localStreamRef.current;
          if (!currentStream) return;
          const { data: pendingOffers } = await supabase
            .from('meeting_signals')
            .select('*')
            .eq('meeting_id', meetingId)
            .eq('to_user', 'host')
            .eq('signal_type', 'offer')
            .order('created_at', { ascending: false })
            .limit(20);
          if (pendingOffers) {
            for (const offer of pendingOffers) {
              const fromPeerId = offer.from_user;
              const existingPc = peerConnectionsRef.current.get(fromPeerId);
              if (existingPc?.connectionState === 'connected') continue;
              if (peerNamesRef.current.has(fromPeerId)) {
                await processOffer(fromPeerId, (offer.signal_data as any).sdp, currentStream);
              }
            }
          }
        };

        const offerPoll = setInterval(checkOffers, 2000);
        await checkOffers();

        setIsConnecting(false);
        toast.success('Sala iniciada! Aguardando participantes...');

        // Store poll cleanup
        const origChannel = channelRef.current;
        channelRef.current = {
          ...origChannel,
          unsubscribe: () => { clearInterval(offerPoll); return origChannel?.unsubscribe(); },
        } as any;

      } catch (error) {
        console.error('Error initializing group call:', error);
        toast.error('Erro ao acessar câmera/microfone');
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [open, meetingId]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      // Cleanup everything
      localStream?.getTracks().forEach(t => t.stop());
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (callIntervalRef.current) clearInterval(callIntervalRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
    }
  }, [open]);

  const handleEndCall = async () => {
    if (isRecording) stopRecording();
    if (isTranscribing) stopTranscription();
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);

    localStream?.getTracks().forEach(t => t.stop());
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    await supabase.from('meeting_signals').insert([{
      meeting_id: meetingId,
      from_user: myPeerId,
      to_user: 'all',
      signal_type: 'call-end',
      signal_data: {},
    }]);

    await supabase.from('meetings').update({
      status: 'ended',
      ended_at: new Date().toISOString(),
    }).eq('id', meetingId);

    onClose();
  };

  // Controls
  const toggleAudio = () => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsAudioEnabled(!isAudioEnabled);
  };

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsVideoEnabled(!isVideoEnabled);
  };

  const toggleScreenShare = async () => {
    const allPcs = Array.from(peerConnectionsRef.current.values());
    if (allPcs.length === 0) return;
    try {
      if (isScreenSharing) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        for (const pc of allPcs) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(videoTrack);
        }
        originalVideoTrackRef.current?.stop();
        const audioTracks = localStream?.getAudioTracks() || [];
        const newStream = new MediaStream([...audioTracks, videoTrack]);
        setLocalStream(newStream);
        localStreamRef.current = newStream;
        if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        originalVideoTrackRef.current = localStream?.getVideoTracks()[0] || null;
        for (const pc of allPcs) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(screenTrack);
        }
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      }
      await supabase.from('meeting_signals').insert([{
        meeting_id: meetingId,
        from_user: myPeerId,
        to_user: 'all',
        signal_type: 'screen-share-status',
        signal_data: { isSharing: !isScreenSharing },
      }]);
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };

  const getFirstRemoteStream = useCallback((): MediaStream | null => {
    const entries = Array.from(remoteParticipants.values());
    return entries.length > 0 ? entries[0].stream : null;
  }, [remoteParticipants]);

  const startRecording = () => {
    const streams: MediaStream[] = [];
    if (localStream) streams.push(localStream);
    const firstRemote = getFirstRemoteStream();
    if (firstRemote) streams.push(firstRemote);
    if (streams.length === 0) { toast.error('Nenhum stream disponível'); return; }
    try {
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      if (localStream?.getAudioTracks().length) audioCtx.createMediaStreamSource(localStream).connect(dest);
      remoteParticipants.forEach(p => {
        if (p.stream.getAudioTracks().length) audioCtx.createMediaStreamSource(p.stream).connect(dest);
      });
      const videoTrack = localStream?.getVideoTracks()[0] || firstRemote?.getVideoTracks()[0];
      const combined = new MediaStream([...dest.stream.getAudioTracks(), ...(videoTrack ? [videoTrack] : [])]);
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(combined, { mimeType });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sala_grupo_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Gravação salva!');
      };
      recorder.start(1000);
      setIsRecording(true); setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
      toast.success('Gravação iniciada');
    } catch { toast.error('Erro ao iniciar gravação'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const startTranscription = useCallback(async () => {
    const streams: MediaStream[] = [];
    if (localStream) streams.push(localStream);
    const firstRemote = getFirstRemoteStream();
    if (firstRemote) streams.push(firstRemote);
    if (streams.length === 0) { toast.error('Nenhum stream de áudio disponível'); return; }
    try {
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      streams.forEach(s => {
        if (s.getAudioTracks().length) audioCtx.createMediaStreamSource(s).connect(dest);
      });
      const mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) { toast.error('Formato não suportado'); return; }
      const recorder = new MediaRecorder(dest.stream, { mimeType });
      transcriptionRecorderRef.current = recorder;
      transcriptionChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) transcriptionChunksRef.current.push(e.data); };
      recorder.start(100);
      setIsTranscribing(true); setShowTranscriptions(true);
      transcriptionIntervalRef.current = setInterval(async () => {
        if (transcriptionChunksRef.current.length === 0) return;
        const blob = new Blob(transcriptionChunksRef.current, { type: mimeType });
        transcriptionChunksRef.current = [];
        if (blob.size < 1000) return;
        try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const b64 = (reader.result as string).split(',')[1];
            const { data } = await supabase.functions.invoke('transcrever-reuniao', { body: { audio: b64, language: 'pt' } });
            if (data?.text?.trim()) {
              setTranscriptions(prev => [...prev, {
                text: data.text.trim(),
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                speaker: hostUserName,
              }]);
            }
          };
        } catch {}
      }, 10000);
      toast.success('Transcrição iniciada');
    } catch { toast.error('Erro ao iniciar transcrição'); }
  }, [localStream, getFirstRemoteStream, hostUserName]);

  const stopTranscription = useCallback(() => {
    if (transcriptionRecorderRef.current && isTranscribing) {
      transcriptionRecorderRef.current.stop();
      setIsTranscribing(false);
      if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
      toast.success('Transcrição encerrada');
    }
  }, [isTranscribing]);

  const downloadTranscription = useCallback(() => {
    if (transcriptions.length === 0) return;
    const content = transcriptions.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transcriptions]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!open) return null;

  const participantCount = remoteParticipants.size + 1;
  const remoteList = Array.from(remoteParticipants.entries());
  const totalVideos = remoteList.length + 1;

  const getVideoGridClass = () => {
    if (totalVideos <= 1) return 'grid-cols-1';
    if (totalVideos === 2) return 'grid-cols-2';
    if (totalVideos <= 4) return 'grid-cols-2';
    if (totalVideos <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Sala de Grupo</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isConnecting && remoteParticipants.size === 0 ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Aguardando participantes...</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span>{formatTime(callDuration)}</span>
                </>
              )}
              <Badge
                variant="secondary"
                className="ml-1 text-xs cursor-pointer hover:bg-secondary/80"
                onClick={() => setShowParticipantList(!showParticipantList)}
              >
                <Users className="h-3 w-3 mr-1" />
                {participantCount}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingJoinRequests.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowPendingRequests(!showPendingRequests)} className="relative">
              <Bell className="h-4 w-4 mr-1" />
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingJoinRequests.length}
              </Badge>
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

      {/* Pending requests panel */}
      {showPendingRequests && pendingJoinRequests.length > 0 && (
        <div className="absolute top-14 right-4 z-50 w-80 bg-background border rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-medium text-sm">Solicitações de Entrada</span>
            <div className="flex gap-1">
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
            {pendingJoinRequests.map(req => (
              <div key={req.guestId} className="flex items-center justify-between p-3 border-b last:border-b-0">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">{req.guestName.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm font-medium">{req.guestName}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleAcceptGuest(req)}>
                    <UserCheck className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRejectGuest(req)}>
                    <UserX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participant list */}
      {showParticipantList && (
        <div className="absolute top-14 left-4 z-50 w-64 bg-background border rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-medium text-sm">Participantes ({participantCount})</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowParticipantList(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <div className="flex items-center gap-2 p-3 border-b">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">{hostUserName.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-sm font-medium">Você (Anfitrião)</span>
              <div className="flex items-center gap-1 ml-auto">
                {isAudioEnabled ? <Mic className="h-3 w-3 text-green-500" /> : <MicOff className="h-3 w-3 text-destructive" />}
                {isVideoEnabled ? <Video className="h-3 w-3 text-green-500" /> : <VideoOff className="h-3 w-3 text-destructive" />}
              </div>
            </div>
            {remoteList.map(([peerId, p]) => (
              <div key={peerId} className="flex items-center gap-2 p-3 border-b last:border-b-0">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">{p.name.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium">{p.name}</span>
                <span className="h-2 w-2 rounded-full bg-green-500 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video area */}
      <div className="flex-1 relative bg-muted/50 overflow-hidden min-h-0">
        {remoteList.length > 0 ? (
          <div className={`grid ${getVideoGridClass()} w-full h-full gap-0.5 p-0.5 auto-rows-fr`}>
            {remoteList.map(([peerId, participant]) => (
              <div key={peerId} className="relative bg-muted/80 overflow-hidden rounded-sm min-h-0 min-w-0">
                <video
                  autoPlay playsInline
                  className={`w-full h-full ${remoteIsScreenSharing ? 'object-contain bg-black' : 'object-cover'}`}
                  ref={(el) => {
                    if (el && el.srcObject !== participant.stream) {
                      el.srcObject = participant.stream;
                      el.play().catch(console.warn);
                    }
                  }}
                />
                <div className="absolute bottom-1 left-1 bg-background/80 text-foreground text-xs px-2 py-0.5 rounded">
                  {participant.name}
                </div>
              </div>
            ))}
            <div className="relative bg-muted/80 overflow-hidden rounded-sm min-h-0 min-w-0">
              <video
                ref={localVideoRef} autoPlay playsInline muted
                className={isBlurEnabled ? 'hidden' : 'w-full h-full object-cover'}
                style={!isBlurEnabled ? getFilterStyle() : undefined}
              />
              {isBlurEnabled && (
                <canvas ref={blurCanvasRef} className="w-full h-full object-cover" style={getFilterStyle()} />
              )}
              {!isVideoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <VideoOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-1 left-1 bg-background/80 text-foreground text-xs px-2 py-0.5 rounded">
                Você
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 relative">
              <video
                ref={localVideoRef} autoPlay playsInline muted
                className={isBlurEnabled ? 'hidden' : 'w-full h-full object-cover'}
                style={!isBlurEnabled ? getFilterStyle() : undefined}
              />
              {isBlurEnabled && (
                <canvas ref={blurCanvasRef} className="w-full h-full object-cover" style={getFilterStyle()} />
              )}
              {!isVideoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <VideoOff className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-background/80 text-foreground text-xs px-2 py-1 rounded">Você</div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="text-center bg-background/90 rounded-lg p-6 shadow-lg">
                <Users className="h-10 w-10 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Sala de Grupo</h3>
                <p className="text-sm text-muted-foreground mb-3">Aguardando participantes entrarem...</p>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {remoteIsScreenSharing && (
          <div className="absolute top-4 left-4 bg-primary/90 text-primary-foreground text-sm px-3 py-1.5 rounded-lg flex items-center gap-2 z-10">
            <Monitor className="h-4 w-4" />
            <span>Participante compartilhando tela</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 p-4 border-t bg-card">
        <Button variant={isAudioEnabled ? 'secondary' : 'destructive'} size="lg" className="rounded-full h-12 w-12" onClick={toggleAudio}>
          {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button variant={isVideoEnabled ? 'secondary' : 'destructive'} size="lg" className="rounded-full h-12 w-12" onClick={toggleVideo}>
          {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <CameraFiltersPanel
          filters={cameraFilters} activePreset={cameraPreset}
          onUpdateFilter={updateCameraFilter} onApplyPreset={applyCameraPreset}
          onReset={resetCameraFilters} isBlurEnabled={isBlurEnabled}
          isBlurLoading={isBlurLoading} blurOptions={blurOptions}
          onToggleBlur={toggleBlur} onUpdateBlurOptions={updateBlurOptions}
        />
        <Button variant={isScreenSharing ? 'default' : 'secondary'} size="lg" className="rounded-full h-12 w-12" onClick={toggleScreenShare}>
          {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
        </Button>
        <Button variant={isRecording ? 'destructive' : 'secondary'} size="lg" className="rounded-full h-12 w-12" onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? <Square className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </Button>
        <Button variant={isTranscribing ? 'default' : 'secondary'} size="lg" className="rounded-full h-12 w-12" onClick={isTranscribing ? stopTranscription : startTranscription}>
          <FileText className="h-5 w-5" />
        </Button>
        <Button variant={activeScript ? 'default' : 'secondary'} size="lg" className="rounded-full h-12 w-12" onClick={() => activeScript ? setActiveScript(null) : setShowScriptDialog(true)}>
          <BookOpen className="h-5 w-5" />
        </Button>
        <Button variant={showChat ? 'default' : 'secondary'} size="lg" className="rounded-full h-12 w-12 relative"
          onClick={() => { setShowChat(!showChat); if (!showChat) markChatAsRead(); }}>
          <MessageCircle className="h-5 w-5" />
          {chatUnreadCount > 0 && !showChat && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
            </span>
          )}
        </Button>
        <Button variant="destructive" size="lg" className="rounded-full h-12 w-12" onClick={handleEndCall}>
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>

      {/* Transcription Panel */}
      {showTranscriptions && (
        <div className="absolute right-4 top-14 bottom-20 w-80 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg flex flex-col z-20">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Transcrição</span>
              {isTranscribing && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
            </div>
            <div className="flex items-center gap-1">
              {transcriptions.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={downloadTranscription}><Download className="h-4 w-4" /></Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowTranscriptions(false)}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-3">
            {transcriptions.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                {isTranscribing ? 'Aguardando áudio...' : 'Inicie a transcrição'}
              </div>
            ) : (
              <div className="space-y-3">
                {transcriptions.map((t, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-medium">{t.speaker}</span><span>•</span><span>{t.timestamp}</span>
                    </div>
                    <p className="text-foreground">{t.text}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      <SelectMeetingScriptDialog open={showScriptDialog} onClose={() => setShowScriptDialog(false)} onSelectScript={(script) => { setActiveScript(script); setShowScriptDialog(false); }} />
      {activeScript && <MeetingScriptPanel script={activeScript} onClose={() => setActiveScript(null)} onScriptUpdate={setActiveScript} />}
      <MeetingChatPanel isOpen={showChat} onClose={() => setShowChat(false)} messages={chatMessages} currentUserId={hostUserId} onSendMessage={sendChatMessage} isLoading={isChatLoading} />
    </div>
  );
};
