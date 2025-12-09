import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WebRTCConfig {
  meetingId: string;
  localUserId: string;
  remoteUserId: string;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onCallEnded: () => void;
}

// ICE Servers with TURN fallback for restrictive networks
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers for testing
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

export const useWebRTC = (config: WebRTCConfig) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidate[]>([]);
  const hasRemoteDescriptionRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  // Send signaling data - defined first as it's used by other functions
  const sendSignal = useCallback(async (signalType: string, signalData: any) => {
    try {
      console.log('Sending signal:', signalType);
      const { error } = await supabase.from('meeting_signals').insert({
        meeting_id: config.meetingId,
        from_user: config.localUserId,
        to_user: config.remoteUserId,
        signal_type: signalType,
        signal_data: signalData,
      });
      
      if (error) {
        console.error('Error sending signal:', error);
      } else {
        console.log('Signal sent successfully:', signalType);
      }
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }, [config.meetingId, config.localUserId, config.remoteUserId]);

  // Initialize media
  const initializeMedia = useCallback(async (video: boolean = true) => {
    try {
      console.log('Initializing media, video:', video);
      const stream = await navigator.mediaDevices.getUserMedia({
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
      });
      console.log('Media initialized:', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, []);

  // Process queued ICE candidates
  const processIceCandidateQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !hasRemoteDescriptionRef.current) return;

    console.log('Processing ICE candidate queue:', iceCandidateQueueRef.current.length);
    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(candidate);
          console.log('Added queued ICE candidate');
        } catch (error) {
          console.error('Error adding queued ICE candidate:', error);
        }
      }
    }
  }, []);

  // End call - defined before createPeerConnection to avoid circular dependency
  const endCall = useCallback(() => {
    console.log('Ending call...');
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Reset state
    hasRemoteDescriptionRef.current = false;
    iceCandidateQueueRef.current = [];
    reconnectAttemptsRef.current = 0;

    setLocalStream(null);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    setIsScreenSharing(false);
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((stream: MediaStream) => {
    console.log('Creating peer connection...');
    
    // Close existing connection if any
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach(track => {
      console.log('Adding track to peer connection:', track.kind);
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Remote track received:', event.track.kind);
      if (event.streams[0]) {
        console.log('Setting remote stream with tracks:', event.streams[0].getTracks().map(t => t.kind));
        config.onRemoteStream(event.streams[0]);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('Local ICE candidate generated');
        await sendSignal('ice-candidate', { candidate: event.candidate.toJSON() });
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed') {
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`ICE restart attempt ${reconnectAttemptsRef.current}`);
          pc.restartIce();
        }
      } else if (pc.iceConnectionState === 'connected') {
        reconnectAttemptsRef.current = 0;
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      config.onConnectionStateChange(pc.connectionState);
    };

    // Handle negotiation needed
    pc.onnegotiationneeded = async () => {
      console.log('Negotiation needed');
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [config, sendSignal]);

  // Handle incoming signals
  const handleSignal = useCallback(async (signal: any) => {
    const pc = peerConnectionRef.current;
    
    try {
      console.log('Handling signal:', signal.signal_type);
      
      if (!pc) {
        console.warn('No peer connection when handling signal:', signal.signal_type);
        return;
      }
      
      switch (signal.signal_type) {
        case 'offer':
          console.log('Received offer, setting remote description...');
          await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
          hasRemoteDescriptionRef.current = true;
          await processIceCandidateQueue();
          
          console.log('Creating answer...');
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', { type: answer.type, sdp: answer.sdp });
          console.log('Answer sent!');
          break;

        case 'answer':
          console.log('Received answer, current state:', pc.signalingState);
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
            hasRemoteDescriptionRef.current = true;
            await processIceCandidateQueue();
            console.log('Remote description set from answer!');
          } else {
            console.warn('Ignoring answer, wrong state:', pc.signalingState);
          }
          break;

        case 'ice-candidate':
          if (signal.signal_data?.candidate) {
            const candidate = new RTCIceCandidate(signal.signal_data.candidate);
            
            if (hasRemoteDescriptionRef.current) {
              await pc.addIceCandidate(candidate);
              console.log('ICE candidate added immediately');
            } else {
              iceCandidateQueueRef.current.push(candidate);
              console.log('ICE candidate queued');
            }
          }
          break;

        case 'call-end':
          console.log('Received call-end signal');
          endCall();
          config.onCallEnded();
          break;
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }, [sendSignal, processIceCandidateQueue, endCall, config]);

  // Subscribe to signals
  const subscribeToSignals = useCallback(() => {
    const channelName = `meeting-signals-${config.meetingId}-${config.localUserId}-${Date.now()}`;
    
    console.log('Subscribing to signals for meeting:', config.meetingId, 'user:', config.localUserId);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_signals',
          filter: `to_user=eq.${config.localUserId}`,
        },
        (payload) => {
          const signal = payload.new as any;
          console.log('Received signal via realtime:', signal?.signal_type, 'meeting:', signal?.meeting_id);
          
          if (signal && signal.meeting_id === config.meetingId) {
            handleSignal(signal);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    channelRef.current = channel;
    return channel;
  }, [config.meetingId, config.localUserId, handleSignal]);

  // Start call (caller - sends offer immediately)
  const startCall = useCallback(async (video: boolean = true) => {
    try {
      console.log('=== Starting call as CALLER ===');
      console.log('Video enabled:', video);
      hasRemoteDescriptionRef.current = false;
      iceCandidateQueueRef.current = [];
      
      const stream = await initializeMedia(video);
      const pc = createPeerConnection(stream);
      
      // Subscribe to signals to receive answer
      subscribeToSignals();
      
      // Create and send offer immediately
      console.log('Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: video,
      });
      await pc.setLocalDescription(offer);
      console.log('Local description set, sending offer...');
      await sendSignal('offer', { type: offer.type, sdp: offer.sdp });
      console.log('Offer sent successfully!');
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }, [initializeMedia, createPeerConnection, subscribeToSignals, sendSignal]);

  // Answer call (callee - waits for offer, sends answer)
  const answerCall = useCallback(async (video: boolean = true) => {
    try {
      console.log('=== Answering call as CALLEE ===');
      console.log('Video enabled:', video);
      hasRemoteDescriptionRef.current = false;
      iceCandidateQueueRef.current = [];
      
      const stream = await initializeMedia(video);
      createPeerConnection(stream);
      subscribeToSignals();
      
      console.log('Ready to receive offer from caller');
    } catch (error) {
      console.error('Error answering call:', error);
      throw error;
    }
  }, [initializeMedia, createPeerConnection, subscribeToSignals]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log('Audio toggled:', audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log('Video toggled:', videoTrack.enabled);
      }
    }
  }, []);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    const pc = peerConnectionRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream) return;

    if (isScreenSharing) {
      // Stop screen sharing, restore camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

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
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        screenStreamRef.current = screenStream;

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
          originalVideoTrackRef.current = sender.track;
          await sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    }
  }, [isScreenSharing]);

  // Send end call signal
  const sendEndCall = useCallback(async () => {
    await sendSignal('call-end', {});
    endCall();
  }, [sendSignal, endCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    connectionState,
    startCall,
    answerCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    endCall,
    sendEndCall,
  };
};