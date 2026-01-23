import { useState, useRef, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';

export interface BackgroundBlurOptions {
  blurAmount: number; // 0-20
  edgeBlurAmount: number; // 0-10
}

const DEFAULT_OPTIONS: BackgroundBlurOptions = {
  blurAmount: 10,
  edgeBlurAmount: 3,
};

export function useBackgroundBlur() {
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [options, setOptions] = useState<BackgroundBlurOptions>(DEFAULT_OPTIONS);
  
  const modelRef = useRef<bodyPix.BodyPix | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const videoSourceRef = useRef<HTMLVideoElement | null>(null);

  // Load the BodyPix model
  const loadModel = useCallback(async () => {
    if (modelRef.current || isModelLoading) return;
    
    try {
      setIsModelLoading(true);
      console.log('🧠 Loading BodyPix model...');
      
      // Set TensorFlow.js backend
      await tf.setBackend('webgl');
      await tf.ready();
      
      // Load BodyPix with optimized settings for real-time performance
      const net = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2,
      });
      
      modelRef.current = net;
      setIsModelReady(true);
      console.log('✅ BodyPix model loaded successfully');
    } catch (error) {
      console.error('❌ Error loading BodyPix model:', error);
      setIsModelReady(false);
    } finally {
      setIsModelLoading(false);
    }
  }, [isModelLoading]);

  // Process a single frame
  const processFrame = useCallback(async (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ) => {
    if (!modelRef.current || isProcessingRef.current) return;
    if (video.readyState !== 4) return; // Video not ready
    
    isProcessingRef.current = true;
    
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Ensure canvas matches video dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      // Segment person from background
      const segmentation = await modelRef.current.segmentPerson(video, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.7,
      });
      
      // Draw blurred background + sharp person
      await bodyPix.drawBokehEffect(
        canvas,
        video,
        segmentation,
        options.blurAmount,
        options.edgeBlurAmount,
        false // flipHorizontal
      );
    } catch (error) {
      // Silently handle frame processing errors
      console.debug('Frame processing error:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [options]);

  // Start processing loop
  const startProcessing = useCallback((
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ) => {
    if (!modelRef.current) return;
    
    videoSourceRef.current = video;
    canvasRef.current = canvas;
    
    const processLoop = async () => {
      if (!isBlurEnabled || !videoSourceRef.current || !canvasRef.current) {
        return;
      }
      
      await processFrame(videoSourceRef.current, canvasRef.current);
      
      // Continue processing at ~15-20 FPS for performance
      animationFrameRef.current = requestAnimationFrame(processLoop);
    };
    
    processLoop();
  }, [isBlurEnabled, processFrame]);

  // Stop processing loop
  const stopProcessing = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  // Toggle blur on/off
  const toggleBlur = useCallback(async () => {
    if (!isBlurEnabled) {
      // Turning on blur
      if (!modelRef.current) {
        await loadModel();
      }
      setIsBlurEnabled(true);
    } else {
      // Turning off blur
      stopProcessing();
      setIsBlurEnabled(false);
    }
  }, [isBlurEnabled, loadModel, stopProcessing]);

  // Update blur options
  const updateOptions = useCallback((newOptions: Partial<BackgroundBlurOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProcessing();
      // Dispose TensorFlow resources
      if (modelRef.current) {
        tf.dispose();
      }
    };
  }, [stopProcessing]);

  // Restart processing when blur is enabled/disabled
  useEffect(() => {
    if (isBlurEnabled && videoSourceRef.current && canvasRef.current && modelRef.current) {
      startProcessing(videoSourceRef.current, canvasRef.current);
    } else {
      stopProcessing();
    }
  }, [isBlurEnabled, startProcessing, stopProcessing]);

  return {
    isBlurEnabled,
    isModelLoading,
    isModelReady,
    options,
    toggleBlur,
    updateOptions,
    startProcessing,
    stopProcessing,
    loadModel,
    canvasRef,
  };
}
