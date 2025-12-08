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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useWebRTC = (config: WebRTCConfig) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initialize media
  const initializeMedia = useCallback(async (video: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { width: 1280, height: 720 } : false,
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams[0]) {
        config.onRemoteStream(event.streams[0]);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await sendSignal('ice-candidate', { candidate: event.candidate });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      config.onConnectionStateChange(pc.connectionState);
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log('Connection state:', pc.connectionState);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [config]);

  // Send signaling data
  const sendSignal = useCallback(async (signalType: string, signalData: any) => {
    try {
      await supabase.from('meeting_signals').insert({
        meeting_id: config.meetingId,
        from_user: config.localUserId,
        to_user: config.remoteUserId,
        signal_type: signalType,
        signal_data: signalData,
      });
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }, [config]);

  // Handle incoming signals
  const handleSignal = useCallback(async (signal: any) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      switch (signal.signal_type) {
        case 'offer':
          await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', answer);
          break;

        case 'answer':
          await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
          break;

        case 'ice-candidate':
          if (signal.signal_data.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.signal_data.candidate));
          }
          break;

        case 'call-end':
          endCall();
          config.onCallEnded();
          break;
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }, [config, sendSignal]);

  // Subscribe to signals
  const subscribeToSignals = useCallback(() => {
    const channel = supabase
      .channel(`meeting-signals-${config.meetingId}-${config.localUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_signals',
          filter: `to_user=eq.${config.localUserId}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).meeting_id === config.meetingId) {
            handleSignal(payload.new);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    return channel;
  }, [config, handleSignal]);

  // Start call (caller)
  const startCall = useCallback(async (video: boolean = true) => {
    const stream = await initializeMedia(video);
    const pc = createPeerConnection(stream);
    subscribeToSignals();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal('offer', offer);
  }, [initializeMedia, createPeerConnection, subscribeToSignals, sendSignal]);

  // Answer call (callee)
  const answerCall = useCallback(async (video: boolean = true) => {
    const stream = await initializeMedia(video);
    createPeerConnection(stream);
    subscribeToSignals();
  }, [initializeMedia, createPeerConnection, subscribeToSignals]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !localStream) return;

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
  }, [isScreenSharing, localStream]);

  // End call
  const endCall = useCallback(() => {
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
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

    setLocalStream(null);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    setIsScreenSharing(false);
  }, [localStream]);

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
