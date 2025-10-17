/**
 * Pure function to compute minimum substitution rounds required
 * 
 * This function calculates the minimum number of substitution rounds (R) needed
 * to ensure all players get both on-field and bench time, given the constraints.
 * 
 * UPDATED FORMULA: minRounds = ceil(totalPlayers / maxSubsPerRound)
 * This ensures all players (field + bench) are included in the rotation.
 * 
 * It performs NO schedule generation - only computation and validation.
 */

export interface MinSubRoundsResult {
  R: number;
  stintMinutes: number;
  details: {
    totalPlayers: number;
    onField: number;
    gameMinutes: number;
    maxSubsPerRound: number;
    targetMinutesPerPlayer: number;
    lockedOnFieldCount: number;
    lockedOffFieldCount: number;
    benchSize: number;
    totalFieldMinutes: number;
    totalBenchMinutes: number;
    minRounds: number;
    minStintMinutes: number;
    isFeasible: boolean;
    errorMessage?: string;
  };
}

/**
 * Compute minimum substitution rounds required
 * 
 * @param totalPlayers - Total number of players in the squad
 * @param onField - Number of players on field at any time
 * @param gameMinutes - Total game duration in minutes
 * @param maxSubsPerRound - Maximum substitutions allowed per round
 * @param targetMinutesPerPlayer - Optional target minutes per player (calculated if not provided)
 * @param lockedOnFieldCount - Optional number of players locked on field
 * @param lockedOffFieldCount - Optional number of players locked off field
 * @returns MinSubRoundsResult with R, stintMinutes, and detailed diagnostics
 */
export function computeMinSubRounds(
  totalPlayers: number,
  onField: number,
  gameMinutes: number,
  maxSubsPerRound: number,
  targetMinutesPerPlayer?: number,
  lockedOnFieldCount?: number,
  lockedOffFieldCount?: number
): MinSubRoundsResult {
  // Default locked counts to 0 if not provided
  const lockedOn = lockedOnFieldCount ?? 0;
  const lockedOff = lockedOffFieldCount ?? 0;

  // Calculate derived values
  const benchSize = totalPlayers > onField ? totalPlayers - onField : 0;
  const totalFieldMinutes = gameMinutes * onField;
  const totalBenchMinutes = gameMinutes * benchSize;

  // Calculate target minutes per player if not provided
  const targetMinutes = targetMinutesPerPlayer ?? 
    (totalPlayers > 0 ? (gameMinutes * onField) / totalPlayers : 0);

  // Initialize result structure
  let isFeasible = true;
  let errorMessage: string | undefined;
  let minRounds = 0;
  let minStintMinutes = 0;

  // ERROR CHECK 1: Total players cannot be less than on-field players
  if (totalPlayers < onField) {
    isFeasible = false;
    errorMessage = 'Total players cannot be less than on-field players';
  }
  // ERROR CHECK 2: Number of on-field players must be greater than 0
  else if (onField === 0) {
    isFeasible = false;
    errorMessage = 'Number of on-field players must be greater than 0';
  }
  // ERROR CHECK 3: Game minutes must be greater than 0
  else if (gameMinutes === 0) {
    isFeasible = false;
    errorMessage = 'Game minutes must be greater than 0';
  }
  // ERROR CHECK 4: Max substitutions per round must be greater than 0
  else if (maxSubsPerRound === 0) {
    isFeasible = false;
    errorMessage = 'Max substitutions per round must be greater than 0';
  }
  // ERROR CHECK 5: Locked on-field players cannot exceed total on-field players
  else if (lockedOn > onField) {
    isFeasible = false;
    errorMessage = 'Locked on-field players cannot exceed total on-field players';
  }
  // ERROR CHECK 6: Locked off-field players cannot exceed bench size
  else if (lockedOff > benchSize) {
    isFeasible = false;
    errorMessage = 'Locked off-field players cannot exceed bench size';
  }
  // FEASIBILITY CALCULATION: Calculate minimum rounds if all checks pass
  else {
    // Calculate minimum rounds based on TOTAL PLAYERS (field + bench)
    // Formula: R = ceil(totalPlayers / maxSubsPerRound)
    // This ensures all players are included in the rotation
    if (benchSize > 0 && maxSubsPerRound > 0 && totalPlayers > 0) {
      minRounds = Math.ceil(totalPlayers / maxSubsPerRound);
      
      // Calculate minimum stint minutes
      // Formula: stintMinutes = gameMinutes / R
      if (minRounds > 0) {
        minStintMinutes = gameMinutes / minRounds;
        
        // ERROR CHECK 7: Minimum stint minutes cannot exceed game minutes
        if (minStintMinutes > gameMinutes) {
          isFeasible = false;
          errorMessage = 'Minimum stint minutes cannot exceed game minutes';
          minRounds = 0;
          minStintMinutes = 0;
        }
      } else {
        // ERROR CHECK 8: Minimum rounds cannot be 0 when bench size is greater than 0
        isFeasible = false;
        errorMessage = 'Minimum rounds cannot be 0 when bench size is greater than 0';
      }
    } else if (benchSize === 0) {
      // No bench players - no substitutions needed
      minRounds = 0;
      minStintMinutes = 0;
    } else {
      // maxSubsPerRound is 0 but benchSize > 0
      isFeasible = false;
      errorMessage = 'Cannot schedule substitutions with maxSubsPerRound = 0 and bench players present';
    }
  }

  // Return complete result
  return {
    R: minRounds,
    stintMinutes: minStintMinutes,
    details: {
      totalPlayers,
      onField,
      gameMinutes,
      maxSubsPerRound,
      targetMinutesPerPlayer: targetMinutes,
      lockedOnFieldCount: lockedOn,
      lockedOffFieldCount: lockedOff,
      benchSize,
      totalFieldMinutes,
      totalBenchMinutes,
      minRounds,
      minStintMinutes,
      isFeasible,
      errorMessage,
    },
  };
}
