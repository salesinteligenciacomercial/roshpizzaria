import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Monitor, MonitorOff, Circle, Square,
  Loader2
} from 'lucide-react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { toast } from 'sonner';

interface VideoCallModalProps {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  localUserId: string;
  remoteUserId: string;
  remoteUserName: string;
  callType: 'audio' | 'video';
  isCaller: boolean;
  onCallEnded: () => void;
}

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

export const VideoCallModal = ({
  open,
  onClose,
  meetingId,
  localUserId,
  remoteUserId,
  remoteUserName,
  callType,
  isCaller,
  onCallEnded,
}: VideoCallModalProps) => {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [localVideoKey, setLocalVideoKey] = useState(0);
  const [remoteVideoKey, setRemoteVideoKey] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
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
    sendEndCall,
  } = useWebRTC({
    meetingId,
    localUserId,
    remoteUserId,
    onRemoteStream: (stream) => {
      console.log('Remote stream received with tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
      setRemoteStream(stream);
      setRemoteVideoKey(prev => prev + 1);
      setIsConnecting(false);
    },
    onConnectionStateChange: (state) => {
      console.log('Connection state changed:', state);
      if (state === 'connected') {
        setIsConnecting(false);
        if (!callIntervalRef.current) {
          callIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        }
      }
    },
    onCallEnded: () => {
      handleClose();
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callIntervalRef.current) {
        clearInterval(callIntervalRef.current);
        callIntervalRef.current = null;
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, []);

  // Initialize call once when modal opens
  useEffect(() => {
    if (open && !hasInitialized) {
      setHasInitialized(true);
      setIsConnecting(true);
      setRemoteStream(null);
      setCallDuration(0);
      
      const initCall = async () => {
        try {
          console.log('=== VideoCallModal: Initializing call ===');
          console.log('isCaller:', isCaller);
          console.log('callType:', callType);
          console.log('meetingId:', meetingId);
          console.log('localUserId:', localUserId);
          console.log('remoteUserId:', remoteUserId);
          
          if (isCaller) {
            console.log('Starting call as caller...');
            await startCall(callType === 'video');
          } else {
            console.log('Answering call as callee...');
            await answerCall(callType === 'video');
          }
        } catch (error) {
          console.error('Error initializing call:', error);
          toast.error('Erro ao iniciar chamada');
        }
      };
      
      initCall();
    }
  }, [open, hasInitialized, isCaller, callType, startCall, answerCall, meetingId, localUserId, remoteUserId]);

  // Set local video with explicit play - also handles screen share
  useEffect(() => {
    if (localVideoRef.current) {
      // Use screen stream if sharing, otherwise camera
      const streamToUse = isScreenSharing && screenStream ? screenStream : localStream;
      
      if (streamToUse) {
        console.log('Setting local video stream:', {
          isScreenSharing,
          videoTracks: streamToUse.getVideoTracks().length,
          audioTracks: streamToUse.getAudioTracks().length,
          videoEnabled: streamToUse.getVideoTracks()[0]?.enabled
        });
        localVideoRef.current.srcObject = streamToUse;
        localVideoRef.current.play().catch(err => {
          console.log('Local video play error:', err);
        });
        setLocalVideoKey(prev => prev + 1);
      }
    }
  }, [localStream, screenStream, isScreenSharing]);

  // Set remote video with explicit play
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('Setting remote video stream:', {
        videoTracks: remoteStream.getVideoTracks().length,
        audioTracks: remoteStream.getAudioTracks().length,
        videoEnabled: remoteStream.getVideoTracks()[0]?.enabled
      });
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => {
        console.log('Remote video play error:', err);
      });
      
      // Listen for track changes
      remoteStream.onaddtrack = () => {
        console.log('Remote stream track added');
        setRemoteVideoKey(prev => prev + 1);
      };
    }
  }, [remoteStream, remoteVideoKey]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = () => {
    const streams: MediaStream[] = [];
    
    // Prioritize screen stream if sharing, otherwise use camera
    const primaryVideoStream = isScreenSharing && screenStream ? screenStream : localStream;
    if (primaryVideoStream) streams.push(primaryVideoStream);
    if (remoteStream) streams.push(remoteStream);

    if (streams.length === 0) {
      toast.error('Nenhum stream disponível para gravar');
      return;
    }

    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Combine audio from all streams
      if (localStream && localStream.getAudioTracks().length > 0) {
        const localSource = audioContext.createMediaStreamSource(localStream);
        localSource.connect(destination);
      }
      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        const remoteSource = audioContext.createMediaStreamSource(remoteStream);
        remoteSource.connect(destination);
      }

      // Use screen video if sharing, otherwise camera
      let videoTrack: MediaStreamTrack | undefined;
      if (isScreenSharing && screenStream) {
        videoTrack = screenStream.getVideoTracks()[0];
        console.log('Recording with screen share track');
      } else if (localStream) {
        videoTrack = localStream.getVideoTracks()[0];
        console.log('Recording with camera track');
      }
      
      if (!videoTrack && remoteStream) {
        videoTrack = remoteStream.getVideoTracks()[0];
        console.log('Recording with remote video track');
      }

      const combinedStream = new MediaStream([
        ...destination.stream.getAudioTracks(),
        ...(videoTrack ? [videoTrack] : []),
      ]);

      console.log('Combined stream for recording:', {
        audioTracks: combinedStream.getAudioTracks().length,
        videoTracks: combinedStream.getVideoTracks().length,
        isScreenSharing
      });

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
        downloadRecording();
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
        recordingIntervalRef.current = null;
      }
    }
  };

  const downloadRecording = () => {
    if (recordedChunksRef.current.length === 0) return;

    const mimeType = getSupportedMimeType();
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

  const handleClose = () => {
    console.log('=== VideoCallModal: Closing call ===');
    
    if (isRecording) {
      stopRecording();
    }

    if (callIntervalRef.current) {
      clearInterval(callIntervalRef.current);
      callIntervalRef.current = null;
    }
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Send end signal and cleanup WebRTC
    sendEndCall();
    
    // Reset all state
    setHasInitialized(false);
    setRemoteStream(null);
    setIsConnecting(true);
    setCallDuration(0);
    setLocalVideoKey(0);
    setRemoteVideoKey(0);
    
    // Notify parent
    onCallEnded();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-4xl w-full h-[80vh] p-0 gap-0 bg-background/95 backdrop-blur-sm" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Chamada com {remoteUserName}</DialogTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary">
                {remoteUserName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-semibold">{remoteUserName}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isConnecting ? (
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

          {isRecording && (
            <div className="flex items-center gap-2 text-destructive">
              <Circle className="h-3 w-3 fill-current animate-pulse" />
              <span className="text-sm font-medium">REC {formatTime(recordingTime)}</span>
            </div>
          )}
        </div>

        {/* Video area */}
        <div className="flex-1 relative bg-muted/50 overflow-hidden">
          {/* Remote video (large) */}
          <video
            key={`remote-${remoteVideoKey}`}
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Placeholder when no remote video or connecting */}
          {(!remoteStream || remoteStream.getVideoTracks().length === 0 || isConnecting) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
              <div className="text-center">
                <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl font-semibold text-primary">
                    {remoteUserName.charAt(0).toUpperCase()}
                  </span>
                </div>
                {isConnecting && (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Aguardando conexão...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Local video (small, bottom-right) - shows screen when sharing */}
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border border-border bg-background">
            <video
              key={`local-${localVideoKey}`}
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Overlay when video is off (but not when screen sharing) */}
            {!isScreenSharing && (!localStream || !localStream.getVideoTracks().length || !isVideoEnabled) && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <VideoOff className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            {/* Label to show screen sharing active */}
            {isScreenSharing && (
              <div className="absolute bottom-1 left-1 bg-primary/80 text-primary-foreground text-xs px-2 py-0.5 rounded">
                Compartilhando tela
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
            onClick={handleClose}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
