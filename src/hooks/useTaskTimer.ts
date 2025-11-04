import { useState, useEffect, useRef } from 'react';

interface UseTaskTimerProps {
  taskId: string;
  initialTimeSpent?: number;
  timeTrackingStarted?: string | null;
  timeTrackingPaused?: boolean;
  onTimeUpdated?: (taskId: string, timeSpent: number) => void;
}

export function useTaskTimer({
  taskId,
  initialTimeSpent = 0,
  timeTrackingStarted,
  timeTrackingPaused = false,
  onTimeUpdated
}: UseTaskTimerProps = {
  taskId: '',
  initialTimeSpent: 0,
  timeTrackingStarted: null,
  timeTrackingPaused: false
}) {
  const [currentTime, setCurrentTime] = useState(initialTimeSpent);
  const [isTracking, setIsTracking] = useState(!timeTrackingPaused && !!timeTrackingStarted);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Formatar tempo em HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formattedTime = formatTime(currentTime);

  // Iniciar timer
  const startTimer = () => {
    if (intervalRef.current) return; // Já está rodando
    
    setIsTracking(true);
    startTimeRef.current = Date.now();
    
    intervalRef.current = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;
        if (onTimeUpdated) {
          onTimeUpdated(taskId, newTime);
        }
        return newTime;
      });
    }, 1000);
  };

  // Pausar timer
  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
  };

  // Parar e resetar timer
  const stopTimer = () => {
    pauseTimer();
    setCurrentTime(0);
    if (onTimeUpdated) {
      onTimeUpdated(taskId, 0);
    }
  };

  // Limpar intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    currentTime,
    isTracking,
    formattedTime,
    startTimer,
    pauseTimer,
    stopTimer,
    tempoGasto: currentTime,
    estaRodando: isTracking,
    iniciarTimer: startTimer,
    pausarTimer: pauseTimer,
    resetarTimer: stopTimer
  };
}
