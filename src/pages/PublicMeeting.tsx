import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Monitor, MonitorOff, Circle, Square, Loader2, Users, Copy, Check
} from 'lucide-react';
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
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [waitingForGuests, setWaitingForGuests] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidate[]>([]);
  const hasRemoteDescriptionRef = useRef(false);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  
  const guestIdRef = useRef<string>(`guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

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
      
      // Check if current user is the host
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === data.created_by) {
        setIsHost(true);
        setGuestName(data.participant_names?.[0] || 'Anfitrião');
      }
    };

    checkMeeting();
  }, [meetingId]);

  // Process queued ICE candidates
  const processIceCandidateQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !hasRemoteDescriptionRef.current) return;

    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(candidate);
          console.log('Added queued ICE candidate');
        } catch (e) {
          console.error('Error adding queued ICE candidate:', e);
        }
      }
    }
  }, []);

  // Initialize WebRTC as Host (waits for guest's offer)
  const initializeWebRTCAsHost = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.warn);
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      hasRemoteDescriptionRef.current = false;
      iceCandidateQueueRef.current = [];

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        console.log('Host received remote track');
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(console.warn);
        }
        setIsConnecting(false);
        setWaitingForGuests(false);
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('Host ICE candidate');
          await supabase.from('meeting_signals').insert([{
            meeting_id: meetingId!,
            from_user: 'host',
            to_user: 'guest',
            signal_type: 'ice-candidate',
            signal_data: JSON.parse(JSON.stringify({ candidate: event.candidate.toJSON() })),
          }]);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Host connection state:', pc.connectionState);
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
        }
      };

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
            
            console.log('Host received signal:', signal.signal_type);

            if (signal.signal_type === 'offer') {
              // Guest sent offer, respond with answer
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data.sdp));
                hasRemoteDescriptionRef.current = true;
                await processIceCandidateQueue();
                
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                await supabase.from('meeting_signals').insert([{
                  meeting_id: meetingId!,
                  from_user: 'host',
                  to_user: signal.from_user,
                  signal_type: 'answer',
                  signal_data: JSON.parse(JSON.stringify({ sdp: answer })),
                }]);
                console.log('Host sent answer to guest:', signal.from_user);
              } catch (error) {
                console.error('Error handling offer:', error);
              }
            } else if (signal.signal_type === 'answer') {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data.sdp));
                hasRemoteDescriptionRef.current = true;
                await processIceCandidateQueue();
              }
            } else if (signal.signal_type === 'ice-candidate') {
              const candidate = new RTCIceCandidate(signal.signal_data.candidate);
              if (hasRemoteDescriptionRef.current) {
                try {
                  await pc.addIceCandidate(candidate);
                } catch (e) {
                  console.error('Error adding ICE candidate:', e);
                }
              } else {
                iceCandidateQueueRef.current.push(candidate);
              }
            } else if (signal.signal_type === 'guest-joined') {
              toast.success(`${signal.signal_data.guestName} entrou na reunião`);
              setWaitingForGuests(false);
            } else if (signal.signal_type === 'call-end') {
              handleEndCall();
            }
          }
        )
        .subscribe((status) => {
          console.log('Host subscription status:', status);
        });

      channelRef.current = channel;
      
      // Wait for subscription to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check for any pending offers from guests
      const { data: pendingOffers } = await supabase
        .from('meeting_signals')
        .select('*')
        .eq('meeting_id', meetingId!)
        .eq('signal_type', 'offer')
        .order('created_at', { ascending: true });
      
      if (pendingOffers && pendingOffers.length > 0) {
        console.log('Found pending offer from guest');
        const offer = pendingOffers[0];
        const signalData = offer.signal_data as any;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          hasRemoteDescriptionRef.current = true;
          await processIceCandidateQueue();
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          await supabase.from('meeting_signals').insert([{
            meeting_id: meetingId!,
            from_user: 'host',
            to_user: offer.from_user,
            signal_type: 'answer',
            signal_data: JSON.parse(JSON.stringify({ sdp: answer })),
          }]);
          console.log('Host sent answer to pending guest');
          setWaitingForGuests(false);
        } catch (error) {
          console.error('Error processing pending offer:', error);
        }
      }
      
      setWaitingForGuests(true);
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
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.warn);
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;
      hasRemoteDescriptionRef.current = false;
      iceCandidateQueueRef.current = [];

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        console.log('Guest received remote track');
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(console.warn);
        }
        setIsConnecting(false);
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('Guest ICE candidate');
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
        console.log('Guest connection state:', pc.connectionState);
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
            if (signal.to_user !== guestIdRef.current && signal.to_user !== 'guest') return;

            console.log('Guest received signal:', signal.signal_type);

            if (signal.signal_type === 'answer') {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data.sdp));
                hasRemoteDescriptionRef.current = true;
                await processIceCandidateQueue();
              }
            } else if (signal.signal_type === 'ice-candidate' && signal.from_user !== guestIdRef.current) {
              const candidate = new RTCIceCandidate(signal.signal_data.candidate);
              if (hasRemoteDescriptionRef.current) {
                try {
                  await pc.addIceCandidate(candidate);
                } catch (e) {
                  console.error('Error adding ICE candidate:', e);
                }
              } else {
                iceCandidateQueueRef.current.push(candidate);
              }
            } else if (signal.signal_type === 'call-end') {
              handleEndCall();
            }
          }
        )
        .subscribe((status) => {
          console.log('Guest subscription status:', status);
        });

      channelRef.current = channel;
      
      // Wait for subscription to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Notify host that guest joined
      await supabase.from('meeting_signals').insert([{
        meeting_id: meetingId!,
        from_user: guestIdRef.current,
        to_user: 'host',
        signal_type: 'guest-joined',
        signal_data: { guestName, guestId: guestIdRef.current },
      }]);

      // Create and send offer
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

      console.log('Guest offer sent');
      
      // Poll for answer in case realtime misses it
      const pollForAnswer = async () => {
        if (hasRemoteDescriptionRef.current) return;
        
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
          console.log('Found pending answer from host');
          await pc.setRemoteDescription(new RTCSessionDescription(answerData.sdp));
          hasRemoteDescriptionRef.current = true;
          await processIceCandidateQueue();
        }
      };
      
      // Poll a few times in case realtime is slow
      setTimeout(pollForAnswer, 1000);
      setTimeout(pollForAnswer, 3000);
      setTimeout(pollForAnswer, 5000);

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
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      if (isScreenSharing) {
        // Restore camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
        
        if (originalVideoTrackRef.current) {
          originalVideoTrackRef.current.stop();
        }
        
        // Update local stream
        const audioTracks = localStream?.getAudioTracks() || [];
        setLocalStream(new MediaStream([...audioTracks, videoTrack]));
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([...audioTracks, videoTrack]);
        }
        
        setIsScreenSharing(false);
      } else {
        // Start screen share
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          originalVideoTrackRef.current = localStream?.getVideoTracks()[0] || null;
          await sender.replaceTrack(screenTrack);
        }
        
        screenTrack.onended = () => {
          toggleScreenShare();
        };
        
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const startRecording = () => {
    const streams: MediaStream[] = [];
    if (localStream) streams.push(localStream);
    if (remoteStream) streams.push(remoteStream);

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

      const videoTrack = localStream?.getVideoTracks()[0] || remoteStream?.getVideoTracks()[0];
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

  const handleEndCall = async () => {
    if (isRecording) stopRecording();
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    
    localStream?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current?.close();
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Signal call end to other participant
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

    // Update meeting status
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

  // Call screen
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
              ) : isConnecting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span>{formatTime(callDuration)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {isHost && waitingForGuests && (
          <Button variant="outline" size="sm" onClick={copyLink} className="mr-2">
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

      {/* Video area */}
      <div className="flex-1 relative bg-muted/50 overflow-hidden">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {!remoteStream && (
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

        <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border border-border bg-background">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <VideoOff className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
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
        >
          {isRecording ? <Square className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
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
    </div>
  );
};

export default PublicMeeting;
