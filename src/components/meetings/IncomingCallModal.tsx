import { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';

interface IncomingCallModalProps {
  open: boolean;
  callerName: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal = ({
  open,
  callerName,
  callType,
  onAccept,
  onReject,
}: IncomingCallModalProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone
  useEffect(() => {
    if (open) {
      // Create a simple ringtone using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playRing = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 440;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      };

      const interval = setInterval(playRing, 1000);

      return () => {
        clearInterval(interval);
        audioContext.close();
      };
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="flex flex-col items-center py-6">
          {/* Caller avatar with animation */}
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative h-24 w-24 rounded-full bg-primary/30 flex items-center justify-center">
              <span className="text-4xl font-semibold text-primary">
                {callerName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Caller info */}
          <h3 className="text-xl font-semibold mb-1">{callerName}</h3>
          <p className="text-muted-foreground mb-8">
            {callType === 'video' ? 'Chamada de vídeo' : 'Chamada de áudio'}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-6">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full h-16 w-16"
              onClick={onReject}
            >
              <PhoneOff className="h-7 w-7" />
            </Button>

            <Button
              variant="default"
              size="lg"
              className="rounded-full h-16 w-16 bg-green-600 hover:bg-green-700"
              onClick={onAccept}
            >
              {callType === 'video' ? (
                <Video className="h-7 w-7" />
              ) : (
                <Phone className="h-7 w-7" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
