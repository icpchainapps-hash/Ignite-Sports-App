import { TeamSize } from './PitchBoard';
import { useResponsive } from '../hooks/useResponsive';
import { percentageToSVG, getResponsiveSizing } from '../lib/pitch-utils';

interface SoccerBallProps {
  position: { x: number; y: number };
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  isDragging: boolean;
  orientation: 'portrait' | 'landscape';
  teamSize: TeamSize;
}

export default function SoccerBall({ position, onDragStart, isDragging, orientation, teamSize }: SoccerBallProps) {
  const { isMobile } = useResponsive();
  
  const { x, y } = percentageToSVG(position, orientation, teamSize);
  const { ballRadius } = getResponsiveSizing(teamSize, isMobile);

  const handleMouseDown = (e: React.MouseEvent) => {
    onDragStart(e);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    onDragStart(e);
  };

  return (
    <g
      className="cursor-move select-none touch-none"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ 
        opacity: isDragging ? 0.8 : 1,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
      }}
    >
      {/* Larger touch area for mobile */}
      {isMobile && (
        <circle
          cx={x}
          cy={y}
          r={ballRadius + 8}
          fill="transparent"
          className="pointer-events-auto"
        />
      )}
      
      {/* Soccer ball */}
      <g>
        {/* Ball shadow */}
        <ellipse
          cx={x + 2}
          cy={y + 2}
          rx={ballRadius}
          ry={ballRadius * 0.8}
          fill="rgba(0,0,0,0.3)"
          className="pointer-events-none"
        />
        
        {/* Main ball */}
        <circle
          cx={x}
          cy={y}
          r={ballRadius}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="1.5"
          className="drop-shadow-lg pointer-events-auto"
          style={{
            filter: isDragging ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
            transform: isDragging ? 'scale(1.1)' : 'scale(1)'
          }}
        />
        
        {/* Soccer ball pattern */}
        <g className="pointer-events-none">
          {/* Pentagon in center */}
          <polygon
            points={`${x},${y-ballRadius*0.4} ${x+ballRadius*0.38},${y-ballRadius*0.12} ${x+ballRadius*0.24},${y+ballRadius*0.32} ${x-ballRadius*0.24},${y+ballRadius*0.32} ${x-ballRadius*0.38},${y-ballRadius*0.12}`}
            fill="#000000"
            stroke="none"
          />
          
          {/* Curved lines */}
          <path
            d={`M ${x-ballRadius*0.6} ${y-ballRadius*0.3} Q ${x-ballRadius*0.2} ${y-ballRadius*0.6} ${x+ballRadius*0.2} ${y-ballRadius*0.3}`}
            stroke="#000000"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d={`M ${x-ballRadius*0.4} ${y+ballRadius*0.5} Q ${x} ${y+ballRadius*0.2} ${x+ballRadius*0.4} ${y+ballRadius*0.5}`}
            stroke="#000000"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d={`M ${x-ballRadius*0.7} ${y+ballRadius*0.1} Q ${x-ballRadius*0.3} ${y+ballRadius*0.4} ${x-ballRadius*0.1} ${y+ballRadius*0.7}`}
            stroke="#000000"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d={`M ${x+ballRadius*0.1} ${y+ballRadius*0.7} Q ${x+ballRadius*0.3} ${y+ballRadius*0.4} ${x+ballRadius*0.7} ${y+ballRadius*0.1}`}
            stroke="#000000"
            strokeWidth="1.5"
            fill="none"
          />
        </g>
      </g>
      
      {/* Ball tooltip */}
      <title>Soccer Ball</title>
    </g>
  );
}
