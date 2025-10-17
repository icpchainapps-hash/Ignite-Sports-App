import { useRef, useCallback, useState, useEffect, ReactElement } from 'react';
import { Player, SoccerBall, TeamSize } from './PitchBoard';
import PlayerChip from './PlayerChip';
import SoccerBallComponent from './SoccerBall';
import DrawingLayer, { DrawingElement } from './DrawingLayer';
import { useResponsive } from '../hooks/useResponsive';
import { getPitchDimensions } from '../lib/pitch-utils';

interface SoccerPitchProps {
  players: Player[];
  soccerBall: SoccerBall;
  onPlayerMove: (playerId: string, position: { x: number; y: number }) => void;
  onBallMove: (position: { x: number; y: number }) => void;
  zoom: number;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  snapToGrid: boolean;
  orientation: 'portrait' | 'landscape';
  teamSize: TeamSize;
  drawingElements: DrawingElement[];
  onDrawingElementsChange: (elements: DrawingElement[]) => void;
  isDrawingMode: boolean;
  drawingTool: 'arrow' | 'freehand';
}

export default function SoccerPitch({ 
  players, 
  soccerBall,
  onPlayerMove, 
  onBallMove,
  zoom, 
  pan, 
  onPanChange, 
  onZoomChange,
  snapToGrid,
  orientation,
  teamSize,
  drawingElements,
  onDrawingElementsChange,
  isDrawingMode,
  drawingTool
}: SoccerPitchProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const [draggedBall, setDraggedBall] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const [panStartTime, setPanStartTime] = useState(0);
  const [initialTouchPos, setInitialTouchPos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const { isMobile } = useResponsive();
  const { PITCH_WIDTH, PITCH_HEIGHT, PITCH_LEFT, PITCH_TOP, SVG_WIDTH, SVG_HEIGHT, pitchScale, isPortrait } = 
    getPitchDimensions(orientation, teamSize);

  // ResizeObserver with throttling for responsive pitch sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeTimeout: NodeJS.Timeout;
    const handleResize = (entries: ResizeObserverEntry[]) => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          setContainerSize({ width, height });
        }
      }, 50); // 50ms throttle
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Initial size
    const rect = container.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, []);

  // Enhanced pan boundaries calculation with optimized positioning for both orientations
  const calculatePanBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const scaledSvgWidth = SVG_WIDTH * zoom;
    const scaledSvgHeight = SVG_HEIGHT * zoom;

    // In both orientations, allow panning with reasonable bounds
    const margin = Math.min(containerWidth, containerHeight) * 0.02;

    const maxPanX = Math.max(0, margin);
    const minPanX = Math.min(0, containerWidth - scaledSvgWidth - margin);
    
    const maxPanY = Math.max(0, margin * 0.25);
    const minPanY = Math.min(0, containerHeight - scaledSvgHeight - margin * 0.25);

    return { minX: minPanX, maxX: maxPanX, minY: minPanY, maxY: maxPanY };
  }, [zoom, SVG_WIDTH, SVG_HEIGHT]);

  // Constrain pan values within bounds
  const constrainPan = useCallback((newPan: { x: number; y: number }) => {
    const bounds = calculatePanBounds();
    
    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, newPan.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, newPan.y))
    };
  }, [calculatePanBounds]);

  // Auto-adjust pan position for optimal positioning in both orientations
  const optimizePitchPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerHeight = rect.height;
    const containerWidth = rect.width;
    const scaledSvgHeight = SVG_HEIGHT * zoom;
    const scaledSvgWidth = SVG_WIDTH * zoom;

    let optimalPan = { x: pan.x, y: pan.y };

    if (orientation === 'landscape') {
      // In landscape mode, center the pitch
      const availableHeight = containerHeight;
      const optimalPanY = Math.max(
        5,
        (availableHeight - scaledSvgHeight) / 2
      );
      
      if (Math.abs(pan.y - optimalPanY) > 20) {
        optimalPan.y = optimalPanY;
      }
      
      // Center horizontally
      if (scaledSvgWidth < containerWidth) {
        const optimalPanX = (containerWidth - scaledSvgWidth) / 2;
        if (Math.abs(pan.x - optimalPanX) > 10) {
          optimalPan.x = optimalPanX;
        }
      }
    } else {
      // In portrait mode, center the pitch vertically with reduced margins
      const availableHeight = containerHeight;
      const optimalPanY = Math.max(
        5,
        (availableHeight - scaledSvgHeight) / 2
      );
      
      if (Math.abs(pan.y - optimalPanY) > 20) {
        optimalPan.y = optimalPanY;
      }
      
      // Center horizontally
      if (scaledSvgWidth < containerWidth) {
        const optimalPanX = (containerWidth - scaledSvgWidth) / 2;
        if (Math.abs(pan.x - optimalPanX) > 10) {
          optimalPan.x = optimalPanX;
        }
      }
    }

    // Apply constraints and update if needed
    const constrainedPan = constrainPan(optimalPan);
    if (constrainedPan.x !== pan.x || constrainedPan.y !== pan.y) {
      onPanChange(constrainedPan);
    }
  }, [orientation, zoom, SVG_HEIGHT, SVG_WIDTH, pan, constrainPan, onPanChange]);

  // Apply optimal positioning when orientation changes, zoom changes, or container size changes
  useEffect(() => {
    const timeoutId = setTimeout(optimizePitchPosition, 100);
    return () => clearTimeout(timeoutId);
  }, [orientation, zoom, containerSize, optimizePitchPosition]);

  const snapToGridPosition = useCallback((x: number, y: number) => {
    if (!snapToGrid) return { x, y };
    
    const gridSizeX = 5;
    const gridSizeY = 5;
    
    return {
      x: Math.round(x / gridSizeX) * gridSizeX,
      y: Math.round(y / gridSizeY) * gridSizeY
    };
  }, [snapToGrid]);

  const convertMouseToPercentage = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return { x: 50, y: 50 };

    const rect = container.getBoundingClientRect();
    
    // Use transform-based coordinates for both orientations
    const svgX = (clientX - rect.left - pan.x) / zoom;
    const svgY = (clientY - rect.top - pan.y) / zoom;
    
    const percentX = Math.max(2, Math.min(98, ((svgX - PITCH_LEFT) / PITCH_WIDTH) * 100));
    const percentY = Math.max(2, Math.min(98, ((svgY - PITCH_TOP) / PITCH_HEIGHT) * 100));
    
    return { x: percentX, y: percentY };
  }, [pan, zoom, PITCH_WIDTH, PITCH_HEIGHT, PITCH_LEFT, PITCH_TOP]);

  const getTouchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
  }, []);

  const getTouchCenter = useCallback((touches: React.TouchList) => {
    if (touches.length === 0) return { x: 0, y: 0 };
    if (touches.length === 1) return { x: touches[0].clientX, y: touches[0].clientY };
    
    const touch1 = touches[0];
    const touch2 = touches[1];
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }, []);

  const isPlayerOrBallElement = useCallback((target: EventTarget | null) => {
    if (!target) return false;
    const element = target as Element;
    
    const draggableSelectors = [
      'g[class*="cursor-move"]',
      '[data-player-id]',
      '[data-ball]',
      '.player-chip',
      '.soccer-ball',
      'g[data-draggable="true"]'
    ];
    
    for (const selector of draggableSelectors) {
      if (element.closest(selector)) return true;
    }
    
    return false;
  }, []);

  const shouldAllowPanning = useCallback((target: EventTarget | null, touchCount: number = 1) => {
    if (isDrawingMode || isDrawingActive) return false;
    if (draggedPlayer || draggedBall) return false;
    if (isPlayerOrBallElement(target)) return false;
    
    if (isMobile && touchCount === 1) {
      return true;
    }
    
    return touchCount === 1;
  }, [isMobile, isDrawingMode, isDrawingActive, draggedPlayer, draggedBall, isPlayerOrBallElement]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!shouldAllowPanning(e.target)) {
      return;
    }
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setPanStartTime(Date.now());
    setHasMoved(false);
  }, [pan, shouldAllowPanning]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touchCount = e.touches.length;
    
    if (touchCount === 1 && shouldAllowPanning(e.target, touchCount)) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
      setInitialTouchPos({ x: touch.clientX, y: touch.clientY });
      setPanStartTime(Date.now());
      setHasMoved(false);
    } else if (touchCount === 2) {
      // Allow pinch zoom in both orientations
      e.preventDefault();
      setIsDragging(false);
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      setLastTouchDistance(distance);
      setLastTouchCenter(center);
    }
  }, [pan, getTouchDistance, getTouchCenter, shouldAllowPanning]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && !draggedPlayer && !draggedBall && !isDrawingMode && !isDrawingActive) {
      e.preventDefault();
      
      const newPan = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      
      if (!hasMoved) {
        const moveDistance = Math.hypot(
          e.clientX - (dragStart.x + pan.x),
          e.clientY - (dragStart.y + pan.y)
        );
        if (moveDistance > 5) {
          setHasMoved(true);
        }
      }
      
      const constrainedPan = constrainPan(newPan);
      onPanChange(constrainedPan);
    }
  }, [isDragging, dragStart, onPanChange, draggedPlayer, draggedBall, constrainPan, isDrawingMode, isDrawingActive, hasMoved, pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touchCount = e.touches.length;
    
    if (touchCount === 1 && isDragging && !draggedPlayer && !draggedBall && !isDrawingMode && !isDrawingActive) {
      e.preventDefault();
      const touch = e.touches[0];
      
      const newPan = {
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      };
      
      if (!hasMoved) {
        const moveDistance = Math.hypot(
          touch.clientX - initialTouchPos.x,
          touch.clientY - initialTouchPos.y
        );
        if (moveDistance > 8) {
          setHasMoved(true);
        }
      }
      
      const constrainedPan = constrainPan(newPan);
      onPanChange(constrainedPan);
    } else if (touchCount === 2) {
      // Allow pinch zoom in both orientations
      e.preventDefault();
      
      const currentDistance = getTouchDistance(e.touches);
      const currentCenter = getTouchCenter(e.touches);
      
      if (lastTouchDistance > 0) {
        const scale = currentDistance / lastTouchDistance;
        const newZoom = Math.max(0.5, Math.min(3, zoom * scale));
        
        if (newZoom !== zoom) {
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const relativeX = currentCenter.x - rect.left;
            const relativeY = currentCenter.y - rect.top;
            
            const zoomRatio = newZoom / zoom;
            const newPan = {
              x: relativeX - (relativeX - pan.x) * zoomRatio,
              y: relativeY - (relativeY - pan.y) * zoomRatio
            };
            
            const constrainedPan = constrainPan(newPan);
            onZoomChange(newZoom);
            onPanChange(constrainedPan);
          }
        }
        
        const panDeltaX = currentCenter.x - lastTouchCenter.x;
        const panDeltaY = currentCenter.y - lastTouchCenter.y;
        
        if (Math.abs(panDeltaX) > 1 || Math.abs(panDeltaY) > 1) {
          const newPan = {
            x: pan.x + panDeltaX,
            y: pan.y + panDeltaY
          };
          const constrainedPan = constrainPan(newPan);
          onPanChange(constrainedPan);
        }
      }
      
      setLastTouchDistance(currentDistance);
      setLastTouchCenter(currentCenter);
    }
  }, [isDragging, dragStart, onPanChange, draggedPlayer, draggedBall, constrainPan, getTouchDistance, getTouchCenter, lastTouchDistance, lastTouchCenter, zoom, onZoomChange, pan, isDrawingMode, isDrawingActive, hasMoved, initialTouchPos]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedPlayer(null);
    setDraggedBall(false);
    setDragOffset({ x: 0, y: 0 });
    setHasMoved(false);
    setPanStartTime(0);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const remainingTouches = e.touches.length;
    
    if (remainingTouches === 0) {
      setIsDragging(false);
      setDraggedPlayer(null);
      setDraggedBall(false);
      setDragOffset({ x: 0, y: 0 });
      setLastTouchDistance(0);
      setHasMoved(false);
      setPanStartTime(0);
    } else if (remainingTouches === 1) {
      setLastTouchDistance(0);
      if (shouldAllowPanning(e.target, remainingTouches)) {
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
        setInitialTouchPos({ x: touch.clientX, y: touch.clientY });
        setPanStartTime(Date.now());
        setHasMoved(false);
      }
    }
  }, [pan, shouldAllowPanning]);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (shouldAllowPanning(e.target)) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setPanStartTime(Date.now());
      setHasMoved(false);
    }
  }, [pan, shouldAllowPanning]);

  const handleContainerTouchStart = useCallback((e: React.TouchEvent) => {
    const touchCount = e.touches.length;
    
    if (touchCount === 1 && shouldAllowPanning(e.target, touchCount)) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
      setInitialTouchPos({ x: touch.clientX, y: touch.clientY });
      setPanStartTime(Date.now());
      setHasMoved(false);
    } else if (touchCount === 2) {
      e.preventDefault();
      setIsDragging(false);
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      setLastTouchDistance(distance);
      setLastTouchCenter(center);
    }
  }, [pan, getTouchDistance, getTouchCenter, shouldAllowPanning]);

  const handlePlayerDragStart = useCallback((playerId: string, e: React.MouseEvent | React.TouchEvent) => {
    if (isDrawingMode) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const player = players.find(p => p.id === playerId);
    if (player) {
      const container = containerRef.current;
      if (container) {
        // Use transform-based positioning for both orientations
        const rect = container.getBoundingClientRect();
        const playerSvgX = PITCH_LEFT + (player.position.x / 100) * PITCH_WIDTH;
        const playerSvgY = PITCH_TOP + (player.position.y / 100) * PITCH_HEIGHT;
        const playerScreenX = rect.left + (playerSvgX * zoom) + pan.x;
        const playerScreenY = rect.top + (playerSvgY * zoom) + pan.y;
        
        setDragOffset({
          x: clientX - playerScreenX,
          y: clientY - playerScreenY
        });
      }
    }
    
    setDraggedPlayer(playerId);
    setIsDragging(false);
  }, [players, pan, zoom, PITCH_WIDTH, PITCH_HEIGHT, PITCH_LEFT, PITCH_TOP, isDrawingMode]);

  const handleBallDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isDrawingMode) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const container = containerRef.current;
    if (container) {
      // Use transform-based positioning for both orientations
      const rect = container.getBoundingClientRect();
      const ballSvgX = PITCH_LEFT + (soccerBall.position.x / 100) * PITCH_WIDTH;
      const ballSvgY = PITCH_TOP + (soccerBall.position.y / 100) * PITCH_HEIGHT;
      const ballScreenX = rect.left + (ballSvgX * zoom) + pan.x;
      const ballScreenY = rect.top + (ballSvgY * zoom) + pan.y;
      
      setDragOffset({
        x: clientX - ballScreenX,
        y: clientY - ballScreenY
      });
    }
    
    setDraggedBall(true);
    setIsDragging(false);
  }, [soccerBall, pan, zoom, PITCH_WIDTH, PITCH_HEIGHT, PITCH_LEFT, PITCH_TOP, isDrawingMode]);

  const handlePlayerDrag = useCallback((playerId: string, clientX: number, clientY: number) => {
    if (draggedPlayer !== playerId) return;
    
    const adjustedX = clientX - dragOffset.x;
    const adjustedY = clientY - dragOffset.y;
    
    const position = convertMouseToPercentage(adjustedX, adjustedY);
    const snappedPosition = snapToGridPosition(position.x, position.y);
    onPlayerMove(playerId, snappedPosition);
  }, [draggedPlayer, dragOffset, convertMouseToPercentage, snapToGridPosition, onPlayerMove]);

  const handleBallDrag = useCallback((clientX: number, clientY: number) => {
    if (!draggedBall) return;
    
    const adjustedX = clientX - dragOffset.x;
    const adjustedY = clientY - dragOffset.y;
    
    const position = convertMouseToPercentage(adjustedX, adjustedY);
    const snappedPosition = snapToGridPosition(position.x, position.y);
    onBallMove(snappedPosition);
  }, [draggedBall, dragOffset, convertMouseToPercentage, snapToGridPosition, onBallMove]);

  const handleDrawingStart = useCallback(() => {
    setIsDrawingActive(true);
  }, []);

  const handleDrawingEnd = useCallback(() => {
    setIsDrawingActive(false);
  }, []);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggedPlayer) {
        handlePlayerDrag(draggedPlayer, e.clientX, e.clientY);
      } else if (draggedBall) {
        handleBallDrag(e.clientX, e.clientY);
      } else if (isDragging && !isDrawingMode && !isDrawingActive) {
        const newPan = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        };
        const constrainedPan = constrainPan(newPan);
        onPanChange(constrainedPan);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDraggedPlayer(null);
      setDraggedBall(false);
      setDragOffset({ x: 0, y: 0 });
      setHasMoved(false);
      setPanStartTime(0);
    };

    if (draggedPlayer || draggedBall || (isDragging && !isDrawingMode && !isDrawingActive)) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggedPlayer, draggedBall, isDragging, dragStart, constrainPan, onPanChange, handlePlayerDrag, handleBallDrag, isDrawingMode, isDrawingActive]);

  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (draggedPlayer && e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        handlePlayerDrag(draggedPlayer, touch.clientX, touch.clientY);
      } else if (draggedBall && e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        handleBallDrag(touch.clientX, touch.clientY);
      } else if (isDragging && e.touches.length === 1 && !isDrawingMode && !isDrawingActive) {
        e.preventDefault();
        const touch = e.touches[0];
        const newPan = {
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y
        };
        const constrainedPan = constrainPan(newPan);
        onPanChange(constrainedPan);
      }
    };

    const handleGlobalTouchEnd = () => {
      setIsDragging(false);
      setDraggedPlayer(null);
      setDraggedBall(false);
      setDragOffset({ x: 0, y: 0 });
      setLastTouchDistance(0);
      setHasMoved(false);
      setPanStartTime(0);
    };

    if (draggedPlayer || draggedBall || (isDragging && !isDrawingMode && !isDrawingActive)) {
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }
    
    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [draggedPlayer, draggedBall, isDragging, dragStart, constrainPan, onPanChange, handlePlayerDrag, handleBallDrag, isDrawingMode, isDrawingActive]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isDrawingMode) return;
      
      e.preventDefault();
      
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(3, zoom + zoomDelta));
      
      if (newZoom !== zoom) {
        const zoomRatio = newZoom / zoom;
        const newPan = {
          x: mouseX - (mouseX - pan.x) * zoomRatio,
          y: mouseY - (mouseY - pan.y) * zoomRatio
        };
        
        const constrainedPan = constrainPan(newPan);
        onZoomChange(newZoom);
        onPanChange(constrainedPan);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [zoom, pan, onPanChange, onZoomChange, constrainPan, isDrawingMode]);

  useEffect(() => {
    const constrainedPan = constrainPan(pan);
    if (constrainedPan.x !== pan.x || constrainedPan.y !== pan.y) {
      onPanChange(constrainedPan);
    }
  }, [zoom, pan, constrainPan, onPanChange]);

  // Render pitch markings
  const renderPitchMarkings = () => {
    const strokeWidth = teamSize === 7 ? "2.5" : teamSize === 9 ? "2.8" : "3";
    
    if (isPortrait) {
      return (
        <g stroke="#ffffff" strokeWidth={strokeWidth} fill="none">
          <rect x={PITCH_LEFT} y={PITCH_TOP} width={PITCH_WIDTH} height={PITCH_HEIGHT} />
          <line x1={PITCH_LEFT + PITCH_WIDTH/2} y1={PITCH_TOP} x2={PITCH_LEFT + PITCH_WIDTH/2} y2={PITCH_TOP + PITCH_HEIGHT} />
          <circle cx={PITCH_LEFT + PITCH_WIDTH/2} cy={PITCH_TOP + PITCH_HEIGHT/2} r={80 * pitchScale} />
          <circle cx={PITCH_LEFT + PITCH_WIDTH/2} cy={PITCH_TOP + PITCH_HEIGHT/2} r="2" fill="#ffffff" />
          
          <rect x={PITCH_LEFT + PITCH_WIDTH*0.26} y={PITCH_TOP} width={PITCH_WIDTH*0.48} height={PITCH_HEIGHT*0.17} />
          <rect x={PITCH_LEFT + PITCH_WIDTH*0.26} y={PITCH_TOP + PITCH_HEIGHT*0.83} width={PITCH_WIDTH*0.48} height={PITCH_HEIGHT*0.17} />
          
          <rect x={PITCH_LEFT + PITCH_WIDTH*0.36} y={PITCH_TOP} width={PITCH_WIDTH*0.28} height={PITCH_HEIGHT*0.07} />
          <rect x={PITCH_LEFT + PITCH_WIDTH*0.36} y={PITCH_TOP + PITCH_HEIGHT*0.93} width={PITCH_WIDTH*0.28} height={PITCH_HEIGHT*0.07} />
          
          <circle cx={PITCH_LEFT + PITCH_WIDTH/2} cy={PITCH_TOP + PITCH_HEIGHT*0.24} r="2" fill="#ffffff" />
          <circle cx={PITCH_LEFT + PITCH_WIDTH/2} cy={PITCH_TOP + PITCH_HEIGHT*0.76} r="2" fill="#ffffff" />
          
          <path d={`M ${PITCH_LEFT + PITCH_WIDTH*0.34} ${PITCH_TOP + PITCH_HEIGHT*0.24} A ${80 * pitchScale} ${80 * pitchScale} 0 0 1 ${PITCH_LEFT + PITCH_WIDTH*0.66} ${PITCH_TOP + PITCH_HEIGHT*0.24}`} />
          <path d={`M ${PITCH_LEFT + PITCH_WIDTH*0.34} ${PITCH_TOP + PITCH_HEIGHT*0.76} A ${80 * pitchScale} ${80 * pitchScale} 0 0 0 ${PITCH_LEFT + PITCH_WIDTH*0.66} ${PITCH_TOP + PITCH_HEIGHT*0.76}`} />
          
          <path d={`M ${PITCH_LEFT + 20} ${PITCH_TOP} A 20 20 0 0 1 ${PITCH_LEFT} ${PITCH_TOP + 20}`} />
          <path d={`M ${PITCH_LEFT} ${PITCH_TOP + PITCH_HEIGHT - 20} A 20 20 0 0 1 ${PITCH_LEFT + 20} ${PITCH_TOP + PITCH_HEIGHT}`} />
          <path d={`M ${PITCH_LEFT + PITCH_WIDTH - 20} ${PITCH_TOP + PITCH_HEIGHT} A 20 20 0 0 1 ${PITCH_LEFT + PITCH_WIDTH} ${PITCH_TOP + PITCH_HEIGHT - 20}`} />
          <path d={`M ${PITCH_LEFT + PITCH_WIDTH} ${PITCH_TOP + 20} A 20 20 0 0 1 ${PITCH_LEFT + PITCH_WIDTH - 20} ${PITCH_TOP}`} />
          
          <rect x={PITCH_LEFT + PITCH_WIDTH*0.46} y={PITCH_TOP - 20} width={PITCH_WIDTH*0.08} height="20" stroke="#ffffff" strokeWidth="2" fill="none" />
          <rect x={PITCH_LEFT + PITCH_WIDTH*0.46} y={PITCH_TOP + PITCH_HEIGHT} width={PITCH_WIDTH*0.08} height="20" stroke="#ffffff" strokeWidth="2" fill="none" />
        </g>
      );
    } else {
      return (
        <g stroke="#ffffff" strokeWidth={strokeWidth} fill="none">
          <rect x={PITCH_LEFT} y={PITCH_TOP} width={PITCH_WIDTH} height={PITCH_HEIGHT} />
          <line x1={PITCH_LEFT} y1={PITCH_TOP + PITCH_HEIGHT/2} x2={PITCH_LEFT + PITCH_WIDTH} y2={PITCH_TOP + PITCH_HEIGHT/2} />
          <circle cx={PITCH_LEFT + PITCH_WIDTH/2} cy={PITCH_TOP + PITCH_HEIGHT/2} r={80 * pitchScale} />
          <circle cx={PITCH_LEFT + PITCH_WIDTH/2} cy={PITCH_TOP + PITCH_HEIGHT/2} r="2" fill="#ffffff" />
          
          <rect x={PITCH_LEFT} y={PITCH_TOP + PITCH_HEIGHT*0.26} width={PITCH_WIDTH*0.17} height={PITCH_HEIGHT*0.48} />
          <rect x={PITCH_LEFT + PITCH_WIDTH*0.83} y={PITCH_TOP + PITCH_HEIGHT*0.26} width={PITCH_WIDTH*0.17} height={PITCH_HEIGHT*0.48} />
          
          <rect x={PITCH_LEFT} y={PITCH_TOP + PITCH_HEIGHT*0.36} width={PITCH_WIDTH*0.07} height={PITCH_HEIGHT*0.28} />
          <rect x={PITCH_LEFT + PITCH_WIDTH*0.93} y={PITCH_TOP + PITCH_HEIGHT*0.36} width={PITCH_WIDTH*0.07} height={PITCH_HEIGHT*0.28} />
          
          <circle cx={PITCH_LEFT + PITCH_WIDTH*0.24} cy={PITCH_TOP + PITCH_HEIGHT/2} r="2" fill="#ffffff" />
          <circle cx={PITCH_LEFT + PITCH_WIDTH*0.76} cy={PITCH_TOP + PITCH_HEIGHT/2} r="2" fill="#ffffff" />
          
          <path d={`M ${PITCH_LEFT + PITCH_WIDTH*0.24} ${PITCH_TOP + PITCH_HEIGHT*0.34} A ${80 * pitchScale} ${80 * pitchScale} 0 0 1 ${PITCH_LEFT + PITCH_WIDTH*0.24} ${PITCH_TOP + PITCH_HEIGHT*0.66}`} />
          <path d={`M ${PITCH_LEFT + PITCH_WIDTH*0.76} ${PITCH_TOP + PITCH_HEIGHT*0.34} A ${80 * pitchScale} ${80 * pitchScale} 0 0 0 ${PITCH_LEFT + PITCH_WIDTH*0.76} ${PITCH_TOP + PITCH_HEIGHT*0.66}`} />
          
          <path d={`M ${PITCH_LEFT} ${PITCH_TOP + 20} A 20 20 0 0 1 ${PITCH_LEFT + 20} ${PITCH_TOP}`} />
          <path d={`M ${PITCH_LEFT + PITCH_WIDTH - 20} ${PITCH_TOP} A 20 20 0 0 1 ${PITCH_LEFT + PITCH_WIDTH} ${PITCH_TOP + 20}`} />
          <path d={`M ${PITCH_LEFT + PITCH_WIDTH} ${PITCH_TOP + PITCH_HEIGHT - 20} A 20 20 0 0 1 ${PITCH_LEFT + PITCH_WIDTH - 20} ${PITCH_TOP + PITCH_HEIGHT}`} />
          <path d={`M ${PITCH_LEFT + 20} ${PITCH_TOP + PITCH_HEIGHT} A 20 20 0 0 1 ${PITCH_LEFT} ${PITCH_TOP + PITCH_HEIGHT - 20}`} />
          
          <rect x={PITCH_LEFT - 20} y={PITCH_TOP + PITCH_HEIGHT*0.46} width="20" height={PITCH_HEIGHT*0.08} stroke="#ffffff" strokeWidth="2" fill="none" />
          <rect x={PITCH_LEFT + PITCH_WIDTH} y={PITCH_TOP + PITCH_HEIGHT*0.46} width="20" height={PITCH_HEIGHT*0.08} stroke="#ffffff" strokeWidth="2" fill="none" />
        </g>
      );
    }
  };

  // Render grass stripes
  const renderGrassBackground = () => {
    // Standard vertical stripes for both orientations
    return Array.from({ length: Math.ceil(SVG_HEIGHT / 40) }, (_, i) => (
      <rect
        key={i}
        x="0"
        y={i * 40}
        width={SVG_WIDTH}
        height="40"
        fill={i % 2 === 0 ? '#16a34a' : '#15803d'}
        opacity="0.3"
      />
    ));
  };

  // Calculate SVG viewBox and dimensions
  const svgViewBox = `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`;
  const svgWidth = SVG_WIDTH;
  const svgHeight = SVG_HEIGHT;

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-gradient-to-r from-pitch-light to-pitch-dark overflow-hidden rounded-lg touch-none transition-all duration-150 ease-out`}
      onMouseDown={handleContainerMouseDown}
      onTouchStart={handleContainerTouchStart}
    >
      <svg
        ref={svgRef}
        viewBox={svgViewBox}
        className={`w-full h-full select-none ${
          isDrawingMode 
            ? 'cursor-crosshair' 
            : draggedPlayer || draggedBall 
              ? 'cursor-default' 
              : isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
        }`}
        style={{
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transformOrigin: '0 0'
        }}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <defs>
          <linearGradient id="pitchGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="50%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
        </defs>
        
        {/* Background layer with grass */}
        <g className="grass-layer">
          <rect width={svgWidth} height={svgHeight} fill="url(#pitchGradient)" />
          {renderGrassBackground()}
        </g>
        
        {/* Pitch markings and players */}
        <g className="pitch-layer">
          {renderPitchMarkings()}
          
          {snapToGrid && (
            <g stroke="#ffffff" strokeWidth="0.5" opacity="0.3">
              {Array.from({ length: 21 }, (_, i) => (
                <line 
                  key={`v${i}`} 
                  x1={PITCH_LEFT + (i * PITCH_WIDTH / 20)} 
                  y1={PITCH_TOP} 
                  x2={PITCH_LEFT + (i * PITCH_WIDTH / 20)} 
                  y2={PITCH_TOP + PITCH_HEIGHT} 
                />
              ))}
              {Array.from({ length: 21 }, (_, i) => (
                <line 
                  key={`h${i}`} 
                  x1={PITCH_LEFT} 
                  y1={PITCH_TOP + (i * PITCH_HEIGHT / 20)} 
                  x2={PITCH_LEFT + PITCH_WIDTH} 
                  y2={PITCH_TOP + (i * PITCH_HEIGHT / 20)} 
                />
              ))}
            </g>
          )}
          
          {/* Soccer Ball */}
          <SoccerBallComponent
            position={soccerBall.position}
            onDragStart={handleBallDragStart}
            isDragging={draggedBall}
            orientation={orientation}
            teamSize={teamSize}
          />
          
          {/* Players */}
          {players.map((player) => (
            <PlayerChip
              key={player.id}
              player={player}
              onDragStart={(e) => handlePlayerDragStart(player.id, e)}
              isDragging={draggedPlayer === player.id}
              orientation={orientation}
              teamSize={teamSize}
            />
          ))}
        </g>
      </svg>
      
      {/* Drawing Layer */}
      <DrawingLayer
        elements={drawingElements}
        onElementsChange={onDrawingElementsChange}
        isDrawingMode={isDrawingMode}
        drawingTool={drawingTool}
        zoom={zoom}
        pan={pan}
        orientation={orientation}
        teamSize={teamSize}
        onDrawingStart={handleDrawingStart}
        onDrawingEnd={handleDrawingEnd}
      />
    </div>
  );
}
