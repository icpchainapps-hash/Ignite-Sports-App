import { useState, useCallback, useRef } from 'react';

interface SwipeState {
  isOpen: boolean;
  offset: number;
  isDragging: boolean;
}

interface UseSidePanelSwipeOptions {
  panelWidth: number;
  threshold?: number;
  onStateChange?: (isOpen: boolean) => void;
}

export function useSidePanelSwipe({
  panelWidth,
  threshold = 50,
  onStateChange
}: UseSidePanelSwipeOptions) {
  const [state, setState] = useState<SwipeState>({
    isOpen: true,
    offset: 0,
    isDragging: false
  });

  const startXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastXRef = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    currentXRef.current = touch.clientX;
    lastXRef.current = touch.clientX;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;

    setState(prev => ({ ...prev, isDragging: true }));
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!state.isDragging) return;

    const touch = e.touches[0];
    currentXRef.current = touch.clientX;
    
    // Calculate velocity for momentum
    const now = Date.now();
    const timeDelta = now - lastTimeRef.current;
    if (timeDelta > 0) {
      velocityRef.current = (touch.clientX - lastXRef.current) / timeDelta;
    }
    lastXRef.current = touch.clientX;
    lastTimeRef.current = now;

    const deltaX = currentXRef.current - startXRef.current;
    
    // Only allow dragging to the right (closing) when open
    // Only allow dragging to the left (opening) when closed
    let newOffset = 0;
    if (state.isOpen) {
      newOffset = Math.max(0, Math.min(panelWidth, deltaX));
    } else {
      newOffset = Math.max(-panelWidth, Math.min(0, deltaX));
    }

    setState(prev => ({ ...prev, offset: newOffset }));
  }, [state.isDragging, state.isOpen, panelWidth]);

  const handleTouchEnd = useCallback(() => {
    if (!state.isDragging) return;

    const deltaX = currentXRef.current - startXRef.current;
    const velocity = velocityRef.current;
    
    // Determine if we should open or close based on distance and velocity
    let shouldOpen = state.isOpen;
    
    if (state.isOpen) {
      // Currently open - check if we should close
      if (deltaX > threshold || velocity > 0.5) {
        shouldOpen = false;
      }
    } else {
      // Currently closed - check if we should open
      if (deltaX < -threshold || velocity < -0.5) {
        shouldOpen = true;
      }
    }

    setState({
      isOpen: shouldOpen,
      offset: 0,
      isDragging: false
    });

    if (shouldOpen !== state.isOpen && onStateChange) {
      onStateChange(shouldOpen);
    }
  }, [state.isDragging, state.isOpen, threshold, panelWidth, onStateChange]);

  const togglePanel = useCallback(() => {
    setState(prev => {
      const newIsOpen = !prev.isOpen;
      if (onStateChange) {
        onStateChange(newIsOpen);
      }
      return {
        ...prev,
        isOpen: newIsOpen,
        offset: 0
      };
    });
  }, [onStateChange]);

  const openPanel = useCallback(() => {
    setState(prev => {
      if (!prev.isOpen && onStateChange) {
        onStateChange(true);
      }
      return {
        ...prev,
        isOpen: true,
        offset: 0
      };
    });
  }, [onStateChange]);

  const closePanel = useCallback(() => {
    setState(prev => {
      if (prev.isOpen && onStateChange) {
        onStateChange(false);
      }
      return {
        ...prev,
        isOpen: false,
        offset: 0
      };
    });
  }, [onStateChange]);

  return {
    isOpen: state.isOpen,
    offset: state.offset,
    isDragging: state.isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    togglePanel,
    openPanel,
    closePanel
  };
}

