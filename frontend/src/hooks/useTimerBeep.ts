import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage timer beep sound for halftime and full time.
 * Plays a beeping sound for 10 seconds when triggered.
 */
export function useTimerBeep() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  // Initialize audio context on first user interaction
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.error('Failed to create audio context:', error);
      }
    }
  }, []);

  // Play beeping sound for 10 seconds
  const playBeep = useCallback(() => {
    // Prevent multiple simultaneous beeps
    if (isPlayingRef.current) {
      return;
    }

    initAudioContext();

    if (!audioContextRef.current) {
      console.error('Audio context not available');
      return;
    }

    try {
      const audioContext = audioContextRef.current;

      // Resume audio context if suspended (required for mobile browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      isPlayingRef.current = true;

      // Create oscillator for beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure beep sound (800 Hz tone)
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      // Set volume
      gainNode.gain.value = 0.3;

      // Create beeping pattern: 0.2s on, 0.2s off
      const currentTime = audioContext.currentTime;
      const beepDuration = 0.2;
      const silenceDuration = 0.2;
      const totalDuration = 10; // 10 seconds total
      const cycleTime = beepDuration + silenceDuration;
      const numCycles = Math.floor(totalDuration / cycleTime);

      // Schedule beeps
      for (let i = 0; i < numCycles; i++) {
        const startTime = currentTime + i * cycleTime;
        const endTime = startTime + beepDuration;

        // Ramp up at start of beep
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);

        // Ramp down at end of beep
        gainNode.gain.setValueAtTime(0.3, endTime - 0.01);
        gainNode.gain.linearRampToValueAtTime(0, endTime);
      }

      oscillator.start(currentTime);
      oscillator.stop(currentTime + totalDuration);

      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;

      // Clean up after 10 seconds
      timeoutRef.current = setTimeout(() => {
        isPlayingRef.current = false;
        oscillatorRef.current = null;
        gainNodeRef.current = null;
      }, totalDuration * 1000);

    } catch (error) {
      console.error('Failed to play beep:', error);
      isPlayingRef.current = false;
    }
  }, [initAudioContext]);

  // Stop beeping immediately
  const stopBeep = useCallback(() => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (error) {
        // Oscillator may already be stopped
      }
      oscillatorRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    isPlayingRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBeep();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopBeep]);

  return { playBeep, stopBeep, initAudioContext };
}
