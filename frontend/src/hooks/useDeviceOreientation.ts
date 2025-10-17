import { useState, useEffect } from 'react';

export type DeviceOrientation = 'portrait' | 'landscape';

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<DeviceOrientation>(() => {
    // Initial orientation detection
    if (typeof window !== 'undefined') {
      return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    }
    return 'portrait';
  });

  useEffect(() => {
    const handleOrientationChange = () => {
      // Use window dimensions to determine orientation
      const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
      setOrientation(newOrientation);
    };

    // Listen for resize events (which fire on orientation change)
    window.addEventListener('resize', handleOrientationChange);
    
    // Also listen for orientationchange event if available
    if ('onorientationchange' in window) {
      window.addEventListener('orientationchange', () => {
        // Small delay to ensure dimensions are updated
        setTimeout(handleOrientationChange, 100);
      });
    }

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      if ('onorientationchange' in window) {
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };
  }, []);

  return orientation;
}
