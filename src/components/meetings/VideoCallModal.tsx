import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Monitor, MonitorOff, Circle, Square, Download,
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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
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
    sendEndCall,
  } = useWebRTC({
    meetingId,
    localUserId,
    remoteUserId,
    onRemoteStream: (stream) => {
      setRemoteStream(stream);
      setIsConnecting(false);
    },
    onConnectionStateChange: (state) => {
      if (state === 'connected') {
        setIsConnecting(false);
        // Start call duration timer
        callIntervalRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
    },
    onCallEnded: () => {
      handleClose();
    },
  });

  // Initialize call
  useEffect(() => {
    if (open) {
      if (isCaller) {
        startCall(callType === 'video');
      } else {
        answerCall(callType === 'video');
      }
    }
  }, [open, isCaller, callType, startCall, answerCall]);

  // Set local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Recording functions
  const startRecording = () => {
    const streams: MediaStream[] = [];
    if (localStream) streams.push(localStream);
    if (remoteStream) streams.push(remoteStream);

    if (streams.length === 0) {
      toast.error('Nenhum stream disponível para gravar');
      return;
    }

    try {
      // Combine streams for recording
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      streams.forEach(stream => {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(destination);
      });

      // Get video from local or remote
      const videoTrack = localStream?.getVideoTracks()[0] || remoteStream?.getVideoTracks()[0];
      const combinedStream = new MediaStream([
        ...destination.stream.getAudioTracks(),
        ...(videoTrack ? [videoTrack] : []),
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
      });

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

    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
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
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    // Clear timers
    if (callIntervalRef.current) {
      clearInterval(callIntervalRef.current);
    }

    sendEndCall();
    onCallEnded();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-4xl w-full h-[80vh] p-0 gap-0 bg-background/95 backdrop-blur-sm">
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
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Placeholder when no remote video */}
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center">
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

          {/* Local video (small, bottom-right) */}
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border border-border bg-background">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {(!localStream || !isVideoEnabled) && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <VideoOff className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 p-6 border-t bg-background">
          {/* Audio toggle */}
          <Button
            variant={isAudioEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={toggleAudio}
          >
            {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>

          {/* Video toggle */}
          <Button
            variant={isVideoEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={toggleVideo}
          >
            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>

          {/* Screen share */}
          <Button
            variant={isScreenSharing ? 'default' : 'secondary'}
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={toggleScreenShare}
          >
            {isScreenSharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
          </Button>

          {/* Recording */}
          <Button
            variant={isRecording ? 'destructive' : 'secondary'}
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? <Square className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
          </Button>

          {/* End call */}
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
