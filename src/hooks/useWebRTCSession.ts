/**
 * useWebRTCSession - Arquitetura WebRTC Refatorada
 * 
 * Modelo HOST/PARTICIPANT:
 * - HOST (caller): Único responsável por criar offers
 * - PARTICIPANT (callee): Apenas responde com answers
 * 
 * Estados da sala:
 * - idle: Nenhuma chamada ativa
 * - waiting: Aguardando participante aceitar
 * - connecting: Estabelecendo conexão WebRTC
 * - connected: Chamada ativa
 * - ended: Chamada encerrada
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export type RoomState = 'idle' | 'waiting' | 'connecting' | 'connected' | 'ended';
export type ParticipantRole = 'host' | 'participant';

export interface WebRTCSessionConfig {
  meetingId: string;
  localUserId: string;
  remoteUserId: string;
  role: ParticipantRole;
  onRemoteStream: (stream: MediaStream) => void;
  onRoomStateChange: (state: RoomState) => void;
  onCallEnded: () => void;
}

interface SignalPayload {
  id: string;
  meeting_id: string;
  from_user: string;
  to_user: string;
  signal_type: string;
  signal_data: any;
  created_at: string;
}

// ============================================
// ICE SERVERS CONFIG
// ============================================

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TURN servers for NAT traversal
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

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export const useWebRTCSession = (config: WebRTCSessionConfig) => {
  // ========== STATE ==========
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [roomState, setRoomState] = useState<RoomState>('idle');

  // ========== REFS ==========
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidate[]>([]);
  const hasRemoteDescriptionRef = useRef(false);
  const isNegotiatingRef = useRef(false);
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const isCleanedUpRef = useRef(false);

  // ========== HELPER: Update Room State ==========
  const updateRoomState = useCallback((newState: RoomState) => {
    console.log(`[WebRTC] Room state: ${roomState} -> ${newState}`);
    setRoomState(newState);
    config.onRoomStateChange(newState);
  }, [roomState, config]);

  // ========== SIGNALING: Send Signal ==========
  const sendSignal = useCallback(async (signalType: string, signalData: any = {}) => {
    if (isCleanedUpRef.current) {
      console.log('[WebRTC] Skipping signal send - already cleaned up');
      return;
    }
    
    try {
      console.log(`[WebRTC] Sending signal: ${signalType}`);
      
      const { error } = await supabase.from('meeting_signals').insert({
        meeting_id: config.meetingId,
        from_user: config.localUserId,
        to_user: config.remoteUserId,
        signal_type: signalType,
        signal_data: signalData,
      });

      if (error) {
        console.error('[WebRTC] Error sending signal:', error);
      }
    } catch (error) {
      console.error('[WebRTC] Error sending signal:', error);
    }
  }, [config.meetingId, config.localUserId, config.remoteUserId]);

  // ========== MEDIA: Initialize ==========
  const initializeMedia = useCallback(async (video: boolean = true) => {
    try {
      console.log('[WebRTC] Initializing media, video:', video);
      
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('[WebRTC] Media initialized:', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVideoEnabled(video && stream.getVideoTracks().length > 0);
      
      return stream;
    } catch (error) {
      console.error('[WebRTC] Error initializing media:', error);
      throw error;
    }
  }, []);

  // ========== ICE: Process Queued Candidates ==========
  const processIceCandidateQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !hasRemoteDescriptionRef.current) return;

    console.log('[WebRTC] Processing ICE queue:', iceCandidateQueueRef.current.length);
    
    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(candidate);
          console.log('[WebRTC] ICE candidate added from queue');
        } catch (error) {
          console.error('[WebRTC] Error adding queued ICE candidate:', error);
        }
      }
    }
  }, []);

  // ========== PEER CONNECTION: Create ==========
  const createPeerConnection = useCallback((stream: MediaStream) => {
    console.log('[WebRTC] Creating peer connection, role:', config.role);

    // Close existing connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach(track => {
      console.log('[WebRTC] Adding track:', track.kind);
      pc.addTrack(track, stream);
    });

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind);
      if (event.streams[0]) {
        config.onRemoteStream(event.streams[0]);
        updateRoomState('connected');
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate generated');
        sendSignal('ice-candidate', { candidate: event.candidate.toJSON() });
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        updateRoomState('connected');
      } else if (pc.iceConnectionState === 'failed') {
        console.log('[WebRTC] ICE failed, attempting restart');
        pc.restartIce();
      } else if (pc.iceConnectionState === 'disconnected') {
        // Wait a bit before considering it failed
        setTimeout(() => {
          if (peerConnectionRef.current?.iceConnectionState === 'disconnected') {
            console.log('[WebRTC] Still disconnected, restarting ICE');
            pc.restartIce();
          }
        }, 3000);
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        updateRoomState('connected');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (!isCleanedUpRef.current) {
          updateRoomState('ended');
        }
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [config, sendSignal, updateRoomState]);

  // ========== HOST: Create and Send Offer ==========
  const createAndSendOffer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('[WebRTC] No peer connection for offer');
      return;
    }

    // Prevent multiple simultaneous offers
    if (isNegotiatingRef.current) {
      console.log('[WebRTC] Already negotiating, skipping offer');
      return;
    }

    try {
      isNegotiatingRef.current = true;
      console.log('[WebRTC] HOST creating offer...');

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);
      console.log('[WebRTC] Local description set');

      await sendSignal('offer', { type: offer.type, sdp: offer.sdp });
      console.log('[WebRTC] Offer sent successfully');

    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
    } finally {
      isNegotiatingRef.current = false;
    }
  }, [sendSignal]);

  // ========== SIGNAL HANDLER ==========
  const handleSignal = useCallback(async (signal: SignalPayload) => {
    // Skip already processed signals
    if (processedSignalsRef.current.has(signal.id)) {
      console.log('[WebRTC] Signal already processed:', signal.id);
      return;
    }
    processedSignalsRef.current.add(signal.id);

    const pc = peerConnectionRef.current;
    console.log('[WebRTC] Handling signal:', signal.signal_type, 'role:', config.role);

    try {
      switch (signal.signal_type) {
        case 'call-accept':
          // PARTICIPANT accepted - HOST creates offer
          if (config.role === 'host') {
            console.log('[WebRTC] Call accepted, HOST creating offer');
            updateRoomState('connecting');
            await createAndSendOffer();
          }
          break;

        case 'offer':
          // PARTICIPANT receives offer from HOST
          if (!pc) {
            console.warn('[WebRTC] No PC when receiving offer');
            return;
          }
          if (config.role === 'participant') {
            console.log('[WebRTC] PARTICIPANT received offer, creating answer');
            updateRoomState('connecting');
            
            await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
            hasRemoteDescriptionRef.current = true;
            await processIceCandidateQueue();

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal('answer', { type: answer.type, sdp: answer.sdp });
            console.log('[WebRTC] Answer sent');
          }
          break;

        case 'answer':
          // HOST receives answer from PARTICIPANT
          if (!pc) {
            console.warn('[WebRTC] No PC when receiving answer');
            return;
          }
          if (config.role === 'host' && pc.signalingState === 'have-local-offer') {
            console.log('[WebRTC] HOST received answer');
            await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
            hasRemoteDescriptionRef.current = true;
            await processIceCandidateQueue();
          }
          break;

        case 'ice-candidate':
          if (signal.signal_data?.candidate) {
            const candidate = new RTCIceCandidate(signal.signal_data.candidate);
            
            if (pc && hasRemoteDescriptionRef.current) {
              await pc.addIceCandidate(candidate);
              console.log('[WebRTC] ICE candidate added');
            } else {
              iceCandidateQueueRef.current.push(candidate);
              console.log('[WebRTC] ICE candidate queued');
            }
          }
          break;

        case 'call-end':
          console.log('[WebRTC] Call end signal received');
          cleanup();
          config.onCallEnded();
          break;

        case 'call-reject':
          console.log('[WebRTC] Call rejected');
          cleanup();
          config.onCallEnded();
          break;
      }
    } catch (error) {
      console.error('[WebRTC] Error handling signal:', error);
    }
  }, [config, createAndSendOffer, sendSignal, processIceCandidateQueue, updateRoomState]);

  // ========== SIGNALING: Subscribe ==========
  const subscribeToSignals = useCallback(() => {
    // Cleanup existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelId = `webrtc-session-${config.meetingId}-${config.localUserId}-${Date.now()}`;
    console.log('[WebRTC] Subscribing to signals, channel:', channelId);

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_signals',
          filter: `to_user=eq.${config.localUserId}`,
        },
        (payload) => {
          const signal = payload.new as SignalPayload;
          if (signal.meeting_id === config.meetingId) {
            handleSignal(signal);
          }
        }
      )
      .subscribe((status) => {
        console.log('[WebRTC] Subscription status:', status);
      });

    channelRef.current = channel;
  }, [config.meetingId, config.localUserId, handleSignal]);

  // ========== FETCH PENDING SIGNALS ==========
  const fetchPendingSignals = useCallback(async () => {
    try {
      const signalTypes = config.role === 'host' 
        ? ['call-accept', 'answer', 'ice-candidate']
        : ['offer', 'ice-candidate'];

      const { data, error } = await supabase
        .from('meeting_signals')
        .select('*')
        .eq('meeting_id', config.meetingId)
        .eq('to_user', config.localUserId)
        .in('signal_type', signalTypes)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[WebRTC] Error fetching signals:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log('[WebRTC] Found pending signals:', data.length);
        for (const signal of data) {
          await handleSignal(signal as SignalPayload);
        }
      }
    } catch (error) {
      console.error('[WebRTC] Error fetching pending signals:', error);
    }
  }, [config, handleSignal]);

  // ========== START SESSION ==========
  const startSession = useCallback(async (video: boolean = true) => {
    console.log(`[WebRTC] Starting session as ${config.role}, video: ${video}`);
    
    isCleanedUpRef.current = false;
    hasRemoteDescriptionRef.current = false;
    iceCandidateQueueRef.current = [];
    processedSignalsRef.current.clear();

    try {
      // Initialize media
      const stream = await initializeMedia(video);
      
      // Create peer connection
      createPeerConnection(stream);
      
      // Subscribe to signals
      subscribeToSignals();
      
      // Wait for subscription
      await new Promise(resolve => setTimeout(resolve, 300));

      if (config.role === 'host') {
        // HOST waits for call-accept, then creates offer
        updateRoomState('waiting');
        
        // Check for pending call-accept
        await fetchPendingSignals();
        
        // Poll for call-accept (in case realtime misses it)
        const pollInterval = setInterval(async () => {
          if (hasRemoteDescriptionRef.current || isCleanedUpRef.current) {
            clearInterval(pollInterval);
            return;
          }
          await fetchPendingSignals();
        }, 2000);

        // Stop polling after 60 seconds
        setTimeout(() => clearInterval(pollInterval), 60000);

      } else {
        // PARTICIPANT waits for offer from HOST
        updateRoomState('connecting');
        
        // Check for pending offer
        await fetchPendingSignals();
        
        // Poll for offer
        const pollInterval = setInterval(async () => {
          if (hasRemoteDescriptionRef.current || isCleanedUpRef.current) {
            clearInterval(pollInterval);
            return;
          }
          await fetchPendingSignals();
        }, 2000);

        setTimeout(() => clearInterval(pollInterval), 60000);
      }

    } catch (error) {
      console.error('[WebRTC] Error starting session:', error);
      throw error;
    }
  }, [config.role, initializeMedia, createPeerConnection, subscribeToSignals, fetchPendingSignals, updateRoomState]);

  // ========== CLEANUP ==========
  const cleanup = useCallback(() => {
    // Prevent double cleanup
    if (isCleanedUpRef.current) {
      console.log('[WebRTC] Already cleaned up, skipping');
      return;
    }
    
    console.log('[WebRTC] Cleaning up session');
    isCleanedUpRef.current = true;

    // Remove channel subscription first to prevent new signals
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        console.warn('[WebRTC] Error closing peer connection:', e);
      }
      peerConnectionRef.current = null;
    }

    // Stop media tracks after a small delay to prevent race conditions
    setTimeout(() => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn('[WebRTC] Error stopping track:', e);
          }
        });
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn('[WebRTC] Error stopping screen track:', e);
          }
        });
        screenStreamRef.current = null;
      }
    }, 100);

    // Reset state
    hasRemoteDescriptionRef.current = false;
    iceCandidateQueueRef.current = [];
    isNegotiatingRef.current = false;

    setLocalStream(null);
    setScreenStream(null);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    setIsScreenSharing(false);
    setRoomState('ended');
  }, []);

  // ========== END CALL ==========
  const endCall = useCallback(async () => {
    console.log('[WebRTC] Ending call');
    await sendSignal('call-end', {});
    cleanup();
  }, [sendSignal, cleanup]);

  // ========== TOGGLE AUDIO ==========
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log('[WebRTC] Audio:', audioTrack.enabled);
      }
    }
  }, []);

  // ========== TOGGLE VIDEO ==========
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log('[WebRTC] Video:', videoTrack.enabled);
      }
    }
  }, []);

  // ========== TOGGLE SCREEN SHARE ==========
  const toggleScreenShare = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !localStreamRef.current) {
      console.error('[WebRTC] No PC or stream for screen share');
      return;
    }

    if (isScreenSharing) {
      // Stop screen sharing
      console.log('[WebRTC] Stopping screen share');
      
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
      }

      // Restore camera track
      if (originalVideoTrackRef.current) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(originalVideoTrackRef.current);
        }
      }
      
      setIsScreenSharing(false);

    } else {
      // Start screen sharing
      try {
        console.log('[WebRTC] Starting screen share');
        
        const screenMediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        screenStreamRef.current = screenMediaStream;
        setScreenStream(screenMediaStream);

        const screenTrack = screenMediaStream.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');

        if (sender && sender.track) {
          originalVideoTrackRef.current = sender.track;
          await sender.replaceTrack(screenTrack);
        }

        // Handle browser stop button
        screenTrack.onended = () => {
          console.log('[WebRTC] Screen share stopped by user');
          toggleScreenShare();
        };

        setIsScreenSharing(true);

      } catch (error: any) {
        if (error.name !== 'NotAllowedError') {
          console.error('[WebRTC] Screen share error:', error);
        }
      }
    }
  }, [isScreenSharing]);

  // ========== CLEANUP ON UNMOUNT ==========
  useEffect(() => {
    return () => {
      // Only cleanup if session was actually started
      if (!isCleanedUpRef.current && peerConnectionRef.current) {
        cleanup();
      }
    };
  }, [cleanup]);

  // ========== RETURN ==========
  return {
    // State
    localStream,
    screenStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    roomState,
    
    // Actions
    startSession,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    cleanup,
  };
};
