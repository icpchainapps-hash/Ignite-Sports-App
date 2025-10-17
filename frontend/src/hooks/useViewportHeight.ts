import { useEffect } from 'react';

/**
 * Hook to set CSS variable for viewport height with fallback for mobile browsers
 * Handles 100dvh for modern browsers and JavaScript fallback for mobile Chrome
 * Updates on resize and orientation change
 */
export function useViewportHeight() {
  useEffect(() => {
    const setViewportHeight = () => {
      // Use dvh if supported, otherwise use window.innerHeight
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      
      // Also set the full viewport height
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
    };

    // Set initial value
    setViewportHeight();

    // Update on resize
    window.addEventListener('resize', setViewportHeight);
    
    // Update on orientation change
    window.addEventListener('orientationchange', () => {
      // Small delay to ensure dimensions are updated
      setTimeout(setViewportHeight, 100);
    });

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);
}

