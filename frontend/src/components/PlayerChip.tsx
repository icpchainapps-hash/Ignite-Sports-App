import { Player, TeamSize } from './PitchBoard';
import { useResponsive } from '../hooks/useResponsive';
import { ROLE_COLORS, ROLE_ABBREVIATIONS } from '../lib/constants';
import { percentageToSVG, getResponsiveSizing } from '../lib/pitch-utils';

interface PlayerChipProps {
  player: Player;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  isDragging: boolean;
  orientation: 'portrait' | 'landscape';
  teamSize: TeamSize;
}

export default function PlayerChip({ player, onDragStart, isDragging, orientation, teamSize }: PlayerChipProps) {
  const { isMobile } = useResponsive();
  
  const { x, y } = percentageToSVG(player.position, orientation, teamSize);
  const { sizeScale, playerRadius, fontSize, labelFontSize } = getResponsiveSizing(teamSize, isMobile);
  
  const color = ROLE_COLORS[player.role];
  const abbreviation = ROLE_ABBREVIATIONS[player.role];

  // Dynamic font sizing based on name length
  const nameLength = player.name.length;
  let adjustedFontSize = fontSize;
  if (nameLength > 8) {
    adjustedFontSize = fontSize * 0.8;
  } else if (nameLength > 6) {
    adjustedFontSize = fontSize * 0.9;
  }

  // ALL players face exactly 90 degrees clockwise for consistent team orientation
  const facingAngle = 90;

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
          r={playerRadius + 8}
          fill="transparent"
          className="pointer-events-auto"
        />
      )}
      
      {/* Main player chip group with 90-degree clockwise rotation */}
      <g transform={`translate(${x}, ${y}) rotate(${facingAngle})`}>
        {/* Jersey/Chip Background */}
        <circle
          cx="0"
          cy="0"
          r={playerRadius}
          fill={color}
          stroke="#ffffff"
          strokeWidth="2"
          className="drop-shadow-lg pointer-events-auto"
          style={{
            filter: isDragging ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
            transform: isDragging ? 'scale(1.15)' : 'scale(1)'
          }}
        />
        
        {/* Special goalkeeper jersey pattern */}
        {player.role === 'goalkeeper' && (
          <g>
            <defs>
              <pattern id={`gkPattern-${player.id}`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                <rect width="4" height="8" fill="#ffffff" opacity="0.25" />
              </pattern>
            </defs>
            <circle
              cx="0"
              cy="0"
              r={playerRadius - 2}
              fill={`url(#gkPattern-${player.id})`}
              className="pointer-events-none"
            />
          </g>
        )}
        
        {/* Player Name - rotated back to be readable */}
        <text
          x="0"
          y="3"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={adjustedFontSize}
          fontWeight="bold"
          className="pointer-events-none select-none"
          transform={`rotate(${-facingAngle})`}
          style={{ 
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            letterSpacing: nameLength > 6 ? '-0.5px' : '0px'
          }}
        >
          {player.name}
        </text>
        
        {/* Role indicator - rotated back to be readable */}
        <g transform={`rotate(${-facingAngle})`}>
          <rect
            x={-(isMobile ? 18 : 15) * sizeScale}
            y={(isMobile ? 30 : 25) * sizeScale}
            width={(isMobile ? 36 : 30) * sizeScale}
            height={(isMobile ? 14 : 12) * sizeScale}
            rx={(isMobile ? 7 : 6) * sizeScale}
            fill={color}
            opacity="0.95"
            stroke="#ffffff"
            strokeWidth="1"
            className="pointer-events-none"
          />
          <text
            x="0"
            y={(isMobile ? 37 : 31) * sizeScale}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize={labelFontSize}
            fontWeight="bold"
            className="pointer-events-none select-none"
            style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.6)' }}
          >
            {abbreviation}
          </text>
        </g>
      </g>
      
      {/* Player Number and Role tooltip */}
      <title>
        {`${player.name} (#${player.number}) - ${abbreviation}`}
      </title>
    </g>
  );
}
