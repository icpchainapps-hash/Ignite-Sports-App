import { Player, SoccerBall, TeamSize } from './PitchBoard';
import { useResponsive } from '../hooks/useResponsive';
import { ROLE_COLORS } from '../lib/constants';

interface MiniMapProps {
  players: Player[];
  soccerBall: SoccerBall;
  zoom: number;
  pan: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  orientation: 'portrait' | 'landscape';
  teamSize: TeamSize;
}

export default function MiniMap({ players, soccerBall, zoom, pan, onPanChange, orientation, teamSize }: MiniMapProps) {
  const { isMobile } = useResponsive();

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 4;
    const y = (e.clientY - rect.top - rect.height / 2) * 4;
    
    onPanChange({ x: -x, y: -y });
  };

  // Responsive sizing based on orientation and team size
  const isPortrait = orientation === 'portrait';
  const sizeScale = teamSize === 7 ? 0.9 : teamSize === 9 ? 0.95 : 1.0;
  
  const mapWidth = isPortrait 
    ? (isMobile ? 67 : 80) * sizeScale
    : (isMobile ? 100 : 120) * sizeScale;
  const mapHeight = isPortrait 
    ? (isMobile ? 100 : 120) * sizeScale
    : (isMobile ? 67 : 80) * sizeScale;
  const playerRadius = (isMobile ? 1.5 : 2) * sizeScale;
  const ballRadius = (isMobile ? 1 : 1.2) * sizeScale;

  // Render pitch markings based on orientation
  const renderPitchMarkings = () => {
    const strokeWidth = teamSize === 7 ? "0.4" : teamSize === 9 ? "0.45" : "0.5";
    
    if (isPortrait) {
      return (
        <g stroke="#ffffff" strokeWidth={strokeWidth} fill="none" opacity="0.6">
          <rect x={mapWidth * 0.063} y={mapHeight * 0.042} width={mapWidth * 0.875} height={mapHeight * 0.917} />
          <line x1={mapWidth * 0.5} y1={mapHeight * 0.042} x2={mapWidth * 0.5} y2={mapHeight * 0.958} />
          <circle cx={mapWidth * 0.5} cy={mapHeight * 0.5} r={mapWidth * 0.1 * sizeScale} />
          <rect x={mapWidth * 0.313} y={mapHeight * 0.042} width={mapWidth * 0.375} height={mapHeight * 0.15} />
          <rect x={mapWidth * 0.313} y={mapHeight * 0.808} width={mapWidth * 0.375} height={mapHeight * 0.15} />
        </g>
      );
    } else {
      return (
        <g stroke="#ffffff" strokeWidth={strokeWidth} fill="none" opacity="0.6">
          <rect x={mapWidth * 0.042} y={mapHeight * 0.063} width={mapWidth * 0.917} height={mapHeight * 0.875} />
          <line x1={mapWidth * 0.042} y1={mapHeight * 0.5} x2={mapWidth * 0.958} y2={mapHeight * 0.5} />
          <circle cx={mapWidth * 0.5} cy={mapHeight * 0.5} r={mapHeight * 0.1 * sizeScale} />
          <rect x={mapWidth * 0.042} y={mapHeight * 0.313} width={mapWidth * 0.15} height={mapHeight * 0.375} />
          <rect x={mapWidth * 0.808} y={mapHeight * 0.313} width={mapWidth * 0.15} height={mapHeight * 0.375} />
        </g>
      );
    }
  };

  return (
    <div className="bg-card/90 backdrop-blur-sm rounded-lg p-2 border shadow-lg">
      <div className="text-xs text-muted-foreground mb-1">Mini Map ({teamSize}v{teamSize})</div>
      <svg
        width={mapWidth}
        height={mapHeight}
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        className="cursor-pointer border rounded touch-manipulation"
        onClick={handleClick}
      >
        {/* Pitch background */}
        <rect width={mapWidth} height={mapHeight} fill="#16a34a" />
        
        {/* Pitch markings */}
        {renderPitchMarkings()}
        
        {/* Soccer Ball */}
        {(() => {
          const ballX = isPortrait
            ? mapWidth * 0.063 + (soccerBall.position.x / 100) * (mapWidth * 0.875)
            : mapWidth * 0.042 + (soccerBall.position.x / 100) * (mapWidth * 0.917);
          const ballY = isPortrait
            ? mapHeight * 0.042 + (soccerBall.position.y / 100) * (mapHeight * 0.917)
            : mapHeight * 0.063 + (soccerBall.position.y / 100) * (mapHeight * 0.875);
          
          return (
            <circle
              cx={ballX}
              cy={ballY}
              r={ballRadius}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="0.3"
            />
          );
        })()}
        
        {/* Players */}
        {players.map((player) => {
          const playerX = isPortrait
            ? mapWidth * 0.063 + (player.position.x / 100) * (mapWidth * 0.875)
            : mapWidth * 0.042 + (player.position.x / 100) * (mapWidth * 0.917);
          const playerY = isPortrait
            ? mapHeight * 0.042 + (player.position.y / 100) * (mapHeight * 0.917)
            : mapHeight * 0.063 + (player.position.y / 100) * (mapHeight * 0.875);
          
          return (
            <circle
              key={player.id}
              cx={playerX}
              cy={playerY}
              r={playerRadius}
              fill={ROLE_COLORS[player.role]}
              stroke="#ffffff"
              strokeWidth="0.5"
            />
          );
        })}
        
        {/* Viewport indicator */}
        <rect
          x={mapWidth * 0.5 - (mapWidth * 0.25) / zoom + pan.x / 10}
          y={mapHeight * 0.5 - (mapHeight * 0.25) / zoom + pan.y / 10}
          width={(mapWidth * 0.5) / zoom}
          height={(mapHeight * 0.5) / zoom}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}
