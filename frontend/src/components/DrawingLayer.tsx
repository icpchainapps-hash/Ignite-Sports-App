import { useRef, useCallback, useState, useEffect } from 'react';
import { getPitchDimensions } from '../lib/pitch-utils';

export interface DrawingElement {
  id: string;
  type: 'arrow' | 'freehand';
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

interface DrawingLayerProps {
  elements: DrawingElement[];
  onElementsChange: (elements: DrawingElement[]) => void;
  isDrawingMode: boolean;
  drawingTool: 'arrow' | 'freehand';
  zoom: number;
  pan: { x: number; y: number };
  orientation: 'portrait' | 'landscape';
  teamSize: 7 | 9 | 11;
  onDrawingStart?: () => void;
  onDrawingEnd?: () => void;
}

export default function DrawingLayer({
  elements,
  onElementsChange,
  isDrawingMode,
  drawingTool,
  zoom,
  pan,
  orientation,
  teamSize,
  onDrawingStart,
  onDrawingEnd
}: DrawingLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  // Get pitch dimensions using the same utility as SoccerPitch
  const { PITCH_WIDTH, PITCH_HEIGHT, PITCH_LEFT, PITCH_TOP, SVG_WIDTH, SVG_HEIGHT } = 
    getPitchDimensions(orientation, teamSize);

  // Convert screen coordinates to SVG coordinates using the exact same transform as the pitch
  const convertScreenToSVG = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) {
      console.warn('[DrawingLayer] SVG ref not available');
      return { x: 0, y: 0 };
    }

    // Use SVG's built-in coordinate conversion for perfect accuracy
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    
    // Get the screen CTM (Current Transformation Matrix) and invert it
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      console.warn('[DrawingLayer] Could not get screen CTM');
      return { x: 0, y: 0 };
    }
    
    // Transform screen coordinates to SVG coordinates
    const svgPoint = point.matrixTransform(ctm.inverse());
    
    return { x: svgPoint.x, y: svgPoint.y };
  }, []);

  const isPointInPitch = useCallback((point: { x: number; y: number }) => {
    const inPitch = point.x >= PITCH_LEFT && 
                    point.x <= PITCH_LEFT + PITCH_WIDTH && 
                    point.y >= PITCH_TOP && 
                    point.y <= PITCH_TOP + PITCH_HEIGHT;
    
    return inPitch;
  }, [PITCH_WIDTH, PITCH_HEIGHT, PITCH_LEFT, PITCH_TOP]);

  const startDrawing = useCallback((clientX: number, clientY: number) => {
    if (!isDrawingMode) return;
    
    const point = convertScreenToSVG(clientX, clientY);
    
    if (!isPointInPitch(point)) return;
    
    setIsDrawing(true);
    setLastPoint(point);
    onDrawingStart?.();
    
    const newElement: DrawingElement = {
      id: Date.now().toString(),
      type: drawingTool,
      points: [point],
      color: '#ffffff',
      strokeWidth: 3
    };
    
    setCurrentElement(newElement);
  }, [isDrawingMode, drawingTool, convertScreenToSVG, isPointInPitch, onDrawingStart]);

  const continueDrawing = useCallback((clientX: number, clientY: number) => {
    if (!isDrawing || !currentElement || !isDrawingMode) return;
    
    const point = convertScreenToSVG(clientX, clientY);
    
    if (!isPointInPitch(point)) return;
    
    if (drawingTool === 'arrow') {
      setCurrentElement(prev => prev ? {
        ...prev,
        points: [prev.points[0], point]
      } : null);
    } else if (drawingTool === 'freehand') {
      if (lastPoint) {
        const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
        if (distance > 3) {
          setCurrentElement(prev => prev ? {
            ...prev,
            points: [...prev.points, point]
          } : null);
          setLastPoint(point);
        }
      }
    }
  }, [isDrawing, currentElement, isDrawingMode, drawingTool, convertScreenToSVG, isPointInPitch, lastPoint]);

  const endDrawing = useCallback(() => {
    if (!isDrawing || !currentElement) return;
    
    setIsDrawing(false);
    setLastPoint(null);
    onDrawingEnd?.();
    
    if ((drawingTool === 'arrow' && currentElement.points.length >= 2) ||
        (drawingTool === 'freehand' && currentElement.points.length >= 2)) {
      onElementsChange([...elements, currentElement]);
    }
    
    setCurrentElement(null);
  }, [isDrawing, currentElement, drawingTool, elements, onElementsChange, onDrawingEnd]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startDrawing(e.clientX, e.clientY);
  }, [startDrawing]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    continueDrawing(e.clientX, e.clientY);
  }, [continueDrawing]);

  const handlePointerUp = useCallback(() => {
    endDrawing();
  }, [endDrawing]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isDrawingMode || e.touches.length !== 1) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    startDrawing(touch.clientX, touch.clientY);
  }, [isDrawingMode, startDrawing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDrawing || !isDrawingMode || e.touches.length !== 1) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    continueDrawing(touch.clientX, touch.clientY);
  }, [isDrawing, isDrawingMode, continueDrawing]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    endDrawing();
  }, [isDrawing, endDrawing]);

  // Render arrow with arrowhead
  const renderArrow = (element: DrawingElement) => {
    if (element.points.length < 2) return null;
    
    const start = element.points[0];
    const end = element.points[element.points.length - 1];
    
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowLength = 15;
    const arrowAngle = Math.PI / 6;
    
    const arrowHead1 = {
      x: end.x - arrowLength * Math.cos(angle - arrowAngle),
      y: end.y - arrowLength * Math.sin(angle - arrowAngle)
    };
    
    const arrowHead2 = {
      x: end.x - arrowLength * Math.cos(angle + arrowAngle),
      y: end.y - arrowLength * Math.sin(angle + arrowAngle)
    };
    
    return (
      <g key={element.id}>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          strokeLinecap="round"
        />
        <polygon
          points={`${end.x},${end.y} ${arrowHead1.x},${arrowHead1.y} ${arrowHead2.x},${arrowHead2.y}`}
          fill={element.color}
        />
      </g>
    );
  };

  // Render freehand line
  const renderFreehand = (element: DrawingElement) => {
    if (element.points.length < 2) return null;
    
    const pathData = element.points.reduce((path, point, index) => {
      return index === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`;
    }, '');
    
    return (
      <path
        key={element.id}
        d={pathData}
        stroke={element.color}
        strokeWidth={element.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  };

  const svgViewBox = `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full ${isDrawingMode ? 'pointer-events-auto' : 'pointer-events-none'} touch-none`}
      style={{ zIndex: isDrawingMode ? 10 : 1 }}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox={svgViewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transformOrigin: '0 0'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {elements.map(element => 
          element.type === 'arrow' ? renderArrow(element) : renderFreehand(element)
        )}
        
        {currentElement && (
          currentElement.type === 'arrow' ? renderArrow(currentElement) : renderFreehand(currentElement)
        )}
      </svg>
    </div>
  );
}
