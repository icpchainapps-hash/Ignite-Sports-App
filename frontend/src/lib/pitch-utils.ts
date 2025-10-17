import { TeamSize, PitchOrientation } from '../components/PitchBoard';

// Pitch dimension utilities with enhanced positioning for optimal screen usage
export function getPitchDimensions(orientation: PitchOrientation, teamSize: TeamSize) {
  const isPortrait = orientation === 'portrait';
  const pitchScale = teamSize === 7 ? 0.85 : teamSize === 9 ? 0.92 : 1.0;
  
  if (isPortrait) {
    // Portrait mode: optimize for vertical layout
    const PITCH_WIDTH = 500 * pitchScale;
    const PITCH_HEIGHT = 700 * pitchScale;
    const PITCH_LEFT = 50;
    const PITCH_TOP = 10;
    const SVG_WIDTH = 600;
    const SVG_HEIGHT = PITCH_HEIGHT + 20;
    
    return {
      PITCH_WIDTH,
      PITCH_HEIGHT,
      PITCH_LEFT,
      PITCH_TOP,
      SVG_WIDTH,
      SVG_HEIGHT,
      pitchScale,
      isPortrait
    };
  } else {
    // Landscape mode: optimize for horizontal layout with full vertical fill
    const PITCH_WIDTH = 700 * pitchScale;
    const PITCH_HEIGHT = 500 * pitchScale;
    const PITCH_LEFT = 50;
    const PITCH_TOP = 0;
    const SVG_WIDTH = 800;
    const SVG_HEIGHT = PITCH_HEIGHT;
    
    return {
      PITCH_WIDTH,
      PITCH_HEIGHT,
      PITCH_LEFT,
      PITCH_TOP,
      SVG_WIDTH,
      SVG_HEIGHT,
      pitchScale,
      isPortrait
    };
  }
}

// Convert percentage coordinates to SVG coordinates
export function percentageToSVG(
  position: { x: number; y: number },
  orientation: PitchOrientation,
  teamSize: TeamSize
) {
  const { PITCH_LEFT, PITCH_TOP, PITCH_WIDTH, PITCH_HEIGHT } = getPitchDimensions(orientation, teamSize);
  
  return {
    x: PITCH_LEFT + (position.x / 100) * PITCH_WIDTH,
    y: PITCH_TOP + (position.y / 100) * PITCH_HEIGHT
  };
}

// Get responsive sizing based on team size and mobile
export function getResponsiveSizing(teamSize: TeamSize, isMobile: boolean) {
  const sizeScale = teamSize === 7 ? 0.9 : teamSize === 9 ? 0.95 : 1.0;
  
  return {
    sizeScale,
    playerRadius: (isMobile ? 24 : 20) * sizeScale,
    ballRadius: (isMobile ? 12 : 10) * sizeScale,
    fontSize: (isMobile ? 11 : 9) * sizeScale,
    labelFontSize: (isMobile ? 9 : 8) * sizeScale
  };
}

// Get pitch height classes for responsive design - returns empty string for CSS-based sizing
export function getPitchHeightClass(orientation: PitchOrientation, isMobile: boolean) {
  // Return empty string to allow CSS grid to control sizing
  return '';
}

