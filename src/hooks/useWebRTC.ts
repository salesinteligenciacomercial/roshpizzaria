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
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
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
  const isCallerRef = useRef(false);
  const videoEnabledRef = useRef(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 3;

  // Send signaling data
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
      videoEnabledRef.current = video;
      
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
      setIsVideoEnabled(video);
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

  // End call
  const endCall = useCallback(() => {
    console.log('=== Ending call and cleaning up ===');
    
    // Clear polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped screen track:', track.kind);
      });
      screenStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log('Peer connection closed');
    }

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      console.log('Channel removed');
    }

    // Reset state
    hasRemoteDescriptionRef.current = false;
    iceCandidateQueueRef.current = [];
    reconnectAttemptsRef.current = 0;
    isCallerRef.current = false;

    setLocalStream(null);
    setScreenStream(null);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    setIsScreenSharing(false);
    setConnectionState('new');
    
    console.log('Call cleanup complete');
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

    // Handle negotiation needed - only caller sends offer
    pc.onnegotiationneeded = async () => {
      console.log('Negotiation needed, isCaller:', isCallerRef.current);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [config, sendSignal]);

  // Create and send offer (called by caller after callee accepts)
  const createAndSendOffer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('No peer connection when trying to create offer');
      return;
    }

    try {
      console.log('Creating offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: videoEnabledRef.current,
      });
      
      await pc.setLocalDescription(offer);
      console.log('Local description set, sending offer...');
      
      await sendSignal('offer', { type: offer.type, sdp: offer.sdp });
      console.log('Offer sent successfully!');
    } catch (error) {
      console.error('Error creating/sending offer:', error);
    }
  }, [sendSignal]);

  // Handle incoming signals
  const handleSignal = useCallback(async (signal: any) => {
    const pc = peerConnectionRef.current;
    
    try {
      console.log('Handling signal:', signal.signal_type, 'hasPc:', !!pc);
      
      switch (signal.signal_type) {
        case 'call-accept':
          // Callee accepted the call, now caller creates and sends offer
          console.log('Call accepted, creating offer as caller...');
          if (isCallerRef.current && pc) {
            await createAndSendOffer();
          }
          break;
          
        case 'offer':
          if (!pc) {
            console.warn('No peer connection when receiving offer');
            return;
          }
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
          if (!pc) {
            console.warn('No peer connection when receiving answer');
            return;
          }
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
            
            if (pc && hasRemoteDescriptionRef.current) {
              await pc.addIceCandidate(candidate);
              console.log('ICE candidate added immediately');
            } else {
              iceCandidateQueueRef.current.push(candidate);
              console.log('ICE candidate queued (no pc or no remote desc)');
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
  }, [sendSignal, processIceCandidateQueue, endCall, config, createAndSendOffer]);

  // Subscribe to signals
  const subscribeToSignals = useCallback(() => {
    // Remove any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    const channelName = `webrtc-${config.meetingId}-${config.localUserId}-${Date.now()}`;
    
    console.log('=== Subscribing to signals ===');
    console.log('Meeting ID:', config.meetingId);
    console.log('Local User ID:', config.localUserId);
    console.log('Remote User ID:', config.remoteUserId);
    
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
          console.log('=== Received signal via realtime ===');
          console.log('Signal type:', signal?.signal_type);
          console.log('From user:', signal?.from_user);
          console.log('To user:', signal?.to_user);
          console.log('Meeting ID:', signal?.meeting_id);
          console.log('Expected meeting:', config.meetingId);
          
          if (signal && signal.meeting_id === config.meetingId) {
            console.log('Signal matches meeting, processing...');
            handleSignal(signal);
          } else {
            console.log('Signal does not match meeting, ignoring');
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status, 'for channel:', channelName);
      });

    channelRef.current = channel;
    return channel;
  }, [config.meetingId, config.localUserId, config.remoteUserId, handleSignal]);

  // Check for pending call-accept signal (for caller)
  const checkForCallAccept = useCallback(async () => {
    console.log('Caller checking for pending call-accept...');
    try {
      const { data: pendingSignals, error } = await supabase
        .from('meeting_signals')
        .select('*')
        .eq('meeting_id', config.meetingId)
        .eq('to_user', config.localUserId)
        .eq('signal_type', 'call-accept')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching call-accept:', error);
        return;
      }

      if (pendingSignals && pendingSignals.length > 0) {
        console.log('Found pending call-accept, processing...');
        for (const signal of pendingSignals) {
          await handleSignal(signal);
        }
      } else {
        console.log('No pending call-accept found yet');
      }
    } catch (error) {
      console.error('Error checking call-accept:', error);
    }
  }, [config.meetingId, config.localUserId, handleSignal]);

  // Start call (caller - waits for call-accept before sending offer)
  const startCall = useCallback(async (video: boolean = true) => {
    try {
      console.log('=== Starting call as CALLER ===');
      console.log('Video enabled:', video);
      
      isCallerRef.current = true;
      hasRemoteDescriptionRef.current = false;
      iceCandidateQueueRef.current = [];
      
      const stream = await initializeMedia(video);
      createPeerConnection(stream);
      
      // Subscribe to signals to receive call-accept and then answer
      subscribeToSignals();
      
      // Wait for subscription to be active
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check for pending call-accept in case callee accepted very fast
      await checkForCallAccept();
      
      // Clear any existing poll interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      // Set up polling to check for call-accept periodically
      pollIntervalRef.current = setInterval(async () => {
        if (hasRemoteDescriptionRef.current) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          return;
        }
        console.log('Polling for call-accept...');
        await checkForCallAccept();
      }, 2000);
      
      // Clear polling after 30 seconds
      setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }, 30000);
      
      console.log('Caller ready, waiting for callee to accept...');
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }, [initializeMedia, createPeerConnection, subscribeToSignals, checkForCallAccept]);

  // Check for pending signals in the database (in case we missed realtime events)
  const checkPendingSignals = useCallback(async () => {
    console.log('Checking for pending signals...');
    try {
      const { data: pendingSignals, error } = await supabase
        .from('meeting_signals')
        .select('*')
        .eq('meeting_id', config.meetingId)
        .eq('to_user', config.localUserId)
        .in('signal_type', ['offer', 'answer', 'ice-candidate'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching pending signals:', error);
        return;
      }

      if (pendingSignals && pendingSignals.length > 0) {
        console.log('Found pending signals:', pendingSignals.length);
        for (const signal of pendingSignals) {
          console.log('Processing pending signal:', signal.signal_type);
          await handleSignal(signal);
        }
      } else {
        console.log('No pending signals found');
      }
    } catch (error) {
      console.error('Error checking pending signals:', error);
    }
  }, [config.meetingId, config.localUserId, handleSignal]);

  // Answer call (callee - receives offer, sends answer)
  // Important: callee subscribes first, then signals ready
  const answerCall = useCallback(async (video: boolean = true) => {
    try {
      console.log('=== Answering call as CALLEE ===');
      console.log('Video enabled:', video);
      
      isCallerRef.current = false;
      hasRemoteDescriptionRef.current = false;
      iceCandidateQueueRef.current = [];
      
      const stream = await initializeMedia(video);
      createPeerConnection(stream);
      
      // Subscribe to signals FIRST before anything else
      subscribeToSignals();
      
      // Give time for subscription to be active
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if there are any pending signals we might have missed
      await checkPendingSignals();
      
      // Set up polling for offer in case we missed it
      const pollInterval = setInterval(async () => {
        if (hasRemoteDescriptionRef.current) {
          clearInterval(pollInterval);
          return;
        }
        console.log('Callee polling for offer...');
        await checkPendingSignals();
      }, 2000);
      
      // Clear polling after 30 seconds
      setTimeout(() => clearInterval(pollInterval), 30000);
      
      console.log('Callee ready to receive offer from caller');
    } catch (error) {
      console.error('Error answering call:', error);
      throw error;
    }
  }, [initializeMedia, createPeerConnection, subscribeToSignals, checkPendingSignals]);

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
    if (!pc || !stream) {
      console.error('No peer connection or stream for screen sharing');
      return;
    }

    if (isScreenSharing) {
      // Stop screen sharing, restore camera
      console.log('Stopping screen share...');
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
      }

      if (originalVideoTrackRef.current) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(originalVideoTrackRef.current);
          console.log('Camera track restored');
        }
      }
      setIsScreenSharing(false);
    } else {
      // Start screen sharing
      try {
        console.log('Starting screen share...');
        const newScreenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        
        screenStreamRef.current = newScreenStream;
        setScreenStream(newScreenStream);

        const screenTrack = newScreenStream.getVideoTracks()[0];
        console.log('Screen track obtained:', screenTrack.label);
        
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
          originalVideoTrackRef.current = sender.track;
          await sender.replaceTrack(screenTrack);
          console.log('Screen track replaced in peer connection');
        } else {
          console.warn('No video sender found in peer connection');
        }

        // Handle user stopping share via browser UI
        screenTrack.onended = () => {
          console.log('Screen share ended by user');
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        console.log('Screen sharing started successfully');
      } catch (error: any) {
        console.error('Error sharing screen:', error);
        if (error.name === 'NotAllowedError') {
          // User cancelled - do nothing
          console.log('User cancelled screen share');
        } else {
          console.error('Screen share error:', error.message);
        }
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
    screenStream,
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
