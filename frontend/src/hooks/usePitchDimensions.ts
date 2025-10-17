import { useMemo } from 'react';
import { TeamSize } from '../components/PitchBoard';
import { getPitchDimensions } from '../lib/pitch-utils';

export function usePitchDimensions(orientation: 'portrait' | 'landscape', teamSize: TeamSize) {
  return useMemo(() => {
    return getPitchDimensions(orientation, teamSize);
  }, [orientation, teamSize]);
}
