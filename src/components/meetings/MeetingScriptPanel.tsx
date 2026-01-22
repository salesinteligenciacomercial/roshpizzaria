/**
 * MeetingScriptPanel - Popup flutuante de roteiro de reunião com controle de tempo
 * Aparece ao lado do modal de videoconferência para ser visível durante compartilhamento de tela
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  X, Play, Pause, SkipForward, RotateCcw, 
  CheckCircle2, Circle, Clock, ChevronDown, ChevronUp,
  AlertTriangle, GripVertical, BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MeetingScriptStep {
  id: string;
  title: string;
  content: string;
  duration_seconds: number;
  is_completed: boolean;
}

export interface MeetingScript {
  id: string;
  title: string;
  steps: MeetingScriptStep[];
}

interface MeetingScriptPanelProps {
  script: MeetingScript;
  onClose: () => void;
  onScriptUpdate?: (script: MeetingScript) => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const MeetingScriptPanel = ({
  script,
  onClose,
  onScriptUpdate,
}: MeetingScriptPanelProps) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<MeetingScriptStep[]>(script.steps);
  const [timeRemaining, setTimeRemaining] = useState(script.steps[0]?.duration_seconds || 0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set([script.steps[0]?.id]));
  
  // Drag state for floating panel
  const [position, setPosition] = useState({ x: 50, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[currentStepIndex];
  const totalDuration = steps.reduce((acc, step) => acc + step.duration_seconds, 0);
  const completedSteps = steps.filter(s => s.is_completed).length;
  const progressPercent = (completedSteps / steps.length) * 100;

  // Play alert sound when time is running out
  const playAlertSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (error) {
      console.log('Could not play alert sound');
    }
  }, []);

  // Timer effect
  useEffect(() => {
    if (isTimerRunning && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          // Play alert at 30 seconds and 10 seconds
          if (newTime === 30 || newTime === 10 || newTime === 0) {
            playAlertSound();
          }
          return newTime;
        });
        setTotalElapsed(prev => prev + 1);
      }, 1000);
    } else if (timeRemaining === 0 && isTimerRunning) {
      setIsTimerRunning(false);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning, timeRemaining, playAlertSound]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 340)),
          y: Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 400))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const toggleTimer = () => {
    setIsTimerRunning(prev => !prev);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeRemaining(currentStep?.duration_seconds || 0);
  };

  const goToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
      setTimeRemaining(steps[index].duration_seconds);
      setIsTimerRunning(false);
      setExpandedSteps(prev => new Set([...prev, steps[index].id]));
    }
  };

  const nextStep = () => {
    // Mark current as completed
    const updatedSteps = steps.map((step, idx) => 
      idx === currentStepIndex ? { ...step, is_completed: true } : step
    );
    setSteps(updatedSteps);
    onScriptUpdate?.({ ...script, steps: updatedSteps });

    if (currentStepIndex < steps.length - 1) {
      goToStep(currentStepIndex + 1);
    }
  };

  const toggleStepCompletion = (stepId: string) => {
    const updatedSteps = steps.map(step => 
      step.id === stepId ? { ...step, is_completed: !step.is_completed } : step
    );
    setSteps(updatedSteps);
    onScriptUpdate?.({ ...script, steps: updatedSteps });
  };

  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const isTimeWarning = timeRemaining > 0 && timeRemaining <= 30;
  const isTimeCritical = timeRemaining > 0 && timeRemaining <= 10;

  // Render using portal to appear outside the video modal
  const panelContent = (
    <div 
      ref={panelRef}
      className="fixed z-[9999] w-80 bg-background/95 backdrop-blur-sm border rounded-lg shadow-2xl flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        maxHeight: '80vh',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header with drag handle */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2 drag-handle cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm truncate max-w-[180px]">{script.title}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Timer Section */}
      <div className={cn(
        "p-4 border-b transition-colors",
        isTimeCritical && "bg-destructive/10",
        isTimeWarning && !isTimeCritical && "bg-yellow-500/10"
      )}>
        <div className="text-center mb-3">
          <div className={cn(
            "text-4xl font-mono font-bold transition-colors",
            isTimeCritical && "text-destructive animate-pulse",
            isTimeWarning && !isTimeCritical && "text-yellow-500"
          )}>
            {formatTime(timeRemaining)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Etapa {currentStepIndex + 1} de {steps.length}
          </div>
          {isTimeWarning && (
            <div className="flex items-center justify-center gap-1 text-xs text-yellow-500 mt-1">
              <AlertTriangle className="h-3 w-3" />
              <span>Tempo acabando!</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={resetTimer}
            title="Reiniciar timer"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant={isTimerRunning ? "secondary" : "default"}
            size="sm"
            className="h-10 w-10 p-0 rounded-full"
            onClick={toggleTimer}
          >
            {isTimerRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={nextStep}
            disabled={currentStepIndex >= steps.length - 1}
            title="Próxima etapa"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-3 py-2 border-b">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{completedSteps}/{steps.length} etapas</span>
          <span>Total: {formatTime(totalElapsed)} / {formatTime(totalDuration)}</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Steps List */}
      <ScrollArea className="flex-1 max-h-[40vh]">
        <div className="p-2 space-y-1">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isExpanded = expandedSteps.has(step.id);
            
            return (
              <div
                key={step.id}
                className={cn(
                  "rounded-lg border transition-all",
                  isActive && "border-primary bg-primary/5",
                  step.is_completed && !isActive && "opacity-60",
                  !isActive && !step.is_completed && "border-border"
                )}
              >
                {/* Step Header */}
                <div 
                  className="flex items-center gap-2 p-2 cursor-pointer"
                  onClick={() => goToStep(index)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStepCompletion(step.id);
                    }}
                  >
                    {step.is_completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className={cn(
                        "h-4 w-4",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                    )}
                  </Button>
                  
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm font-medium truncate",
                      step.is_completed && "line-through"
                    )}>
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(step.duration_seconds)}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStepExpanded(step.id);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                {/* Step Content */}
                {isExpanded && step.content && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/50">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {step.content}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );

  // Use portal to render outside the modal
  return createPortal(panelContent, document.body);
};
