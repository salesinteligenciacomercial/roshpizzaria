/**
 * VideoCallModalV2 - Modal de Chamada Refatorado
 * 
 * Usa a nova arquitetura WebRTC com modelo HOST/PARTICIPANT
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Monitor, MonitorOff, Circle, Square,
  Loader2
} from 'lucide-react';
import { useWebRTCSession, RoomState, ParticipantRole } from '@/hooks/useWebRTCSession';
import { toast } from 'sonner';

interface VideoCallModalV2Props {
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

export const VideoCallModalV2 = ({
  open,
  onClose,
  meetingId,
  localUserId,
  remoteUserId,
  remoteUserName,
  callType,
  isCaller,
  onCallEnded,
}: VideoCallModalV2Props) => {
  // ========== STATE ==========
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [displayRoomState, setDisplayRoomState] = useState<RoomState>('idle');
  const [localVideoReady, setLocalVideoReady] = useState(false);

  // ========== REFS ==========
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);
  const isMountedRef = useRef(true);

  // ========== ROLE ==========
  const role: ParticipantRole = isCaller ? 'host' : 'participant';

  // ========== WEBRTC SESSION ==========
  const {
    localStream,
    screenStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    roomState,
    startSession,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    cleanup,
  } = useWebRTCSession({
    meetingId,
    localUserId,
    remoteUserId,
    role,
    onRemoteStream: (stream) => {
      console.log('[VideoCall] Remote stream received');
      setRemoteStream(stream);
    },
    onRoomStateChange: (state) => {
      console.log('[VideoCall] Room state:', state);
      setDisplayRoomState(state);
      
      if (state === 'connected' && !callIntervalRef.current) {
        // Start call duration counter
        callIntervalRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
    },
    onCallEnded: () => {
      console.log('[VideoCall] Call ended');
      handleClose();
    },
  });

  // ========== TRACK MOUNT STATE ==========
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ========== INITIALIZE CALL ==========
  useEffect(() => {
    if (open && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setRemoteStream(null);
      setCallDuration(0);
      setDisplayRoomState('idle');
      setLocalVideoReady(false);

      const init = async () => {
        try {
          console.log('[VideoCall] Initializing, role:', role);
          await startSession(callType === 'video');
        } catch (error) {
          console.error('[VideoCall] Init error:', error);
          if (isMountedRef.current) {
            toast.error('Erro ao iniciar chamada');
          }
        }
      };

      // Small delay to ensure DOM is ready
      setTimeout(init, 100);
    }
  }, [open, role, callType, startSession]);

  // ========== SET LOCAL VIDEO ==========
  useEffect(() => {
    const stream = isScreenSharing && screenStream ? screenStream : localStream;
    
    if (!stream) {
      console.log('[VideoCall] No local stream available yet');
      return;
    }

    const setVideoSource = (retryCount = 0) => {
      if (!isMountedRef.current) return;
      
      const videoEl = localVideoRef.current;
      if (videoEl) {
        console.log('[VideoCall] Setting local video source, tracks:', stream.getTracks().length);
        videoEl.srcObject = stream;
        videoEl.play()
          .then(() => {
            console.log('[VideoCall] Local video playing');
            setLocalVideoReady(true);
          })
          .catch((err) => {
            console.warn('[VideoCall] Play failed, retrying...', err);
            if (retryCount < 5 && isMountedRef.current) {
              setTimeout(() => setVideoSource(retryCount + 1), 200);
            }
          });
      } else if (retryCount < 10 && isMountedRef.current) {
        // Video element not ready yet, retry
        console.log('[VideoCall] Video element not ready, retrying...');
        setTimeout(() => setVideoSource(retryCount + 1), 100);
      }
    };

    setVideoSource();
  }, [localStream, screenStream, isScreenSharing]);

  // ========== SET REMOTE VIDEO ==========
  useEffect(() => {
    if (!remoteStream) return;

    const setRemoteVideoSource = (retryCount = 0) => {
      if (!isMountedRef.current) return;
      
      const videoEl = remoteVideoRef.current;
      if (videoEl) {
        console.log('[VideoCall] Setting remote video source');
        videoEl.srcObject = remoteStream;
        videoEl.play().catch((err) => {
          console.warn('[VideoCall] Remote play failed, retrying...', err);
          if (retryCount < 5 && isMountedRef.current) {
            setTimeout(() => setRemoteVideoSource(retryCount + 1), 200);
          }
        });

        // Listen for track changes
        remoteStream.onaddtrack = () => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        };
      } else if (retryCount < 10 && isMountedRef.current) {
        setTimeout(() => setRemoteVideoSource(retryCount + 1), 100);
      }
    };

    setRemoteVideoSource();
  }, [remoteStream]);

  // ========== CLEANUP ON UNMOUNT ==========
  useEffect(() => {
    return () => {
      if (callIntervalRef.current) {
        clearInterval(callIntervalRef.current);
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // ========== FORMAT TIME ==========
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ========== GET STATUS TEXT ==========
  const getStatusText = () => {
    switch (displayRoomState) {
      case 'idle':
        return 'Inicializando...';
      case 'waiting':
        return 'Aguardando resposta...';
      case 'connecting':
        return 'Conectando...';
      case 'connected':
        return formatTime(callDuration);
      case 'ended':
        return 'Chamada encerrada';
      default:
        return '';
    }
  };

  // ========== RECORDING ==========
  const startRecording = useCallback(() => {
    const streams: MediaStream[] = [];
    const primaryStream = isScreenSharing && screenStream ? screenStream : localStream;
    if (primaryStream) streams.push(primaryStream);
    if (remoteStream) streams.push(remoteStream);

    if (streams.length === 0) {
      toast.error('Nenhum stream disponível');
      return;
    }

    try {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      if (localStream?.getAudioTracks().length) {
        audioContext.createMediaStreamSource(localStream).connect(destination);
      }
      if (remoteStream?.getAudioTracks().length) {
        audioContext.createMediaStreamSource(remoteStream).connect(destination);
      }

      let videoTrack: MediaStreamTrack | undefined;
      if (isScreenSharing && screenStream) {
        videoTrack = screenStream.getVideoTracks()[0];
      } else if (localStream) {
        videoTrack = localStream.getVideoTracks()[0];
      }
      if (!videoTrack && remoteStream) {
        videoTrack = remoteStream.getVideoTracks()[0];
      }

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
      console.error('[VideoCall] Recording error:', error);
      toast.error('Erro ao iniciar gravação');
    }
  }, [localStream, remoteStream, screenStream, isScreenSharing]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [isRecording]);

  const downloadRecording = useCallback(() => {
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
  }, []);

  // ========== CLOSE ==========
  const handleClose = useCallback(() => {
    console.log('[VideoCall] Closing');

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

    endCall();
    hasInitializedRef.current = false;
    setRemoteStream(null);
    setCallDuration(0);
    setLocalVideoReady(false);
    
    onCallEnded();
    onClose();
  }, [isRecording, stopRecording, endCall, onCallEnded, onClose]);

  // ========== RENDER ==========
  const isConnecting = displayRoomState !== 'connected';
  const showRemotePlaceholder = !remoteStream || isConnecting;

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent 
        className="max-w-4xl w-full h-[80vh] p-0 gap-0 bg-background/95 backdrop-blur-sm flex flex-col" 
        aria-describedby={undefined}
      >
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
                    <span>{getStatusText()}</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span>{getStatusText()}</span>
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

        {/* Video Area */}
        <div className="flex-1 relative bg-muted/50 overflow-hidden">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Placeholder */}
          {showRemotePlaceholder && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
              <div className="text-center">
                <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl font-semibold text-primary">
                    {remoteUserName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{getStatusText()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Local Video (PiP) */}
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border border-border bg-background">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            
            {/* Loading state for local video */}
            {!localVideoReady && localStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            
            {!isScreenSharing && (!localStream || !isVideoEnabled) && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <VideoOff className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            
            {isScreenSharing && (
              <div className="absolute bottom-1 left-1 bg-primary/80 text-primary-foreground text-xs px-2 py-0.5 rounded">
                Compartilhando
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
